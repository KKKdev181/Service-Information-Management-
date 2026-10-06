// User-provided naming conventions. Most specific prefix wins.
export const serverRules=[
 ['PN1','Production','','Old Production'],['PN3','Production','NIC','NIC Production'],
 ['PE1','Production','SALAM','SALAM Production Corporate'],['SN3','Staging','NIC','NIC Staging'],
 ['SE1','Staging','SALAM','SALAM Staging'],['BN4','DR','','DR'],
 ['TE','QA','','Test (QA)'],['DE','Dev','','Development (IaaS)'],
 ['TG','Dev','GCP','GCP Development'],['T','QA','','Test (QA)'],['D','Dev','','Development']
].map(([prefix,environment,location,zone])=>({prefix,environment,location,zone})).sort((a,b)=>b.prefix.length-a.prefix.length);
const missing=v=>v==null||/^(?:\s*|not specified|unknown|n\/a|-|—|\u063a\u064a\u0631 \u0645\u062d\u062f\u062f)$/i.test(String(v).trim());
export function identifyServer(name){const host=String(name||'').trim().toUpperCase();return serverRules.find(r=>host.startsWith(r.prefix))||null;}
const equivalent=(a,b)=>{const normalize=v=>({prod:'production',stg:'staging',test:'qa','test (qa)':'qa',development:'dev'}[String(v).trim().toLowerCase()]||String(v).trim().toLowerCase());return normalize(a)===normalize(b);};
export function applyServerRules(record){
 const changes=[],conflicts=[],knownLocations=new Set();
 for(const server of record.Servers||[]){const rule=identifyServer(server.name);if(!rule)continue;
 for(const [field,expected] of [['environment',rule.environment],['site',rule.location],['zone',rule.zone]]){
 if(!expected)continue;
 if(missing(server[field])){server[field]=expected;changes.push({server:server.name,field,value:expected});}
 else if(!equivalent(server[field],expected))conflicts.push(`${server.name}: ${field} is "${server[field]}"; prefix ${rule.prefix} suggests "${expected}".`);
 }
 // Derive service locations from the preserved server site, never an overriding guess.
 const site=String(server.site||'').trim().toUpperCase();if(['GCP','NIC','SALAM'].includes(site))knownLocations.add(site);
 }
 const service=record.service||{};
 if(missing(service.hostingLocations)&&knownLocations.size){service.hostingLocations=[...knownLocations].sort().join(',');changes.push({field:'hostingLocations',value:service.hostingLocations});}
 else if(!missing(service.hostingLocations)){const existing=String(service.hostingLocations).split(',').map(v=>v.trim().toUpperCase());for(const site of knownLocations)if(!existing.includes(site))conflicts.push(`Service hosting locations omit ${site}, which is recorded on a server. Review the selected locations.`);}
 return {changes,conflicts};
}
