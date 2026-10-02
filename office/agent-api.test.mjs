import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {AgentProvider,AgentProviderRegistry} from './agent-provider.mjs';
import {createAgentApi} from './agent-api.mjs';

test('mutation routes enforce CSRF, origin, JSON and provider routing',async t=>{
  const provider=new AgentProvider();provider.name='fake';provider.snapshot=()=>({provider:'fake',connected:true});provider.send=async(id,text)=>{provider.last={id,text};};
  const registry=new AgentProviderRegistry();registry.register(provider);
  const api=createAgentApi(registry);
  const server=createServer((req,res)=>api.handle(req,res,req.url));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{api.close();server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const {token}=await (await fetch(base+'/api/agent/session')).json();
  const post=headers=>fetch(base+'/api/agent/send',{method:'POST',headers,body:JSON.stringify({provider:'fake',threadId:'t',text:'Hello'})});
  assert.equal((await post({'Content-Type':'application/json'})).status,403);
  assert.equal((await post({'Content-Type':'application/json','X-Office-Token':token,Origin:'https://evil.test'})).status,403);
  assert.equal((await post({'Content-Type':'text/plain','X-Office-Token':token})).status,415);
  assert.equal((await post({'Content-Type':'application/json','X-Office-Token':token,Origin:base})).status,200);
  assert.deepEqual(provider.last,{id:'t',text:'Hello'});
  assert.equal((await fetch(base+'/api/agent/session',{headers:{Origin:'https://evil.test'}})).status,403);
});
