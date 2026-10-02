const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const section=el('section',undefined,'office-chat');section.id='office-chat';section.setAttribute('aria-label','Office chat');
section.innerHTML=`<div class="chat-heading"><div><div class="eyebrow">WORK WITH YOUR AGENTS</div><h2>Office chat</h2></div><span id="chat-status" role="status">Connecting…</span></div>
<p>Start a conversation here, or resume a saved workspace conversation after finishing it in your other client.</p>
<div class="chat-controls"><label>Provider<select id="chat-provider"><option value="codex">Codex</option></select></label><button id="chat-connect">Reconnect</button><button id="chat-new">New conversation</button><button id="chat-history">Load saved conversations</button></div>
<label>Conversation<select id="chat-thread"><option value="">Choose a conversation</option></select></label>
<div id="chat-history-list"></div><p id="chat-error" role="alert"></p>
<div id="chat-messages" role="log" aria-label="Conversation messages" aria-live="polite"></div>
<div id="chat-requests"></div>
<form id="chat-form"><label for="chat-input">Message</label><textarea id="chat-input" rows="3" maxlength="32000" placeholder="Ask Codex to work in this repository…" required></textarea><div class="chat-controls"><button id="chat-send" type="submit">Send</button><button id="chat-stop" type="button">Stop turn</button><span id="chat-turn-status"></span></div></form>
<p class="footnote">Your Codex sign-in is used locally. Approval requests appear here. Sending during a turn adds guidance to that turn. Reloading the page retains conversations; reconnecting after a server restart requires resuming saved history.</p>`;
document.querySelector('.shell').append(section);
const jump=el('button','↓ Office chat');jump.onclick=()=>section.scrollIntoView({behavior:'smooth'});document.querySelector('nav').append(jump);
const $=id=>document.getElementById(id);
let token,state,active=localStorage.getItem('atelier-thread')||'',busy=false,requestKey='',eventSource;
function select(id){active=id;localStorage.setItem('atelier-thread',id);requestKey='';render();}
async function api(action,body={}){
  const response=await fetch('/api/agent/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Office-Token':token},body:JSON.stringify({provider:$('chat-provider').value,...body})});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Office request failed');return value;
}
async function run(fn){
  if(busy)return;busy=true;$('chat-error').textContent='';render();
  try{await fn();}catch(e){$('chat-error').textContent=e.message;}finally{busy=false;render();}
}
function render(){
  const provider=state?.providers.find(p=>p.provider===$('chat-provider').value);
  const connected=provider?.connected;
  $('chat-status').textContent=connected?`● Connected · ${provider.account?.type||'Sign-in needed'}`:provider?.error||'Connecting…';
  const threads=provider?.threads||[],thread=threads.find(t=>t.id===active);
  const selectBox=$('chat-thread');selectBox.replaceChildren(new Option('Choose a conversation',''));
  for(const t of threads)selectBox.append(new Option(`${t.name.slice(0,80)} · ${t.id.slice(0,8)}`,t.id));selectBox.value=thread?active:'';
  for(const id of ['chat-new','chat-history'])$(id).disabled=busy||!connected;
  $('chat-connect').disabled=busy;
  $('chat-send').disabled=busy||!connected||!thread||thread.status==='unknown';
  $('chat-stop').disabled=!connected||!thread?.turnId;
  $('chat-turn-status').textContent=thread?`${thread.status}${thread.error?' · '+thread.error:''}`:'';
  const log=$('chat-messages'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;
  const messages=thread?.messages||[],key=JSON.stringify(messages);
  if(log.dataset.content!==key){
    log.dataset.content=key;log.replaceChildren();
    for(const message of messages){const article=el('article',undefined,'chat-message '+message.role);article.append(el('strong',message.role==='assistant'?'Codex':message.role==='user'?'You':'Activity'),el('pre',message.text));log.append(article);}
    if(!messages.length)log.append(el('p','Create or select a conversation to begin.'));
    if(atBottom)log.scrollTop=log.scrollHeight;
  }
  const requests=(provider?.requests||[]).filter(r=>r.threadId===active),newKey=JSON.stringify(requests);
  if(requestKey!==newKey){
    requestKey=newKey;$('chat-requests').replaceChildren();
    for(const request of requests){
      const card=el('div',undefined,'chat-request');card.append(el('h3',request.questions?'Codex needs your input':'Approval required'));
      if(request.questions){
        const inputs=new Map();
        for(const q of request.questions){const label=el('label',q.question),input=el('input');input.type=q.isSecret?'password':'text';input.required=true;
          if(q.options?.length){const options=el('p',q.options.map(x=>`${x.label}: ${x.description}`).join('\n'));label.append(options);}
          label.append(input);inputs.set(q.id,input);card.append(label);
        }
        const answer=el('button','Send answers');answer.onclick=()=>run(()=>api('respond',{id:request.id,response:{answers:Object.fromEntries([...inputs].map(([id,input])=>[id,input.value]))}}));card.append(answer);
      }else{
        card.append(el('pre',[request.reason,request.command,request.cwd,request.grantRoot,request.network&&JSON.stringify(request.network)].filter(Boolean).join('\n')));
        const item=thread?.messages.find(m=>m.id===request.itemId);if(item)card.append(el('pre',item.text));
        for(const decision of request.decisions){const button=el('button',{accept:'Approve once',decline:'Decline',cancel:'Cancel'}[decision]);button.onclick=()=>run(()=>api('respond',{id:request.id,response:{decision}}));card.append(button);}
      }
      $('chat-requests').append(card);
    }
  }
}
async function resume(id){const thread=await api('resume',{threadId:id});await refresh();select(thread.id);}
async function refresh(){const response=await fetch('/api/agent/session');if(!response.ok)throw Error('Office connection failed');const data=await response.json();token=data.token;state=data;render();}
$('chat-thread').onchange=e=>select(e.target.value);
$('chat-connect').onclick=()=>run(async()=>{await api('connect');await refresh();if(active&&!state.providers[0].threads.some(t=>t.id===active&&t.status!=='unknown'))await resume(active);});
$('chat-new').onclick=()=>run(async()=>{const thread=await api('start');await refresh();select(thread.id);$('chat-input').focus();});
async function history(cursor=null){
  const result=await api('threads',{cursor});if(!cursor)$('chat-history-list').replaceChildren();
  for(const t of result.data){const button=el('button',t.name.slice(0,100)+' · '+t.id.slice(0,8));button.onclick=()=>run(()=>resume(t.id));$('chat-history-list').append(button);}
  if(result.nextCursor){const more=el('button','More conversations');more.onclick=()=>run(async()=>{more.remove();await history(result.nextCursor);});$('chat-history-list').append(more);}
  if(!result.data.length&&!cursor)$('chat-history-list').append(el('p','No saved conversations in this workspace.'));
}
$('chat-history').onclick=()=>run(()=>history());
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('chat-input').value;run(async()=>{await api('send',{threadId:active,text});$('chat-input').value='';});};
$('chat-stop').onclick=async()=>{try{await api('interrupt',{threadId:active});}catch(e){$('chat-error').textContent=e.message;}};
window.addEventListener('office-chat-select',e=>{section.scrollIntoView({behavior:'smooth'});run(()=>resume(e.detail));});
async function init(){
  try{
    await refresh();eventSource=new EventSource('/api/agent/events');
    eventSource.onmessage=e=>{state=JSON.parse(e.data);render();};
    eventSource.onerror=()=>{$('chat-status').textContent='Office stream disconnected · reconnecting';for(const p of state.providers)p.connected=false;render();};
    // Refresh the CSRF session after SSE reconnect (the backend may have restarted).
    eventSource.onopen=()=>refresh().catch(e=>{$('chat-error').textContent=e.message;});
  }catch(e){$('chat-error').textContent=e.message;}
}
init();
