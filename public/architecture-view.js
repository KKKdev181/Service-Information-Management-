export const W=224,H=116;
const colors={'Server':'#287751','Database':'#765bb1','Load Balancer':'#167f9c','WAF':'#b7832c','Firewall':'#ba584c','External':'#637c8d','URL':'#39887b'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(type){const shapes={
 'Load Balancer':'<rect x="22" y="3" width="20" height="14" rx="3"/><path d="M32 17v11M10 28h44M10 28v10M32 28v10M54 28v10"/><rect x="2" y="38" width="16" height="13" rx="3"/><rect x="24" y="38" width="16" height="13" rx="3"/><rect x="46" y="38" width="16" height="13" rx="3"/>',
 Server:'<rect x="9" y="3" width="46" height="49" rx="5"/><path d="M9 19h46M9 35h46M18 11h3M18 27h3M18 43h3M32 11h15M32 27h15M32 43h15"/>',
 Database:'<ellipse cx="32" cy="10" rx="24" ry="8"/><path d="M8 10v34c0 11 48 11 48 0V10M8 26c0 11 48 11 48 0"/>',
 Firewall:'<rect x="5" y="8" width="54" height="40" rx="3"/><path d="M5 21h54M5 35h54M23 8v13M43 8v13M14 21v14M34 21v14M51 21v14M23 35v13M43 35v13"/>',
 WAF:'<path d="M32 3L54 12v17c0 12-12 20-22 25C22 49 10 41 10 29V12Z"/><path d="m21 28 8 8 15-17"/>',
 External:'<path d="M15 43h35a12 12 0 0 0 1-24A20 20 0 0 0 13 22a11 11 0 0 0 2 21Z"/>',
 URL:'<rect x="4" y="6" width="56" height="42" rx="5"/><path d="M4 17h56M12 11h2M20 11h2"/><circle cx="32" cy="32" r="11"/><path d="M21 32h22M32 21c-7 5-7 17 0 22M32 21c7 5 7 17 0 22"/>'};return `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${shapes[type]||shapes.Server}</g>`;}
export function arrangeArchitecture(graph){
 const connected=new Set(graph.edges.flatMap(e=>[e.source,e.target]));
 const rank={URL:0,WAF:1,Firewall:1,'Load Balancer':2,Server:3,Database:4,External:5};
 const columns=new Map();for(const n of graph.nodes.filter(n=>connected.has(n.id))){const r=rank[n.type]??3;if(!columns.has(r))columns.set(r,[]);columns.get(r).push(n);}
 const ranks=[...columns.keys()].sort((a,b)=>a-b);const max=Math.max(1,...[...columns.values()].map(g=>g.length));
 ranks.forEach((r,i)=>{const group=columns.get(r);group.sort((a,b)=>a.label.localeCompare(b.label));group.forEach((n,j)=>{n.x=40+i*330;n.y=65+j*160+(max-group.length)*80;});});
 const isolated=graph.nodes.filter(n=>!connected.has(n.id));const start=max*160+130;
 isolated.forEach((n,i)=>{n.x=40+(i%4)*270;n.y=start+Math.floor(i/4)*150;});
 return graph;
}
export function renderArchitecture(graph,selected,linkSource){
 const lookup=new Map(graph.nodes.map(n=>[n.id,n]));const linked=new Set(selected?.kind==='node'?graph.edges.filter(e=>e.source===selected.id||e.target===selected.id).flatMap(e=>[e.source,e.target]):[]);
 const w=Math.max(1060,...graph.nodes.map(n=>n.x+W+45)),h=Math.max(650,...graph.nodes.map(n=>n.y+H+65));
 let svg='<defs><marker id="arrow" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8Z" fill="#638e80"/></marker></defs><rect width="100%" height="100%" fill="#f5f8f6"/>';
 const connected=new Set(graph.edges.flatMap(e=>[e.source,e.target]));const isolated=graph.nodes.filter(n=>!connected.has(n.id));if(isolated.length){const y=Math.min(...isolated.map(n=>n.y))-25;svg+=`<text x="40" y="${y}" font-size="15" font-family="Arial" font-weight="bold" fill="#74887d">عناصر بلا اتصالات مسجلة — ${isolated.length}</text>`;}
 svg+=graph.edges.map((e,i)=>{const a=lookup.get(e.source),b=lookup.get(e.target);if(!a||!b)return '';const right=b.x>=a.x;const ax=a.x+(right?W:0),bx=b.x+(right?0:W),ay=a.y+H/2,by=b.y+H/2;const mid=ax===bx?ax+50:(ax+bx)/2;const d=`M${ax} ${ay} H${mid} V${by} H${bx}`;const active=selected?.id===e.id||selected?.id===e.source||selected?.id===e.target;const dim=selected?.kind==='node'&&!active;const label=[e.type,e.protocol,e.port].filter(Boolean).join(' · ');return `<g class="arch-edge" data-edge="${esc(e.id)}" opacity="${dim?.18:1}"><path d="${d}" fill="none" stroke="transparent" stroke-width="18"/><path d="${d}" fill="none" stroke="${active?'#168b72':'#99b4a9'}" stroke-width="${active?3:1.7}" stroke-linejoin="round" marker-end="url(#arrow)"/>${active?`<text x="${mid+8}" y="${(ay+by)/2-8}" font-family="Arial" font-size="12" fill="#185b46" stroke="#f5f8f6" stroke-width="5" paint-order="stroke">${esc(label.slice(0,65))}</text>`:''}<title>${esc(label)}</title></g>`;}).join('');
 svg+=graph.nodes.map(n=>{const color=colors[n.type]||colors.Server;const active=selected?.id===n.id||linkSource===n.id;return `<g class="arch-node" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}" transform="translate(${n.x},${n.y})" opacity="${selected?.kind==='node'&&!active&&!linked.has(n.id)?.4:1}"><rect y="4" width="${W}" height="${H}" rx="13" fill="#dee8e1"/><rect width="${W}" height="${H}" rx="13" fill="white" stroke="${active?'#d59b2b':color}" stroke-width="${active?3:1.4}"/><rect x="12" y="12" width="58" height="54" rx="10" fill="${color}" opacity=".09"/><g transform="translate(17,16) scale(.75)" color="${color}">${icon(n.type)}</g><text x="80" y="32" font-family="Arial" font-size="13" font-weight="bold" fill="${color}">${esc(n.type)}</text><text x="80" y="52" font-family="Arial" font-size="10" fill="#738779">${esc(n.environment)}</text><text x="13" y="83" font-family="Arial" font-size="12" font-weight="bold" fill="#284738">${esc(n.label.length>29?n.label.slice(0,28)+'…':n.label)}</text><text x="13" y="103" font-family="Arial" font-size="11" fill="#66816e">${esc(n.ip.slice(0,32))}</text><title>${esc(n.label+' '+n.ip)}</title></g>`;}).join('');
 return {svg,w,h};
}
