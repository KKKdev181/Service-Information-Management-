// User-provided naming conventions. Most specific prefix wins.
export const serverRules=[
 ['PN1','Production','','Old Production'],['PN3','Production','NIC','NIC Production'],
 ['PE1','Production','SALAM','SALAM Production Corporate'],['SN3','Staging','NIC','NIC Staging'],
 ['SE1','Staging','SALAM','SALAM Staging'],['BN4','DR','DR','DR'],
 ['TE','QA','','Test (QA)'],['DE','Dev','','Development (IaaS)'],
 ['TG','Dev','GCP','GCP Development'],['T','QA','','Test (QA)'],['D','Dev','','Development']
].map(([prefix,environment,location,zone])=>({prefix,environment,location,zone})).sort((a,b)=>b.prefix.length-a.prefix.length);
const missing=v=>v==null||/^(?:\s*|not specified|unknown|n\/a|-|—|\u063a\u064a\u0631 \u0645\u062d\u062f\u062f)$/i.test(String(v).trim());
export function identifyServer(name){const host=String(name||'').trim().toUpperCase();return serverRules.find(r=>host.startsWith(r.prefix))||null;}
const equivalent=(a,b)=>{const normalize=v=>({prod:'production',stg:'staging',test:'qa','test (qa)':'qa',development:'dev'}[String(v).trim().toLowerCase()]||String(v).trim().toLowerCase());return normalize(a)===normalize(b);};
export const hostingLocations=['NIC','GCP','SALAM','DR'];
export function canonicalLocation(value){const v=String(value||'').trim().toUpperCase();return hostingLocations.includes(v)?v:'';}
export function serverLocation(server){return canonicalLocation(server.site)||identifyServer(server.name)?.location||'';}
export function applyServerRules(record){
 const changes=[],conflicts=[],knownLocations=new Set();
 for(const server of [...record.Servers||[],...record.Components||[]]){
 const original=String(server.site||'').trim(),rule=identifyServer(server.name),site=serverLocation(server);
 if(original&&!canonicalLocation(original)){
 const note='Imported hosting label: '+original;
 if(!String(server.notes||'').includes(note))server.notes=[server.notes,note].filter(Boolean).join('\n');
 }
 if((server.site||'')!==site){server.site=site;changes.push({server:server.name,field:'site',value:site});}
 if(site)knownLocations.add(site);
 if(!rule)continue;
 for(const [field,expected] of [['environment',rule.environment],['zone',rule.zone]]){
 if(!expected)continue;
 if(missing(server[field])){server[field]=expected;changes.push({server:server.name,field,value:expected});}
 else if(!equivalent(server[field],expected))conflicts.push(`${server.name}: ${field} is "${server[field]}"; prefix ${rule.prefix} suggests "${expected}".`);
 }
 if(rule.location&&site&&site!==rule.location)conflicts.push(`${server.name}: site is "${site}"; prefix ${rule.prefix} suggests "${rule.location}".`);
 }
 const service=record.service||{},raw=String(service.hostingLocations||'').split(',').map(v=>v.trim()).filter(Boolean);
 const unknown=raw.filter(v=>!canonicalLocation(v));
 if(unknown.length){const note='Imported hosting labels: '+unknown.join(', ');if(!String(service.description||'').includes(note))service.description=[service.description,note].filter(Boolean).join('\n');}
 const sites=new Set([...raw.map(canonicalLocation).filter(Boolean),...knownLocations]);
 const value=hostingLocations.filter(v=>sites.has(v)).join(',');
 if((service.hostingLocations||'')!==value){service.hostingLocations=value;changes.push({field:'hostingLocations',value});}
 return {changes,conflicts};
}
