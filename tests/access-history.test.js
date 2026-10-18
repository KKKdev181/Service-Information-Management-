import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const folder=await fs.mkdtemp(path.join(os.tmpdir(),'portal-access-'));
process.env.DATA_DIR=folder;process.env.NODE_ENV='test';
const {saveUser}=await import('../server/access.js');
const {app}=await import('../server/index.js');
const {changes}=await import('../server/history.js');
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const password='Temporary-test-password-827!';
const admin=await saveUser(null,{username:'admin',name:'Admin Person',password},{bootstrap:true});
async function request(url,{method='GET',body,cookie,csrf=true}={}){
 const headers={};if(csrf)headers['X-Portal-Request']='1';if(body!==undefined)headers['Content-Type']='application/json';if(cookie)headers.Cookie=cookie;
 const res=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,body:res.status===204?null:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
}
const record=name=>({service:{name,code:'TST'},Servers:[],Components:[],Endpoints:[],LoadBalancers:[],Connections:[],Networks:[],updatedBy:'Forged author'});

test('server enforces admin writes and records reliable identity across every mutation area',async()=>{
 try{
 assert.equal((await request('/api/services')).status,200);
 for(const [method,url] of [['POST','/api/tpms'],['POST','/api/services'],['PUT','/api/services/example'],['DELETE','/api/services/example'],['POST','/api/import/preview'],['POST','/api/import/commit'],['POST','/api/references'],['PUT','/api/references/example'],['DELETE','/api/references/example'],['PUT','/api/services/example/architecture'],['POST','/api/users'],['PUT','/api/users/example']]){
 assert.equal((await request(url,{method,body:{}})).status,401,url);
 }
 assert.equal((await request('/api/users')).status,401);
 assert.equal((await request('/api/auth/login',{method:'POST',csrf:false,body:{username:'admin',password}})).status,403);
 assert.equal((await request('/api/auth/login',{method:'POST',body:{username:'admin',password:'wrong'}})).status,401);
 const signed=await request('/api/auth/login',{method:'POST',body:{username:'admin',password}});assert.equal(signed.status,200);assert.match(signed.headers.get('set-cookie'),/HttpOnly/);assert.match(signed.headers.get('set-cookie'),/SameSite=Strict/);
 const cookie=signed.cookie;
 const tpm=await request('/api/tpms',{method:'POST',cookie,body:{name:'  Sample   TPM  '}});assert.equal(tpm.status,201);assert.equal(tpm.body.name,'Sample TPM');
 const duplicate=await request('/api/tpms',{method:'POST',cookie,body:{name:'sample tpm'}});assert.equal(duplicate.body.name,'Sample TPM');
 assert.deepEqual((await request('/api/tpms')).body,['Sample TPM']);
 assert.equal((await request('/api/tpms',{method:'POST',cookie,body:{name:' '}})).status,400);
 
 assert.equal((await request('/api/services',{method:'POST',cookie,csrf:false,body:record('Blocked')})).status,403);
 const viewer=await request('/api/users',{method:'POST',cookie,body:{username:'viewer',name:'Viewer Person',role:'viewer',password}});assert.equal(viewer.status,201);
 const viewerCookie=(await request('/api/auth/login',{method:'POST',body:{username:'viewer',password}})).cookie;
 assert.equal((await request('/api/services',{method:'POST',cookie:viewerCookie,body:record('Blocked')})).status,403);
 assert.equal((await request('/api/users',{cookie:viewerCookie})).status,403);
 const created=await request('/api/services',{method:'POST',cookie,body:record('Original')});assert.equal(created.status,201);assert.equal(created.body.service.updatedBy,'Admin Person');
 const id=created.body.service.id;
 const updated=await request('/api/services/'+id,{method:'PUT',cookie,body:{...created.body,service:{...created.body.service,name:'Renamed'},updatedBy:'Impersonated'}});assert.equal(updated.status,200);assert.equal(updated.body.service.updatedBy,'Admin Person');
 const stale=await request('/api/services/'+id,{method:'PUT',cookie,body:created.body});assert.equal(stale.status,409);
 const diagram=await request('/api/services/'+id+'/architecture',{method:'PUT',cookie,body:{revision:0,nodes:[{id:'db',label:'DB',type:'Database',x:0,y:0}],edges:[]}});assert.equal(diagram.status,200);
 const reference=await request('/api/references',{method:'POST',cookie,body:{category:'Public IP',name:'Gateway',value:'192.0.2.10',updatedBy:'Fake'}});assert.equal(reference.status,201);assert.equal(reference.body.updatedBy,'Admin Person');
 assert.equal((await request('/api/references/'+reference.body.id,{method:'DELETE',cookie})).status,204);
 const imported=await request('/api/import/commit',{method:'POST',cookie,body:{records:[record('Imported')]}});assert.equal(imported.status,200);assert.equal(imported.body.imported,1);
 assert.equal((await request('/api/services')).body.find(r=>r.service.name==='Imported').service.updatedBy,'Admin Person');
 assert.equal((await request('/api/services/'+id,{method:'DELETE',cookie})).status,204);
 const history=(await request('/api/history',{cookie})).body;
 assert.ok(history.items.some(e=>e.action==='Updated service'&&e.status==='completed'&&e.changes.some(c=>c.field==='service.name'&&c.before==='Original'&&c.after==='Renamed')));
 assert.ok(history.items.some(e=>e.action==='Updated service'&&e.status==='rejected'));
 for(const kind of ['services','architecture','references','imports','users','tpms'])assert.ok(history.items.some(e=>e.kind===kind&&e.status==='completed'),kind);
 assert.ok(history.items.every(e=>e.actor.username==='admin'));
 assert.ok(!(await request('/api/history',{cookie:viewerCookie})).body.items.some(e=>e.kind==='users'));
 assert.ok(!JSON.stringify(history).includes(password));
 const users=(await request('/api/users',{cookie})).body;assert.ok(!JSON.stringify(users).includes('credentials'));
 const stored=await fs.readFile(path.join(folder,'users.json'),'utf8');assert.ok(!stored.includes(password));assert.match(stored,/"salt"/);
 assert.equal((await request('/api/users/'+viewer.body.id,{method:'PUT',cookie,body:{enabled:false}})).status,200);
 assert.equal((await request('/api/auth/session',{cookie:viewerCookie})).body.user,null);
 assert.equal((await request('/api/users/'+admin.id,{method:'PUT',cookie,body:{enabled:false}})).status,400);
 assert.equal((await request('/api/auth/logout',{method:'POST',cookie})).status,204);
 assert.equal((await request('/api/services',{method:'POST',cookie,body:record('After logout')})).status,401);
 await assert.rejects(()=>saveUser(null,{username:'another',name:'Other',password},{bootstrap:true}),/already exists/);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(folder,{recursive:true,force:true});}
});
test('history compares child records by identity without treating reordering as edits',()=>{
 const a={Servers:[{id:'a',name:'A'},{id:'b',name:'B'}]},b={Servers:[{id:'b',name:'B'},{id:'a',name:'A'}]};assert.deepEqual(changes(a,b),[]);
 b.Servers[1].name='Renamed';assert.deepEqual(changes(a,b),[{field:'Servers.a.name',before:'A',after:'Renamed'}]);
});
