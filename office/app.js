import {createExterior} from '/exterior.js';
import '/chat.js';

const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');

let floor=0,exterior=false,agents=[],selected=null,online=false;

let prefs;try{prefs=JSON.parse(localStorage.getItem('atelier')||'{}')}catch{prefs={}}const positions=new Map();

const plans=[['Engineering studio','Mission control','Onboarding','Meeting pavilion','Observability','Reception'],['Knowledge library','Research laboratory','Context exchange','Strategy room','Archive','Sky lounge'],['Codex residence','Agent residences','Wellness studio','Listening lounge','Conservatory','Night lounge']];

const rooms=[[80,90,470,290],[820,90,490,290],[80,470,280,300],[390,470,250,300],[760,470,250,300],[1040,470,270,300]];

const palette=['#354d44','#394c55','#5a5242','#3f4b4d','#3a4d3a','#514a48'];

function save(){localStorage.setItem('atelier',JSON.stringify(prefs))}

function box(x,y,w,h,color,r=0){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}

function text(t,x,y,size=14,color='#bbcabe'){ctx.fillStyle=color;ctx.font=`${size}px "DM Sans", sans-serif`;ctx.fillText(t,x,y)}

function plant(x,y){box(x-12,y-10,24,24,'#8c8f73',5);for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#537963':'#709075';ctx.beginPath();ctx.ellipse(x+Math.cos(i)*10,y+Math.sin(i)*10,8,16,i,0,7);ctx.fill()}}

function desk(x,y){box(x-7,y+43,34,25,'#101e1c',7);box(x-12,y+40,44,10,'#61726a',4);box(x-25,y-8,108,49,'#14231f',4);box(x-28,y-12,108,45,'#929a83',4);box(x-9,y-4,56,22,'#182e2b',3);box(x-6,y-2,50,15,'#79b8a0',2);box(x+8,y+22,31,6,'#d0d0b3',2)}

function sofa(x,y,vertical=false){ctx.save();ctx.translate(x,y);if(vertical)ctx.rotate(Math.PI/2);box(-4,-4,125,45,'#172923',8);box(0,0,118,35,'#809181',8);for(let i=0;i<3;i++)box(i*37+5,5,32,28,'#a4afa0',4);box(-4,-4,126,9,'#5b7367',4);ctx.restore()}

function room(index){const [x,y,w,h]=rooms[index],color=floor===2&&index===0?(prefs[selected]?.room||palette[index]):palette[index];

ctx.save();box(x+8,y+12,w,h,'#0a131066',4);box(x,y,w,h,color,3);ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;

const tile=index===0?40:index===3?55:25;for(let a=x;a<x+w;a+=tile){ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(a,y+h);ctx.stroke()}for(let a=y;a<y+h;a+=tile){ctx.beginPath();ctx.moveTo(x,a);ctx.lineTo(x+w,a);ctx.stroke()}

ctx.restore();ctx.strokeStyle='#96aa91';ctx.lineWidth=5;ctx.strokeRect(x,y,w,h);box(x+w/2-25,index<2?y+h-5:y-5,50,10,'#263d31');text(String(index+1).padStart(2,'0')+' / '+plans[floor][index].toUpperCase(),x+18,y+29,12,'#d4dec9');

plant(x+w-32,y+35);

if(floor===2&&index<2){box(x+36,y+80,115,155,'#182720',8);box(x+43,y+85,101,142,'#a7b5a0',5);box(x+43,y+125,101,95,prefs[selected]?.color||'#83bda4',4);box(x+51,y+92,38,26,'#e2e4ce',5);box(x+101,y+92,35,26,'#e2e4ce',5);desk(x+w-140,y+115);if((prefs[selected]?.decor||'plants')==='plants')plant(x+185,y+h-55);else if(prefs[selected]?.decor==='art'){box(x+w-125,y+46,70,35,'#d3af78');box(x+w-118,y+52,56,23,'#506d7b')}else{box(x+175,y+95,72,110,'#2e5f66',4);for(let k=0;k<5;k++)box(x+185+k*8,y+110+k*13,9,4,'#d9bc72')}}

else if((floor===1&&index===0)||index===4){for(let i=0;i<(w>300?4:2);i++){box(x+26+i*100,y+65,70,h-110,'#1c2a24',3);for(let j=0;j<5;j++){box(x+29+i*100,y+72+j*32,64,7,'#aa9b72');for(let k=0;k<7;k++)box(x+31+i*100+k*8,y+80+j*32,5,20,['#859b87','#b7a57d','#66878d'][k%3])}}}

else if(index===3){box(x+w/2-52,y+85,105,140,'#a6a58a',30);for(let j=0;j<3;j++){box(x+34,y+88+j*48,30,30,'#6e897c',8);box(x+w-64,y+88+j*48,30,30,'#6e897c',8)}box(x+w/2-32,y+124,64,44,'#426b62',8)}

else if(index===5||floor===2){sofa(x+30,y+80);sofa(x+30,y+205);box(x+50,y+135,100,45,'#b0a68b',15);plant(x+w-40,y+h-42)}

else{desk(x+65,y+95);if(w>300){desk(x+225,y+95);desk(x+65,y+200);desk(x+225,y+200)}else desk(x+65,y+210)}

}

function interior(){box(0,0,1400,940,'#15241e');ctx.save();ctx.shadowColor='#0008';ctx.shadowBlur=40;box(48,56,1295,752,'#263d31',16);ctx.restore();box(61,70,1268,722,'#344a3d',7);for(let x=70;x<1320;x+=32)for(let y=80;y<790;y+=32){ctx.strokeStyle='#ffffff05';ctx.strokeRect(x,y,32,32)}rooms.forEach((_,i)=>room(i));

box(628,84,116,274,'#1a2c24',50);plant(686,125);plant(686,290);text('ATELIER',656,215,13,'#aec39d');

box(647,365,101,105,'#111e1b',5);box(654,387,40,68,'#7a8e83',2);box(699,387,40,68,'#5d756a',2);box(672,369,51,17,'#111b17',3);text('0'+(floor+1),687,382,12,'#d4f2a3');text('CENTRAL LIFT',646,491,11,'#b0c69f');

for(let x=140;x<1280;x+=220){box(x,410,86,5,'#c4dfab',2)}text('N ↑',80,855,15);text('ATELIER  /  '+['OPERATIONS','INTELLIGENCE','RESIDENCES'][floor],80,886,12,'#829983');text('THREE FLOORS. ONE SHARED PURPOSE.',970,886,11,'#829983');

}

function outside(){const sky=ctx.createLinearGradient(0,0,0,940);sky.addColorStop(0,'#9baeb2');sky.addColorStop(.5,'#d6d9cd');sky.addColorStop(1,'#344c42');ctx.fillStyle=sky;ctx.fillRect(0,0,1400,940);for(let i=0;i<13;i++)box(i*125-20,180+(i%3)*25,90,270,'#607b7820');

ctx.save();ctx.translate(700,470);ctx.scale(1,.54);ctx.rotate(-Math.PI/4);box(-520,-340,1080,780,'#5a6c5d',20);for(let i=0;i<6;i++)box(-480,-290+i*120,990,2,'#acb3a033');ctx.restore();

function poly(points,fill){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill()}

for(let f=0;f<3;f++){let y=660-f*125;poly([[260,y-160],[900,y-90],[900,y+30],[260,y-40]],'#527776');poly([[900,y-90],[1150,y-220],[1150,y-100],[900,y+30]],'#294d4e');for(let i=0;i<24;i++){let x=268+i*26;box(x,y-154+i*2.85,3,109,'#99b7a5');box(x+4,y-142+i*2.85,18,80,i%4===0?'#ceb98280':'#93b8b335')}for(let i=0;i<9;i++){let x=914+i*26;box(x,y-96-i*13.5,3,108,'#658982')}poly([[254,y-165],[900,y-94],[1156,y-225],[1156,y-216],[900,y-82],[254,y-152]],'#c7c7b0');text('0'+(f+1),284,y-72,22,'#e6e4c8')}

poly([[254,245],[900,316],[1156,185],[510,115]],'#c9cebc');poly([[300,239],[891,299],[1098,192],[512,134]],'#688675');for(let i=0;i<7;i++){poly([[390+i*65,215+i*7],[433+i*65,220+i*7],[513+i*65,179+i*7],[470+i*65,175+i*7]],'#233f4c')}

for(let i=0;i<8;i++)plant(380+i*90,750+(i%3)*32);text('A T E L I E R',530,687,23,'#e4e6cd');text('ARCHITECTURAL VIEW / THREE-LEVEL GLASS PAVILION',80,870,13,'#d6dfce');text('Same footprint · central vertical circulation',80,897,12,'#adc2af')}

function destination(a,i){const index=a.room??(a.state==='idle'?0:a.state==='unknown'?5:0);const [x,y,w,h]=rooms[index];return {x:x+80+(i%4)*64,y:y+h-42-Math.floor(i/4)*44}}

function sprite(a,p,i){const custom=prefs[a.id]||{},color=custom.color||['#b8ddb1','#8bbccc','#d2b684'][i%3];const sleeping=a.state==='idle'&&Date.now()-a.updatedAt>Number($('sleep').value)*1000;

ctx.save();ctx.translate(p.x,p.y);if(sleeping)ctx.rotate(-Math.PI/2);ctx.shadowColor='#0008';ctx.shadowBlur=8;box(-13,20,30,8,'#07120c66',10);ctx.shadowBlur=0;const s=4;let pattern=custom.sprite==='robot'?['011110','122221','123321','122221','011110','044440','444444','044440','040040']:custom.sprite==='mage'?['000100','001110','011111','111111','002220','002220','033330','333333','030030']:['001110','011111','012221','002220','033330','333333','033330','030030','110110'];const colors={'1':'#263b3a','2':'#e1ba91','3':color,'4':color};pattern.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='0')box((x-3)*s,(y-5)*s,s,s,colors[v])}));ctx.restore();text(a.name,p.x-18,p.y+43,11,'#e3eadb');if(selected===a.id&&a.state==='working'){box(p.x-85,p.y-78,260,26,'#e0e7cf',7);text((a.summary||a.activity).slice(0,38),p.x-76,p.y-60,11,'#35473a')}if(sleeping)text('z z Z',p.x+15,p.y-23,15,'#d4eaaa');else if(a.state==='working'){box(p.x-22,p.y-49,52,22,'#e0e7cf',8);text('• • •',p.x-12,p.y-33,14,'#35473a')}

}

