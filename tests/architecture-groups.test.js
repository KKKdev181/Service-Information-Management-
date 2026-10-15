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


// Explicit containers retain visible equipment and exact connection endpoints.
import {attachToContainer,moveDiagramItem} from '../public/architecture-groups.js';
import {renderArchitecture} from '../public/architecture-view.js';
test('cluster membership, listener address and visible children survive persistence and movement',()=>{
 const cluster={id:'cluster',label:'Orders SQL',type:'Database Cluster',listenerIp:'10.20.1.50',x:100,y:100,width:520,height:300};
 const a={id:'db1',label:'SQL primary',type:'Database',x:700,y:100},b={id:'db2',label:'SQL secondary',type:'Database',x:700,y:300};
 const graph={nodes:[cluster,a,b],edges:[{id:'sync',source:'db1',target:'db2'}]};
 let view=groupArchitecture(graph);
 attachToContainer(graph,view,a,cluster);attachToContainer(graph,view,b,cluster);
 const saved=validateGraph(graph);view=groupArchitecture(saved);
 assert.equal(saved.nodes[0].listenerIp,'10.20.1.50');
 assert.equal(view.nodes.length,3);assert.equal(view.groups.length,0);
 assert.equal(view.edges[0].source,'db1');assert.equal(view.edges[0].target,'db2');
 for(const node of view.nodes.filter(n=>n.parentId)){
 assert.equal(node.parentId,'cluster');assert.ok(node.x>=cluster.x&&node.y>=cluster.y+84);
 assert.ok(node.y+node.height<=cluster.y+cluster.height);
 }
 const before=view.nodes.map(n=>({...n}));moveDiagramItem(saved,view,'cluster',200,250);
 for(const node of view.nodes){const old=before.find(n=>n.id===node.id);assert.equal(node.x,old.x+100);assert.equal(node.y,old.y+150);}
 view=groupArchitecture(validateGraph(saved));
 assert.equal(view.nodes.find(n=>n.id==='db1').x,224);
 const svg=renderArchitecture(view,null,null).svg;
 assert.match(svg,/Listener IP: 10.20.1.50/);assert.match(svg,/SQL primary/);assert.match(svg,/SQL secondary/);
 assert.ok(svg.indexOf('cluster-frame')<svg.indexOf('data-node="db1"'));
});
test('application containers persist and invalid or nested memberships are rejected',()=>{
 const app={id:'apps',label:'Application tier',type:'Application Group',x:10,y:10,width:520,height:600};
 const vm={id:'vm',label:'App 1',type:'VM',parentId:'apps',x:34,y:110};
 const saved=validateGraph({nodes:[app,vm],edges:[]});
 assert.equal(saved.nodes[0].height,600);assert.equal(saved.nodes[1].parentId,'apps');
 assert.equal(groupArchitecture(saved).nodes.length,2);
 assert.throws(()=>validateGraph({nodes:[{...app,parentId:'apps'},vm],edges:[]}),/nested/);
 assert.throws(()=>validateGraph({nodes:[app,{...vm,parentId:'missing'}],edges:[]}),/membership/);
});
test('adding a member after removing another leaves remaining members unobscured',()=>{
 const cluster={id:'c',label:'DBs',type:'Database Cluster',x:0,y:0,width:520,height:300};
 const graph={nodes:[cluster,...['a','b','d'].map(id=>({id,label:id,type:'Database',x:0,y:0}))],edges:[]};
 let view=groupArchitecture(graph);
 for(const n of graph.nodes.slice(1))attachToContainer(graph,view,n,cluster);
 delete graph.nodes[2].parentId;
 const next={id:'e',label:'New DB',type:'Database',x:0,y:0};graph.nodes.push(next);
 view=groupArchitecture(graph);attachToContainer(graph,view,next,cluster);
 assert.ok(next.y>=graph.nodes[3].y+116+24);
 assert.equal(attachToContainer(graph,view,cluster,cluster),false);
});
