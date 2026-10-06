// ELK is served locally; diagrams and infrastructure data never leave the portal.
export async function layoutArchitecture(graph, direction = 'DOWN', Engine = globalThis.ELK) {
 if (!Engine) throw Error('تعذر تحميل محرك الرسم. شغّل npm install وأعد تشغيل الموقع.');
 const elk = new Engine();
 const result = await elk.layout({id:'root',layoutOptions:{
  'elk.algorithm':'layered','elk.direction':direction,'elk.edgeRouting':'ORTHOGONAL',
  'elk.spacing.nodeNode':'90','elk.layered.spacing.nodeNodeBetweenLayers':'130',
  'elk.spacing.edgeNode':'35','elk.padding':'[top=70,left=60,bottom=60,right=60]'
 },children:graph.nodes.map(n=>({id:n.id,width:n.width||224,height:n.height||116})),
 edges:graph.edges.map(e=>({id:e.id,sources:[e.source],targets:[e.target]}))});
 for(const n of graph.nodes){const p=result.children.find(p=>p.id===n.id);n.x=p.x;n.y=p.y;}
 for(const e of graph.edges){const section=result.edges.find(p=>p.id===e.id)?.sections?.[0];
  if(section)e.route={points:[section.startPoint,...(section.bendPoints||[]),section.endPoint],signature:routeSignature(graph,e)};
 }
 return graph;
}
export function routeSignature(graph,e){return JSON.stringify([e.source,e.target,...[e.source,e.target].map(id=>{const n=graph.nodes.find(n=>n.id===id);return n?[n.x,n.y,n.width||224,n.height||116]:null;})]);}
