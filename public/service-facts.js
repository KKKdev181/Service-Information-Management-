export const text=v=>String(v??'').trim();
export const unique=values=>[...new Set(values.map(text).filter(Boolean))];
export function environmentName(v){const s=text(v);return ({prod:'Production',production:'Production',stg:'Staging',staging:'Staging',test:'QA','test (qa)':'QA',qa:'QA',dev:'Dev',development:'Dev',dr:'DR','dev/qa':'Dev/QA'})[s.toLowerCase()]||s||'Not specified';}
export function serviceFacts(record){
 const servers=record.Servers||[],components=record.Components||[],endpoints=record.Endpoints||[],lbs=record.LoadBalancers||[];
 const environmentNames=unique([...servers,...components,...endpoints].map(n=>environmentName(n.environment)));
 const environments=environmentNames.map(name=>({name,servers:servers.filter(n=>environmentName(n.environment)===name).length,components:components.filter(n=>environmentName(n.environment)===name).length,endpoints:endpoints.filter(n=>environmentName(n.environment)===name).length}));
 const locations=unique([...(record.service.hostingLocations||'').split(','),...servers.map(n=>n.site),...components.map(n=>n.site)]);
 const platforms=unique([record.service.hostingType,...servers.map(n=>n.platform),...components.map(n=>n.type)]);
 const hasVM=platforms.some(p=>/^VM$|^Hybrid$/i.test(p)),hasOCP=platforms.some(p=>/^OpenShift$|^Hybrid$/i.test(p));
 const platform=hasVM&&hasOCP?'Hybrid':hasOCP?'OpenShift':hasVM?'VM':text(record.service.hostingType)||'Not specified';
 return {servers:servers.length,components:components.length,total:servers.length+components.length,environments,locations,platform,vips:unique(lbs.map(n=>n.vip)),endpoints:endpoints.length,connections:(record.Connections||[]).length,networks:(record.Networks||[]).length,waf:unique([...endpoints.map(n=>n.wafIp),...lbs.map(n=>n.waf)]).length,declaredServers:text(record.service.serverCount)};
}
export function inventorySignature(record){
 const source=['Servers','Components','Endpoints','LoadBalancers','Connections','Networks'].map(key=>[key,(record[key]||[]).map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['id','serviceId'].includes(k)).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
 const value=JSON.stringify(source);let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return 'inventory-v1:'+value.length+':'+(h>>>0).toString(16);
}
// Addresses are matched exactly; no partial-IP matching in dependency traversal.
export function addresses(value){return unique(text(value).split(/[\s,;·]+/).map(v=>v.replace(/^https?:\/\//i,'').replace(/\/$/,'').toLowerCase()));}
export function dependencyLinks(records){const links=[];const add=(record,source,target,type,protocol,port)=>{if(!text(source)||!text(target))return;links.push({serviceId:record.service.id,serviceName:record.service.name,source:text(source),target:text(target),type:type||'Connection',protocol:protocol||'',port:port||''});};
 for(const r of records){for(const e of r.Connections||[])add(r,e.sourceIp||e.sourceHost||e.source,e.destinationIp||e.destinationHost||e.destination,e.type,e.protocol,e.port);
 for(const e of r.LoadBalancers||[])add(r,e.vip,e.hostIp||e.members||e.name,'VIP → backend',e.hostProtocol,e.hostPort);
 for(const e of r.Endpoints||[]){if(e.wafIp){add(r,e.url||e.dns,e.wafIp,'Publishing → WAF',e.protocol,e.port);add(r,e.wafIp,e.vip,'WAF → VIP',e.protocol,e.port);}else add(r,e.url||e.dns,e.vip,'Publishing → VIP',e.protocol,e.port);}
 }return links;}
export function traceDependencies(records,query){const q=text(query).toLowerCase();if(!q)return {links:[],services:[],direct:0,indirect:0};const links=dependencyLinks(records),seen=new Set(addresses(q));
 for(const r of records){for(const n of [...r.Servers||[],...r.Components||[]])if([n.name,n.privateIp,n.publicIp,n.url].some(v=>text(v).toLowerCase()===q))for(const v of [n.name,n.privateIp,n.publicIp,n.url])for(const a of addresses(v))seen.add(a);}
 const found=new Map();let frontier=new Set(seen),depth=0;
 while(frontier.size&&depth<=links.length){const next=new Set();links.forEach((link,i)=>{if(found.has(i))return;const tokens=[...addresses(link.source),...addresses(link.target)];if(tokens.some(v=>frontier.has(v))){found.set(i,{...link,depth});for(const t of tokens)if(!seen.has(t)){seen.add(t);next.add(t);}}});frontier=next;depth++;}
 const result=[...found.values()],ids=new Set(result.map(e=>e.serviceId));return {links:result,services:records.filter(r=>ids.has(r.service.id)).map(r=>r.service),direct:result.filter(e=>e.depth===0).length,indirect:result.filter(e=>e.depth>0).length};
}
