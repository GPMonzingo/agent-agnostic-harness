import test from 'node:test';
import assert from 'node:assert/strict';
import {CodexProvider} from './codex-provider.mjs';

class FakeSocket extends EventTarget {
  static instances=[];
  constructor(){super();this.readyState=0;this.sent=[];FakeSocket.instances.push(this);queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));});}
  send(raw){const message=JSON.parse(raw);this.sent.push(message);if(!message.method||message.id===undefined)return;
    let result={};
    if(message.method==='account/read')result={account:{type:'chatgpt',email:'private@example.test'}};
    if(message.method==='thread/start')result={thread:{id:'thread-1',cwd:'C:/workspace',turns:[]}};
    if(message.method==='turn/start'){
      this.deliver({method:'turn/started',params:{threadId:'thread-1',turn:{id:'turn-1'}}});result={turn:{id:'turn-1'}};
    }
    queueMicrotask(()=>this.deliver({id:message.id,result}));
  }
  deliver(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
  close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
}
async function fixture(t){const provider=new CodexProvider({cwd:'C:/workspace',WebSocketClass:FakeSocket,timeout:100});t.after(()=>provider.close());await provider.connect();await provider.startThread();return {provider,socket:provider.socket};}

test('handshake, public streaming, steering and final status',async t=>{
  const {provider,socket}=await fixture(t);
  assert.deepEqual(socket.sent.slice(0,3).map(x=>x.method),['initialize','initialized','account/read']);
  assert.deepEqual(provider.snapshot().account,{type:'chatgpt'});
  await provider.send('thread-1','Hello');
  socket.deliver({method:'item/agentMessage/delta',params:{threadId:'thread-1',itemId:'a',delta:'Hello '}});
  socket.deliver({method:'item/agentMessage/delta',params:{threadId:'thread-1',itemId:'a',delta:'office'}});
  socket.deliver({method:'item/completed',params:{threadId:'thread-1',item:{id:'secret',type:'reasoning',content:['secret']}}});
  assert.equal(provider.snapshot().threads[0].messages[0].text,'Hello office');
  assert.equal(JSON.stringify(provider.snapshot()).includes('secret'),false);
  await provider.send('thread-1','Use tests');
  assert.equal(socket.sent.at(-1).method,'turn/steer');assert.equal(socket.sent.at(-1).params.expectedTurnId,'turn-1');
  await provider.interrupt('thread-1');assert.equal(socket.sent.at(-1).method,'turn/interrupt');
  socket.deliver({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'interrupted'}}});
  assert.equal(provider.snapshot().threads[0].status,'interrupted');
  assert.equal(provider.snapshot().threads[0].turnId,null);
});
test('approvals require explicit allowed decisions and preserve numeric/string IDs',async t=>{
  const {provider,socket}=await fixture(t);
  socket.deliver({id:'approval-7',method:'item/commandExecution/requestApproval',params:{threadId:'thread-1',turnId:'turn-1',command:'git status',availableDecisions:['accept','decline']}});
  assert.equal(provider.snapshot().requests.length,1);
  assert.throws(()=>provider.respond('approval-7',{decision:'acceptForSession'}));
  provider.respond('approval-7',{decision:'decline'});
  assert.deepEqual(socket.sent.at(-1),{id:'approval-7',result:{decision:'decline'}});
  assert.throws(()=>provider.respond('approval-7',{decision:'accept'}));
  socket.deliver({id:22,method:'item/tool/requestUserInput',params:{threadId:'thread-1',questions:[{id:'q',question:'Which?'}]}});
  provider.respond(22,{answers:{q:'One'}});
  assert.deepEqual(socket.sent.at(-1),{id:22,result:{answers:{q:{answers:['One']}}}});
});
test('resolved requests disappear and unknown requests fail closed',async t=>{
  const {provider,socket}=await fixture(t);
  socket.deliver({id:5,method:'item/fileChange/requestApproval',params:{threadId:'thread-1'}});
  socket.deliver({method:'serverRequest/resolved',params:{threadId:'thread-1',requestId:5}});
  assert.equal(provider.snapshot().requests.length,0);
  socket.deliver({id:6,method:'item/permissions/requestApproval',params:{threadId:'thread-1'}});
  assert.equal(socket.sent.at(-1).error.code,-32601);
});
test('disconnect invalidates active state and never replays a turn',async t=>{
  const {provider,socket}=await fixture(t);await provider.send('thread-1','Hello');
  socket.close();assert.equal(provider.snapshot().connected,false);assert.equal(provider.agents()[0].state,'unknown');
  await assert.rejects(provider.send('thread-1','Again'),/Connect/);
  await provider.connect();
  assert.equal(provider.socket.sent.some(x=>x.method==='turn/start'),false);
  await assert.rejects(provider.send('thread-1','Again'),/Resume/);
});
test('request timeouts clear pending calls',async t=>{
  const {provider,socket}=await fixture(t);socket.send=()=>{};
  await assert.rejects(provider.rpc('thread/read'),/timed out/);assert.equal(provider.pending.size,0);
});
test('only loopback endpoints are accepted',()=>{
  assert.throws(()=>new CodexProvider({url:'ws://example.com:4500'}),/loopback/);
});
