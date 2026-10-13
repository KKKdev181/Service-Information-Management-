import test from 'node:test';
import assert from 'node:assert/strict';
import {groupArchitecture,roleFor} from '../public/architecture-groups.js';
import {validateGraph} from '../server/architecture.js';
const sample=()=>({nodes:[
{id:'a',label:'App 1',type:'Server',notes:'role: Application',environment:'Production',x:20,y:20},
{id:'b',label:'App 2',type:'VM',environment:'Production',x:300,y:20},
{id:'c',label:'DB',type:'Database',environment:'Production',x:20,y:300},
{id:'d',label:'DR App',type:'VM',environment:'DR',x:20,y:600},
{id:'u',label:'Unknown',type:'Server',environment:'Production',x:300,y:600}],
edges:[{id:'e1',source:'a',target:'c',port:'443'},{id:'e2',source:'b',target:'c',port:'8443'},{id:'e3',source:'a',target:'b'}]});
test('groups by role and environment without changing source data',()=>{
 const graph=sample(),before=JSON.stringify(graph),view=groupArchitecture(graph);
 assert.equal(view.groups.length,4);
 const apps=view.groups.find(g=>g.role==='Applications'&&g.environment==='Production');
 assert.equal(apps.members.length,2);assert.equal(apps.internal.length,1);
 assert.equal(view.edges.length,1);assert.equal(view.edges[0].members.length,2);
 assert.equal(JSON.stringify(graph),before);
});
test('expanding a group restores exact member endpoints and internal connections',()=>{
 const graph=sample(),view=groupArchitecture(graph),id=view.groups.find(g=>g.role==='Applications'&&g.environment==='Production').id;
 const expanded=groupArchitecture(graph,new Set([id]));
 assert.ok(expanded.nodes.some(n=>n.id==='a'));assert.ok(!expanded.nodes.some(n=>n.id===id));
 assert.equal(expanded.edges.length,3);
 assert.deepEqual(expanded.edges.flatMap(e=>e.members.map(m=>m.id)).sort(),['e1','e2','e3']);
});
test('explicit roles persist and unknown servers are not classified by hostname',()=>{
 assert.equal(roleFor({type:'Server',label:'SQL-PROD-01'}),'Unassigned');
 assert.equal(roleFor({type:'Server',notes:'role: Database'}),'Databases');
 const saved=validateGraph({nodes:[{id:'a',x:0,y:0,type:'Server',architectureRole:'Applications'}],edges:[]});
 assert.equal(roleFor(saved.nodes[0]),'Applications');
 assert.equal(roleFor({type:'VM',architectureRole:'Unassigned'}),'Unassigned');
});

test('group links preserve scope and direction without inventing server pairs or ports',()=>{
 const graph=sample(),view=groupArchitecture(graph);
 const from=view.membership.get('a').id,to=view.membership.get('c').id;
 graph.edges=[{id:'group-link',source:from,target:to,protocol:'',port:''}];
 const saved=validateGraph(graph),projected=groupArchitecture(saved);
 assert.equal(saved.edges.length,1);
 assert.equal(saved.edges[0].source,from);
 assert.equal(saved.edges[0].target,to);
 assert.equal(saved.edges[0].port,'');
 assert.equal(projected.edges.length,1);
 assert.equal(projected.edges[0].source,from);
 assert.equal(projected.edges[0].target,to);
 assert.throws(()=>validateGraph({...graph,edges:[{id:'invalid',source:from,target:'group:missing'}]}));
});

test('separate components remain independent beside groups and retain exact connections',()=>{
 const graph=sample();graph.nodes.find(n=>n.id==='a').displayMode='separate';
 graph.edges=[{id:'ab',source:'a',target:'b'},{id:'ac',source:'a',target:'c'}];
 const saved=validateGraph(graph),view=groupArchitecture(saved);
 assert.equal(saved.nodes.find(n=>n.id==='a').displayMode,'separate');
 assert.ok(view.nodes.some(n=>n.id==='a'&&!n.isGroup));
 assert.ok(view.groups.every(g=>!g.members.some(n=>n.id==='a')));
 assert.equal(view.membership.get('b').members.length,1);
 assert.equal(view.edges.filter(e=>e.source==='a').length,2);
 saved.nodes.find(n=>n.id==='a').displayMode='grouped';
 const grouped=groupArchitecture(saved);
 assert.equal(grouped.nodes.some(n=>n.id==='a'),false);
 assert.equal(grouped.membership.get('a').id,grouped.membership.get('b').id);
 assert.equal(saved.edges.length,2);
});

test('hosting locations remain distinct and their identities survive validation',()=>{
 const graph={nodes:['GCP','NIC','SALAM','DR'].map((site,i)=>({id:'vm-'+i,type:'VM',label:site+' VM',environment:'Production',hostingLocation:site,displayMode:'grouped',x:0,y:0})),edges:[]};
 const saved=validateGraph(graph),view=groupArchitecture(saved);
 assert.equal(view.groups.length,4);
 assert.deepEqual(view.nodes.map(n=>n.hostingLocation),['GCP','NIC','SALAM','DR']);
 assert.equal(new Set(view.nodes.map(n=>n.id)).size,4);
 assert.deepEqual(saved.nodes.map(n=>n.hostingLocation),['GCP','NIC','SALAM','DR']);
 assert.equal(roleFor({type:'MPLS'}),'Integrations');
 assert.equal(roleFor({type:'GSN'}),'Integrations');
 assert.equal(roleFor({type:'Docker'}),'Applications');
});
