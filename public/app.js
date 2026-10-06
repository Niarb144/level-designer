import {GRID,TYPES,clamp,createObject,constrain,movementVector,sampleLevel,emptyLevel,exportLevel,importLevel,inspectLevel,pointOnPath} from './model.js';

const $=id=>document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
const numericProperties=['x','y','w','h','distance','speed','health','damage','detection_range','patrol_distance','patrol_speed','active_seconds','inactive_seconds'];
function el(tag,attrs={},text){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,v);}if(text!==undefined)n.textContent=text;return n;}
function svg(tag,attrs={},text){const n=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
let level=sampleLevel(),selection=null,tool='select',history=[],dirty=false,drag=null,zoom=1,cursor={x:2,y:16},playing=false,frame=0,previewStarted=0,toastTimer;
const board=$('board');
const clone=value=>JSON.parse(JSON.stringify(value));
const selectedObject=()=>selection?.kind==='object'?level.objects.find(o=>o.id===selection.id):null;
function remember(){history.push(clone(level));if(history.length>60)history.shift();}
function markChanged(){dirty=true;$('save-state').textContent='Unsaved layout · export to keep';}
function announce(message,error=false){const n=$('toast');n.textContent=message;n.className='toast visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.className='toast',4500);}
function stopPreview(){playing=false;cancelAnimationFrame(frame);$('preview-layer').replaceChildren();$('preview-btn').textContent='Play preview';$('progress-fill').style.width='0%';renderCanvas();}
function setTool(next){if(!['select','path',...Object.keys(TYPES)].includes(next))throw new Error('Unknown tool.');stopPreview();tool=next;selection=null;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});board.dataset.tool=tool;$('instruction').textContent=next==='select'?'Select and drag an object. Arrow keys also move it.':next==='path'?'Click to add a waypoint. Drag a point to adjust the route.':'Click to place '+TYPES[next].label.toLowerCase()+'. Switch to Select / move to drag.';render();}
function addObject(type,x,y){
 stopPreview();const existing=type==='player_start'?level.objects.find(o=>o.type===type):null;
 if(!existing&&level.objects.length>=500)throw new Error('This level is limited to 500 objects.');
 remember();let o;if(existing){o=existing;o.x=x;o.y=y;constrain(o);}else{o=createObject(type,x,y,crypto.randomUUID());level.objects.push(o);}
 selection={kind:'object',id:o.id};markChanged();render();return o;
}
function addPoint(x,y){stopPreview();if(level.path.length>=200)throw new Error('This route is limited to 200 points.');remember();level.path.push({x:clamp(Math.round(x),0,47),y:clamp(Math.round(y),0,21)});selection={kind:'point',index:level.path.length-1};markChanged();render();}
function deleteSelection(){if(!selection)return;stopPreview();remember();if(selection.kind==='object')level.objects=level.objects.filter(o=>o.id!==selection.id);else level.path.splice(selection.index,1);selection=null;markChanged();render();}
function undo(){if(!history.length)return;stopPreview();level=history.pop();selection=null;markChanged();render();}
function setProperty(key,value){
 const o=selectedObject(),p=selection?.kind==='point'?level.path[selection.index]:null;if(!o&&!p)return;
 if(numericProperties.includes(key)&&!Number.isFinite(Number(value))){announce('Enter a valid number.',true);renderInspector();return;}
 stopPreview();remember();
 if(p){p[key]=clamp(Math.round(Number(value)),0,key==='x'?47:21);}else{if(numericProperties.includes(key))o[key]=Number(value);else o[key]=value;constrain(o);}
 markChanged();render();
}
function field(label,key,value,options={}){
 const wrap=el('label',{class:'field'},label);let input;
 if(options.choices){input=el('select',{'data-property':key,'aria-label':label});for(const[v,t]of options.choices){const opt=el('option',{value:v},t);input.append(opt);}input.value=value;}
 else{input=el('input',{'data-property':key,'aria-label':label,type:options.type??'number'});input.value=value;if(options.type!=='text'){input.min=String(options.min??0);input.max=String(options.max??48);input.step=String(options.step??1);}else input.maxLength=options.maxLength??80;}
 input.addEventListener('change',()=>{if(input.type==='number'&&input.value===''){announce('Enter a number.',true);input.value=value;return;}setProperty(key,input.value);});wrap.append(input);return wrap;
}
function renderInspector(){
 const root=$('properties');root.replaceChildren();const o=selectedObject();
 if(selection?.kind==='point'&&level.path[selection.index]){
  const p=level.path[selection.index];root.append(el('div',{class:'type-badge'},'Route point '+(selection.index+1)));const xy=el('div',{class:'field-grid'});xy.append(field('X · cells','x',p.x,{max:47}),field('Y · cells','y',p.y,{max:21}));root.append(xy);const del=el('button',{class:'danger'},'Delete waypoint');del.addEventListener('click',deleteSelection);root.append(del);return;
 }
 if(!o){const empty=el('div',{class:'empty-properties'});empty.append(el('div',{class:'empty-icon','aria-hidden':'true'},'⌖'),el('p',{},'Select an object to edit its position, size, and behavior.'));root.append(empty);return;}
 const t=TYPES[o.type],badge=el('div',{class:'type-badge'});badge.append(el('i',{style:'--c:'+t.color}),el('span',{},t.label));root.append(badge,field('Name','name',o.name,{type:'text'}));
 root.append(el('div',{class:'sub-label'},'POSITION · TOP LEFT'));
 const xy=el('div',{class:'field-grid'});xy.append(field('X · cells','x',o.x,{max:48-o.w}),field('Y · cells','y',o.y,{max:22-o.h}));root.append(xy);
 root.append(el('div',{class:'sub-label'},'SIZE'));
 const wh=el('div',{class:'field-grid'});wh.append(field('Width · cells','w',o.w,{min:1,max:48-o.x}),field('Height · cells','h',o.h,{min:1,max:22-o.y}));root.append(wh);
 root.append(el('p',{class:'property-note'},'Godot center: '+((o.x+o.w/2)*32)+', '+((o.y+o.h/2)*32)+' px · '+o.w*32+' × '+o.h*32+' px'));
 if(o.type==='moving_platform'){
  root.append(el('div',{class:'sub-label'},'PING-PONG MOVEMENT'),field('Direction','direction',o.direction,{choices:[['right','Right'],['left','Left'],['up','Up'],['down','Down']]}),field('Travel distance · cells','distance',o.distance,{max:{right:48-o.x-o.w,left:o.x,down:22-o.y-o.h,up:o.y}[o.direction]}),field('Speed · px / second','speed',o.speed,{min:1,max:1000}),el('p',{class:'property-note'},o.distance*32+' px one way. The dashed guide shows the full travel range. Distance is limited to the grid.'));
 }
 if(o.type==='exit')root.append(field('Next level scene · optional','next_level',o.next_level,{type:'text',maxLength:200}));
 if(o.type==='enemy'){
  root.append(el('div',{class:'sub-label'},'ENEMY SETTINGS'),field('Health','health',o.health,{min:1,max:10000}),field('Contact damage','damage',o.damage,{max:1000}),field('Detection radius · cells','detection_range',o.detection_range),field('Patrol direction','facing',o.facing,{choices:[['right','Right'],['left','Left']]}),field('Patrol distance · cells','patrol_distance',o.patrol_distance,{max:o.facing==='left'?o.x:48-o.x-o.w}),field('Patrol speed · px / second','patrol_speed',o.patrol_speed,{min:1,max:1000}),el('p',{class:'property-note'},'Detection: '+o.detection_range*32+' px. Patrol: '+o.patrol_distance*32+' px one way. Guides appear when selected; enemy behavior is a reference for your Godot script.'));
 }
 if(o.type==='trap'){
  root.append(el('div',{class:'sub-label'},'TRAP SETTINGS'),field('Trap type','trap_kind',o.trap_kind,{choices:[['spikes','Spikes'],['timed','Timed hazard']]}),field('Damage','damage',o.damage,{max:1000}));
  if(o.trap_kind==='timed')root.append(field('Active duration · seconds','active_seconds',o.active_seconds,{min:.1,max:60,step:.1}),field('Inactive duration · seconds','inactive_seconds',o.inactive_seconds,{min:.1,max:60,step:.1}));
  root.append(el('p',{class:'property-note'},o.trap_kind==='timed'?'Timing is exported for your Godot script. The route preview does not simulate trap activation.':'A damage area for spikes. Use a killzone for instant death.'));
 }
 const del=el('button',{class:'danger'},'Delete object');del.addEventListener('click',deleteSelection);root.append(del);
}
function renderCanvas(){
 const objects=$('objects-layer'),guides=$('movement-guides'),route=$('route-layer'),points=$('waypoints-layer');objects.replaceChildren();guides.replaceChildren();route.replaceChildren();points.replaceChildren();
 for(const o of level.objects){
  const t=TYPES[o.type],g=svg('g',{'data-entity-id':o.id,class:'object'+(selection?.kind==='object'&&selection.id===o.id?' selected':''),transform:'translate('+o.x*32+' '+o.y*32+')'});
  g.append(svg('title',{},o.name+' — '+t.label+' · '+o.x+', '+o.y));
  g.append(svg('rect',{x:2,y:2,width:o.w*32-4,height:o.h*32-4,rx:3,fill:o.type==='killzone'?'#442c38':t.color+'22',stroke:t.color,'stroke-width':2}));
  if(o.type==='killzone')g.append(svg('rect',{x:3,y:3,width:o.w*32-6,height:o.h*32-6,fill:'url(#hazard)','pointer-events':'none'}));
  if(['platform','moving_platform'].includes(o.type))g.append(svg('line',{x1:3,y1:4,x2:o.w*32-3,y2:4,stroke:t.color,'stroke-width':4,'pointer-events':'none'}));
  g.append(svg('text',{x:o.w*16,y:o.h*16+5,'text-anchor':'middle',fill:t.color,'font-size':18},t.mark),svg('rect',{class:'outline',x:-2,y:-2,width:o.w*32+4,height:o.h*32+4,rx:4,'pointer-events':'none'}));objects.append(g);
  if(o.type==='moving_platform'){
   const v=movementVector(o),cx=(o.x+o.w/2)*32,cy=(o.y+o.h/2)*32;
   guides.append(svg('line',{x1:cx,y1:cy,x2:cx+v.x*32,y2:cy+v.y*32,stroke:t.color,'stroke-width':2,'stroke-dasharray':'8 6','pointer-events':'none'}),svg('rect',{x:(o.x+v.x)*32+2,y:(o.y+v.y)*32+2,width:o.w*32-4,height:o.h*32-4,rx:3,fill:'none',stroke:t.color,'stroke-width':2,'stroke-dasharray':'6 6',opacity:.6,'pointer-events':'none'}));
  }
  if(o.type==='enemy'&&selection?.kind==='object'&&selection.id===o.id){
   const cx=(o.x+o.w/2)*32,cy=(o.y+o.h/2)*32,offset=(o.facing==='left'?-1:1)*o.patrol_distance*32;
   guides.append(svg('circle',{cx,cy,r:o.detection_range*32,fill:'#f1a87408',stroke:t.color,'stroke-width':2,'stroke-dasharray':'4 8',opacity:.5,'pointer-events':'none'}),svg('line',{x1:cx,y1:cy,x2:cx+offset,y2:cy,stroke:t.color,'stroke-width':3,'stroke-dasharray':'8 6','pointer-events':'none'}),svg('rect',{x:o.x*32+offset+2,y:o.y*32+2,width:o.w*32-4,height:o.h*32-4,rx:3,fill:'none',stroke:t.color,'stroke-dasharray':'6 6',opacity:.6,'pointer-events':'none'}));
  }
 }
 if(level.path.length){route.append(svg('polyline',{points:level.path.map(p=>(p.x*32+16)+','+(p.y*32+16)).join(' '),fill:'none',stroke:'#dfabff','stroke-width':3,'stroke-dasharray':'8 7',opacity:.85,'pointer-events':'none'}));
  level.path.forEach((p,i)=>{const g=svg('g',{'data-point-index':i,class:'waypoint',transform:'translate('+(p.x*32+16)+' '+(p.y*32+16)+')',display:playing?'none':'block'});g.append(svg('circle',{r:12,fill:'#322741',stroke:selection?.kind==='point'&&selection.index===i?'#fff':'#dfabff','stroke-width':2}),svg('text',{'text-anchor':'middle',y:4,fill:'#f2d9ff','font-family':'ui-monospace,monospace','font-size':12,'pointer-events':'none'},String(i+1)));points.append(g);});
 }
 renderCursor();
}
function renderCursor(){const root=$('cursor-layer');root.replaceChildren();if(document.activeElement===board)root.append(svg('rect',{x:cursor.x*32+1,y:cursor.y*32+1,width:30,height:30,fill:'#ffffff0a',stroke:'#d3e0f2','stroke-dasharray':'4 3','stroke-width':2}));}
function renderChecklist(){const root=$('checklist');root.replaceChildren();const rows=[['Player start',level.objects.some(o=>o.type==='player_start')],['Key',level.objects.some(o=>o.type==='key')],['Exit',level.objects.some(o=>o.type==='exit')],['Route · '+level.path.length+' points',level.path.length>=2]];for(const[label,ok]of rows){const li=el('li');li.append(el('span',{class:ok?'check-mark':'check-pending','aria-label':ok?'Present':'Missing'},ok?'✓':'○'),el('span',{},label));root.append(li);}}
function render(){
 $('level-name').value=level.name;$('object-count').textContent=level.objects.length+' objects · '+level.path.length+' route points';$('undo-btn').disabled=!history.length;$('clear-path-btn').disabled=!level.path.length;$('preview-btn').disabled=level.path.length<2;
 renderCanvas();renderInspector();renderChecklist();
}
function worldPoint(e){const p=board.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const matrix=board.getScreenCTM();return matrix?p.matrixTransform(matrix.inverse()):null;}
function gridPoint(e){const p=worldPoint(e);if(!p||p.x<0||p.y<0||p.x>=1536||p.y>=704)return null;return{x:Math.floor(p.x/32),y:Math.floor(p.y/32)};}
board.addEventListener('pointerdown',e=>{
 if(e.button!==0||playing)return;const p=gridPoint(e);if(!p)return;e.preventDefault();board.focus({preventScroll:true});cursor=p;
 const point=e.target.closest('[data-point-index]'),entity=e.target.closest('[data-entity-id]');
 if(point&&(tool==='select'||tool==='path')){const index=Number(point.dataset.pointIndex);selection={kind:'point',index};drag={kind:'point',index,start:p,original:clone(level.path[index]),before:clone(level),changed:false};}
 else if(entity&&tool==='select'){const o=level.objects.find(o=>o.id===entity.dataset.entityId);selection={kind:'object',id:o.id};drag={kind:'object',id:o.id,start:p,original:clone(o),before:clone(level),changed:false};}
 else if(tool==='select'){selection=null;drag=null;}
 else{try{if(tool==='path')addPoint(p.x,p.y);else addObject(tool,p.x,p.y);}catch(err){announce(err.message,true);}drag=null;}
 if(drag)board.setPointerCapture(e.pointerId);render();
});
board.addEventListener('pointermove',e=>{
 const world=worldPoint(e);if(!world)return;const p={x:clamp(Math.floor(world.x/32),0,47),y:clamp(Math.floor(world.y/32),0,21)};cursor=p;
 if(!drag){renderCursor();return;}const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
 if(drag.kind==='object'){const o=level.objects.find(o=>o.id===drag.id);Object.assign(o,drag.original,{x:drag.original.x+dx,y:drag.original.y+dy});constrain(o);}else{level.path[drag.index]={x:clamp(drag.original.x+dx,0,47),y:clamp(drag.original.y+dy,0,21)};}
 drag.changed=JSON.stringify(level)!==JSON.stringify(drag.before);renderCanvas();renderInspector();
});
function finishDrag(e){if(!drag)return;if(drag.changed){history.push(drag.before);if(history.length>60)history.shift();markChanged();}drag=null;if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);render();}
board.addEventListener('pointerup',finishDrag);board.addEventListener('pointercancel',finishDrag);board.addEventListener('focus',renderCursor);board.addEventListener('blur',()=>{if(!drag)$('cursor-layer').replaceChildren();});
function moveSelection(dx,dy){if(!selection)return false;stopPreview();remember();const o=selectedObject();if(o){o.x+=dx;o.y+=dy;constrain(o);}else{const p=level.path[selection.index];p.x=clamp(p.x+dx,0,47);p.y=clamp(p.y+dy,0,21);}markChanged();render();return true;}
document.addEventListener('keydown',e=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('new-dialog').open)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const shortcuts={'1':'select','2':'platform','3':'moving_platform','4':'key','5':'exit','6':'killzone','7':'player_start','8':'path','9':'enemy','0':'trap'};if(Object.hasOwn(shortcuts,e.key)){setTool(shortcuts[e.key]);return;}
 if(e.key==='Escape'){stopPreview();setTool('select');return;}
 if(e.key==='Delete'||e.key==='Backspace'){if(selection){e.preventDefault();deleteSelection();}return;}
 if(document.activeElement!==board)return;
 const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();if(tool==='select'&&selection)moveSelection(...d);else{cursor={x:clamp(cursor.x+d[0],0,47),y:clamp(cursor.y+d[1],0,21)};renderCursor();}return;}
 if(e.key===' '){e.preventDefault();try{if(tool==='path')addPoint(cursor.x,cursor.y);else if(tool!=='select')addObject(tool,cursor.x,cursor.y);}catch(err){announce(err.message,true);}}
 if(e.key==='Enter'){e.preventDefault();const o=[...level.objects].reverse().find(o=>cursor.x>=o.x&&cursor.x<o.x+o.w&&cursor.y>=o.y&&cursor.y<o.y+o.h);selection=o?{kind:'object',id:o.id}:null;setSelectWithoutReset();render();}
});
function setSelectWithoutReset(){tool='select';board.dataset.tool=tool;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});$('instruction').textContent='Select and drag an object. Arrow keys also move it.';}
function playPreview(){
 if(playing){stopPreview();return;}if(level.path.length<2){announce('Add at least two route points first.',true);return;}
 playing=true;selection=null;render();$('preview-btn').textContent='Stop preview';previewStarted=performance.now();
 const routeLength=level.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-level.path[i].x,p.y-level.path[i].y)*32,0);const duration=Math.max(3000,routeLength/250*1000);
 const marker=svg('g');marker.append(svg('circle',{r:17,fill:'#dfabff22',stroke:'#e9c5ff','stroke-width':2}),svg('circle',{r:5,fill:'#f4ddff'}));$('preview-layer').replaceChildren(marker);
 function tick(now){if(!playing)return;const elapsed=(now-previewStarted)/1000,fraction=Math.min((now-previewStarted)/duration,1),p=pointOnPath(level.path,fraction);marker.setAttribute('transform','translate('+p.x+' '+p.y+')');$('progress-fill').style.width=fraction*100+'%';
  for(const o of level.objects.filter(o=>o.type==='moving_platform')){const n=[...$('objects-layer').children].find(n=>n.dataset.entityId===o.id);const v=movementVector(o),oneWay=o.distance*32/o.speed;const phase=oneWay?elapsed/oneWay%2:0,amount=phase<=1?phase:2-phase;n.setAttribute('transform','translate('+((o.x+v.x*amount)*32)+' '+((o.y+v.y*amount)*32)+')');}
  if(fraction<1)frame=requestAnimationFrame(tick);else{stopPreview();announce('Preview complete. Test the route with your player in Godot.');}
 }frame=requestAnimationFrame(tick);
}
function downloadJSON(){const data=JSON.stringify(exportLevel(level),null,2);const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:(level.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'cave-level')+'.json'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);dirty=false;$('save-state').textContent='JSON export requested';announce('JSON download requested. Keep the file to reopen this layout.');}
async function loadFile(file){if(!file)return;try{if(file.size>2*1024*1024)throw new Error('Choose a JSON file smaller than 2 MB.');const next=importLevel(JSON.parse(await file.text()));stopPreview();remember();level=next;selection=null;markChanged();render();announce('Layout imported. Undo restores your previous layout.');}catch(err){announce(err instanceof SyntaxError?'That file is not valid JSON.':err.message,true);}finally{$('import-file').value='';}}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('undo-btn').addEventListener('click',undo);$('clear-path-btn').addEventListener('click',()=>{if(!level.path.length)return;stopPreview();remember();level.path=[];selection=null;markChanged();render();});
$('level-name').addEventListener('change',e=>{remember();level.name=e.target.value.trim()||'Untitled cave';markChanged();render();});
$('preview-btn').addEventListener('click',playPreview);$('export-btn').addEventListener('click',downloadJSON);$('import-btn').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>loadFile(e.target.files[0]));
$('new-btn').addEventListener('click',()=>{$('new-dialog').returnValue='';$('new-dialog').showModal();});$('new-dialog').addEventListener('close',()=>{if($('new-dialog').returnValue!=='new')return;stopPreview();remember();level=emptyLevel();selection=null;markChanged();setTool('select');render();announce('Blank level ready. Start with a platform and player start.');});
function setZoom(next){zoom=clamp(next,1,3);board.style.width=zoom===1?'100%':zoom*100+'%';$('zoom-label').textContent=zoom===1?'Fit':Math.round(zoom*100)+'%';$('zoom-out').disabled=zoom===1;$('zoom-in').disabled=zoom===3;}
$('zoom-in').addEventListener('click',()=>setZoom(zoom+.5));$('zoom-out').addEventListener('click',()=>setZoom(zoom-.5));$('fit-btn').addEventListener('click',()=>setZoom(1));
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
for(let x=0;x<=48;x+=4)$('rulers').append(svg('text',{x:x*32,y:-8,fill:'#8293aa','font-size':13,'font-family':'ui-monospace,monospace','text-anchor':'middle'},String(x)));
for(let y=0;y<=22;y+=2)$('rulers').append(svg('text',{x:-7,y:y*32+4,fill:'#8293aa','font-size':13,'font-family':'ui-monospace,monospace','text-anchor':'end'},String(y)));
setTool('select');setZoom(1);

