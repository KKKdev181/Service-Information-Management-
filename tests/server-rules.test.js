import test from 'node:test';import assert from 'node:assert/strict';
import {identifyServer,applyServerRules,serverRules} from '../public/server-rules.js';
test('all supplied prefixes match, including specific prefixes before T and D',()=>{for(const r of serverRules)assert.equal(identifyServer('  '+r.prefix.toLowerCase()+'-server  ').prefix,r.prefix);assert.equal(identifyServer('TG01').environment,'Dev');assert.equal(identifyServer('DE01').zone,'Development (IaaS)');assert.equal(identifyServer('XYZ01'),null);});
test('fills missing fields and multiple locations without guessing platform',()=>{const r={service:{},Servers:[{name:'PN3-APP'},{name:'PE1-APP'},{name:'TG-APP'},{name:'BN4-APP'}]};assert.ok(applyServerRules(r).changes.length);assert.equal(r.service.hostingLocations,'NIC,GCP,SALAM,DR');assert.equal(r.Servers[3].environment,'DR');assert.equal(r.Servers[3].site,'DR');assert.equal(r.service.hostingType,undefined);assert.equal(applyServerRules(r).changes.length,0);});
test('preserves existing values and reports conflicts',()=>{const r={service:{hostingLocations:'NIC'},Servers:[{name:'PE1-APP',environment:'QA',site:'SALAM',zone:'Custom'}]};const result=applyServerRules(r);assert.equal(r.Servers[0].environment,'QA');assert.equal(r.Servers[0].zone,'Custom');assert.equal(r.service.hostingLocations,'NIC,SALAM');assert.equal(result.conflicts.length,2);});

test('imports replace cluster labels with prefix-derived sites and retain original labels',()=>{
 const r={service:{hostingLocations:'NIC,ELM1-DEV-QA,CLD-PROD'},Servers:[{name:'PN3-APP',site:'CLD-PROD'},{name:'SN3-APP',site:'SN3-OPS-CLD-POOL01'},{name:'PE1-APP',site:'CLD-STG'},{name:'TG-APP',site:'ELM1-DEV-QA'},{name:'BN4-APP'},{name:'TE-APP',site:'ELM1-DEV-QA'}]};
 applyServerRules(r);assert.deepEqual(r.Servers.map(n=>n.site||''),['NIC','NIC','SALAM','GCP','DR','']);
 assert.equal(r.service.hostingLocations,'NIC,GCP,SALAM,DR');assert.match(r.Servers[0].notes,/CLD-PROD/);assert.match(r.service.description,/ELM1-DEV-QA/);assert.equal(applyServerRules(r).changes.length,0);
});
