import {icon} from './architecture-icons.js';
import {inventorySignature} from './service-facts.js';
import {openConnections} from './connection-manager.js';
import {groupArchitecture,roles,roleFor,moveDiagramItem,connectionNodes} from './architecture-groups.js';
import {arrangeArchitecture,renderArchitecture,types,zones,zoneFor} from './architecture-view.js';
import {generateArchitecture,environments} from './architecture-model.js';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('type').innerHTML=types.map(t=>`<option>${esc(t)}</option>`).join('');
const serviceId=new URLSearchParams(location.search).get('service');
let record,graph={revision:0,nodes:[],edges:[]},selected=null,linkMode=false,linkSource=null,zoom=1,dirty=false,epoch=0,drag=null,ready=false;
const grouped=true;
let arrowTool=false,handTool=false,spacePan=false,pendingTarget=null;
let history=[],historyIndex=-1;
const snapshot=()=>JSON.stringify({nodes:graph.nodes,edges:graph.edges,positions:graph.positions||[],arrows:graph.arrows||[],inventorySignature:graph.inventorySignature||''});
function historyButtons(){$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;}
function remember(){const value=snapshot();if(history[historyIndex]!==value){history=history.slice(0,historyIndex+1);history.push(value);if(history.length>60)history.shift();historyIndex=history.length-1;}historyButtons();}
function travelHistory(delta){if(!ready||gesture)return;const next=historyIndex+delta;if(next<0||next>=history.length)return;Object.assign(graph,JSON.parse(history[next]));historyIndex=next;epoch++;dirty=true;projection=null;selected=null;linkMode=false;linkSource=null;pendingTarget=null;status('Unsaved changes');historyButtons();draw();inspector();}
$('undo').onclick=()=>travelHistory(-1);$('redo').onclick=()=>travelHistory(1);
function setTool(hand){arrowTool=false;$('draw-arrow').classList.remove('selected');$('draw-arrow').setAttribute('aria-pressed','false');handTool=hand;stopConnecting();$('tool-select').classList.toggle('selected',!hand);$('tool-pan').classList.toggle('selected',hand);$('tool-select').setAttribute('aria-pressed',String(!hand));$('tool-pan').setAttribute('aria-pressed',String(hand));$('viewport').classList.toggle('hand-tool',hand);}
$('draw-arrow').onclick=()=>{const next=!arrowTool;setTool(false);arrowTool=next;$('draw-arrow').classList.toggle('selected',next);$('draw-arrow').setAttribute('aria-pressed',String(next));draw();};
$('tool-select').onclick=()=>setTool(false);$('tool-pan').onclick=()=>setTool(true);
$('layout').onclick=()=>{if(!ready)return;graph.positions=[];changed();resetProjection();};
let projection=null,projectionEpoch=-1;
function visibleGraph(){if(!grouped)return graph;if(!projection||projectionEpoch!==epoch){projection=groupArchitecture(graph);projectionEpoch=epoch;}return {...projection,arrows:graph.arrows||[]};}
function resetProjection(){projection=null;selected=null;draw();fit();inspector();}
function focusComponent(id){choose('node',id);}
function openGroup(id){
 const group=visibleGraph().groups.find(g=>g.id===id);if(!group)return;
 const opener=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='group-dialog';dialog.setAttribute('aria-labelledby','group-dialog-title');
 dialog.innerHTML=`<header><div><h2 id="group-dialog-title">${esc(group.role)}</h2><p>${esc(group.environment)} · ${group.members.length} components · ${group.internal.length} internal connections</p></div><button class="btn" data-close aria-label="Close group details">Close ×</button></header><label for="group-search">Find a component</label><input id="group-search" type="search" placeholder="Search name, type or IP" autofocus><div class="group-popup-members"></div><details class="group-internal"><summary>Internal connections (${group.internal.length})</summary>${group.internal.map(e=>{const a=connectionNodes(graph).find(n=>n.id===e.source),b=connectionNodes(graph).find(n=>n.id===e.target);return `<button class="group-member" data-group-connection="${esc(e.id)}"><strong>${esc(a?.label)} → ${esc(b?.label)}</strong><span>${esc([e.protocol,e.port,e.type].filter(Boolean).join(' · ')||'No connection details recorded')}</span></button>`;}).join('')||'<p>No internal connections recorded.</p>'}</details>`;
 const list=dialog.querySelector('.group-popup-members'),search=dialog.querySelector('input');
 function renderMembers(){const q=search.value.trim().toLowerCase();list.innerHTML=group.members.filter(n=>[n.label,n.type,n.ip].join(' ').toLowerCase().includes(q)).map(n=>`<button class="group-popup-member" data-popup-member="${esc(n.id)}"><svg viewBox="0 0 64 64" aria-hidden="true">${icon(n.type)}</svg><span><strong>${esc(n.label)}</strong><span>${esc(n.type)} · ${esc(n.ip||'No IP recorded')}</span><small>View / edit details →</small></span></button>`).join('')||'<p>No matching components.</p>';list.querySelectorAll('[data-popup-member]').forEach(b=>b.onclick=()=>{dialog.close();focusComponent(b.dataset.popupMember);});}
 search.oninput=renderMembers;renderMembers();
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-group-connection]').forEach(b=>b.onclick=()=>{dialog.close();connections({edgeId:b.dataset.groupConnection});});
 dialog.addEventListener('close',()=>{dialog.remove();(opener?.isConnected?opener:$('canvas')).focus({preventScroll:true});});
 document.body.append(dialog);dialog.showModal();
}
function groupInspector(){
 const view=visibleGraph();const node=selected?.kind==='node'&&view.nodes.find(n=>n.id===selected.id),edge=selected?.kind==='edge'&&view.edges.find(e=>e.id===selected.id);
 const group=node&&view.groups.find(g=>g.id===(node.groupId||node.id));
 if(group){$('inspector').innerHTML=`<h2>${esc(group.role)}</h2><p>${esc(group.environment)} · ${group.members.length} components</p><button class="btn primary" id="expand-group">View components ↗</button><p>${group.internal.length} recorded connections within this group</p>`+group.members.map(n=>`<button class="group-member" data-member="${esc(n.id)}"><strong>${esc(n.label)}</strong><span>${esc(n.type)} · ${esc(n.ip||'No IP recorded')}</span><small>View / edit component →</small></button>`).join('');$('expand-group').onclick=()=>openGroup(group.id);$('inspector').querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{focusComponent(b.dataset.member);});return;}
 if(edge){$('inspector').innerHTML='<h2>Selected connection</h2><button id="delete-line" class="btn danger">Delete selected line</button><p>This line represents '+edge.members.length+' connection(s). Press Delete to remove it, or select an entry below to edit one connection.</p>'+edge.members.map(e=>{const a=connectionNodes(graph).find(n=>n.id===e.source),b=connectionNodes(graph).find(n=>n.id===e.target);return `<button class="group-member" data-connection="${esc(e.id)}"><strong>${esc(a?.label)} → ${esc(b?.label)}</strong><span>${esc([e.source.startsWith('group:')||e.target.startsWith('group:')?'Group-level link':'Component link',e.type,e.protocol,e.port].filter(Boolean).join(' · '))}</span><small>View / edit connection →</small></button>`;}).join('');$('delete-line').onclick=deleteSelectedLine;$('inspector').querySelectorAll('[data-connection]').forEach(b=>b.onclick=()=>{connections({edgeId:b.dataset.connection});});return;}
 $('inspector').innerHTML=`<h2>Architecture overview</h2><p>${view.groups.length} groups · ${graph.nodes.length} components · ${graph.edges.length} recorded connections</p><p>Select a group to see its component list, or an arrow to inspect its recorded connections.</p><p>Groups are separated by environment. Unassigned components need a role; select a component and set Architecture role.</p><p>Use the expand button on a group to open its components without changing the diagram.</p>`;
}
function connections(options={}){if(!ready)return;openConnections(graph,async arrange=>{selected=null;changed();draw();inspector();if(arrange)resetProjection();},options);}
$('connections-list').onclick=()=>connections({list:true});
const colors={'Server':'#247654','Database':'#6558a5','Load Balancer':'#247f97','WAF':'#b07932','Firewall':'#b04f48','External':'#727e88','URL':'#43817d'};
function status(message){$('state').textContent=message;}
function changed(){const valid=new Set(connectionNodes(graph).map(n=>n.id));graph.edges=graph.edges.filter(e=>valid.has(e.source)&&valid.has(e.target));dirty=true;epoch++;remember();status('Unsaved changes');}
async function request(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;}
function dimensions(){return renderArchitecture(visibleGraph(),null,null);}
function draw(){
 const stale=graph.revision&&graph.inventorySignature!==inventorySignature(record);$('inventory-notice').hidden=!stale;$('inventory-notice').textContent=stale?'Inventory has changed or this diagram has no inventory baseline. Review the current records, then use Generate from records if you want to replace this drawing.':'';

 $('hint').textContent=arrowTool?'Drag anywhere to draw an arrow. No items required.':linkMode?(linkSource?'2. Click the destination item':'1. Click the source item'):'Drag shapes to move · Drag blue handles to connect · Space to pan';
 $('connect').textContent=linkMode?'Cancel connection':'Connect items';$('connect').classList.toggle('selected',linkMode);
 $('connect').setAttribute('aria-pressed',String(linkMode));
 $('diagram-count').textContent=graph.nodes.length+' components · '+graph.edges.length+' connections';
 const view=visibleGraph(),highlight=selected?.kind==='node'&&!view.nodes.some(n=>n.id===selected.id)?{kind:'node',id:view.membership.get(selected.id)?.id}:selected;
 const {svg,w,h}=renderArchitecture(view,highlight,linkSource);
 $('canvas').innerHTML=svg;applyCamera();
}
// Camera changes never alter inventory, diagram positions, or unsaved state.
const camera={x:0,y:0};
let cameraFrame=0,itemFrame=0;
function scheduleItemDraw(){if(!itemFrame)itemFrame=requestAnimationFrame(()=>{itemFrame=0;draw();});}
function applyCamera(){
 const v=$('viewport'),c=$('canvas');
 c.setAttribute('width','100%');c.setAttribute('height','100%');
 c.setAttribute('viewBox',`${camera.x} ${camera.y} ${Math.max(1,v.clientWidth)/zoom} ${Math.max(1,v.clientHeight)/zoom}`);
 $('zoom-label').textContent=Math.round(zoom*100)+'%';
}
function scheduleCamera(){if(!cameraFrame)cameraFrame=requestAnimationFrame(()=>{cameraFrame=0;applyCamera();});}
function zoomAt(next,x=$('viewport').clientWidth/2,y=$('viewport').clientHeight/2){
 next=Math.max(.02,Math.min(3,next));
 camera.x+=x/zoom-x/next;camera.y+=y/zoom-y/next;zoom=next;scheduleCamera();
}
function fit(){
 if(!ready)return;
 const {w,h}=dimensions(),v=$('viewport');
 zoom=Math.max(.02,Math.min(1,(v.clientWidth-48)/w,(v.clientHeight-48)/h));
 camera.x=(w-v.clientWidth/zoom)/2;camera.y=(h-v.clientHeight/zoom)/2;applyCamera();
}
$('fit').onclick=fit;
new ResizeObserver(()=>{if(ready)scheduleCamera();}).observe($('viewport'));
function inspector(){if(selected?.kind==='arrow'){$('inspector').innerHTML='<h2>Arrow</h2><p>Visual annotation. No linked items.</p><button id="reverse-arrow" class="btn">Reverse direction</button><button id="delete" class="btn danger">Delete arrow</button>';$('delete').onclick=()=>{graph.arrows=(graph.arrows||[]).filter(a=>a.id!==selected.id);selected=null;changed();draw();inspector();};$('reverse-arrow').onclick=()=>{const a=graph.arrows.find(a=>a.id===selected.id);[a.x1,a.x2]=[a.x2,a.x1];[a.y1,a.y2]=[a.y2,a.y1];changed();draw();};return;}
if(!selected||selected.kind!=='node'||!graph.nodes.some(n=>n.id===selected.id)){groupInspector();return;}const item=selected&&(selected.kind==='node'?graph.nodes:graph.edges).find(x=>x.id===selected.id);if(!item){$('inspector').innerHTML='<h2>Diagram overview</h2><p>'+graph.nodes.length+' components · '+graph.edges.length+' recorded connections</p><p>Drag the corner handle to resize a component. Select a component to edit its type or zone.</p>'+graph.edges.map(e=>{const a=connectionNodes(graph).find(n=>n.id===e.source),b=connectionNodes(graph).find(n=>n.id===e.target);return `<p dir="ltr">${esc(a?.label)} → ${esc(b?.label)}<br><b>${esc([e.source.startsWith('group:')||e.target.startsWith('group:')?'Group-level link':'Component link',e.type,e.protocol,e.port].filter(Boolean).join(' · '))}</b></p>`;}).join('')+'<h2>Unconnected components</h2>'+graph.nodes.filter(n=>!graph.edges.some(e=>e.source===n.id||e.target===n.id)).map(n=>`<p>${esc(n.label)} — Relationship requires confirmation</p>`).join('');return;}
 const node=selected.kind==='node';const fields=node?[['label','Component name'],['type','Component type / Icon'],['architectureRole','Architecture role'],['zone','Zone / Group'],['ip','IP / Address'],['environment','Environment'],['notes','Notes']]:[['source','Source'],['target','Destination'],['type','Connection type (NAT / GSN / VPN…)'],['protocol','Protocol'],['port','Port'],['notes','Notes']];
 $('inspector').innerHTML=`<h2>${node?'Component details':'Connection details'}</h2>`+fields.map(([key,label])=>`<label for="edit-${key}">${label}</label>${node&&['type','zone','architectureRole'].includes(key)?`<select id="edit-${key}">${(key==='type'?types:key==='architectureRole'?roles:zones).map(v=>`<option ${(item[key]||(key==='zone'?zoneFor(item):key==='architectureRole'?roleFor(item):''))===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:key==='environment'?`<select id="edit-${key}">${environments.map(env=>`<option ${item[key]===env?'selected':''}>${esc(env)}</option>`).join('')}</select>`:['source','target'].includes(key)?`<select id="edit-${key}">${graph.nodes.map(n=>`<option value="${esc(n.id)}" ${item[key]===n.id?'selected':''}>${esc(n.label)}</option>`).join('')}</select>`:key==='notes'?`<textarea id="edit-${key}">${esc(item[key])}</textarea>`:`<input id="edit-${key}" value="${esc(item[key])}" maxlength="1000">`}`).join('')+(node?'':'<button id="reverse" class="btn">Reverse direction</button>')+'<button id="apply" class="btn primary">Apply changes</button><button id="delete" class="btn danger">Remove from diagram</button>';
 if(node){const button=document.createElement('button');button.className='btn';button.textContent='＋ Connect from this component';button.onclick=()=>connections({source:item.id});$('inspector').prepend(button);}
 if(!node)$('reverse').onclick=()=>{[item.source,item.target]=[item.target,item.source];changed();draw();inspector();};
 $('apply').onclick=()=>{const values=Object.fromEntries(fields.map(([key])=>[key,$('edit-'+key).value.trim()]));if(node&&!values.label)return status('Component name is required');if(!node&&values.source===values.target)return status('Choose different source and destination components');Object.assign(item,values);changed();focusComponent(item.id);};
 $('delete').onclick=()=>{if(!confirm('Delete the selected component or connection from this diagram?'))return;if(node){graph.nodes=graph.nodes.filter(n=>n.id!==item.id);graph.edges=graph.edges.filter(e=>e.source!==item.id&&e.target!==item.id);}else graph.edges=graph.edges.filter(e=>e.id!==item.id);selected=null;changed();draw();inspector();};
}
function deleteSelectedLine(){
 if(selected?.kind!=='edge')return;
 const edge=visibleGraph().edges.find(e=>e.id===selected.id);if(!edge)return;
 const ids=new Set((edge.members||[edge]).map(e=>e.id));
 if(!confirm(`Delete this line and its ${ids.size} recorded connection(s)? Components will remain.`))return;
 graph.edges=graph.edges.filter(e=>!ids.has(e.id));selected=null;changed();draw();inspector();
}
function dropNodeAt(e,source){
 const v=$('viewport').getBoundingClientRect(),p=localPoint(e);
 if(p.x<0||p.y<0||p.x>$('viewport').clientWidth||p.y>$('viewport').clientHeight)return null;
 const x=camera.x+p.x/zoom,y=camera.y+p.y/zoom,tolerance=16/zoom;
 // Geometry hit-testing works even when a line or zone label covers the target.
 return visibleGraph().nodes.filter(n=>n.id!==source&&x>=n.x-tolerance&&x<=n.x+(n.width||224)+tolerance&&y>=n.y-tolerance&&y<=n.y+(n.height||116)+tolerance).sort((a,b)=>Math.hypot(x-a.x-(a.width||224)/2,y-a.y-(a.height||116)/2)-Math.hypot(x-b.x-(b.width||224)/2,y-b.y-(b.height||116)/2))[0]?.id||null;
}
function connectDroppedItems(sourceId,targetId){
 const view=visibleGraph(),resolve=id=>{const g=view.groups.find(g=>g.id===id);return g?.members.length===1?g.members[0].id:id;};
 const source=resolve(sourceId),target=resolve(targetId),items=connectionNodes(graph);
 if(source===target||!items.some(n=>n.id===source)||!items.some(n=>n.id===target))return;
 const existing=graph.edges.find(e=>e.source===source&&e.target===target);
 if(existing){stopConnecting();status('These items are already connected. Select the line to view details.');return;}
 // Preserve the user's drawing when adding a relationship.
 graph.positions=view.nodes.map(n=>({id:n.id,x:n.x,y:n.y}));
 graph.edges.push({id:crypto.randomUUID(),source,target,type:'',protocol:'',port:'',notes:''});
 linkMode=false;linkSource=null;pendingTarget=null;selected=null;changed();draw();inspector();
 status('Connected: '+items.find(n=>n.id===source).label+' → '+items.find(n=>n.id===target).label);
}
function choose(kind,id){if(linkMode&&kind==='node'){pickEndpoint(id);return;}selected={kind,id};draw();inspector();if(kind==='edge'&&!grouped)connections({edgeId:id});}
const pointers=new Map();let gesture=null;
const localPoint=e=>{const r=$('viewport').getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
function pinchState(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
$('canvas').addEventListener('pointerdown',e=>{
 if(!ready||![0,1].includes(e.button))return;
 const expand=e.target.closest('[data-expand-group]');if(expand&&e.button===0&&!arrowTool&&!linkMode){e.preventDefault();openGroup(expand.dataset.expandGroup);return;}
 e.preventDefault();$('canvas').focus({preventScroll:true});
 const p=localPoint(e);pointers.set(e.pointerId,p);
 const target=e.target.closest('[data-node],[data-edge],[data-arrow]');
 if(pointers.size===1)gesture={start:p,last:p,moved:false,target,button:e.button};
 else{gesture.moved=true;gesture.freeArrow=null;gesture.freeMove=null;gesture.item=null;gesture.connector=null;$('connector-preview')?.remove();gesture.pinch=pinchState();}
 const handle=e.target.closest('[data-connect-handle]');
 if(pointers.size===1&&!arrowTool&&handle&&!handTool&&!spacePan&&e.button===0){gesture.connector=handle.dataset.connectHandle;gesture.item=null;}
 if(pointers.size===1&&!arrowTool&&!handle&&!handTool&&!spacePan&&!linkMode&&e.button===0&&target?.dataset.node){const n=visibleGraph().nodes.find(n=>n.id===target.dataset.node);if(n)gesture.item={id:n.id,x:n.x,y:n.y};}
 if(pointers.size===1&&e.button===0&&!spacePan){if(arrowTool)gesture.freeArrow={x:Math.max(0,Math.min(10000,camera.x+p.x/zoom)),y:Math.max(0,Math.min(10000,camera.y+p.y/zoom))};else if(!handTool&&!linkMode&&target?.dataset.arrow)gesture.freeMove={...graph.arrows.find(a=>a.id===target.dataset.arrow)};}
 $('canvas').setPointerCapture(e.pointerId);
});
$('canvas').addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId)||!gesture)return;
 const p=localPoint(e);pointers.set(e.pointerId,p);
 if(pointers.size>1){
 const now=pinchState(),prev=gesture.pinch||now;
 camera.x+=(prev.x-now.x)/zoom;camera.y+=(prev.y-now.y)/zoom;
 zoomAt(zoom*now.d/prev.d,now.x,now.y);gesture.pinch=now;gesture.moved=true;
 }else{
 if(!gesture.moved&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<4)return;
 gesture.moved=true;
 if(gesture.freeArrow){
 let preview=$('connector-preview');if(!preview){preview=document.createElementNS('http://www.w3.org/2000/svg','path');preview.id='connector-preview';preview.setAttribute('stroke','#80e9ef');preview.setAttribute('stroke-width','3');preview.setAttribute('marker-end','url(#arrow)');preview.setAttribute('pointer-events','none');$('canvas').append(preview);}preview.setAttribute('d',`M${gesture.freeArrow.x} ${gesture.freeArrow.y} L${Math.max(0,Math.min(10000,camera.x+p.x/zoom))} ${Math.max(0,Math.min(10000,camera.y+p.y/zoom))}`);
 }else if(gesture.freeMove){const a=gesture.freeMove,dx=Math.max(-Math.min(a.x1,a.x2),Math.min(10000-Math.max(a.x1,a.x2),(p.x-gesture.start.x)/zoom)),dy=Math.max(-Math.min(a.y1,a.y2),Math.min(10000-Math.max(a.y1,a.y2),(p.y-gesture.start.y)/zoom));Object.assign(graph.arrows.find(n=>n.id===a.id),{x1:a.x1+dx,x2:a.x2+dx,y1:a.y1+dy,y2:a.y2+dy});gesture.itemMoved=true;selected={kind:'arrow',id:a.id};scheduleItemDraw();
 }else if(gesture.connector){
 const n=visibleGraph().nodes.find(n=>n.id===gesture.connector);if(n){let preview=$('connector-preview');if(!preview){preview=document.createElementNS('http://www.w3.org/2000/svg','path');preview.id='connector-preview';preview.setAttribute('fill','none');preview.setAttribute('stroke','#86ccff');preview.setAttribute('stroke-width','3');preview.setAttribute('stroke-dasharray','7 5');preview.setAttribute('pointer-events','none');$('canvas').append(preview);}preview.setAttribute('d',`M${n.x+(n.width||224)/2} ${n.y+(n.height||116)/2} L${camera.x+p.x/zoom} ${camera.y+p.y/zoom}`);}
 }else if(gesture.item){
 const n=gesture.item;moveDiagramItem(graph,visibleGraph(),n.id,n.x+(p.x-gesture.start.x)/zoom,n.y+(p.y-gesture.start.y)/zoom);
 gesture.itemMoved=true;selected={kind:'node',id:n.id};scheduleItemDraw();
 }else{camera.x-=(p.x-gesture.last.x)/zoom;camera.y-=(p.y-gesture.last.y)/zoom;scheduleCamera();}
 }
 gesture.last=p;$('viewport').classList.add('is-panning');
});
function endPointer(e){
 if(!pointers.has(e.pointerId))return;
 pointers.delete(e.pointerId);
 if(pointers.size){gesture.last=[...pointers.values()][0];gesture.pinch=null;gesture.moved=true;return;}
 const done=gesture;gesture=null;$('viewport').classList.remove('is-panning');
 $('connector-preview')?.remove();
 if(done?.freeArrow){if(e.type==='pointerup'&&done.moved){const p=localPoint(e),id=crypto.randomUUID();graph.arrows=[...(graph.arrows||[]),{id,x1:done.freeArrow.x,y1:done.freeArrow.y,x2:Math.max(0,Math.min(10000,camera.x+p.x/zoom)),y2:Math.max(0,Math.min(10000,camera.y+p.y/zoom))}];selected={kind:'arrow',id};changed();setTool(false);draw();inspector();}return;}
 if(done?.connector){if(e.type==='pointerup'){const target=dropNodeAt(e,done.connector);if(target)connectDroppedItems(done.connector,target);else beginHandleConnection(done.connector,null);}return;}
 if(done?.itemMoved){changed();draw();inspector();}
 if(e.type!=='pointerup'||done?.moved||done?.button!==0||handTool||spacePan)return;
 if(done.target?.dataset.node)choose('node',done.target.dataset.node);
 else if(done.target?.dataset.edge)choose('edge',done.target.dataset.edge);
 else if(done.target?.dataset.arrow)choose('arrow',done.target.dataset.arrow);
 else{selected=null;draw();inspector();}
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('canvas').addEventListener(event,endPointer);
$('viewport').addEventListener('wheel',e=>{
 if(!ready)return;e.preventDefault();const p=localPoint(e);
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?$('viewport').clientHeight:1);
 zoomAt(zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.002),p.x,p.y);
},{passive:false});
$('canvas').addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey)return;
 const expand=e.target.closest('[data-expand-group]');if(expand&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();openGroup(expand.dataset.expandGroup);return;}
 const target=e.target.closest('[data-node]');
 if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();choose('node',target.dataset.node);return;}
 const step=60/zoom;
 if(e.key==='ArrowLeft')camera.x-=step;else if(e.key==='ArrowRight')camera.x+=step;
 else if(e.key==='ArrowUp')camera.y-=step;else if(e.key==='ArrowDown')camera.y+=step;
 else if(e.key==='+'||e.key==='=')zoomAt(zoom*1.2);else if(e.key==='-')zoomAt(zoom/1.2);
 else if(e.key==='0'||e.key==='Home')fit();else return;
 e.preventDefault();scheduleCamera();
});
function addShape(type,point){
 if(!ready)return;
 const v=$('viewport'),id=crypto.randomUUID();
 const x=Math.max(0,Math.round((point?.x??camera.x+v.clientWidth/zoom/2)-112)),y=Math.max(0,Math.round((point?.y??camera.y+v.clientHeight/zoom/2)-58));
 graph.nodes.push({id,type,label:type,ip:'',environment:'Not specified',notes:'',x,y});
 graph.positions=[...(graph.positions||[]),{id,x,y}];
 const group=groupArchitecture(graph).membership.get(id);
 if(!visibleGraph().nodes.some(n=>n.id===group.id))graph.positions.push({id:group.id,x,y});
 linkMode=false;linkSource=null;projection=null;selected={kind:'node',id};changed();draw();inspector();
}
$('add').onclick=()=>addShape($('type').value);
const shapeSections={'Compute':['VM','Server','OpenShift','Kubernetes','Container'],'Network & security':['Load Balancer','Firewall','WAF','DNS','VPN','Router'],'Data & integration':['Database','Storage','API','Message Queue','Cloud','User']};
function renderPalette(){const query=$('shape-search').value.toLowerCase();$('shape-list').innerHTML=Object.entries(shapeSections).map(([title,items])=>{const found=items.filter(t=>t.toLowerCase().includes(query));return found.length?`<section class="shape-section"><h3>${title}</h3><div class="shape-grid">${found.map(type=>`<button class="shape-tile" draggable="true" data-shape="${type}" title="Drag or click to add ${type}"><svg viewBox="0 0 64 64" aria-hidden="true">${icon(type)}</svg><span>${type}</span></button>`).join('')}</div></section>`:'';}).join('')||'<p>No matching shapes. Try More components below.</p>';$('shape-list').querySelectorAll('[data-shape]').forEach(b=>{b.onclick=()=>addShape(b.dataset.shape);b.ondragstart=e=>{e.dataTransfer.setData('application/x-hub-shape',b.dataset.shape);e.dataTransfer.effectAllowed='copy';};});}
$('shape-search').oninput=renderPalette;renderPalette();
$('viewport').addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('application/x-hub-shape')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
$('viewport').addEventListener('drop',e=>{const type=e.dataTransfer.getData('application/x-hub-shape');if(!types.includes(type))return;e.preventDefault();const p=localPoint(e);addShape(type,{x:camera.x+p.x/zoom,y:camera.y+p.y/zoom});});
function beginHandleConnection(source,target){linkMode=true;linkSource=null;pendingTarget=target;draw();pickEndpoint(source);}
function stopConnecting(){linkMode=false;linkSource=null;pendingTarget=null;if(ready){draw();inspector();}}
function pickEndpoint(id){
 if(!linkSource){linkSource=id;selected=null;draw();if(pendingTarget){const target=pendingTarget;pendingTarget=null;connectDroppedItems(id,target);return;}$('inspector').innerHTML=`<h2>Choose destination</h2><p>From: <strong>${esc(connectionNodes(graph).find(n=>n.id===id)?.label)}</strong></p><p>Click the destination to connect immediately.</p>`;return;}
 if(id===linkSource){status('Choose a different destination item.');return;}
 connectDroppedItems(linkSource,id);
}
$('connect').onclick=()=>{if(!ready)return;if(linkMode){stopConnecting();return;}arrowTool=false;$('draw-arrow').classList.remove('selected');$('draw-arrow').setAttribute('aria-pressed','false');handTool=false;spacePan=false;$('viewport').classList.remove('hand-tool');$('tool-pan').classList.remove('selected');$('tool-pan').setAttribute('aria-pressed','false');$('tool-select').classList.add('selected');$('tool-select').setAttribute('aria-pressed','true');linkMode=true;linkSource=null;pendingTarget=null;selected=null;draw();$('inspector').innerHTML='<h2>Choose source</h2><p>Click the item where traffic starts, then click its destination. You can still drag and zoom.</p>';};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(arrowTool)setTool(false);if(linkMode)stopConnecting();}});

