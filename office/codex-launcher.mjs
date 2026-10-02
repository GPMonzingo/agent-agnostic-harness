import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join, delimiter} from 'node:path';

export async function ensureCodexServer(url='ws://127.0.0.1:4500') {
  const endpoint=new URL(url);
  if(endpoint.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw Error('Codex must listen on loopback');
  const health=new URL('/readyz',url.replace(/^ws:/,'http:'));
  const ready=async()=>{try{return (await fetch(health,{signal:AbortSignal.timeout(700)})).ok;}catch{return false;}};
  if(await ready())return null;
  if(process.env.OFFICE_CODEX_AUTOSTART==='0')throw Error('Start codex app-server --listen '+url);
  let command=process.env.CODEX_BIN||'codex', args=['app-server','--listen',url];
  // npm's .cmd shim cannot be spawned directly on Windows. Invoke its JS entry
  // with Node, using argument arrays and no command-shell interpolation.
  if(process.platform==='win32'&&!process.env.CODEX_BIN){
    const entry=(process.env.PATH||'').split(delimiter).map(p=>join(p,'node_modules','@openai','codex','bin','codex.js')).find(existsSync);
    if(!entry)throw Error('Cannot find global Codex. Set CODEX_BIN to the codex executable.');
    command=process.execPath;args=[entry,...args];
  }
  const child=spawn(command,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let failure=null;
  child.on('error',error=>{failure=error;});
  child.on('exit',code=>{failure=Error(`Codex App Server exited (${code})`);});
  // Drain stderr without forwarding logs that might contain local secrets.
  child.stderr?.resume();
  for(let attempt=0;attempt<80;attempt++){
    if(failure)throw failure;
    if(await ready())return child;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  child.kill();throw Error('Codex App Server did not become ready');
}
