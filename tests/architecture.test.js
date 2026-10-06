import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {generateArchitecture} from '../public/architecture-model.js';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'architecture-test-'));
process.env.DATA_DIR=temp;
const {saveArchitecture,readArchitecture,validateGraph}=await import('../server/architecture.js');
test('generates only recorded VIP/backend relationships',()=>{
 const record={Servers:[{name:'app1',privateIp:'192.0.2.1',environment:'Production'}],LoadBalancers:[{name:'app1',vip:'192.0.2.10',hostPort:'8080'},{name:'missing',vip:'192.0.2.11'}],Endpoints:[],Connections:[]};
 const result=generateArchitecture(record);assert.equal(result.nodes.length,3);assert.equal(result.edges.length,1);assert.equal(result.edges[0].port,'8080');assert.equal(result.nodes.find(n=>n.id===result.edges[0].target).label,'app1');
});
test('roundtrip preserves manual layout; stale saves cannot overwrite it',async()=>{
 const graph={revision:0,nodes:[{id:'one',label:'app',type:'Server',ip:'192.0.2.1',environment:'Production',x:321,y:222}],edges:[]};
 const saved=await saveArchitecture('test-service',graph);assert.equal(saved.revision,1);assert.equal((await readArchitecture('test-service')).nodes[0].x,321);
 await assert.rejects(()=>saveArchitecture('test-service',graph),e=>e.status===409);
 assert.equal((await readArchitecture('test-service')).nodes[0].y,222);
});
test('rejects dangling edges and file traversal',async()=>{
 assert.throws(()=>validateGraph({nodes:[],edges:[{id:'e',source:'unknown',target:'other'}]}));
 await assert.rejects(()=>readArchitecture('../outside'));
});
test.after(()=>fs.rm(temp,{recursive:true,force:true}));

test('layout follows dependencies, preserves cycles and separates environments without overlap',async()=>{
 const {arrangeArchitecture}=await import('../public/architecture-view.js');
 const graph={nodes:['db','lb','a','b','qa'].map(id=>({id,label:id,type:'Server',environment:id==='qa'?'QA':'Production',x:0,y:0,width:300,height:140})),edges:[{source:'lb',target:'a'},{source:'lb',target:'b'},{source:'a',target:'db'},{source:'db',target:'a'}]};
 const before=JSON.stringify(graph.edges);arrangeArchitecture(graph);const by=Object.fromEntries(graph.nodes.map(n=>[n.id,n]));assert.ok(by.lb.y<by.a.y);assert.equal(by.a.y,by.db.y);assert.equal(JSON.stringify(graph.edges),before);
 for(const a of graph.nodes)for(const b of graph.nodes)if(a!==b)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
});
test('validates and preserves zone and resized cards',()=>{const g=validateGraph({nodes:[{id:'n',x:1,y:2,width:420,height:220,zone:'DATA'}],edges:[]});assert.equal(g.nodes[0].width,420);assert.equal(g.nodes[0].zone,'DATA');});

test('ELK routes a branching architecture in both directions and preserves editable routes', async()=>{
 const {default:ELK}=await import('elkjs/lib/elk.bundled.js');
 const {layoutArchitecture,routeSignature}=await import('../public/architecture-layout.js');
 for(const direction of ['DOWN','RIGHT']){
 const graph={nodes:['lb','vm1','vm2','db'].map(id=>({id,label:id,type:'Server',x:0,y:0})),edges:[['lb','vm1'],['lb','vm2'],['vm1','db'],['vm2','db']].map(([source,target],i)=>({id:'e'+i,source,target}))};
 await layoutArchitecture(graph,direction,ELK);
 const clean=validateGraph(graph);
 for(const edge of clean.edges){assert.ok(edge.route.points.length>=2);assert.equal(edge.route.signature,routeSignature(clean,edge));}
 for(const a of clean.nodes)for(const b of clean.nodes)if(a.id!==b.id)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
 const edge=clean.edges[0];clean.nodes[0].x+=20;assert.notEqual(edge.route.signature,routeSignature(clean,edge));
 }
});
