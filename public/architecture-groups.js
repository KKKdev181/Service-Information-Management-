import {arrangeArchitecture} from './architecture-view.js';
export const roles=['Applications','Databases','Load Balancers','Security','Integrations','Storage','Operations','Unassigned'];
export function roleFor(n){
 if(roles.includes(n.architectureRole))return n.architectureRole;
 const recordedRole=String(n.role||String(n.notes||'').match(/^role:\s*(.+)$/im)?.[1]||'').trim();
 if(/\b(database|db|sql|oracle|postgresql)\b/i.test(recordedRole))return 'Databases';
 if(/\b(application|app|web|frontend|backend)\b/i.test(recordedRole))return 'Applications';
 if(['Database','Oracle','SQL Server','PostgreSQL','Redis'].includes(n.type))return 'Databases';
 if(n.type==='Load Balancer')return 'Load Balancers';
 if(['Firewall','WAF'].includes(n.type))return 'Security';
 if(['VM','OpenShift','Kubernetes','Docker','Container','API'].includes(n.type))return 'Applications';
 if(['Storage','S3 / MinIO'].includes(n.type))return 'Storage';
 if(['Monitoring','Backup','DR Site'].includes(n.type))return 'Operations';
 if(['External','External System','Internet','Cloud','URL','DNS','VPN','NAT','Router','Switch','Proxy','API Gateway','DataPower','3scale','Apigee','Kafka','Message Queue'].includes(n.type))return 'Integrations';
 return 'Unassigned';
}
const icons={'Applications':'VM','Databases':'Database','Load Balancers':'Load Balancer','Security':'Firewall','Integrations':'API','Storage':'Storage','Operations':'Monitoring','Unassigned':'Server'};
export function groupArchitecture(graph,expanded=new Set()){
 const groups=new Map(),membership=new Map(),nodes=[],edges=[],pairs=new Map();
 for(const n of graph.nodes){const environment=!n.environment||n.environment==='\u063a\u064a\u0631 \u0645\u062d\u062f\u062f'?'Not specified':n.environment;const role=roleFor(n),key=n.displayMode==='separate'?n.id:JSON.stringify([environment,role]);let g=groups.get(key);if(!g){g={id:n.displayMode==='separate'?n.id:'group:'+key,separate:n.displayMode==='separate',role,environment,members:[],internal:[]};groups.set(key,g);}g.members.push(n);membership.set(n.id,g);}
 for(const g of groups.values()){
 if(g.separate)nodes.push({...g.members[0],environment:g.environment});
 else if(expanded.has(g.id))nodes.push(...g.members.map(n=>({...n,environment:g.environment,groupId:g.id})));
 else nodes.push({id:g.id,label:g.role+' · '+g.members.length,type:icons[g.role],environment:g.environment,ip:g.members.length+' components',width:280,height:116,x:0,y:0,isGroup:true,groupId:g.id});
 }
 for(const e of graph.edges){const a=membership.get(e.source)||[...groups.values()].find(g=>g.id===e.source),b=membership.get(e.target)||[...groups.values()].find(g=>g.id===e.target);if(!a||!b)continue;
 if(a===b)a.internal.push(e);
 const source=expanded.has(a.id)?e.source:a.id,target=expanded.has(b.id)?e.target:b.id;
 if(source===target)continue;
 const key=JSON.stringify([source,target]);let edge=pairs.get(key);if(!edge){edge={id:'aggregate:'+key,source,target,type:'',members:[]};pairs.set(key,edge);edges.push(edge);}edge.members.push(e);
 }
 for(const e of edges)e.type=e.members.length+' recorded connection'+(e.members.length===1?'':'s');
 const projected=arrangeArchitecture({nodes,edges});
 const positions=new Map((graph.positions||[]).map(p=>[p.id,p]));
 for(const node of projected.nodes){const p=positions.get(node.id);if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){node.x=p.x;node.y=p.y;}}
 return {...projected,groups:[...groups.values()].filter(g=>!g.separate),membership};
}

// Store overview and expanded-component positions separately from grouping logic.
export function moveDiagramItem(graph,view,id,x,y){
 const node=view.nodes.find(n=>n.id===id);if(!node)return false;
 const position={id,x:Math.max(0,Math.min(10000,x)),y:Math.max(0,Math.min(10000,y))};
 graph.positions=[...(graph.positions||[]).filter(p=>p.id!==id),position];
 node.x=position.x;node.y=position.y;
 const original=graph.nodes.find(n=>n.id===id);if(original){original.x=position.x;original.y=position.y;}
 return true;
}

// Groups are valid architecture endpoints, distinct from individual server links.
export function connectionNodes(graph){return [...graph.nodes,...groupArchitecture({nodes:graph.nodes,edges:[]}).groups.map(g=>({id:g.id,label:g.role+' · '+g.environment,type:'Group',environment:g.environment,ip:''}))];}
