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
