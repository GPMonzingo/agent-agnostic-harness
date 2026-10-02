import {randomBytes, timingSafeEqual} from 'node:crypto';

export function createAgentApi(registry,{ensureServer=async()=>{}}={}) {
  const token=randomBytes(32).toString('hex');
  const clients=new Set();
  let scheduled=false;
  const state=()=>({providers:[...registry.providers.values()].map(p=>p.snapshot())});
  const publish=()=>{
    if(scheduled)return;scheduled=true;
    setTimeout(()=>{scheduled=false;const data=`data: ${JSON.stringify(state())}\n\n`;
      for(const res of clients){if(res.writableLength>1024*1024){res.destroy();clients.delete(res);}else res.write(data);}
    },40).unref();
  };
  for(const p of registry.providers.values())p.on('change',publish);
  const heartbeat=setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n');},15000);heartbeat.unref();
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  async function handle(req,res,path) {
    if(!path.startsWith('/api/agent/'))return false;
    const origin=`http://${req.headers.host}`;
    if((req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){
      json(res,403,{error:'Same-origin office access required'});return true;
    }
    if(req.method==='GET'){
      if(path==='/api/agent/session'){json(res,200,{token,...state()});return true;}
      if(path==='/api/agent/events'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});
        res.write(`data: ${JSON.stringify(state())}\n\n`);clients.add(res);
        res.on('close',()=>clients.delete(res));return true;
      }
      json(res,404,{error:'Unknown agent route'});return true;
    }
    if(req.method!=='POST'){json(res,405,{error:'Use POST'});return true;}
    const supplied=Buffer.from(req.headers['x-office-token']||'');const expected=Buffer.from(token);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){
      json(res,403,{error:'Reload the office to establish a local session'});return true;
    }
    if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'JSON required'});return true;}
    try {
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>65536){json(res,413,{error:'Request too large'});return true;}chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const provider=registry.get(body.provider||'codex');
      let result;
      switch(path){
        case '/api/agent/connect':await ensureServer();result=await provider.connect();break;
        case '/api/agent/threads':result=await provider.listThreads(body.cursor);break;
        case '/api/agent/start':result=await provider.startThread();break;
        case '/api/agent/resume':result=await provider.resumeThread(body.threadId);break;
        case '/api/agent/send':await provider.send(body.threadId,body.text);result={ok:true};break;
        case '/api/agent/interrupt':await provider.interrupt(body.threadId);result={ok:true};break;
        case '/api/agent/respond':provider.respond(body.id,body.response);result={ok:true};break;
        default:json(res,404,{error:'Unknown agent route'});return true;
      }
      json(res,200,result);
    } catch(error){json(res,400,{error:error.message});}
    return true;
  }
  return {handle,close(){clearInterval(heartbeat);for(const res of clients)res.end();}};
}
