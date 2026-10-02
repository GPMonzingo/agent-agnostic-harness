import {AgentProvider} from './agent-provider.mjs';

const approvalMethods = ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'];
const inputMethod = 'item/tool/requestUserInput';
const publicItem = item => {
  if (item.type === 'agentMessage') return {id:item.id, role:'assistant', text:item.text};
  if (item.type === 'userMessage') return {id:item.id, role:'user', text:item.content.filter(x=>x.type==='text').map(x=>x.text).join('\n')};
  if (item.type === 'commandExecution') return {id:item.id, role:'tool', text:`${item.command}\n${item.status}`};
  if (item.type === 'fileChange') return {id:item.id, role:'tool', text:`Files: ${item.changes.map(x=>x.path).join(', ')} · ${item.status}`};
  if (['mcpToolCall','webSearch','collabAgentToolCall','contextCompaction'].includes(item.type)) return {id:item.id, role:'tool', text:`${item.type} · ${item.status || ''}`};
  return null; // Never forward raw protocol payloads, reasoning or credentials.
};

export class CodexProvider extends AgentProvider {
  name = 'codex';
  constructor({url='ws://127.0.0.1:4500', cwd=process.cwd(), WebSocketClass=globalThis.WebSocket, timeout=30000}={}) {
    super();
    const address=new URL(url);
    if(address.protocol!=='ws:' || !['127.0.0.1','localhost','[::1]'].includes(address.hostname)) throw Error('Codex endpoint must be a loopback WebSocket');
    this.url=url; this.cwd=cwd; this.WebSocketClass=WebSocketClass; this.timeout=timeout;
    this.pending=new Map(); this.requests=new Map(); this.threads=new Map(); this.sequence=0;
    this.connected=false; this.error=null; this.account=null;
  }
  snapshot() {
    return {provider:this.name, connected:this.connected, error:this.error, account:this.account,
      workspace:this.cwd, threads:[...this.threads.values()], requests:[...this.requests.values()]};
  }
  changed() { this.emit('change'); }
  async connect() {
    if(this.connected) return this.snapshot();
    if(this.connecting) return this.connecting;
    this.connecting=this.open().finally(()=>{this.connecting=null;});
    return this.connecting;
  }
  async open() {
    const socket=new this.WebSocketClass(this.url); this.socket=socket;
    socket.addEventListener('message', event=>{
      try { this.receive(JSON.parse(String(event.data))); } catch { this.error='Invalid Codex event'; this.changed(); }
    });
    socket.addEventListener('close',()=>{
      if(this.socket!==socket)return;
      this.connected=false; this.error='Codex disconnected. Reconnect and resume the thread; messages are never retried automatically.';
      for(const {reject,timer} of this.pending.values()){clearTimeout(timer);reject(Error(this.error));}
      this.pending.clear(); this.requests.clear();
      for(const t of this.threads.values()) {t.status='unknown';t.turnId=null;}
      this.changed();
    });
    try {
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{socket.close();reject(Error('Codex connection timed out'));},this.timeout);
        socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
        socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Cannot reach Codex App Server on '+this.url));},{once:true});
      });
      await this.rpc('initialize',{clientInfo:{name:'atelier_office',title:'Atelier Office',version:'0.3.0'}});
      this.write({method:'initialized',params:{}});
      const {account}=await this.rpc('account/read',{});
      this.account=account?{type:account.type}:null;
      this.connected=true; this.error=null; this.changed(); return this.snapshot();
    } catch(error) { this.error=error.message; socket.close(); this.changed(); throw error; }
  }
  write(message) {
    if(this.socket?.readyState!==1) throw Error('Codex is not connected');
    this.socket.send(JSON.stringify(message));
  }
  rpc(method,params={}) {
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`${method} timed out; inspect thread history before retrying`));},this.timeout);
      this.pending.set(id,{resolve,reject,timer});
      try {this.write({id,method,params});} catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}
    });
  }
  receive(message) {
    const {id,method,params:p={}}=message;
    if(!method && id!==undefined){
      const pending=this.pending.get(id); if(!pending)return;
      clearTimeout(pending.timer);this.pending.delete(id);
      if(message.error)pending.reject(Error(message.error.message));else pending.resolve(message.result);
      return;
    }
    if(method && id!==undefined){
      if(!this.threads.has(p.threadId)) {this.write({id,error:{code:-32601,message:'Thread is not controlled by this office'}});return;}
      if(approvalMethods.includes(method)) {
        const decisions=(p.availableDecisions || ['accept','decline','cancel']).filter(x=>['accept','decline','cancel'].includes(x));
        this.requests.set(id,{id,method,threadId:p.threadId,turnId:p.turnId,itemId:p.itemId,
          reason:p.reason,command:p.command,cwd:p.cwd,grantRoot:p.grantRoot,network:p.networkApprovalContext,decisions});
      } else if(method===inputMethod) {
        this.requests.set(id,{id,method,threadId:p.threadId,turnId:p.turnId,questions:p.questions});
      } else {
        this.write({id,error:{code:-32601,message:`Office does not support ${method}; request was not approved`}});
        this.error=`Unsupported Codex request: ${method}`;
      }
      this.changed();return;
    }
    if(method==='serverRequest/resolved'){this.requests.delete(p.requestId);this.changed();return;}
    const thread=this.threads.get(p.threadId);
    if(!thread)return;
    thread.updatedAt=Date.now();
    if(method==='turn/started'){thread.turnId=p.turn.id;thread.status='working';thread.error=null;}
    else if(method==='turn/completed'){
      thread.turnId=null;thread.status=p.turn.status;thread.error=p.turn.error?.message || null;
      for(const [key,r]of this.requests)if(r.threadId===thread.id)this.requests.delete(key);
    } else if(method==='item/agentMessage/delta') {
      let entry=thread.messages.find(x=>x.id===p.itemId);
      if(!entry){entry={id:p.itemId,role:'assistant',text:''};thread.messages.push(entry);}
      entry.text=(entry.text+p.delta).slice(-100000);
    } else if(method==='item/started'||method==='item/completed') {
      const item=publicItem(p.item);if(item)this.upsert(thread,item);
      if(method==='item/started')thread.activity=p.item.type;
    } else if(method==='error') {thread.error=p.error?.message || 'Codex turn error';}
    else return;
    thread.messages=thread.messages.slice(-300);this.changed();
  }
  upsert(thread,item) {
    const i=thread.messages.findIndex(x=>x.id===item.id);
    if(i<0)thread.messages.push(item);else thread.messages[i]=item;
  }
  adopt(thread) {
    const active=(thread.turns||[]).findLast(t=>t.status==='inProgress');
    const state={id:thread.id,name:thread.name||thread.preview||'Office Codex',cwd:thread.cwd,
      status:active?'working':'idle',turnId:active?.id||null,updatedAt:Date.now(),messages:[],error:null};
    for(const turn of thread.turns||[])for(const item of turn.items||[]) {const entry=publicItem(item);if(entry)this.upsert(state,entry);}
    state.messages=state.messages.slice(-300);this.threads.set(thread.id,state);this.changed();return state;
  }
  async listThreads(cursor=null) {
    await this.connect();
    const result=await this.rpc('thread/list',{limit:30,cursor,cwd:this.cwd,sortKey:'updated_at'});
    return {data:result.data.map(t=>({id:t.id,name:t.name||t.preview||t.id,cwd:t.cwd,status:t.status})),nextCursor:result.nextCursor};
  }
  async startThread() {
    await this.connect();
    const {thread}=await this.rpc('thread/start',{cwd:this.cwd,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'workspace-write'});
    return this.adopt(thread);
  }
  async resumeThread(threadId) {
    await this.connect();
    if(this.threads.has(threadId)&&this.threads.get(threadId).status!=='unknown')return this.threads.get(threadId);
    const {thread:stored}=await this.rpc('thread/read',{threadId,includeTurns:false});
    const normalize=p=>p?.replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
    if(normalize(stored.cwd)!==normalize(this.cwd))throw Error('Choose a thread from this workspace');
    if(stored.status?.type==='active')throw Error('Thread is active elsewhere. Finish it there before resuming here.');
    const {thread}=await this.rpc('thread/resume',{threadId,cwd:this.cwd,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'workspace-write'});
    return this.adopt(thread);
  }
  async send(threadId,text) {
    const thread=this.requireThread(threadId);
    if(typeof text!=='string'||!text.trim()||text.length>32000)throw Error('Message must be 1–32000 characters');
    if(thread.sending)throw Error('A message is already being sent');
    thread.sending=true;
    try {
      const input=[{type:'text',text}];
      if(thread.turnId) return await this.rpc('turn/steer',{threadId,expectedTurnId:thread.turnId,input});
      // Do not set working after the reply: turn/completed can arrive first.
      thread.status='working';thread.error=null;this.changed();
      return await this.rpc('turn/start',{threadId,input});
    } catch(e){thread.error=e.message;if(!thread.turnId)thread.status='unknown';throw e;}
    finally {thread.sending=false;this.changed();}
  }
  requireThread(id) {
    if(!this.connected)throw Error('Connect to Codex first');
    const thread=this.threads.get(id);if(!thread||thread.status==='unknown')throw Error('Resume the thread before sending');return thread;
  }
  async interrupt(threadId) {
    const thread=this.requireThread(threadId);if(!thread.turnId)throw Error('No active turn');
    return this.rpc('turn/interrupt',{threadId,turnId:thread.turnId});
  }
  respond(id,response) {
    const request=this.requests.get(id);if(!request)throw Error('Request expired or was already answered');
    let result;
    if(approvalMethods.includes(request.method)){
      if(!request.decisions.includes(response.decision))throw Error('Invalid approval decision');
      result={decision:response.decision};
    } else {
      const answers={};
      for(const q of request.questions){const value=response.answers?.[q.id];if(typeof value!=='string'||!value.trim()||value.length>10000)throw Error('Answer each question');answers[q.id]={answers:[value]};}
      result={answers};
    }
    this.write({id,result});this.requests.delete(id);this.changed();
  }
  agents() {
    return [...this.threads.values()].map(t=>({id:t.id,name:'Codex · office',workspace:t.cwd,
      state:!this.connected||t.status==='unknown'?'unknown':this.requests.size&&[...this.requests.values()].some(r=>r.threadId===t.id)?'blocked':t.status==='working'?'working':t.status==='failed'?'blocked':'idle',
      activity:t.error||t.activity||t.status,summary:t.messages.findLast(m=>m.role==='assistant')?.text.slice(-600)||'',
      goal:t.messages.findLast(m=>m.role==='user')?.text.slice(0,800)||'',updatedAt:t.updatedAt,
      floor:['idle','completed','interrupted'].includes(t.status)?2:0,room:0,source:'Codex App Server'}));
  }
  close() {this.socket?.close();}
}
