export const environments=['Production','Staging','Dev/QA','DR','غير محدد'];
export function generateArchitecture(record){
 const nodes=[],edges=[];let seq=0;const id=()=>`generated-${++seq}`;
 const normalize=x=>String(x||'').trim().toLowerCase();
 const add=(label,type,ip='',environment='غير محدد')=>{const node={id:id(),label:label||type,type,ip,environment:environments.includes(environment)?environment:'غير محدد',notes:'',x:0,y:0};nodes.push(node);return node;};
 const find=(name,ip)=>nodes.find(n=>(ip&&normalize(n.ip)===normalize(ip))||(name&&normalize(n.label)===normalize(name)));
 const connect=(a,b,type,protocol='',port='')=>{if(a&&b&&a!==b&&!edges.some(e=>e.source===a.id&&e.target===b.id&&e.port===port))edges.push({id:id(),source:a.id,target:b.id,type,protocol,port,notes:'علاقة مستخرجة من البيانات المسجلة'});};
 for(const s of record.Servers||[])add(s.name,'Server',s.privateIp||s.publicIp,s.environment);
 for(const lb of record.LoadBalancers||[]){if(!lb.vip)continue;let vip=nodes.find(n=>n.type==='Load Balancer'&&n.ip===lb.vip)||add('VIP '+lb.vip,'Load Balancer',lb.vip);const backend=find(lb.name,lb.hostIp||lb.members);connect(vip,backend,'Load Balancer',lb.hostProtocol,lb.hostPort);}
 for(const ep of record.Endpoints||[]){if(!ep.url&&!ep.dns)continue;const endpoint=add(ep.url||ep.dns,'URL','',ep.environment);const vip=nodes.find(n=>n.type==='Load Balancer'&&n.ip===ep.vip);connect(endpoint,vip,'HTTPS',ep.protocol,ep.port);}
 for(const flow of record.Connections||[]){
   const resolve=(side)=>{const ip=flow[side+'Ip']||'',name=flow[side+'Host']||'',raw=flow[side]||'';if(!ip&&!name&&!raw)return null;return find(name,ip)||nodes.find(n=>n.label===(name||raw||ip))||add(name||raw||ip,'External',ip);};
   connect(resolve('source'),resolve('destination'),flow.type||'Connection',flow.protocol,flow.port);
 }
 const counters={};for(const n of nodes){const lane=environments.indexOf(n.environment);const index=counters[lane]||0;counters[lane]=index+1;n.x=30+(index%4)*230;n.y=lane*330+75+Math.floor(index/4)*100;}
 // Keep large groups from overlapping later environment groups.
 let y=0;for(const env of environments){const group=nodes.filter(n=>n.environment===env);for(let i=0;i<group.length;i++){group[i].x=30+(i%4)*230;group[i].y=y+65+Math.floor(i/4)*110;}y+=Math.max(210,Math.ceil(group.length/4)*110+90);}
 return {nodes,edges};
}