// Browser tools share the editor's actions and validation; no network or extra permissions.
const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'read_level_layout',title:'Read level layout',description:'Read the current level layout as structured data, including setup checks.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');return{layout:exportLevel(level),setup_issues:inspectLevel(level)};}});
 register({name:'add_level_objects',title:'Add level objects',description:'Add a batch of objects to the visible grid. Adding a player start moves the existing start.',inputSchema:{type:'object',properties:{objects:{type:'array',minItems:1,maxItems:50,items:{type:'object',properties:{type:{type:'string',enum:Object.keys(TYPES)},x:{type:'integer',minimum:0,maximum:47},y:{type:'integer',minimum:0,maximum:21}},required:['type','x','y'],additionalProperties:false}}},required:['objects'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='objects')||!Array.isArray(input.objects)||input.objects.length<1||input.objects.length>50)throw new Error('Supply 1–50 objects.');for(const item of input.objects)if(!item||Object.keys(item).some(k=>!['type','x','y'].includes(k))||!Object.hasOwn(TYPES,item.type)||!Number.isInteger(item.x)||item.x<0||item.x>47||!Number.isInteger(item.y)||item.y<0||item.y>21)throw new Error('Invalid object type or grid position.');const newStarts=input.objects.some(o=>o.type==='player_start')&&!level.objects.some(o=>o.type==='player_start')?1:0;const newObjects=input.objects.filter(o=>o.type!=='player_start').length+newStarts;if(level.objects.length+newObjects>500)throw new Error('This level is limited to 500 objects.');const result=input.objects.map(o=>addObject(o.type,o.x,o.y));return{added:result.map(o=>({id:o.id,type:o.type,x:o.x,y:o.y})),object_count:level.objects.length};}});
 register({name:'replace_traversal_path',title:'Replace traversal path',description:'Set the ordered intended route shown in the editor. This does not simulate physics.',inputSchema:{type:'object',properties:{points:{type:'array',maxItems:200,items:{type:'object',properties:{x:{type:'integer',minimum:0,maximum:47},y:{type:'integer',minimum:0,maximum:21}},required:['x','y'],additionalProperties:false}}},required:['points'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='points')||!Array.isArray(input.points)||input.points.length>200)throw new Error('Supply at most 200 grid points.');const points=input.points.map(p=>{if(!p||Object.keys(p).some(k=>!['x','y'].includes(k))||!Number.isInteger(p.x)||p.x<0||p.x>47||!Number.isInteger(p.y)||p.y<0||p.y>21)throw new Error('Invalid route point.');return{x:p.x,y:p.y};});stopPreview();remember();level.path=points;selection=null;markChanged();render();return{point_count:points.length};}});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
