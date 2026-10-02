import {recordEvent} from '../office/events.mjs';
import {resolve} from 'node:path';
const [agentId,state,...summary]=process.argv.slice(2);
try{await recordEvent(resolve('office/events.jsonl'),{agentId,state,summary:summary.join(' ')});console.log('Office event recorded')}catch(e){console.error(e.message);process.exitCode=1}
