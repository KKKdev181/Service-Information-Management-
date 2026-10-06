export const W=224,H=116;
const colors={'Server':'#c4ccd9','Database':'#c4ccd9','Load Balancer':'#c4ccd9','WAF':'#c4ccd9','Firewall':'#c4ccd9','External':'#c4ccd9','URL':'#c4ccd9'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(type){const shapes={
 VM:'<rect x="4" y="4" width="45" height="34" rx="4"/><rect x="16" y="17" width="44" height="34" rx="4"/><path d="M24 27h27M24 35h20M24 43h12"/>',
 OpenShift:'<path d="M49 10a23 23 0 1 0 5 32M48 19a14 14 0 1 0 0 21M2 23l15-4M3 36l15-4M46 15l15-4M48 29l14-4"/>',
 API:'<rect x="3" y="5" width="58" height="44" rx="5"/><path d="m22 18-9 9 9 9m20-18 9 9-9 9m-7-22-6 26"/>',
 DNS:'<circle cx="19" cy="19" r="15"/><ellipse cx="19" cy="19" rx="6" ry="15"/><path d="M4 19h30M34 19h15v14M22 49h32M38 42v7"/><rect x="28" y="33" width="28" height="9" rx="2"/>',
 Storage:'<rect x="5" y="6" width="54" height="18" rx="4"/><rect x="5" y="31" width="54" height="18" rx="4"/><path d="M14 15h19M14 40h19M48 15h2M48 40h2"/>',

 'Load Balancer':'<rect x="22" y="3" width="20" height="14" rx="3"/><path d="M32 17v11M10 28h44M10 28v10M32 28v10M54 28v10"/><rect x="2" y="38" width="16" height="13" rx="3"/><rect x="24" y="38" width="16" height="13" rx="3"/><rect x="46" y="38" width="16" height="13" rx="3"/>',
 User:'<circle cx="32" cy="14" r="11"/><path d="M10 52v-9a22 22 0 0 1 44 0v9"/>',
 Monitoring:'<rect x="4" y="5" width="56" height="38" rx="4"/><path d="M10 28h10l6-13 10 22 7-12h11M32 43v10M20 53h24"/>',
 Server:'<rect x="9" y="3" width="46" height="49" rx="5"/><path d="M9 19h46M9 35h46M18 11h3M18 27h3M18 43h3M32 11h15M32 27h15M32 43h15"/>',
 Database:'<ellipse cx="32" cy="10" rx="24" ry="8"/><path d="M8 10v34c0 11 48 11 48 0V10M8 26c0 11 48 11 48 0"/>',
 Firewall:'<rect x="5" y="8" width="54" height="40" rx="3"/><path d="M5 21h54M5 35h54M23 8v13M43 8v13M14 21v14M34 21v14M51 21v14M23 35v13M43 35v13"/>',
 WAF:'<path d="M32 3L54 12v17c0 12-12 20-22 25C22 49 10 41 10 29V12Z"/><path d="m21 28 8 8 15-17"/>',
 External:'<path d="M15 43h35a12 12 0 0 0 1-24A20 20 0 0 0 13 22a11 11 0 0 0 2 21Z"/>',
 URL:'<rect x="4" y="6" width="56" height="42" rx="5"/><path d="M4 17h56M12 11h2M20 11h2"/><circle cx="32" cy="32" r="11"/><path d="M21 32h22M32 21c-7 5-7 17 0 22M32 21c7 5 7 17 0 22"/>'};return `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${shapes[type]||shapes[(['Oracle','SQL Server','PostgreSQL','Redis','Storage','S3 / MinIO'].includes(type)?'Database':['VPN','NAT','Router','Switch','DNS','Proxy','API Gateway'].includes(type)?'Load Balancer':['Internet','Cloud','External System'].includes(type)?'External':['API','DataPower','3scale','Apigee'].includes(type)?'URL':type)]||shapes.Server}</g>`;}
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
 const envs=[...new Set(graph.nodes.map(n=>n.environment||'غير محدد'))].sort();let top=90;
 const cellW=Math.max(224,...graph.nodes.map(n=>n.width||224))+110;
 const cellH=Math.max(116,...graph.nodes.map(n=>n.height||116))+150;
 const layers=[];
 const connected=new Set(graph.edges.flatMap(e=>[e.source,e.target]));
 for(const env of envs){const groups=new Map();for(const n of graph.nodes.filter(n=>(n.environment||'غير محدد')===env)){const rank=connected.has(n.id)?ranks[component.get(n.id)]:1000;if(!groups.has(rank))groups.set(rank,[]);groups.get(rank).push(n);}for(const [rank,group] of [...groups].sort((a,b)=>a[0]-b[0])){group.sort((a,b)=>zoneFor(a).localeCompare(zoneFor(b))||a.label.localeCompare(b.label));for(let offset=0;offset<group.length;offset+=4)layers.push(group.slice(offset,offset+4));}layers.push([]);}
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
 const groups=new Map();for(const n of graph.nodes){const key=(n.environment||'غير محدد')+' · '+zoneFor(n);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}
 // Separate contiguous regions so a zone never encloses unrelated intervening nodes.
 for(const [key,group] of groups){const columns=new Map();for(const n of group){if(!columns.has(n.x))columns.set(n.x,[]);columns.get(n.x).push(n);}for(const col of columns.values()){col.sort((a,b)=>a.y-b.y);let runs=[];for(const n of col){const run=runs.at(-1);if(run&&n.y-(run.at(-1).y+(run.at(-1).height||H))<100)run.push(n);else runs.push([n]);}for(const run of runs){const x=run[0].x-18,y=run[0].y-38,bottom=Math.max(...run.map(n=>n.y+(n.height||H))),width=Math.max(...run.map(n=>n.width||W))+36;svg+=`<rect x="${x}" y="${y}" width="${width}" height="${bottom-y+18}" rx="12" fill="#161a21" stroke="#363e4b" stroke-dasharray="4 6"/><text x="${x+9}" y="${y+20}" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="12" fill="#c8d8e8">${esc(key)}</text>`;}}}
 svg+=graph.edges.map((e,i)=>{const a=lookup.get(e.source),b=lookup.get(e.target);if(!a||!b)return '';const down=b.y>=a.y;const ax=a.x+(a.width||W)/2,bx=b.x+(b.width||W)/2,ay=a.y+(down?(a.height||H):0),by=b.y+(down?0:(b.height||H));const mid=a.y===b.y?a.y+Math.max(a.height||H,b.height||H)+50+(i%3)*18:(ay+by)/2;const d=a.y===b.y?`M${ax} ${a.y+(a.height||H)} V${mid} H${bx} V${b.y+(b.height||H)}`:`M${ax} ${ay} V${mid} H${bx} V${by}`;const active=selected?.id===e.id||selected?.id===e.source||selected?.id===e.target;const dim=selected?.kind==='node'&&!active;const label=[e.type,e.protocol,e.port].filter(Boolean).join(' · ');
 if(label){const box=placeLabel(label,(ax+bx)/2,mid-12);const lines=label.match(/.{1,28}(?:\s|$)|.{1,28}/g)||[label];labelMarkup.push(`<g data-edge="${esc(e.id)}" class="arch-edge"><path d="M${(ax+bx)/2} ${mid} L${box.x+box.w/2} ${box.y+box.h/2}" stroke="#778394" stroke-dasharray="3 3" fill="none"/><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="7" fill="#1d222b" stroke="#4d5665"/><text font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" fill="#ffffff" text-anchor="middle">${lines.map((line,j)=>`<tspan x="${box.x+box.w/2}" y="${box.y+23+j*21}">${esc(line.trim())}</tspan>`).join('')}</text></g>`);}
 return `<g class="arch-edge" data-edge="${esc(e.id)}" opacity="${dim?.18:1}"><path d="${d}" fill="none" stroke="transparent" stroke-width="18"/><path d="${d}" fill="none" stroke="${active?'#c9b5ec':'#93afc7'}" stroke-width="${active?3:1.7}" stroke-linejoin="round" marker-end="url(#arrow)"/><title>${esc(label)}</title></g>`;}).join('');
 svg+=graph.nodes.map(n=>{const nw=n.width||W,nh=n.height||H;const color=colors[n.type]||colors.Server;const active=selected?.id===n.id||linkSource===n.id;return `<g class="arch-node" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}" transform="translate(${n.x},${n.y})" opacity="${selected?.kind==='node'&&!active&&!linked.has(n.id)?.8:1}"><rect y="4" width="${nw}" height="${nh}" rx="13" fill="#080e18"/><rect width="${nw}" height="${nh}" rx="13" fill="#1d222b" stroke="${active?'#c9b5ec':'#505a6a'}" stroke-width="${active?3:1.4}"/><rect x="12" y="12" width="58" height="54" rx="10" fill="${color}" opacity=".09"/><g transform="translate(17,16) scale(.75)" color="${color}">${icon(n.type)}</g><text x="80" y="32" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" font-weight="bold" fill="${color}">${esc(n.type)}</text><text x="80" y="52" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="13" fill="#c0d0e0">${esc(n.environment)}</text><text x="13" y="83" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="16" font-weight="bold" fill="#f1f5f9">${esc(n.label.length>23?n.label.slice(0,22)+'…':n.label)}</text><text x="13" y="103" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" fill="#d0dfec">${esc((n.ip||'').slice(0,24))}</text><rect data-resize="true" x="${nw-13}" y="${nh-13}" width="10" height="10" rx="2" fill="${color}" style="cursor:nwse-resize"/><title>${esc(n.label+' '+n.ip)}</title></g>`;}).join('');
 svg+=labelMarkup.join('');
 return {svg,w:Math.max(w,...labelBoxes.map(b=>b.x+b.w+20)),h:Math.max(h,...labelBoxes.map(b=>b.y+b.h+20))};
}
