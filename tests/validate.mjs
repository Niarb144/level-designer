import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as model from '../public/model.js';
const root=fileURLToPath(new URL('../public/', import.meta.url));
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('All eight object types export pixel positions and sizes',()=>{
 const level={name:'All tools',objects:Object.keys(model.TYPES).map((type,i)=>model.createObject(type,10+i*2,8,'type-'+i)),path:[]},data=model.exportLevel(level);
 assert.deepEqual(new Set(data.objects.map(o=>o.type)),new Set(Object.keys(model.TYPES)));
 for(const o of data.objects){assert.equal(o.godot.position_px.x,(o.grid_bounds.x+o.grid_bounds.width/2)*32);assert.equal(o.godot.size_px.height,o.grid_bounds.height*32);}
 assert.deepEqual(model.importLevel(JSON.parse(JSON.stringify(data))),level);
});
check('Existing layouts remain compatible and new settings reject invalid imports',()=>{
 const legacy=model.sampleLevel();assert.deepEqual(model.importLevel(model.exportLevel(legacy)),legacy);
 const level={name:'Hazards',objects:[model.createObject('enemy',10,5,'enemy'),model.createObject('trap',20,8,'trap')],path:[]};
 const data=model.exportLevel(level);assert.equal(data.objects[0].enemy.detection_radius_px,192);assert.equal(data.objects[1].trap.damage,25);
 for(const mutate of [d=>d.objects[0].enemy.health=0,d=>d.objects[0].enemy.contact_damage=-1,d=>d.objects[0].enemy.facing='up',d=>d.objects[0].enemy.patrol_distance_cells=48,d=>d.objects[0].enemy.detection_radius_cells=NaN,d=>d.objects[1].trap.kind='unknown',d=>d.objects[1].trap.active_seconds=0,d=>d.objects[1].trap.inactive_seconds=Infinity,d=>d.objects[1].trap.damage=-1]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>model.importLevel(bad));}
});
check('Movement directions, boundary limits, and pixel offsets',()=>{
 for(const[direction,expected]of [['right',{x:192,y:0}],['left',{x:-192,y:0}],['down',{x:0,y:192}],['up',{x:0,y:-192}]]){
 const o=Object.assign(model.createObject('moving_platform',10,10,'move'),{direction,distance:6});model.constrain(o);const out=model.exportLevel({name:'Test',objects:[o],path:[]}).objects[0];assert.deepEqual(out.movement.offset_px,expected);assert.equal(out.movement.speed_px_per_second,60);
 }
 const o=Object.assign(model.createObject('moving_platform',47,21,'edge'),{distance:100,speed:-4});model.constrain(o);assert.ok(o.x+o.w+o.distance<=48);assert.equal(o.speed,1);
});
check('Invalid imports fail without accepting unsafe types or bad coordinates',()=>{
 const data=model.exportLevel(model.sampleLevel());
 for(const mutate of [d=>d.schema_version=2,d=>d.grid.cell_size_px=64,d=>d.objects[0].type='__proto__',d=>d.objects[0].type='toString',d=>d.objects[0].grid_bounds.x=-1,d=>d.objects[0].grid_bounds.width=200,d=>d.objects[1].id=d.objects[0].id,d=>d.objects[6].movement.speed_px_per_second=0,d=>d.objects[6].movement.distance_cells=48,d=>d.traversal_path[0].grid.x=48]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>model.importLevel(bad));}
});
check('Route interpolation and blank-level setup checks',()=>{
 assert.deepEqual(model.pointOnPath([{x:0,y:0},{x:4,y:0}],.5),{x:80,y:16});assert.deepEqual(model.pointOnPath([{x:0,y:0},{x:4,y:0}],1),{x:144,y:16});assert.equal(model.pointOnPath([],0),null);assert.equal(model.inspectLevel(model.emptyLevel()).length,4);assert.equal(model.inspectLevel(model.sampleLevel()).length,0);
});
check('HTML assets and metadata are valid',()=>{
 const html=fs.readFileSync(root+'index.html','utf8');for(const match of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g))assert.ok(fs.existsSync(root+match[1].slice(2)));assert.match(html,/name="viewport"/);assert.match(html,/rel="icon"/);assert.ok(!html.includes('sites-project://'));
});

