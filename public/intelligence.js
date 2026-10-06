const lower = value => String(value ?? '').trim().toLowerCase();
const pieces = value => String(value ?? '').split(/[\s,\u060c;·]+/).map(x => x.trim()).filter(Boolean);
const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const ips = value => [...new Set(String(value ?? '').match(ipPattern) || [])];

export function buildInventory(services) {
  const resources = [], flows = [];
  const add = (service, category, label, field, value, extra={}) => {
    if (!String(value ?? '').trim()) return;
    resources.push({ serviceId: service.service.id, serviceName: service.service.name, category, label, field, value: String(value), ...extra });
  };
  for (const record of services) {
    for (const server of record.Servers || []) {
      for (const field of ['name','privateIp','publicIp','domain']) add(record,'Server',server.name || 'Server',field,server[field],{ serverIp:server.privateIp||server.publicIp });
    }
    for (const endpoint of record.Endpoints || []) {
      for (const field of ['url','dns','vip','publicIp','wafIp']) add(record,'Publishing',endpoint.environment||'Service endpoint',field,endpoint[field]);
    }
    for (const lb of record.LoadBalancers || []) {
      for (const field of ['name','hostIp','vip','pool','members']) add(record,'Load Balancer',lb.name||'LB',field,lb[field]);
    }
    for (const net of record.Networks || []) {
      for (const field of ['name','range','subnet','gateway','vlan']) add(record,'Network',net.name||'Subnet',field,net[field]);
    }
    for (const flow of record.Connections || []) {
      const source = [flow.sourceIp,flow.sourceHost,flow.source].filter(Boolean).join(' · ');
      const destination = [flow.destinationIp,flow.destinationHost,flow.destination].filter(Boolean).join(' · ');
      flows.push({serviceId:record.service.id,serviceName:record.service.name,type:flow.type||'connection',source,destination,protocol:flow.protocol||'',port:flow.port||'',reference:flow.reference||'',sourceIps:ips(source),destinationIps:ips(destination)});
    }
  }
  return {resources,flows};
}

export function inspectServices(services) {
  const findings=[];
  const serverIps=new Map();
  for (const record of services) {
    const s=record.service;
    const push=(kind,message)=>findings.push({serviceId:s.id,serviceName:s.name,kind,message});
    if(!s.code)push('missing','CODE is not recorded');
    if(!(record.Servers||[]).length)push('missing','No servers recorded');
    if(!(record.Endpoints||[]).length)push('missing','No endpoints or publishing details recorded');
    const ownIps=new Set((record.Servers||[]).flatMap(server=>[server.privateIp,server.publicIp].flatMap(ips)));
    for(const lb of record.LoadBalancers||[]) {
      const backend=ips(lb.hostIp||lb.members)[0];
      if(backend && ownIps.size && !ownIps.has(backend))push('review',`Load balancer backend ${backend} does not match any recorded server IP; review the inventory`);
    }
    for(const server of record.Servers||[])for(const ip of [server.privateIp,server.publicIp].flatMap(ips)){
      const key=lower(ip);if(!serverIps.has(key))serverIps.set(key,new Map());
      serverIps.get(key).set(s.id,s.name);
    }
  }
  for(const [ip,owners] of serverIps)if(owners.size>1){
    for(const [id,name] of owners)findings.push({serviceId:id,serviceName:name,kind:'review',message:`Server IP ${ip} is recorded in multiple services: ${[...owners.values()].join(', ')}`});
  }
  return findings;
}

export function traceImpact(services, rawQuery) {
  const query=lower(rawQuery);
  if(!query)return {resources:[],flows:[],services:[]};
  const {resources,flows}=buildInventory(services);
  const direct=resources.filter(r=>lower(r.value).includes(query)||lower(r.label).includes(query));
  const directServices=services.filter(s=>lower(s.service.name).includes(query)||lower(s.service.code).includes(query));
  const matchIps=new Set(ips(query));
  for(const item of direct)if(item.category==='Server')for(const ip of ips(item.serverIp||item.value))matchIps.add(ip);
  const matchedFlows=flows.filter(f=>[f.source,f.destination,f.reference].some(v=>lower(v).includes(query)) || [...matchIps].some(ip=>f.sourceIps.includes(ip)||f.destinationIps.includes(ip)) || directServices.some(s=>s.service.id===f.serviceId));
  const ids=new Set([...direct.map(r=>r.serviceId),...matchedFlows.map(f=>f.serviceId),...directServices.map(s=>s.service.id)]);
  return {resources:direct,flows:matchedFlows,services:services.filter(s=>ids.has(s.service.id)).map(s=>({id:s.service.id,name:s.service.name,code:s.service.code}))};
}