function doorway(room){const [x,y,w,h]=rooms[room];return {x:x+w/2,y:room<2?y+h+18:y-18}}
let previous=performance.now();function draw(now){const dt=Math.min(now-previous,100);previous=now;ctx.clearRect(0,0,1400,940);if(!exterior){interior();agents.forEach((a,i)=>{
 let p=positions.get(a.id);if(!p){p={x:695,y:425,floor:a.floor,room:null,queue:[],key:null};positions.set(a.id,p)}
 const targetRoom=a.room??(a.state==='unknown'?5:0),key=a.floor+':'+targetRoom;
 if(!p.queue.length&&p.key!==key){const d=destination(a,i),door=doorway(targetRoom);p.queue=[];
 if(p.room!==null){const old=doorway(p.room);p.queue.push({x:old.x,y:p.y},{x:old.x,y:old.y},{x:old.x,y:425})}
 if(p.floor!==a.floor)p.queue.push({x:695,y:425},{lift:a.floor,time:0});
 p.queue.push({x:door.x,y:425},{x:door.x,y:door.y},{x:door.x,y:d.y},{x:d.x,y:d.y});p.key=key;p.room=targetRoom;
 }
 const q=p.queue[0];let inLift=false;
 if(q?.lift!==undefined){inLift=true;q.time+=dt;if(q.time>1400){p.floor=q.lift;p.queue.shift();if(selected===a.id&&$('follow').checked)setFloor(p.floor)}}
 else if(q){const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy),speed=$('motion').checked&&!matchMedia('(prefers-reduced-motion: reduce)').matches?dt*.22:10000;if(len<=speed){p.x=q.x;p.y=q.y;p.queue.shift()}else{p.x+=dx/len*speed;p.y+=dy/len*speed}}
 if(p.floor===floor){if(inLift)text('↑ 0'+(q.lift+1),675,381,13,'#e4f9b0');else sprite(a,p,i)}
 })}requestAnimationFrame(draw)}
