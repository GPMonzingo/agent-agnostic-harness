import {readAgents} from './events.mjs';
import {createServer} from 'node:http';
import {AgentProviderRegistry} from './agent-provider.mjs';
import {CodexProvider} from './codex-provider.mjs';
import {ensureCodexServer} from './codex-launcher.mjs';
import {createAgentApi} from './agent-api.mjs';

import {readFile, readdir, stat, open} from 'node:fs/promises';

import {homedir} from 'node:os';

import {join, dirname} from 'node:path';

import {fileURLToPath} from 'node:url';

import {summarize} from './state.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const registry=new AgentProviderRegistry();
const codex=registry.register(new CodexProvider({url:process.env.CODEX_APP_SERVER_URL||'ws://127.0.0.1:4500',cwd:dirname(root)}));
let codexChild=null,starting=null;
async function ensureServer(){
  if(!starting)starting=ensureCodexServer(codex.url).then(child=>{if(child)codexChild=child;}).finally(()=>{starting=null;});
  return starting;
}
const agentApi=createAgentApi(registry,{ensureServer});

const sessions=join(process.env.CODEX_HOME || join(homedir(),'.codex'),'sessions');

async function walk(path){let result=[];for(const e of await readdir(path,{withFileTypes:true}).catch(()=>[])){const p=join(path,e.name);if(e.isDirectory())result.push(...await walk(p));else if(e.name.endsWith('.jsonl'))result.push(p)}return result}

let snapshot={agents:[],error:null}, refreshing=false;

const cache=new Map();

async function refresh(){if(refreshing)return;refreshing=true;try{const files=await walk(sessions);const recent=(await Promise.all(files.map(async path=>({path,info:await stat(path)})))).sort((a,b)=>b.info.mtimeMs-a.info.mtimeMs).slice(0,20);snapshot={agents:[...await readAgents(join(root,'events.jsonl')),...await Promise.all(recent.map(async({path,info})=>{let cached=cache.get(path);

if(!cached || cached.size!==info.size){

 const content=await readFile(path,'utf8');

 const lines=content.split('\n').flatMap(l=>{try{const v=JSON.parse(l);return ['session_meta','event_msg','response_item'].includes(v.type)?[v]:[]}catch{return []}});

 cached={size:info.size,agent:summarize(lines,path,info.mtimeMs)};cache.set(path,cached);

}

const agent={...cached.agent};if(agent.state==='working'&&Date.now()-info.mtimeMs>120000){agent.state='unknown';agent.activity='No recent telemetry · work may still be running';agent.floor=0}return agent;}))],error:null}}catch(e){snapshot={...snapshot,error:String(e)}}finally{refreshing=false}}

await refresh();setInterval(refresh,2000).unref();

const port=Number(process.env.OFFICE_PORT||4310);

const server=createServer(async(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403).end();return;}
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    if(await agentApi.handle(req,res,path))return;
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    if(path==='/api/state'){
      const live=codex.agents(),ids=new Set(live.map(a=>a.id));
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({...snapshot,agents:[...live,...snapshot.agents.filter(a=>!ids.has(a.id))],now:Date.now()}));return;
    }
    const files={'/':'index.html','/app.js':'app.js','/chat.js':'chat.js','/style.css':'style.css','/exterior.js':'exterior.js','/vendor/three.module.js':'../node_modules/three/build/three.module.js','/vendor/three.core.js':'../node_modules/three/build/three.core.js'};
    if(!files[path]){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
    res.end(await readFile(join(root,files[path])));
  }catch{if(!res.headersSent)res.writeHead(500);res.end('Office unavailable');}
});
server.listen(port,'127.0.0.1',()=>{
  console.log(`Agent office: http://127.0.0.1:${port}`);
  ensureServer().then(()=>codex.connect()).catch(error=>{codex.error=error.message;codex.changed();console.error(error.message);});
});
function shutdown(){agentApi.close();codex.close();codexChild?.kill();server.close();setTimeout(()=>process.exit(0),1000).unref();}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);

