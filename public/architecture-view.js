import {icon} from './architecture-icons.js';
export {icon} from './architecture-icons.js';
import {routeSignature} from './architecture-layout.js';
export const W=224,H=116;
const colors={'Server':'#c4ccd9','Database':'#c4ccd9','Load Balancer':'#c4ccd9','WAF':'#c4ccd9','Firewall':'#c4ccd9','External':'#c4ccd9','URL':'#c4ccd9'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const types=['User','Internet','External System','External','URL','Firewall','WAF','Load Balancer','Router','Switch','VPN','NAT','DNS','Proxy','Physical Server','VM','Server','Windows Server','Linux Server','OpenShift','Kubernetes','Docker','Container','Cloud','Database','Oracle','SQL Server','PostgreSQL','Redis','Storage','S3 / MinIO','API','API Gateway','DataPower','3scale','Apigee','Kafka','Message Queue','Monitoring','Backup','DR Site'];
export const zones=['EXTERNAL','NETWORK / SECURITY','APPLICATION','DATA','INTEGRATION','OPERATIONS'];
export function zoneFor(n){if(n.zone)return n.zone;if(['User','Internet','External System','External','URL','Cloud'].includes(n.type))return zones[0];if(['Firewall','WAF','Load Balancer','Router','Switch','VPN','NAT','DNS','Proxy'].includes(n.type))return zones[1];if(['Database','Oracle','SQL Server','PostgreSQL','Redis','Storage','S3 / MinIO'].includes(n.type))return zones[3];if(['API','API Gateway','DataPower','3scale','Apigee','Kafka','Message Queue'].includes(n.type))return zones[4];if(['Monitoring','Backup','DR Site'].includes(n.type))return zones[5];return zones[2];}
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
export function renderArchitecture(graph,selected,linkSource){
 const labelBoxes=[],labelMarkup=[];
 const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 function placeLabel(text,x,y){
 const lines=text.match(/.{1,28}(?:\s|$)|.{1,28}/g)||[text];
 const width=Math.max(100,Math.max(...lines.map(l=>l.length))*9+24),height=lines.length*21+14;
 const obstacles=graph.nodes.map(n=>({x:n.x-20,y:n.y-40,w:(n.width||W)+40,h:(n.height||H)+62}));
 let box;outer:for(let radius=0;radius<100;radius++){for(const dy of radius?[radius*30,-radius*30]:[0])for(const dx of [0,-width/2,width/2,-width,width]){
 const candidate={x:Math.max(8,x-width/2+dx),y:Math.max(8,y-height/2+dy),w:width,h:height};
 if(![...obstacles,...labelBoxes].some(b=>overlaps(candidate,b))){box=candidate;break outer;}}}
 box ||= {x:8,y:Math.max(0,...obstacles.map(b=>b.y+b.h),...labelBoxes.map(b=>b.y+b.h))+20,w:width,h:height};
 labelBoxes.push(box);return box;
 }
 const lookup=new Map(graph.nodes.map(n=>[n.id,n]));const linked=new Set(selected?.kind==='node'?graph.edges.filter(e=>e.source===selected.id||e.target===selected.id).flatMap(e=>[e.source,e.target]):[]);
 const w=Math.max(360,...graph.nodes.map(n=>n.x+(n.width||W)+65)),h=Math.max(650,...graph.nodes.map(n=>n.y+(n.height||H)+90));
 let svg='<defs><marker id="arrow" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8Z" fill="#9fbacf"/></marker></defs><rect width="100%" height="100%" fill="#101217"/>';
 const groups=new Map();for(const n of graph.nodes){const key=(n.environment||'Not specified')+' · '+zoneFor(n);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}
 // Separate contiguous regions so a zone never encloses unrelated intervening nodes.
 for(const [key,group] of groups){const columns=new Map();for(const n of group){if(!columns.has(n.x))columns.set(n.x,[]);columns.get(n.x).push(n);}for(const col of columns.values()){col.sort((a,b)=>a.y-b.y);let runs=[];for(const n of col){const run=runs.at(-1);if(run&&n.y-(run.at(-1).y+(run.at(-1).height||H))<100)run.push(n);else runs.push([n]);}for(const run of runs){const x=run[0].x-18,y=run[0].y-38,bottom=Math.max(...run.map(n=>n.y+(n.height||H))),width=Math.max(...run.map(n=>n.width||W))+36;svg+=`<rect x="${x}" y="${y}" width="${width}" height="${bottom-y+18}" rx="12" fill="#161a21" stroke="#363e4b" stroke-dasharray="3 5"/><text x="${x+9}" y="${y+20}" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="12" fill="#c8d8e8">${esc(key)}</text>`;}}}
 svg+=graph.edges.map((e,i)=>{const a=lookup.get(e.source),b=lookup.get(e.target);if(!a||!b)return '';const down=b.y>=a.y;const ax=a.x+(a.width||W)/2,bx=b.x+(b.width||W)/2,ay=a.y+(down?(a.height||H):0),by=b.y+(down?0:(b.height||H));const mid=a.y===b.y?a.y+Math.max(a.height||H,b.height||H)+50+(i%3)*18:(ay+by)/2;let d=a.y===b.y?`M${ax} ${a.y+(a.height||H)} V${mid} H${bx} V${b.y+(b.height||H)}`:`M${ax} ${ay} V${mid} H${bx} V${by}`;const route=e.route?.signature===routeSignature(graph,e)?e.route.points:null;if(route?.length)d=route.map((p,j)=>`${j?'L':'M'}${p.x} ${p.y}`).join(' ');const anchor=route?.[Math.floor(route.length/2)];const labelX=anchor?anchor.x:(ax+bx)/2,labelY=anchor?anchor.y:mid;const active=selected?.id===e.id||selected?.id===e.source||selected?.id===e.target;const dim=selected?.kind==='node'&&!active;const label=[e.type,e.protocol,e.port].filter(Boolean).join(' · ');
 if(label){const box=placeLabel(label,labelX,labelY-12);const lines=label.match(/.{1,28}(?:\s|$)|.{1,28}/g)||[label];labelMarkup.push(`<g data-edge="${esc(e.id)}" class="arch-edge"><path d="M${labelX} ${labelY} L${box.x+box.w/2} ${box.y+box.h/2}" stroke="#778394" stroke-dasharray="3 3" fill="none"/><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="7" fill="#1d222b" stroke="#4d5665"/><text font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" fill="#ffffff" text-anchor="middle">${lines.map((line,j)=>`<tspan x="${box.x+box.w/2}" y="${box.y+23+j*21}">${esc(line.trim())}</tspan>`).join('')}</text></g>`);}
 return `<g class="arch-edge" data-edge="${esc(e.id)}" opacity="${dim?.18:1}"><path d="${d}" fill="none" stroke="transparent" stroke-width="18"/><path d="${d}" fill="none" stroke="${active?'#c9b5ec':'#93afc7'}" stroke-width="${active?3:1.7}" stroke-linejoin="round" marker-end="url(#arrow)"/><title>${esc(label)}</title></g>`;}).join('');
 svg+=graph.nodes.map(n=>{const nw=n.width||W,nh=n.height||H;const color=({'EXTERNAL':'#a8b5cf','NETWORK / SECURITY':'#65cddd','APPLICATION':'#b4a0f3','DATA':'#70d1ae','INTEGRATION':'#e8bb75','OPERATIONS':'#95baff'})[zoneFor(n)]||colors.Server;const active=selected?.id===n.id||linkSource===n.id;return `<g class="arch-node" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}" transform="translate(${n.x},${n.y})" opacity="${selected?.kind==='node'&&!active&&!linked.has(n.id)?.8:1}"><rect y="4" width="${nw}" height="${nh}" rx="13" fill="#080e18"/><rect width="${nw}" height="${nh}" rx="13" fill="#1d222b" stroke="${active?'#c9b5ec':'#505a6a'}" stroke-width="${active?3:1.4}"/><rect x="8" y="6" width="65" height="62" rx="10" fill="${color}" opacity=".09"/><g transform="translate(9,7) scale(.98)" color="${color}">${icon(n.type)}</g><text x="76" y="32" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="14" font-weight="600" fill="${color}">${esc(n.type)}</text><text x="80" y="52" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="13" fill="#c0d0e0">${esc(n.environment)}</text><text x="13" y="83" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="16" font-weight="bold" fill="#f1f5f9">${esc(n.label.length>23?n.label.slice(0,22)+'…':n.label)}</text><text x="13" y="103" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" fill="#d0dfec">${esc((n.ip||'').slice(0,24))}</text><rect data-resize="true" x="${nw-13}" y="${nh-13}" width="10" height="10" rx="2" fill="${color}" style="cursor:nwse-resize"/><title>${esc(n.label+' '+n.ip)}</title></g>`;}).join('');
 svg+=labelMarkup.join('');
 return {svg,w:Math.max(w,...labelBoxes.map(b=>b.x+b.w+20)),h:Math.max(h,...labelBoxes.map(b=>b.y+b.h+20))};
}
