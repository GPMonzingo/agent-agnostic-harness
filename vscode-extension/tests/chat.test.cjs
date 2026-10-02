const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('streamed tool results return to model and final unterminated chunk renders',async()=>{
 let provider;const posted=[],requests=[];
 const vscode={window:{registerWebviewViewProvider(_id,p){provider=p},activeTextEditor:undefined},commands:{registerCommand(){}},workspace:{workspaceFolders:[{uri:{fsPath:'/repo'}}],getConfiguration(){return {get(_k,fallback){return fallback}}},findFiles:async()=>[],fs:{readFile:async()=>new TextEncoder().encode('file contents')},asRelativePath:()=> 'sample.txt'},Uri:{joinPath:()=>({fsPath:'/repo/sample.txt'})}};
 const module={exports:{}};
 const sandbox={exports:module.exports,module,require:()=>vscode,TextDecoder,TextEncoder,setTimeout,fetch:async(url,init)=>{
  if(url.endsWith('/api/tags'))return new Response('{}');
  requests.push(JSON.parse(init.body));
  const message=requests.length===1?{role:'assistant',content:'',tool_calls:[{id:'a',function:{name:'read_file',arguments:{path:'sample.txt'}}}]}:{role:'assistant',content:'Read successfully'};
  return new Response(JSON.stringify({message,done:true}));
 }};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../out/extension.js'),'utf8'),sandbox);
 module.exports.activate({subscriptions:[],globalState:{get:()=>[],update:async()=>{}}});
 provider.resolveWebviewView({webview:{options:{},postMessage:m=>posted.push(m),onDidReceiveMessage(){}}});
 await provider.chat('Read sample.txt');
 assert.equal(requests.length,2);
 assert.ok(requests[1].messages.some(m=>m.role==='tool'&&m.content.includes('file contents')));
 assert.ok(posted.some(m=>m.type==='assistantDelta'&&m.text==='Read successfully'));
 assert.equal(provider.busy,false);
});
