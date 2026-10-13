import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {searchAssets,inspectServices} from '../public/intelligence.js';
import {diagramImpact} from '../public/diagram-impact.js';
import {renderArchitecture} from '../public/architecture-view.js';
const record={service:{id:'s1',name:'Identity',code:'ID',hostingLocations:'NIC',hostingType:'VM'},Servers:[{name:'PN3APP01',privateIp:'10.1.1.1',environment:'Production',site:'NIC'}],Components:[],Endpoints:[],LoadBalancers:[],Networks:[],Connections:[]};
test('asset search returns one row with service context even when multiple fields match',()=>{
 const rows=searchAssets([record],'PN3');assert.equal(rows.length,1);assert.equal(rows[0].serviceName,'Identity');assert.equal(rows[0].environment,'Production');assert.equal(rows[0].location,'NIC');assert.equal(searchAssets([record],'10.1.1.1').length,1);assert.deepEqual(searchAssets([record],''),[]);
});
test('record review does not require publishing and links connection gaps to the correct editor',()=>{
 assert.ok(!inspectServices([record]).some(f=>/endpoint|publishing/i.test(f.message)));
 const findings=inspectServices([{...record,Connections:[{sourceIp:'10.1.1.1'}]}]);assert.equal(findings.find(f=>/source or destination/.test(f.message)).section,'Connections');
});
test('diagram impact terminates on cycles and excludes unrelated items and free arrows',()=>{
 const result=diagramImpact({edges:[{id:'a',source:'vip',target:'app'},{id:'b',source:'app',target:'db'},{id:'c',source:'db',target:'app'},{id:'d',source:'other',target:'external'}],arrows:[{id:'free'}]},['app']);assert.deepEqual([...result.nodes].sort(),['app','db','vip']);assert.deepEqual([...result.edges].sort(),['a','b','c']);
});
test('light diagram has readable text and arrow colors without changing graph geometry',()=>{
 const graph={nodes:[{id:'a',label:'Application',type:'VM',x:20,y:30},{id:'b',label:'Data',type:'Database',x:20,y:300}],edges:[{id:'edge',source:'a',target:'b'}]};const dark=renderArchitecture(graph),light=renderArchitecture(graph,null,null,'light');assert.equal(light.w,dark.w);assert.equal(light.h,dark.h);assert.match(light.svg,/#236178/);assert.match(light.svg,/#24364d/);assert.match(dark.svg,/#f1f5f9/);
});
test('appearance defaults to light, restores dark and resolves system without storage access',()=>{
 const code=readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');
 for(const [stored,system,expected,blocked] of [[null,true,'light',false],['dark',false,'dark',false],['system',true,'dark',false],['invalid',true,'light',false],[null,true,'light',true]]){
 const document={documentElement:{dataset:{}},querySelector:()=>null,addEventListener(){}};vm.runInNewContext(code,{document,matchMedia:()=>({matches:system,addEventListener(){}}),localStorage:{getItem(){if(blocked)throw Error('Storage blocked');return stored;}},window:{dispatchEvent(){}},Event:class{}});assert.equal(document.documentElement.dataset.theme,expected);
 }
});
