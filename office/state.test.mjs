import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from './state.mjs';
const event=type=>({type:'event_msg',payload:{type}});
test('active, completed and interrupted turns have distinct lifecycle states',()=>{assert.equal(summarize([event('task_started')],'x',100,110).state,'working');assert.equal(summarize([event('task_started'),event('task_complete')],'x',100,110).floor,2);assert.equal(summarize([event('turn_aborted')],'x',100,110).state,'idle')});
test('silence is unknown, never fabricated sleep',()=>{const a=summarize([event('task_started')],'x',100,130000);assert.equal(a.state,'unknown');assert.equal(a.floor,0)});
test('only public messages become bubbles; tool inputs and reasoning stay private',()=>{const a=summarize([{type:'response_item',payload:{type:'reasoning',content:'private'}},{type:'response_item',payload:{type:'custom_tool_call',name:'read_file',input:'secret'}},{type:'event_msg',payload:{type:'agent_message',message:'Checking tests'}}],'x',100,110);assert.equal(a.summary,'Checking tests');assert.equal(JSON.stringify(a).includes('secret'),false);assert.equal(JSON.stringify(a).includes('private'),false)});
test('late tool output does not wake a completed turn',()=>{assert.equal(summarize([event('task_complete'),{type:'response_item',payload:{type:'custom_tool_call_output'}}],'x',100,110).state,'idle')});