// DOM interaction harness: execute the shipped app and its event handlers.
// This checks UI logic without claiming a real browser rendering or WebMCP runtime test.
class Element {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.dataset={};this.style={};this.attributes={};this.listeners={};this.className='';this.value='';this.disabled=false;this.open=false;this._text='';this.parentElement=null;this.capture=new Set();}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='id'){this.id=String(v);this.doc.ids.set(this.id,this);}if(k==='class')this.className=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);if(k==='type')this.type=String(v);}
 getAttribute(k){return this.attributes[k]??null;}
 get classList(){return{toggle:(name,on)=>{const set=new Set(this.className.split(' ').filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');},contains:name=>this.className.split(' ').includes(name)};}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children.forEach(n=>n.parentElement=null);this.children=[];this._text='';this.append(...nodes);}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 async fire(name,args={}){const event={target:this,button:0,pointerId:1,key:'',preventDefault(){this.prevented=true;},...args};await Promise.all((this.listeners[name]??[]).map(fn=>fn(event)));return event;}
 click(){if(!this.disabled){if(this.tagName==='A')this.doc.downloads.push({...this.attributes});return this.fire('click');}}
 focus(){this.doc.activeElement=this;return this.fire('focus');}
 closest(selector){const attr=selector.slice(1,-1);let n=this;while(n){if(n.attributes[attr]!==undefined)return n;n=n.parentElement;}return null;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
 setPointerCapture(id){this.capture.add(id);}hasPointerCapture(id){return this.capture.has(id);}releasePointerCapture(id){this.capture.delete(id);}
 createSVGPoint(){return{x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}};}getScreenCTM(){return{inverse(){return{};}};}
 showModal(){this.open=true;}async close(value){this.returnValue=value;this.open=false;await this.fire('close');}
}
class Doc extends Element {
 constructor(){super('document',null);this.doc=this;this.ids=new Map();this.downloads=[];this.body=new Element('body',this);this.activeElement=this.body;this.tools=new Map();this.modelContext={registerTool:(tool)=>this.tools.set(tool.name,tool)};}
 createElement(tag){return new Element(tag,this);}createElementNS(ns,tag){return new Element(tag,this);}getElementById(id){return this.ids.get(id);}
 querySelectorAll(selector){if(selector==='[data-tool]')return this.palette;throw new Error('Harness unsupported selector '+selector);}
}
const doc=new Doc();const html=fs.readFileSync(root+'index.html','utf8');
for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=doc.createElement(m[1]);n.setAttribute('id',m[2]);doc.body.append(n);}
doc.palette=[];for(const m of html.matchAll(/<button[^>]*data-tool="([^"]+)"[^>]*>/g)){const n=doc.createElement('button');n.setAttribute('data-tool',m[1]);doc.palette.push(n);doc.body.append(n);}
const frames=new Map(),blobs=new Map();let clock=0,frameID=0,urlID=0;
const window={addEventListener:(name,fn)=>doc.addEventListener(name,fn)};
const context=vm.createContext({document:doc,window,crypto:globalThis.crypto,Blob,AbortController,URL:{createObjectURL:blob=>{const id='blob:test-'+(++urlID);blobs.set(id,blob);return id;},revokeObjectURL:()=>{}},performance:{now:()=>clock},requestAnimationFrame:fn=>{frames.set(++frameID,fn);return frameID;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>1,clearTimeout:()=>{},console});
const modelModule=new vm.SyntheticModule(Object.keys(model),function(){for(const[k,v]of Object.entries(model))this.setExport(k,v);},{context});
const appModule=new vm.SourceTextModule(fs.readFileSync(root+'app.js','utf8'),{context});await appModule.link(()=>modelModule);await appModule.evaluate();
const layout=()=>JSON.parse(JSON.stringify(doc.tools.get('read_level_layout').execute({}).layout));
const byTool=type=>doc.palette.find(b=>b.dataset.tool===type);
const objectNode=id=>doc.getElementById('objects-layer').children.find(n=>n.dataset.entityId===id);
const prop=key=>{const search=n=>n.dataset.property===key?n:n.children.map(search).find(Boolean);return search(doc.getElementById('properties'));};
const pointer=async(x,y,target=doc.getElementById('board'),name='pointerdown')=>doc.getElementById('board').fire(name,{clientX:x*32+4,clientY:y*32+4,target});
check('Initial app renders the sample objects, checklist, and tools',()=>{assert.equal(doc.getElementById('objects-layer').children.length,11);assert.equal(doc.tools.size,3);assert.equal(doc.getElementById('preview-btn').disabled,false);});
for(const type of Object.keys(model.TYPES)){const before=layout().objects.length;await byTool(type).click();await pointer(5,4);assert.equal(layout().objects.length,before+(type==='player_start'?0:1));assert.equal(layout().objects.filter(o=>o.type==='player_start').length,1);}checks++;console.log('PASS Placement of every object type and unique player start');
await byTool('select').click();let o=layout().objects.find(o=>o.type==='moving_platform');await pointer(o.grid_bounds.x,o.grid_bounds.y,objectNode(o.id));await pointer(o.grid_bounds.x+2,o.grid_bounds.y-2,doc.getElementById('board'),'pointermove');await doc.getElementById('board').fire('pointerup');let moved=layout().objects.find(x=>x.id===o.id);assert.equal(moved.grid_bounds.x,o.grid_bounds.x+2);assert.equal(moved.grid_bounds.y,o.grid_bounds.y-2);await doc.getElementById('undo-btn').click();assert.deepEqual(layout().objects.find(x=>x.id===o.id).grid_bounds,o.grid_bounds);checks++;console.log('PASS Drag snaps objects and undo restores original geometry');
o=layout().objects.find(o=>o.type==='moving_platform');await pointer(o.grid_bounds.x,o.grid_bounds.y,objectNode(o.id));prop('direction').value='up';await prop('direction').fire('change');prop('distance').value='3';await prop('distance').fire('change');prop('speed').value='90';await prop('speed').fire('change');moved=layout().objects.find(x=>x.id===o.id);assert.deepEqual(moved.movement.offset_px,{x:0,y:-96});assert.equal(moved.movement.speed_px_per_second,90);checks++;console.log('PASS Inspector movement settings appear in JSON export');
prop('w').value='500';await prop('w').fire('change');const resized=layout().objects.find(x=>x.id===o.id);assert.ok(resized.grid_bounds.x+resized.grid_bounds.width<=48);checks++;console.log('PASS Oversized inspector values remain within grid');
await byTool('path').click();const pathBefore=layout().traversal_path.length;await pointer(8,7);assert.equal(layout().traversal_path.length,pathBefore+1);const pointNode=doc.getElementById('waypoints-layer').children.at(-1);await pointer(8,7,pointNode);await pointer(9,6,doc.getElementById('board'),'pointermove');await doc.getElementById('board').fire('pointerup');assert.deepEqual(layout().traversal_path.at(-1).grid,{x:9,y:6});checks++;console.log('PASS Route points can be added and dragged');
await doc.getElementById('preview-btn').click();assert.equal(doc.getElementById('preview-btn').textContent,'Stop preview');clock=1500;for(const[id,fn]of [...frames]){frames.delete(id);fn(clock);}assert.ok(doc.getElementById('preview-layer').children[0].getAttribute('transform'));assert.notEqual(doc.getElementById('progress-fill').style.width,'0%');await doc.getElementById('preview-btn').click();assert.equal(doc.getElementById('preview-layer').children.length,0);checks++;console.log('PASS Preview animates traversal and stops cleanly');
await byTool('enemy').click();await pointer(12,6);const enemyId=layout().objects.at(-1).id;
for(const[key,value]of [['health','75'],['damage','12'],['detection_range','8'],['facing','left'],['patrol_distance','6'],['patrol_speed','70']]){prop(key).value=value;await prop(key).fire('change');}
let enemy=layout().objects.find(o=>o.id===enemyId);assert.equal(enemy.enemy.health,75);assert.equal(enemy.enemy.contact_damage,12);assert.equal(enemy.enemy.detection_radius_px,256);assert.deepEqual(enemy.enemy.patrol_offset_px,{x:-192,y:0});assert.equal(enemy.enemy.patrol_speed_px_per_second,70);assert.ok(doc.getElementById('movement-guides').children.some(n=>n.tagName==='CIRCLE'));await byTool('select').click();await pointer(12,6,objectNode(enemyId));await pointer(4,5,doc.getElementById('board'),'pointermove');await doc.getElementById('board').fire('pointerup');enemy=layout().objects.find(o=>o.id===enemyId);assert.equal(enemy.grid_bounds.x,4);assert.equal(enemy.enemy.patrol_distance_cells,4);checks++;console.log('PASS Enemy inspector, detection guides, dragging, and patrol bounds');
await byTool('trap').click();await pointer(22,15);const trapId=layout().objects.at(-1).id;
for(const[key,value]of [['trap_kind','timed'],['damage','40'],['active_seconds','1.5'],['inactive_seconds','3']]){prop(key).value=value;await prop(key).fire('change');}
assert.deepEqual(layout().objects.find(o=>o.id===trapId).trap,{kind:'timed',damage:40,active_seconds:1.5,inactive_seconds:3});assert.equal(prop('active_seconds').step,'0.1');checks++;console.log('PASS Trap type, damage, and fractional timing settings');
for(const[key,type]of [['9','enemy'],['0','trap'],['8','path']]){await doc.fire('keydown',{target:doc.getElementById('board'),key});assert.equal(doc.getElementById('board').dataset.tool,type);}checks++;console.log('PASS New enemy and trap shortcuts preserve the route shortcut');
await doc.getElementById('export-btn').click();const download=doc.downloads.at(-1);assert.match(download.download,/\.json$/);const exported=JSON.parse(await blobs.get(download.href).text());assert.deepEqual(exported,layout());checks++;console.log('PASS Export button downloads current structured JSON');
await doc.getElementById('new-btn').click();assert.ok(doc.getElementById('new-dialog').open);await doc.getElementById('new-dialog').close('new');assert.equal(layout().objects.length,0);assert.equal(doc.getElementById('preview-btn').disabled,true);await doc.getElementById('import-file').fire('change',{target:{files:[{size:2000,text:async()=>JSON.stringify(exported)}]}});assert.deepEqual(layout(),exported);checks++;console.log('PASS New-level confirmation, blank state, and JSON re-import');
const beforeBad=JSON.stringify(layout());await doc.getElementById('import-file').fire('change',{target:{files:[{size:30,text:async()=>'{bad'}]}});assert.equal(JSON.stringify(layout()),beforeBad);assert.match(doc.getElementById('toast').textContent,/not valid JSON/);checks++;console.log('PASS Failed import preserves the current layout');
await byTool('platform').click();const nBefore=layout().objects.length;doc.activeElement=doc.getElementById('board');await doc.fire('keydown',{target:doc.getElementById('board'),key:' '});assert.equal(layout().objects.length,nBefore+1);await byTool('select').click();const last=layout().objects.at(-1);await pointer(last.grid_bounds.x,last.grid_bounds.y,objectNode(last.id));await doc.fire('keydown',{target:doc.getElementById('board'),key:'Delete'});assert.equal(layout().objects.length,nBefore);checks++;console.log('PASS Keyboard placement and deletion');
await doc.getElementById('zoom-in').click();assert.equal(doc.getElementById('board').style.width,'150%');await doc.getElementById('fit-btn').click();assert.equal(doc.getElementById('board').style.width,'100%');checks++;console.log('PASS Zoom and fit controls');
const beforeTools=layout().objects.length;doc.tools.get('add_level_objects').execute({objects:[{type:'key',x:20,y:5},{type:'exit',x:30,y:8}]});assert.equal(layout().objects.length,beforeTools+2);const toolState=JSON.stringify(layout());assert.throws(()=>doc.tools.get('add_level_objects').execute({objects:[{type:'key',x:1,y:1},{type:'key',x:-1,y:1}]}));assert.equal(JSON.stringify(layout()),toolState);doc.tools.get('replace_traversal_path').execute({points:[{x:1,y:1},{x:4,y:2}]});assert.equal(layout().traversal_path.length,2);assert.throws(()=>doc.tools.get('replace_traversal_path').execute({points:[{x:100,y:2}]}));checks++;console.log('PASS Browser-tool handlers update visible state and reject invalid batches atomically (harness only)');
console.log(JSON.stringify({passed:checks,browser_rendering:'unavailable',native_webmcp_context:'unavailable',result:'PASS'}));
