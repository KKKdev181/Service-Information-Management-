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
 for(const n of graph.nodes){const environment=!n.environment||n.environment==='\u063a\u064a\u0631 \u0645\u062d\u062f\u062f'?'Not specified':n.environment;const role=roleFor(n),key=JSON.stringify([environment,role]);let g=groups.get(key);if(!g){g={id:'group:'+key,role,environment,members:[],internal:[]};groups.set(key,g);}g.members.push(n);membership.set(n.id,g);}
 for(const g of groups.values()){
 if(expanded.has(g.id))nodes.push(...g.members.map(n=>({...n,environment:g.environment,groupId:g.id})));
 else nodes.push({id:g.id,label:g.role+' · '+g.members.length,type:icons[g.role],environment:g.environment,ip:g.members.length+' components',width:280,height:116,x:0,y:0,isGroup:true,groupId:g.id});
 }
 for(const e of graph.edges){const a=membership.get(e.source),b=membership.get(e.target);if(!a||!b)continue;
 if(a===b)a.internal.push(e);
 const source=expanded.has(a.id)?e.source:a.id,target=expanded.has(b.id)?e.target:b.id;
 if(source===target)continue;
 const key=JSON.stringify([source,target]);let edge=pairs.get(key);if(!edge){edge={id:'aggregate:'+key,source,target,type:'',members:[]};pairs.set(key,edge);edges.push(edge);}edge.members.push(e);
 }
 for(const e of edges)e.type=e.members.length+' recorded connection'+(e.members.length===1?'':'s');
 const projected=arrangeArchitecture({nodes,edges});return {...projected,groups:[...groups.values()],membership};
}
