// Potential relationships in either direction, based only on recorded diagram edges.
export function diagramImpact(graph,seeds){
 const nodes=new Set(seeds),edges=new Set();let changed=true;
 while(changed){changed=false;for(const edge of graph.edges||[]){if(nodes.has(edge.source)||nodes.has(edge.target)){edges.add(edge.id);for(const id of [edge.source,edge.target])if(!nodes.has(id)){nodes.add(id);changed=true;}}}}
 return {nodes,edges};
}
