import {icon,componentType,componentColor,hostingIcon} from './architecture-icons.js';
export {icon} from './architecture-icons.js';
import {routeSignature} from './architecture-layout.js';
export const W=224,H=116;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const types=['Database Cluster','Application Group','User','Internet','External System','External','URL','Firewall','WAF','Load Balancer','Switch','VPN','MPLS','GSN','NAT','DNS','Proxy','Physical Server','VM','Server','Windows Server','Linux Server','OpenShift','Docker','Cloud','Database','Oracle','SQL Server','PostgreSQL','Redis','Storage','S3 / MinIO','API','API Gateway','DataPower','3scale','Apigee','Kafka','Message Queue','Monitoring','Backup','DR Site'];
export const zones=['EXTERNAL','NETWORK / SECURITY','APPLICATION','DATA','INTEGRATION','OPERATIONS'];
export function zoneFor(n){if(n.zone)return n.zone;if(['User','Internet','External System','External','URL','Cloud'].includes(n.type))return zones[0];if(['Firewall','WAF','Load Balancer','Switch','VPN','MPLS','GSN','NAT','DNS','Proxy'].includes(n.type))return zones[1];if(['Database','Oracle','SQL Server','PostgreSQL','Redis','Storage','S3 / MinIO'].includes(n.type))return zones[3];if(['API','API Gateway','DataPower','3scale','Apigee','Kafka','Message Queue'].includes(n.type))return zones[4];if(['Monitoring','Backup','DR Site'].includes(n.type))return zones[5];return zones[2];}
export function arrangeArchitecture(graph){
 // Collapse strongly connected components first: cycles remain peers, not arbitrary chains.
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),adj=new Map(graph.nodes.map(n=>[n.id,[]]));
 for(const e of graph.edges)if(nodes.has(e.source)&&nodes.has(e.target))adj.get(e.source).push(e.target);
 let serial=0;const index=new Map(),low=new Map(),stack=[],on=new Set(),components=[],component=new Map();
 function visit(id){index.set(id,serial);low.set(id,serial++);stack.push(id);on.add(id);for(const v of adj.get(id)){if(!index.has(v)){visit(v);low.set(id,Math.min(low.get(id),low.get(v)));}else if(on.has(v))low.set(id,Math.min(low.get(id),index.get(v)));}if(low.get(id)===index.get(id)){const group=[];let v;do{v=stack.pop();on.delete(v);component.set(v,components.length);group.push(v);}while(v!==id);components.push(group);}}
 for(const id of nodes.keys())if(!index.has(id))visit(id);
 const ranks=components.map(()=>0),links=components.map(()=>new Set()),degree=components.map(()=>0);
 for(const e of graph.edges){const a=component.get(e.source),b=component.get(e.target);if(a!==undefined&&b!==undefined&&a!==b&&!links[a].has(b)){links[a].add(b);degree[b]++;}}
 const queue=degree.flatMap((d,i)=>d===0?[i]:[]);for(let i=0;i<queue.length;i++){const a=queue[i];for(const b of links[a]){ranks[b]=Math.max(ranks[b],ranks[a]+1);if(!--degree[b])queue.push(b);}}
 const envs=[...new Set(graph.nodes.map(n=>n.environment||'Not specified'))].sort();let top=90;
 const cellW=Math.max(224,...graph.nodes.map(n=>n.width||224))+110;
 const cellH=Math.max(116,...graph.nodes.map(n=>n.height||116))+150;
 const layers=[];
 const connected=new Set(graph.edges.flatMap(e=>[e.source,e.target]));
 for(const env of envs){const groups=new Map();for(const n of graph.nodes.filter(n=>(n.environment||'Not specified')===env)){const rank=connected.has(n.id)?ranks[component.get(n.id)]:1000;if(!groups.has(rank))groups.set(rank,[]);groups.get(rank).push(n);}for(const [rank,group] of [...groups].sort((a,b)=>a[0]-b[0])){group.sort((a,b)=>zoneFor(a).localeCompare(zoneFor(b))||a.label.localeCompare(b.label));for(let offset=0;offset<group.length;offset+=4)layers.push(group.slice(offset,offset+4));}layers.push([]);}
 const maxCols=Math.max(1,...layers.map(row=>row.length)),rowWidth=maxCols*cellW-110;
 for(const row of layers){if(!row.length){top+=60;continue;}const width=row.length*cellW-110;row.forEach((n,i)=>{n.x=60+(rowWidth-width)/2+i*cellW+(cellW-110-(n.width||224))/2;n.y=top;});top+=cellH;}
 return graph;
}
// Boundaries describe function; geometry stays within the existing connection anchors.
export function componentBoundary(node,width,height,theme='dark',active=false){
 const type=componentType(node),role=node.architectureRole||'';
 const family=role==='Databases'||['Database','Oracle','SQL Server','PostgreSQL','Redis'].includes(type)?'data':role==='Security'||['Firewall','WAF'].includes(type)?'security':role==='Storage'||['Storage','S3 / MinIO','Backup'].includes(type)?'storage':['OpenShift','Docker','Kubernetes','Container'].includes(type)?'platform':['User','Internet','External','External System','Cloud','URL'].includes(type)?'external':role==='Load Balancers'||['Load Balancer','Switch','VPN','MPLS','GSN','NAT','DNS','Proxy','API Gateway'].includes(type)?'network':'compute';
 const palette={compute:['#f7f4fe','#7962ac','#252238'],data:['#effaf5','#35856e','#19332e'],security:['#fff6ed','#b2743b','#36291f'],storage:['#eff8fa','#437e91','#1b3039'],platform:['#fff2f4','#b66072','#36232d'],external:['#f4f6fa','#718099','#252d3a'],network:['#eef7fe','#427aa4','#1c2e40']}[family];
 const fill=theme==='light'?palette[0]:palette[2],stroke=active?(theme==='light'?'#7144a0':'#d4b9ff'):palette[1],w=width,h=height;
 const attrs=`class="component-boundary" fill="${fill}" stroke="${stroke}" stroke-width="${active?2.8:1.6}"`;
 let shape;
 if(family==='data')shape=`<path ${attrs} d="M1 10 C1 -2 ${w-1} -2 ${w-1} 10 V${h-10} C${w-1} ${h+2} 1 ${h+2} 1 ${h-10}Z"/><path d="M1 ${h-12} C1 ${h} ${w-1} ${h} ${w-1} ${h-12}" fill="none" stroke="${stroke}" opacity=".5"/>`;
 else if(family==='security')shape=`<path ${attrs} d="M13 1 H${w-13} L${w-1} 13 V${h-13} L${w-13} ${h-1} H13 L1 ${h-13} V13Z"/>`;
 else shape=`<rect ${attrs} x="1" y="1" width="${w-2}" height="${h-2}" rx="${family==='external'?26:family==='network'?17:8}" ${family==='platform'?'stroke-dasharray="7 3"':''}/>${family==='storage'?`<path d="M7 ${h-8}H${w-7}M7 ${h-4}H${w-7}" stroke="${stroke}" opacity=".5"/>`:''}`;
 return `<g data-boundary="${family}" pointer-events="none">${shape}</g>`;
}
export function renderArchitecture(graph,selected,linkSource,theme='dark'){
 const isContainer=n=>['Database Cluster','Application Group'].includes(n.type);
 const equipment=[];const art=markup=>{equipment.push(markup);return `__EQUIPMENT_${equipment.length-1}__`;};
 const labelBoxes=[],labelMarkup=[];let routeRight=0;
 const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 function placeLabel(text,x,y){
 const lines=text.match(/.{1,28}(?:\s|$)|.{1,28}/g)||[text];
 const width=Math.max(100,Math.max(...lines.map(l=>l.length))*9+24),height=lines.length*21+14;
 const obstacles=graph.nodes.filter(n=>!isContainer(n)).map(n=>({x:n.x-20,y:n.y-40,w:(n.width||W)+40,h:(n.height||H)+62}));
 let box;outer:for(let radius=0;radius<100;radius++){for(const dy of radius?[radius*30,-radius*30]:[0])for(const dx of [0,-width/2,width/2,-width,width]){
 const candidate={x:Math.max(8,x-width/2+dx),y:Math.max(8,y-height/2+dy),w:width,h:height};
 if(![...obstacles,...labelBoxes].some(b=>overlaps(candidate,b))){box=candidate;break outer;}}}
 box ||= {x:8,y:Math.max(0,...obstacles.map(b=>b.y+b.h),...labelBoxes.map(b=>b.y+b.h))+20,w:width,h:height};
 labelBoxes.push(box);return box;
 }
 const lookup=new Map(graph.nodes.map(n=>[n.id,n]));const linked=new Set(selected?.kind==='node'?graph.edges.filter(e=>e.source===selected.id||e.target===selected.id).flatMap(e=>[e.source,e.target]):[]);
 const w=Math.max(360,...graph.nodes.map(n=>n.x+(n.width||W)+65)),h=Math.max(650,...graph.nodes.map(n=>n.y+(n.height||H)+90));
 let svg='<defs><marker id="arrow" viewBox="0 0 12 12" markerWidth="7" markerHeight="7" refX="11" refY="6" orient="auto" markerUnits="strokeWidth"><path d="M1 1 L11 6 L1 11 L3 6Z" fill="#80e9ef"/></marker></defs><rect width="100%" height="100%" fill="#101217" opacity="0"/>';
 const groups=new Map();for(const n of graph.nodes.filter(n=>!isContainer(n)&&!n.parentId)){const key=(n.environment||'Not specified')+' · '+zoneFor(n);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}
 // Separate contiguous regions so a zone never encloses unrelated intervening nodes.
 for(const [key,group] of groups){const columns=new Map();for(const n of group){if(!columns.has(n.x))columns.set(n.x,[]);columns.get(n.x).push(n);}for(const col of columns.values()){col.sort((a,b)=>a.y-b.y);let runs=[];for(const n of col){const run=runs.at(-1);if(run&&n.y-(run.at(-1).y+(run.at(-1).height||H))<100)run.push(n);else runs.push([n]);}for(const run of runs){const x=run[0].x-18,y=run[0].y-38,bottom=Math.max(...run.map(n=>n.y+(n.height||H))),width=Math.max(...run.map(n=>n.width||W))+36;svg+=`<rect x="${x}" y="${y}" width="${width}" height="${bottom-y+18}" rx="12" fill="${run.length>1?'#161a21':'none'}" stroke="${run.length>1?'#363e4b':'none'}" stroke-dasharray="3 5"/><text x="${x+9}" y="${y+20}" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="12" fill="#c8d8e8">${esc(key)}</text>`;}}}
 svg+=graph.nodes.filter(isContainer).map(n=>{
 const active=selected?.id===n.id,color=n.type==='Database Cluster'?'#89dcca':'#b8a5f0',count=graph.nodes.filter(c=>c.parentId===n.id).length;
 return `<g class="arch-node cluster-frame ${active?'is-selected':''}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)} group" transform="translate(${n.x},${n.y})"><rect width="${n.width||520}" height="${n.height||300}" rx="18" fill="${theme==='light'?'#f0f4f9':'#182332'}" stroke="${active?'#d4b9ff':color}" stroke-width="${active?3:1.5}"/><path d="M0 84H${n.width||520}" stroke="${color}" opacity=".35"/><g transform="translate(16,13) scale(.85)">${art(icon(n.type))}</g><text x="82" y="32" font-family="Segoe UI,Arial" font-size="18" font-weight="600" fill="#f1f5f9">${esc(n.label.slice(0,45))}</text><text x="82" y="57" font-family="Segoe UI,Arial" font-size="13" fill="#c8d5e6">Listener IP: ${esc(n.listenerIp||'Not set')}</text><text x="${(n.width||520)-20}" y="74" text-anchor="end" font-family="Segoe UI,Arial" font-size="11" fill="${color}">${count} ${count===1?'member':'members'}</text>${count?'':`<text x="${(n.width||520)/2}" y="165" text-anchor="middle" font-family="Segoe UI,Arial" font-size="14" fill="#bac7d9">Drop components here</text>`}<title>${esc(n.type+' · '+n.label+' · Listener IP: '+(n.listenerIp||'Not set'))}</title></g>`;
 }).join('');
 svg+=graph.edges.map((e,i)=>{const a=lookup.get(e.source),b=lookup.get(e.target);if(!a||!b)return '';const down=b.y>=a.y;const ax=a.x+(a.width||W)/2,bx=b.x+(b.width||W)/2,ay=a.y+(down?(a.height||H):0),by=b.y+(down?0:(b.height||H));const mid=a.y===b.y?a.y+Math.max(a.height||H,b.height||H)+50+(i%3)*18:(ay+by)/2;let d=a.y===b.y?`M${ax} ${a.y+(a.height||H)} V${mid} H${bx} V${b.y+(b.height||H)}`:`M${ax} ${ay} V${mid} H${bx} V${by}`;const route=e.route?.signature===routeSignature(graph,e)?e.route.points:null;if(route?.length)d=route.map((p,j)=>`${j?'L':'M'}${p.x} ${p.y}`).join(' ');let anchor=route?.[Math.floor(route.length/2)];
 // A long vertical connection must not run through unrelated equipment.
 if(!route?.length){
 const startY=a.y===b.y?a.y+(a.height||H):ay,endY=a.y===b.y?b.y+(b.height||H):by;
 const points=[{x:ax,y:startY},{x:ax,y:mid},{x:bx,y:mid},{x:bx,y:endY}];
 const blocked=graph.nodes.filter(n=>!isContainer(n)&&n.id!==a.id&&n.id!==b.id).some(n=>points.slice(1).some((p,j)=>{
 const q=points[j],left=n.x-16,right=n.x+(n.width||W)+16,top=n.y-40,bottom=n.y+(n.height||H)+16;
 return p.x===q.x?p.x>left&&p.x<right&&Math.max(p.y,q.y)>top&&Math.min(p.y,q.y)<bottom:p.y>top&&p.y<bottom&&Math.max(p.x,q.x)>left&&Math.min(p.x,q.x)<right;
 }));
 if(blocked){
 const lane=Math.max(...graph.nodes.map(n=>n.x+(n.width||W)))+65+i*32;
 const sy=down?startY+26:startY-50,ty=down?endY-50:endY+26;
 d=`M${ax} ${startY} V${sy} H${lane} V${ty} H${bx} V${endY}`;
 routeRight=Math.max(routeRight,lane+40);anchor={x:lane,y:(sy+ty)/2};
 }
 }
 const labelX=anchor?anchor.x:(ax+bx)/2,labelY=anchor?anchor.y:mid;const active=selected?.id===e.id||selected?.id===e.source||selected?.id===e.target;const label=[e.type,e.protocol,e.port].filter(Boolean).join(' · ');
 if(label){const box=placeLabel(label,labelX,labelY-12);const lines=label.match(/.{1,28}(?:\s|$)|.{1,28}/g)||[label];labelMarkup.push(`<g data-edge="${esc(e.id)}" class="arch-edge"><path d="M${labelX} ${labelY} L${box.x+box.w/2} ${box.y+box.h/2}" stroke="#778394" stroke-dasharray="3 3" fill="none"/><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="7" fill="#1d222b" stroke="#4d5665"/><text font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" fill="#ffffff" text-anchor="middle">${lines.map((line,j)=>`<tspan x="${box.x+box.w/2}" y="${box.y+23+j*21}">${esc(line.trim())}</tspan>`).join('')}</text></g>`);}
 return `<g class="arch-edge" data-edge="${esc(e.id)}" opacity="1"><path d="${d}" fill="none" stroke="transparent" stroke-width="18"/><path d="${d}" fill="none" stroke="${active?'#d5bcff':'#80e9ef'}" stroke-width="${active?3.5:2.8}" stroke-linejoin="round" marker-end="url(#arrow)"/><title>${esc(a.label+' → '+b.label+' · '+label)}</title></g>`;}).join('');
 svg+=(graph.arrows||[]).map(a=>`<g class="arch-edge" data-arrow="${esc(a.id)}" tabindex="0" role="button" aria-label="Free arrow"><path d="M${a.x1} ${a.y1} L${a.x2} ${a.y2}" fill="none" stroke="transparent" stroke-width="20"/><path d="M${a.x1} ${a.y1} L${a.x2} ${a.y2}" fill="none" stroke="${selected?.kind==='arrow'&&selected.id===a.id?'#d5bcff':'#80e9ef'}" stroke-width="3" marker-end="url(#arrow)"/><title>Free arrow — no linked items</title></g>`).join('');
 svg+=graph.nodes.filter(n=>!isContainer(n)).map(n=>{
 const nw=n.width||W,nh=n.height||H,type=componentType(n),color=componentColor(type);
 const active=selected?.id===n.id||linkSource===n.id;
 const boundaryRole=graph.groups?.find(g=>g.id===n.id)?.role||n.architectureRole;
 // Keep hit targets above the decorative boundary for dragging and linking.
 return `<g class="arch-node ${active?'is-selected':''}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(type+': '+n.label)}" transform="translate(${n.x},${n.y})" opacity="${selected?.kind==='node'&&!active&&!linked.has(n.id)?.65:1}">
 ${art(componentBoundary({...n,architectureRole:boundaryRole},nw,nh,theme,active))}
 <rect width="${nw}" height="${nh}" rx="10" fill="none" pointer-events="all" stroke="none"/>
 <g transform="translate(4,0) scale(1.13)">${art(icon(type))}</g>
 <text x="82" y="27" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" font-weight="600" fill="${color}">${esc(type)}</text>
 <text x="82" y="48" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="13" fill="#bac7d9">${esc(n.environment||'Not specified')}</text>
 ${n.hostingLocation?`<g transform="translate(82,51) scale(.25)">${art(hostingIcon(n.hostingLocation))}</g><text x="103" y="64" font-size="11" font-family="Segoe UI,Arial,sans-serif" fill="#e0ebfa">${esc(n.hostingLocation)}</text>`:`<path d="M83 60h28" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`}
 <text x="${nw/2}" y="85" text-anchor="middle" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="16" font-weight="600" fill="#f1f5f9">${esc(n.label.length>Math.floor(nw/8.5)?n.label.slice(0,Math.floor(nw/8.5)-1)+'…':n.label)}</text>
 <text x="${nw/2}" y="106" text-anchor="middle" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="14" fill="#c8d5e6">${esc((n.ip||'').slice(0,Math.floor(nw/8)))}</text>
 ${n.isGroup?`<g class="group-expand" data-expand-group="${esc(n.id)}" tabindex="0" role="button" aria-label="View components in ${esc(n.label)}" transform="translate(${nw-38},8)"><rect width="30" height="30" rx="6" fill="#25354b" stroke="#7897bc"/><path d="M8 13V8h5M17 8h5v5M22 17v5h-5M13 22H8v-5" stroke="#d4e6ff" stroke-width="1.8" fill="none"/><title>View components</title></g>`:''}
 ${n.groupId?'':`<path data-resize="true" d="M${nw-12} ${nh-3}h9v-9" stroke="${color}" stroke-width="3" fill="none" style="cursor:nwse-resize"/>`}
 ${[[nw/2,0],[nw,nh/2],[nw/2,nh],[0,nh/2]].map(([x,y])=>`<g class="connection-handle" data-connect-handle="${esc(n.id)}" transform="translate(${x},${y})"><circle r="12" fill="#10263d" stroke="#78c8ff" stroke-width="2"/><path d="M-5 0h10M0-5v10" stroke="#bde9ff" stroke-width="2"/><title>Drag to connect</title></g>`).join('')}
 <title>${esc(type+' · '+n.label+' '+(n.ip||''))}</title></g>`;
 }).join('');
 svg+=labelMarkup.join('');
 if(theme==='light'){
 const colors={'#80e9ef':'#236178','#d5bcff':'#7044a5','#f0e4ff':'#7044a5','#161a21':'#edf1f7','#363e4b':'#bac6d6','#c8d8e8':'#475569','#1d222b':'#ffffff','#ffffff':'#17263c','#bac7d9':'#475569','#e0ebfa':'#334155','#f1f5f9':'#17263c','#c8d5e6':'#475569'};
 // Change text and diagram surfaces only; preserve the equipment brand artwork.
 svg=svg.replace(/<(text|tspan|rect|path)\b[^>]*>/g,tag=>tag.replace(/(fill|stroke)="(#[a-fA-F0-9]{6})"/g,(all,attr,color)=>colors[color]?`${attr}="${colors[color]}"`:all));
 svg=svg.replace(/(<text[^>]*fill=")[^"]+("[^>]*>)/g,'$1#24364d$2');
 }
 svg=svg.replace(/__EQUIPMENT_(\d+)__/g,(_,i)=>equipment[Number(i)]);
 return {svg,w:Math.max(w,routeRight,...(graph.arrows||[]).flatMap(a=>[a.x1+30,a.x2+30]),...labelBoxes.map(b=>b.x+b.w+20)),h:Math.max(h,...(graph.arrows||[]).flatMap(a=>[a.y1+30,a.y2+30]),...labelBoxes.map(b=>b.y+b.h+20))};
}

