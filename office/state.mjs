export function summarize(lines,path,updatedAt,now=Date.now()) {
 const agent={id:path.split(/[\\/]/).at(-1).replace('.jsonl',''),name:'Codex',state:'unknown',activity:'No lifecycle event observed',summary:'',goal:'',updatedAt,source:'Local Codex session (experimental)',tokens:null,context:null};
 for(const {type,payload:p} of lines){if(!p)continue;
 if(type==='session_meta'){agent.id=p.id||agent.id;agent.workspace=p.cwd;agent.startedAt=p.timestamp}
 if(type==='event_msg'){
 if(p.type==='user_message')agent.goal=String(p.message||'').slice(0,800);
 if(p.type==='task_started'){agent.state='working';agent.activity='Working on a turn'}
 if(p.type==='task_complete'){agent.state='idle';agent.activity='Turn complete';agent.summary=String(p.last_agent_message||'').slice(0,600)}
 if(p.type==='turn_aborted'){agent.state='idle';agent.activity='Turn interrupted'}
 if(p.type==='agent_message')agent.summary=String(p.message||'').slice(0,600);
 if(p.type==='token_count'){agent.tokens=p.info?.total_token_usage?.total_tokens??null;agent.context=p.info?.model_context_window??null}
 }
 if(type==='response_item'&&['function_call','custom_tool_call'].includes(p.type)){agent.activity=`Using ${p.name||'a tool'}`;agent.tool=p.name}
 }
 if(agent.state==='working'&&now-updatedAt>120000){agent.state='unknown';agent.activity='No recent telemetry · work may still be running'}
 agent.floor=agent.state==='idle'?2:agent.state==='unknown'?0:/search|web|read/.test(agent.tool||'')?1:0;
 return agent;
}
