export const GRID = { cell_size_px: 32, columns: 48, rows: 22 };
export const TYPES = {
 platform: { label:'Platform', node:'StaticBody2D', color:'#72cfdd', w:5, h:1, mark:'P' },
 moving_platform: { label:'Moving platform', node:'AnimatableBody2D', color:'#a5a0ff', w:4, h:1, mark:'M' },
 key: { label:'Key', node:'Area2D', color:'#f6ca6c', w:1, h:1, mark:'K' },
 exit: { label:'Exit', node:'Area2D', color:'#7fe0b1', w:1, h:2, mark:'E' },
 killzone: { label:'Killzone', node:'Area2D', color:'#f08991', w:5, h:1, mark:'×' },
 player_start: { label:'Player start', node:'CharacterBody2D', color:'#f1f6ff', w:1, h:2, mark:'S' },
 enemy: { label:'Enemy', node:'CharacterBody2D', color:'#f1a874', w:1, h:2, mark:'N' },
 trap: { label:'Trap', node:'Area2D', color:'#f4a0cf', w:2, h:1, mark:'T' }
};
export const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
export function movementVector(o) {const d=o.distance??0;return{x:o.direction==='right'?d:o.direction==='left'?-d:0,y:o.direction==='down'?d:o.direction==='up'?-d:0};}
export function constrain(o) {
 o.w=clamp(Math.round(o.w),1,48);o.h=clamp(Math.round(o.h),1,22);
 o.x=clamp(Math.round(o.x),0,48-o.w);o.y=clamp(Math.round(o.y),0,22-o.h);
 if(o.type==='moving_platform'){const limit={right:48-o.x-o.w,left:o.x,down:22-o.y-o.h,up:o.y}[o.direction];o.distance=clamp(Math.round(o.distance),0,limit);o.speed=clamp(Number(o.speed),1,1000);}
 if(o.type==='enemy'){o.health=clamp(Math.round(o.health),1,10000);o.damage=clamp(Math.round(o.damage),0,1000);o.detection_range=clamp(Math.round(o.detection_range),0,48);o.patrol_distance=clamp(Math.round(o.patrol_distance),0,o.facing==='left'?o.x:48-o.x-o.w);o.patrol_speed=clamp(Math.round(o.patrol_speed),1,1000);}
 if(o.type==='trap'){o.damage=clamp(Math.round(o.damage),0,1000);o.active_seconds=clamp(Number(o.active_seconds),.1,60);o.inactive_seconds=clamp(Number(o.inactive_seconds),.1,60);}return o;
}
export function createObject(type,x,y,id) {
 if(typeof type!=='string'||!Object.hasOwn(TYPES,type))throw new Error('Choose a supported object type.');const t=TYPES[type];
 const o={id,type,name:t.label,x:clamp(Math.round(x),0,48-t.w),y:clamp(Math.round(y),0,22-t.h),w:t.w,h:t.h};
 if(type==='moving_platform')Object.assign(o,{direction:'right',distance:6,speed:60});
 if(type==='enemy')Object.assign(o,{health:100,damage:10,detection_range:6,patrol_distance:4,patrol_speed:80,facing:'right'});
 if(type==='trap')Object.assign(o,{trap_kind:'spikes',damage:25,active_seconds:1,inactive_seconds:2});
 if(type==='exit')o.next_level='';return constrain(o);
}
export function sampleLevel() {
 const specs=[['platform',0,18,9,4],['platform',11,16,5,1],['platform',18,14,5,1],['platform',26,12,5,1],['platform',35,10,7,1],['platform',40,18,8,4],['moving_platform',29,17,4,1],['killzone',9,21,31,1],['player_start',2,16,1,2],['key',28,11,1,1],['exit',40,8,1,2]];
 return{name:'Cave 01 — The crossing',objects:specs.map(([type,x,y,w,h],i)=>constrain(Object.assign(createObject(type,x,y,'sample-'+i),{w,h}))),path:[{x:2,y:17},{x:7,y:17},{x:10,y:14},{x:13,y:15},{x:17,y:12},{x:20,y:13},{x:24,y:10},{x:28,y:11},{x:32,y:8},{x:36,y:9},{x:40,y:9}]};
}
export function emptyLevel(){return{name:'Untitled cave',objects:[],path:[]};}
export function exportLevel(level) {
 return{schema_version:1,name:level.name,grid:{...GRID,origin:'top_left',x_axis:'right',y_axis:'down'},objects:level.objects.map(o=>{
 const r={id:o.id,type:o.type,name:o.name,grid_bounds:{x:o.x,y:o.y,width:o.w,height:o.h},godot:{suggested_node:TYPES[o.type].node,position_px:{x:(o.x+o.w/2)*32,y:(o.y+o.h/2)*32},size_px:{width:o.w*32,height:o.h*32}}};
 if(o.type==='moving_platform'){const v=movementVector(o);r.movement={direction:o.direction,distance_cells:o.distance,distance_px:o.distance*32,offset_px:{x:v.x*32,y:v.y*32},speed_px_per_second:o.speed,mode:'ping_pong'};}
 if(o.type==='exit')r.next_level_scene=o.next_level;
 if(o.type==='enemy')r.enemy={health:o.health,contact_damage:o.damage,facing:o.facing,detection_radius_cells:o.detection_range,detection_radius_px:o.detection_range*32,patrol_distance_cells:o.patrol_distance,patrol_offset_px:{x:(o.facing==='left'?-1:1)*o.patrol_distance*32,y:0},patrol_speed_px_per_second:o.patrol_speed};
 if(o.type==='trap')r.trap={kind:o.trap_kind,damage:o.damage,active_seconds:o.active_seconds,inactive_seconds:o.inactive_seconds};return r;
 }),traversal_path:level.path.map((p,i)=>({step:i+1,grid:{x:p.x,y:p.y},position_px:{x:p.x*32+16,y:p.y*32+16}})),notes:'Planning reference, not a Godot scene. Positions use centered object anchors. Traversal is an intended route, not a physics or collision test.'};
}
const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw new Error('Invalid '+label+'.');return v;};
const shortText=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw new Error('Invalid '+label+'.');return v;};
const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid '+label+'.');return v;};
export function importLevel(raw) {
 if(!raw||raw.schema_version!==1)throw new Error('Use a Cave Workshop JSON export (schema version 1).');
 if(!raw.grid||raw.grid.cell_size_px!==32||raw.grid.columns!==48||raw.grid.rows!==22)throw new Error('This editor uses a 48 × 22 grid with 32 px cells.');
 if(!Array.isArray(raw.objects)||raw.objects.length>500||!Array.isArray(raw.traversal_path)||raw.traversal_path.length>200)throw new Error('The layout has too many objects or route points.');
 const ids=new Set();let starts=0;
 const objects=raw.objects.map(item=>{
 if(!item||typeof item.type!=='string'||!Object.hasOwn(TYPES,item.type))throw new Error('Unsupported object type.');
 const id=shortText(item.id,100,'object ID');if(!id||ids.has(id))throw new Error('Object IDs must be unique.');ids.add(id);
 const b=item.grid_bounds;if(!b)throw new Error('Missing object bounds.');
 const w=integer(b.width,1,48,'width'),h=integer(b.height,1,22,'height');
 const o={id,type:item.type,name:shortText(item.name,80,'object name'),x:integer(b.x,0,48-w,'X'),y:integer(b.y,0,22-h,'Y'),w,h};
 if(o.type==='player_start'&&++starts>1)throw new Error('A level can have only one player start.');
 if(o.type==='moving_platform'){const m=item.movement;if(!m||!['right','left','up','down'].includes(m.direction))throw new Error('Invalid movement direction.');o.direction=m.direction;o.distance=integer(m.distance_cells,0,48,'movement distance');if(typeof m.speed_px_per_second!=='number'||!Number.isFinite(m.speed_px_per_second)||m.speed_px_per_second<1||m.speed_px_per_second>1000)throw new Error('Invalid movement speed.');o.speed=m.speed_px_per_second;const v=movementVector(o);if(o.x+v.x<0||o.x+v.x+o.w>48||o.y+v.y<0||o.y+v.y+o.h>22)throw new Error('Platform movement leaves the grid.');}
 if(o.type==='exit')o.next_level=shortText(item.next_level_scene??'',200,'next level');
 if(o.type==='enemy'){const e=item.enemy;if(!e||!['left','right'].includes(e.facing))throw new Error('Invalid enemy settings.');o.facing=e.facing;o.health=integer(e.health,1,10000,'enemy health');o.damage=integer(e.contact_damage,0,1000,'enemy damage');o.detection_range=integer(e.detection_radius_cells,0,48,'detection radius');o.patrol_distance=integer(e.patrol_distance_cells,0,o.facing==='left'?o.x:48-o.x-o.w,'patrol distance');o.patrol_speed=integer(e.patrol_speed_px_per_second,1,1000,'patrol speed');}
 if(o.type==='trap'){const t=item.trap;if(!t||!['spikes','timed'].includes(t.kind))throw new Error('Invalid trap settings.');o.trap_kind=t.kind;o.damage=integer(t.damage,0,1000,'trap damage');o.active_seconds=number(t.active_seconds,.1,60,'active duration');o.inactive_seconds=number(t.inactive_seconds,.1,60,'inactive duration');}return o;
 });
 const path=raw.traversal_path.map(p=>{if(!p?.grid)throw new Error('Invalid route point.');return{x:integer(p.grid.x,0,47,'route X'),y:integer(p.grid.y,0,21,'route Y')};});return{name:shortText(raw.name,100,'level name'),objects,path};
}
export function inspectLevel(level){const issues=[];if(!level.objects.some(o=>o.type==='player_start'))issues.push('Add a player start.');if(!level.objects.some(o=>o.type==='key'))issues.push('Add a key for your key-and-exit loop.');if(!level.objects.some(o=>o.type==='exit'))issues.push('Add an exit.');if(level.path.length<2)issues.push('Sketch at least two route points to preview traversal.');return issues;}
export function pointOnPath(path,fraction){if(!path.length)return null;const pts=path.map(p=>({x:p.x*32+16,y:p.y*32+16}));if(pts.length===1)return pts[0];const lengths=pts.slice(1).map((p,i)=>Math.hypot(p.x-pts[i].x,p.y-pts[i].y));let target=clamp(fraction,0,1)*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(target<=lengths[i]){const t=lengths[i]?target/lengths[i]:0;return{x:pts[i].x+(pts[i+1].x-pts[i].x)*t,y:pts[i].y+(pts[i+1].y-pts[i].y)*t};}target-=lengths[i];}return pts.at(-1);}
