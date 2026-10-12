import {inventorySignature} from './service-facts.js';
import {openConnections} from './connection-manager.js';
import {groupArchitecture,roles,roleFor} from './architecture-groups.js';
import {arrangeArchitecture,renderArchitecture,types,zones,zoneFor} from './architecture-view.js';
import {generateArchitecture,environments} from './architecture-model.js';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('type').innerHTML=types.map(t=>`<option>${esc(t)}</option>`).join('');
const serviceId=new URLSearchParams(location.search).get('service');
let record,graph={revision:0,nodes:[],edges:[]},selected=null,linkMode=false,linkSource=null,zoom=1,dirty=false,epoch=0,drag=null,ready=false;
const grouped=true;
let expanded=new Set(),projection=null,projectionEpoch=-1;
function visibleGraph(){if(!grouped)return graph;if(!projection||projectionEpoch!==epoch){projection=groupArchitecture(graph,expanded);projectionEpoch=epoch;}return projection;}
function resetProjection(){projection=null;selected=null;draw();fit();inspector();}
function focusComponent(id){
 const group=visibleGraph().groups.find(g=>g.members.some(n=>n.id===id));
 if(group){expanded.add(group.id);projection=null;}
 choose('node',id);fit();
}
$('collapse-groups').onclick=()=>{expanded.clear();resetProjection();};
function groupInspector(){
 const view=visibleGraph();const node=selected?.kind==='node'&&view.nodes.find(n=>n.id===selected.id),edge=selected?.kind==='edge'&&view.edges.find(e=>e.id===selected.id);
 const group=node&&view.groups.find(g=>g.id===(node.groupId||node.id));
 if(group){$('inspector').innerHTML=`<h2>${esc(group.role)}</h2><p>${esc(group.environment)} · ${group.members.length} components</p><button class="btn primary" id="expand-group">${expanded.has(group.id)?'Collapse group':'Expand in diagram'}</button><p>${group.internal.length} recorded connections within this group</p>`+group.members.map(n=>`<button class="group-member" data-member="${esc(n.id)}"><strong>${esc(n.label)}</strong><span>${esc(n.type)} · ${esc(n.ip||'No IP recorded')}</span><small>View / edit component →</small></button>`).join('');$('expand-group').onclick=()=>{expanded.has(group.id)?expanded.delete(group.id):expanded.add(group.id);resetProjection();};$('inspector').querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{focusComponent(b.dataset.member);});return;}
 if(edge){$('inspector').innerHTML='<h2>Recorded connections</h2><p>Each entry below is an existing component-level connection.</p>'+edge.members.map(e=>{const a=graph.nodes.find(n=>n.id===e.source),b=graph.nodes.find(n=>n.id===e.target);return `<button class="group-member" data-connection="${esc(e.id)}"><strong>${esc(a?.label)} → ${esc(b?.label)}</strong><span>${esc([e.type,e.protocol,e.port].filter(Boolean).join(' · '))}</span><small>View / edit connection →</small></button>`;}).join('');$('inspector').querySelectorAll('[data-connection]').forEach(b=>b.onclick=()=>{connections({edgeId:b.dataset.connection});});return;}
 $('inspector').innerHTML=`<h2>Architecture overview</h2><p>${view.groups.length} groups · ${graph.nodes.length} components · ${graph.edges.length} recorded connections</p><p>Select a group to see its component list, or an arrow to inspect its recorded connections.</p><p>Groups are separated by environment. Unassigned components need a role; select a component and set Architecture role.</p><p>Expand only the group you need. Select a component to edit it here; select an arrow to inspect connections.</p>`;
}
function connections(options={}){if(!ready)return;openConnections(graph,async arrange=>{selected=null;changed();draw();inspector();if(arrange)resetProjection();else fit();},options);}
$('connections-list').onclick=()=>connections({list:true});
const colors={'Server':'#247654','Database':'#6558a5','Load Balancer':'#247f97','WAF':'#b07932','Firewall':'#b04f48','External':'#727e88','URL':'#43817d'};
function status(message){$('state').textContent=message;}
function changed(){dirty=true;epoch++;status('Unsaved changes');}
async function request(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;}
function dimensions(){return renderArchitecture(visibleGraph(),null,null);}
function draw(){
 const stale=graph.revision&&graph.inventorySignature!==inventorySignature(record);$('inventory-notice').hidden=!stale;$('inventory-notice').textContent=stale?'Inventory has changed or this diagram has no inventory baseline. Review the current records, then use Generate from records if you want to replace this drawing.':'';

 $('hint').textContent='Drag to move · Scroll to zoom · Click for details';
 const {svg,w,h}=renderArchitecture(visibleGraph(),selected,linkSource);
 $('canvas').innerHTML=svg;applyCamera();
}
// Camera changes never alter inventory, diagram positions, or unsaved state.
const camera={x:0,y:0};
let cameraFrame=0;
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
function inspector(){if(!selected||selected.kind!=='node'||!graph.nodes.some(n=>n.id===selected.id)){groupInspector();return;}const item=selected&&(selected.kind==='node'?graph.nodes:graph.edges).find(x=>x.id===selected.id);if(!item){$('inspector').innerHTML='<h2>Diagram overview</h2><p>'+graph.nodes.length+' components · '+graph.edges.length+' recorded connections</p><p>Drag the corner handle to resize a component. Select a component to edit its type or zone.</p>'+graph.edges.map(e=>{const a=graph.nodes.find(n=>n.id===e.source),b=graph.nodes.find(n=>n.id===e.target);return `<p dir="ltr">${esc(a?.label)} → ${esc(b?.label)}<br><b>${esc([e.type,e.protocol,e.port].filter(Boolean).join(' · '))}</b></p>`;}).join('')+'<h2>Unconnected components</h2>'+graph.nodes.filter(n=>!graph.edges.some(e=>e.source===n.id||e.target===n.id)).map(n=>`<p>${esc(n.label)} — Relationship requires confirmation</p>`).join('');return;}
 const node=selected.kind==='node';const fields=node?[['label','Component name'],['type','Component type / Icon'],['architectureRole','Architecture role'],['zone','Zone / Group'],['ip','IP / Address'],['environment','Environment'],['notes','Notes']]:[['source','Source'],['target','Destination'],['type','Connection type (NAT / GSN / VPN…)'],['protocol','Protocol'],['port','Port'],['notes','Notes']];
 $('inspector').innerHTML=`<h2>${node?'Component details':'Connection details'}</h2>`+fields.map(([key,label])=>`<label for="edit-${key}">${label}</label>${node&&['type','zone','architectureRole'].includes(key)?`<select id="edit-${key}">${(key==='type'?types:key==='architectureRole'?roles:zones).map(v=>`<option ${(item[key]||(key==='zone'?zoneFor(item):key==='architectureRole'?roleFor(item):''))===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:key==='environment'?`<select id="edit-${key}">${environments.map(env=>`<option ${item[key]===env?'selected':''}>${esc(env)}</option>`).join('')}</select>`:['source','target'].includes(key)?`<select id="edit-${key}">${graph.nodes.map(n=>`<option value="${esc(n.id)}" ${item[key]===n.id?'selected':''}>${esc(n.label)}</option>`).join('')}</select>`:key==='notes'?`<textarea id="edit-${key}">${esc(item[key])}</textarea>`:`<input id="edit-${key}" value="${esc(item[key])}" maxlength="1000">`}`).join('')+(node?'':'<button id="reverse" class="btn">Reverse direction</button>')+'<button id="apply" class="btn primary">Apply changes</button><button id="delete" class="btn danger">Remove from diagram</button>';
 if(node){const button=document.createElement('button');button.className='btn';button.textContent='＋ Connect from this component';button.onclick=()=>connections({source:item.id});$('inspector').prepend(button);}
 if(!node)$('reverse').onclick=()=>{[item.source,item.target]=[item.target,item.source];changed();draw();inspector();};
 $('apply').onclick=()=>{const values=Object.fromEntries(fields.map(([key])=>[key,$('edit-'+key).value.trim()]));if(node&&!values.label)return status('Component name is required');if(!node&&values.source===values.target)return status('Choose different source and destination components');Object.assign(item,values);changed();focusComponent(item.id);};
 $('delete').onclick=()=>{if(!confirm('Delete the selected component or connection from this diagram?'))return;if(node){graph.nodes=graph.nodes.filter(n=>n.id!==item.id);graph.edges=graph.edges.filter(e=>e.source!==item.id&&e.target!==item.id);}else graph.edges=graph.edges.filter(e=>e.id!==item.id);selected=null;changed();draw();inspector();};
}
function choose(kind,id){selected={kind,id};draw();inspector();if(kind==='edge'&&!grouped)connections({edgeId:id});}
const pointers=new Map();let gesture=null;
const localPoint=e=>{const r=$('viewport').getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
function pinchState(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
$('canvas').addEventListener('pointerdown',e=>{
 if(!ready||![0,1].includes(e.button))return;
 e.preventDefault();$('canvas').focus({preventScroll:true});
 const p=localPoint(e);pointers.set(e.pointerId,p);
 const target=e.target.closest('[data-node],[data-edge]');
 if(pointers.size===1)gesture={start:p,last:p,moved:false,target,button:e.button};
 else{gesture.moved=true;gesture.pinch=pinchState();}
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
 gesture.moved=true;camera.x-=(p.x-gesture.last.x)/zoom;camera.y-=(p.y-gesture.last.y)/zoom;scheduleCamera();
 }
 gesture.last=p;$('viewport').classList.add('is-panning');
});
function endPointer(e){
 if(!pointers.has(e.pointerId))return;
 pointers.delete(e.pointerId);
 if(pointers.size){gesture.last=[...pointers.values()][0];gesture.pinch=null;gesture.moved=true;return;}
 const done=gesture;gesture=null;$('viewport').classList.remove('is-panning');
 if(e.type!=='pointerup'||done?.moved||done?.button!==0)return;
 if(done.target?.dataset.node)choose('node',done.target.dataset.node);
 else if(done.target?.dataset.edge)choose('edge',done.target.dataset.edge);
 else{selected=null;draw();inspector();}
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('canvas').addEventListener(event,endPointer);
$('viewport').addEventListener('wheel',e=>{
 if(!ready)return;e.preventDefault();const p=localPoint(e);
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?$('viewport').clientHeight:1);
 zoomAt(zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.002),p.x,p.y);
},{passive:false});
$('canvas').addEventListener('keydown',e=>{
 const target=e.target.closest('[data-node]');
 if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();choose('node',target.dataset.node);return;}
 const step=60/zoom;
 if(e.key==='ArrowLeft')camera.x-=step;else if(e.key==='ArrowRight')camera.x+=step;
 else if(e.key==='ArrowUp')camera.y-=step;else if(e.key==='ArrowDown')camera.y+=step;
 else if(e.key==='+'||e.key==='=')zoomAt(zoom*1.2);else if(e.key==='-')zoomAt(zoom/1.2);
 else if(e.key==='0'||e.key==='Home')fit();else return;
 e.preventDefault();scheduleCamera();
});
$('add').onclick=()=>{if(!ready)return;const type=$('type').value;const n={id:crypto.randomUUID(),type,label:type,ip:'',environment:'Not specified',notes:'',x:Math.round($('viewport').scrollLeft/zoom+60),y:Math.max(80,...graph.nodes.map(n=>n.y+(n.height||116)+80))};graph.nodes.push(n);changed();focusComponent(n.id);};
$('connect').onclick=()=>connections({source:selected?.kind==='node'&&graph.nodes.some(n=>n.id===selected.id)?selected.id:''});
$('zoom-in').onclick=()=>zoomAt(zoom*1.2);$('zoom-out').onclick=()=>zoomAt(zoom/1.2);
$('generate').onclick=async()=>{if(!ready||!confirm('Replace the current diagram with one generated from service records?'))return;Object.assign(graph,generateArchitecture(record));selected=null;changed();fit();inspector();};
$('save').onclick=async()=>{if(!ready)return;const version=epoch;$('save').disabled=true;try{const saved=await request(`/api/services/${encodeURIComponent(serviceId)}/architecture`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(graph)});graph.revision=saved.revision;if(epoch===version){dirty=false;status('Diagram saved');}else status('Previous version saved; newer changes remain unsaved');}catch(e){status(e.message);}finally{$('save').disabled=false;}};
$('export').onclick=()=>{if(!ready)return;const svg=$('canvas').cloneNode(true);const {w,h}=dimensions();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('width',w);svg.setAttribute('height',h);const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='service-architecture.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{const records=await request('/api/services');record=records.find(x=>x.service.id===serviceId);if(!record)throw Error('Service not found');$('title').textContent='Architecture — '+record.service.name;$('back').href='/#/service/'+encodeURIComponent(serviceId);graph=await request(`/api/services/${encodeURIComponent(serviceId)}/architecture`);ready=true;if(!graph.revision){Object.assign(graph,generateArchitecture(record));changed();}else status('Saved diagram — Select a group to explore');draw();fit();inspector();}catch(e){status(e.message);}