$('zoom-in').onclick=()=>zoomAt(zoom*1.2);$('zoom-out').onclick=()=>zoomAt(zoom/1.2);
$('generate').onclick=async()=>{if(!ready||!confirm('Replace the current diagram with one generated from service records?'))return;Object.assign(graph,generateArchitecture(record),{positions:[],arrows:[]});selected=null;changed();draw();fit();inspector();};
$('save').onclick=async()=>{if(!ready)return;const version=epoch;$('save').disabled=true;try{const saved=await request(`/api/services/${encodeURIComponent(serviceId)}/architecture`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(graph)});graph.revision=saved.revision;if(epoch===version){dirty=false;status('Diagram saved');}else status('Previous version saved; newer changes remain unsaved');}catch(e){status(e.message);}finally{$('save').disabled=false;}};
$('export').onclick=()=>{if(!ready)return;const svg=$('canvas').cloneNode(true);const {w,h}=dimensions();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('width',w);svg.setAttribute('height',h);const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='service-architecture.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{const records=await request('/api/services');record=records.find(x=>x.service.id===serviceId);if(!record)throw Error('Service not found');$('title').textContent='Architecture — '+record.service.name;$('back').href='/#/service/'+encodeURIComponent(serviceId);graph=await request(`/api/services/${encodeURIComponent(serviceId)}/architecture`);ready=true;if(!graph.revision){Object.assign(graph,generateArchitecture(record));changed();}else status('Saved diagram — Select a group to explore');remember();draw();fit();inspector();}catch(e){status(e.message);}

window.addEventListener('keydown',e=>{
 if(e.target.closest?.('input,textarea,select,[contenteditable="true"],dialog'))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travelHistory(e.shiftKey?1:-1);return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();return;}
 if(e.code==='Space'&&e.target===$('canvas')){e.preventDefault();spacePan=true;$('viewport').classList.add('hand-tool');}
 if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='v')setTool(false);
 if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='h')setTool(true);
 if((e.key==='Delete'||e.key==='Backspace')&&selected){if(selected.kind==='edge'){e.preventDefault();deleteSelectedLine();}else if($('delete')){e.preventDefault();$('delete').click();}}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spacePan=false;$('viewport').classList.toggle('hand-tool',handTool);}});
window.addEventListener('blur',()=>{spacePan=false;$('viewport').classList.toggle('hand-tool',handTool);});
$('canvas').addEventListener('dblclick',e=>{if(linkMode||handTool)return;const id=e.target.closest('[data-node]')?.dataset.node;if(!id)return;const group=visibleGraph().groups.find(g=>g.id===id);if(group){openGroup(id);}else{choose('node',id);$('edit-label')?.focus();}});
