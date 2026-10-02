import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordEvent,readAgents,validateEvent} from './events.mjs';
test('reject unknown states and malformed agent IDs',()=>{assert.throws(()=>validateEvent({agentId:'../x',state:'idle'}));assert.throws(()=>validateEvent({agentId:'x',state:'pretending'}))});
test('meeting participants share a room; later idle event sends only that agent home',async()=>{const dir=await mkdtemp(join(tmpdir(),'office-test-'));try{const file=join(dir,'events.jsonl');for(const id of ['a','b'])await recordEvent(file,{agentId:id,state:'meeting',participants:['a','b'],contextId:'review'});let agents=await readAgents(file);assert.equal(agents.length,2);assert.ok(agents.every(a=>a.room===3&&a.floor===0));await recordEvent(file,{agentId:'a',state:'idle'});agents=await readAgents(file);assert.equal(agents.find(a=>a.id==='a').floor,2);assert.equal(agents.find(a=>a.id==='b').room,3)}finally{await rm(dir,{recursive:true,force:true})}});
