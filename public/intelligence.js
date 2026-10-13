import {serviceFacts,traceDependencies} from './service-facts.js';
import {applyServerRules,serverLocation} from './server-rules.js';
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
    for(const component of record.Components||[])for(const field of ['name','cluster','namespace','url'])add(record,'Platform',component.name||component.type,field,component[field]);
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
    const push=(kind,message,section='service')=>findings.push({serviceId:s.id,serviceName:s.name,kind,message,section});
    for(const message of applyServerRules(structuredClone(record)).conflicts)push('review',message,'Servers');
    if(!s.code)push('missing','CODE is not recorded');
    if(!(record.Servers||[]).length&&!(record.Components||[]).length)push('missing','No infrastructure inventory recorded','Servers');
    const facts=serviceFacts(record);
    if(facts.platform==='Not specified')push('missing','Hosting platform is not recorded');
    if(!facts.locations.length)push('missing','Hosting location is not recorded');
    if(facts.declaredServers&&Number(facts.declaredServers)!==facts.servers)push('review',`Declared server count (${facts.declaredServers}) differs from inventory (${facts.servers})`);
    for(const flow of record.Connections||[])if(!(flow.sourceIp||flow.sourceHost||flow.source)||!(flow.destinationIp||flow.destinationHost||flow.destination))push('missing','A connection is missing its source or destination','Connections');
    const ownIps=new Set((record.Servers||[]).flatMap(server=>[server.privateIp,server.publicIp].flatMap(ips)));
    for(const lb of record.LoadBalancers||[]) {
      const backend=ips(lb.hostIp||lb.members)[0];
      if(backend && ownIps.size && !ownIps.has(backend))push('review',`Load balancer backend ${backend} does not match any recorded server IP; review the inventory`,'LoadBalancers');
    }
    for(const server of record.Servers||[])for(const ip of [server.privateIp,server.publicIp].flatMap(ips)){
      const key=lower(ip);if(!serverIps.has(key))serverIps.set(key,new Map());
      serverIps.get(key).set(s.id,s.name);
    }
  }
  for(const [ip,owners] of serverIps)if(owners.size>1){
    for(const [id,name] of owners)findings.push({serviceId:id,serviceName:name,kind:'review',section:'Servers',message:`Server IP ${ip} is recorded in multiple services: ${[...owners.values()].join(', ')}`});
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
  let matchedFlows=flows.filter(f=>[f.source,f.destination,f.reference].some(v=>lower(v).includes(query)) || [...matchIps].some(ip=>f.sourceIps.includes(ip)||f.destinationIps.includes(ip)) || directServices.some(s=>s.service.id===f.serviceId));
  const traced=traceDependencies(services,rawQuery);
  const additional=traced.links.map(e=>({serviceId:e.serviceId,serviceName:e.serviceName,source:e.source,destination:e.target,type:e.type,protocol:e.protocol,port:e.port,depth:e.depth}));
  const flowKeys=new Set(matchedFlows.map(e=>JSON.stringify([e.serviceId,e.source,e.destination,e.type,e.port])));
  for(const e of additional){const key=JSON.stringify([e.serviceId,e.source,e.destination,e.type,e.port]);if(!flowKeys.has(key)){matchedFlows.push(e);flowKeys.add(key);}}
  const ids=new Set([...direct.map(r=>r.serviceId),...matchedFlows.map(f=>f.serviceId),...directServices.map(s=>s.service.id)]);
  return {resources:direct,flows:matchedFlows,services:services.filter(s=>ids.has(s.service.id)).map(s=>({id:s.service.id,name:s.service.name,code:s.service.code}))};
}

// Row-level search avoids duplicate results when several fields match one asset.
export function searchAssets(records,rawQuery){
 const q=lower(rawQuery);if(!q)return [];
 const result=[];
 for(const record of records)for(const section of ['Servers','Components','Endpoints','LoadBalancers','Networks','Connections'])for(const row of record[section]||[]){
 const entries=Object.entries(row).filter(([key,value])=>!['id','serviceId'].includes(key)&&String(value??'').trim());
 if(!entries.some(([,value])=>lower(value).includes(q)))continue;
 result.push({serviceId:record.service.id,serviceName:record.service.name,section,label:row.name||row.url||row.dns||row.vip||row.sourceHost||row.sourceIp||'Recorded connection',address:row.privateIp||row.publicIp||row.vip||row.hostIp||row.range||'',environment:row.environment||'Not recorded',location:serverLocation(row)||'Not recorded',match:entries.filter(([,v])=>lower(v).includes(q)).map(([k,v])=>k+': '+v).join(' · ')});
 }return result;
}