let exteriorReady=false;function toggleExterior(show){exterior=show;canvas.hidden=show;$('exteriorScene').hidden=!show;if(show&&!exteriorReady){try{createExterior($('exteriorScene'));exteriorReady=true}catch(e){$('exteriorScene').textContent='WebGL unavailable: '+e.message}}}

function setFloor(n){floor=n;toggleExterior(false);$('exterior').textContent='↗ Exterior view';document.querySelectorAll('[data-floor]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.floor)===n));$('floorTag').textContent=`LEVEL 0${n+1} / ${['OPERATIONS','INTELLIGENCE','RESIDENCES'][n]}`;$('floorTitle').textContent=['A place for ambitious work.','Room to think beyond.','Even great minds need rest.'][n]}

document.querySelectorAll('[data-floor]').forEach(b=>b.onclick=()=>setFloor(Number(b.dataset.floor)));$('exterior').onclick=()=>{toggleExterior(!exterior);$('exterior').textContent=exterior?'↙ Return inside':'↗ Exterior view'};

function inspect(id){selected=id;const a=agents.find(x=>x.id===id);if(!a)return;if($('follow').checked)setFloor(positions.get(id)?.floor??a.floor);renderCards();const panel=$('inspector');panel.replaceChildren();const h=document.createElement('h3');h.textContent=a.name+' / '+a.state;panel.append(h);for(const value of [a.activity,a.summary||'No public progress message yet.',a.goal&&'Latest request: '+a.goal,a.workspace,'Session: '+a.id,'Tokens: '+(a.tokens??'not reported')+' · Context capacity: '+(a.context??'not reported')]){if(!value)continue;const p=document.createElement('p');p.textContent=value;panel.append(p)}

function control(title,key,values){const l=document.createElement('label');l.textContent=title;const el=document.createElement('select');for(const v of values){const opt=document.createElement('option');opt.value=v;opt.textContent=v;el.append(opt)}el.value=prefs[id]?.[key]||values[0];el.onchange=()=>{prefs[id]={...prefs[id],[key]:el.value};save()};l.append(el);panel.append(l)}

control('Sprite','sprite',['engineer','robot','mage']);control('Suite decoration','decor',['plants','art','aquarium']);for(const [title,key,fallback]of [['Outfit color','color','#b8ddb1'],['Suite tile color','room','#354d44']]){const l=document.createElement('label');l.textContent=title;const input=document.createElement('input');input.type='color';input.value=prefs[id]?.[key]||fallback;input.oninput=()=>{prefs[id]={...prefs[id],[key]:input.value};save()};l.append(input);panel.append(l)}}

function renderCards(){$('count').textContent=agents.length;$('agents').replaceChildren();for(const a of agents){const b=document.createElement('button');b.className='agent-card'+(selected===a.id?' active':'');b.textContent=`${a.state==='working'?'●':a.state==='idle'?'◐':'○'} ${a.name} · ${a.state}`;const s=document.createElement('small');s.textContent=(a.workspace?.split(/[\\/]/).at(-1)||a.id.slice(-12))+' / '+a.activity;b.append(s);b.onclick=()=>inspect(a.id);$('agents').append(b)}}

async function poll(){try{const r=await fetch('/api/state');if(!r.ok)throw Error();const data=await r.json();if(data.error)throw Error(data.error);agents=data.agents;online=true;$('connection').textContent='● Local Codex telemetry · 2s updates';renderCards();if(selected){const a=agents.find(x=>x.id===selected),panel=$('inspector');if(a&&panel.querySelector('h3')){panel.querySelector('h3').textContent=a.name+' / '+a.state;const ps=panel.querySelectorAll(':scope > p');if(ps[0])ps[0].textContent=a.activity;if(ps[1])ps[1].textContent=a.summary||'No public progress message yet.'}}}catch{online=false;$('connection').textContent='○ Telemetry disconnected';agents=agents.map(a=>({...a,state:'unknown',activity:'Telemetry disconnected'}));renderCards()}$('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});setTimeout(poll,2000)}

canvas.onmousemove=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*1400/r.width,y=(e.clientY-r.top)*940/r.height;const a=!exterior&&agents.find(a=>{const p=positions.get(a.id);return p?.floor===floor&&Math.hypot(x-p.x,y-p.y)<35});$('tooltip').hidden=!a;if(a)$('tooltip').textContent=`${a.name} · ${a.state}\n${a.activity}\n${a.summary||'No public progress message'}\nLast event ${new Date(a.updatedAt).toLocaleTimeString()}`;canvas.dataset.hover=a?.id||''};canvas.onmouseleave=()=>{$('tooltip').hidden=true};canvas.onclick=()=>{if(canvas.dataset.hover)inspect(canvas.dataset.hover)};

for(const id of ['follow','motion','sleep']){if(prefs.settings?.[id]!==undefined){if(id==='sleep')$(id).value=prefs.settings[id];else $(id).checked=prefs.settings[id]}$(id).onchange=()=>{prefs.settings={follow:$('follow').checked,motion:$('motion').checked,sleep:$('sleep').value};save()}}

requestAnimationFrame(draw);poll();

