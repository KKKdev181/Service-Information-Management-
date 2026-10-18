import {identify,mutationGuard,adminOnly,login,logout,listUsers,saveUser} from './access.js';
import {audited,readHistory} from './history.js';
import { readArchitecture, saveArchitecture } from './architecture.js';
import express from 'express';
import { listReferences, saveReference, deleteReference, listTpms, addTpm } from './references.js';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list, upsert, remove, workbookPath, importRecords } from './store.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
// IIS must forward X-Forwarded-For only from its local proxy.
app.set('trust proxy','loopback');
app.use('/api',identify);
app.get('/api/auth/session',(req,res)=>res.json({user:req.user}));
app.post('/api/auth/login',asyncRoute(login));
app.post('/api/auth/logout',logout);
app.use('/api',mutationGuard);
app.get('/api/users',adminOnly,asyncRoute(async(req,res)=>res.json(await listUsers())));
app.post('/api/users',asyncRoute(async(req,res)=>res.status(201).json(await audited(req.user,{kind:'users',action:'Created account',label:req.body.username},async()=>null,()=>saveUser(null,req.body),async user=>user))));
app.put('/api/users/:id',asyncRoute(async(req,res)=>res.json(await audited(req.user,{kind:'users',action:'Updated account',entityId:req.params.id,label:req.body.username||'Account'},async()=>(await listUsers()).find(u=>u.id===req.params.id)||null,()=>saveUser(req.params.id,req.body),async user=>({...user,...(req.body.password?{password:'Password reset'}:{})})))));
app.get('/api/history',asyncRoute(async(req,res)=>res.json(await readHistory({offset:Math.max(0,Math.min(1000000,parseInt(req.query.offset)||0)),query:String(req.query.q||'').slice(0,200),kind:String(req.query.kind||''),entityId:String(req.query.entityId||''),includeUsers:req.user?.role==='admin'}))));
const serviceBefore=async id=>(await list()).find(x=>x.service.id===id)||null;
const referenceBefore=async id=>(await listReferences()).find(x=>x.id===id)||null;
app.get('/api/tpms',asyncRoute(async(req,res)=>{
 const names=[...await listTpms(),...(await list()).map(r=>r.service.tpmName).filter(Boolean)];
 const unique=new Map();for(const name of names){const key=name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();if(!unique.has(key))unique.set(key,name);}
 res.json([...unique.values()].sort((a,b)=>a.localeCompare(b)));
}));
app.post('/api/tpms',asyncRoute(async(req,res)=>res.status(201).json(await audited(req.user,{kind:'tpms',action:'Added TPM name',label:req.body?.name},listTpms,()=>addTpm(req.body),listTpms))));
app.get('/api/references', asyncRoute(async(req,res)=>res.json(await listReferences())));
app.post('/api/references', asyncRoute(async(req,res)=>res.status(201).json(await audited(req.user,{kind:'references',action:'Added reference',label:req.body.name},async()=>null,()=>saveReference(null,{...req.body,updatedBy:req.user.name}),async x=>x))));
app.put('/api/references/:id', asyncRoute(async(req,res)=>res.json(await audited(req.user,{kind:'references',action:'Updated reference',entityId:req.params.id,label:req.body.name},()=>referenceBefore(req.params.id),()=>saveReference(req.params.id,{...req.body,updatedBy:req.user.name}),async x=>x))));
app.delete('/api/references/:id', asyncRoute(async(req,res)=>{await audited(req.user,{kind:'references',action:'Deleted reference',entityId:req.params.id},()=>referenceBefore(req.params.id),()=>deleteReference(req.params.id),async()=>null);res.status(204).end();}));
app.get('/api/services', asyncRoute(async (req, res) => res.json(await list())));
app.post('/api/services', asyncRoute(async (req, res) => res.status(201).json(await audited(req.user,{kind:'services',action:'Added service',label:req.body.service?.name},async()=>null,()=>upsert(null,{...req.body,updatedBy:req.user.name}),async x=>x))));
app.put('/api/services/:id', asyncRoute(async (req, res) => res.json(await audited(req.user,{kind:'services',action:'Updated service',entityId:req.params.id,label:req.body.service?.name},()=>serviceBefore(req.params.id),()=>upsert(req.params.id,{...req.body,updatedBy:req.user.name}),async x=>x))));
app.delete('/api/services/:id', asyncRoute(async (req, res) => { await audited(req.user,{kind:'services',action:'Deleted service',entityId:req.params.id},()=>serviceBefore(req.params.id),()=>remove(req.params.id),async()=>null); res.status(204).end(); }));
app.get('/api/services/:id/architecture', asyncRoute(async (req,res)=>{if(!(await list()).some(x=>x.service.id===req.params.id))return res.status(404).json({error:'Service not found'});res.json(await readArchitecture(req.params.id));}));
app.put('/api/services/:id/architecture', asyncRoute(async (req,res)=>{if(!(await list()).some(x=>x.service.id===req.params.id))return res.status(404).json({error:'Service not found'});res.json(await audited(req.user,{kind:'architecture',action:'Saved architecture',entityId:req.params.id,label:(await serviceBefore(req.params.id)).service.name},()=>readArchitecture(req.params.id),()=>saveArchitecture(req.params.id,req.body),async x=>x));}));
app.get('/api/export', asyncRoute(async (req, res) => res.download(await workbookPath(), 'service-implementation.xlsx')));
app.post('/api/import/preview', express.raw({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', limit: '12mb' }), asyncRoute(async (req, res) => {
  const filename = decodeURIComponent(req.get('X-Import-Filename') || '');
  res.json(await previewInWorker(req.body, filename));
}));
app.post('/api/import/commit', asyncRoute(async (req, res) => res.json(await audited(req.user,{kind:'imports',action:'Imported Excel',label:'Excel import'},list,()=>importRecords(req.body.records,req.user.name),list))));
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.get('/vendor/elk.bundled.js', (req,res)=>res.sendFile(createRequire(import.meta.url).resolve('elkjs/lib/elk.bundled.js')));
app.use(express.static(publicDir));
app.get('/{*path}', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error('Request failed:', err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status < 500 ? err.message : 'An error occurred while processing the request' });
});
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res)).catch(next); }
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if(process.env.NODE_ENV!=='test')app.listen(port, host, () => console.log(`Service portal: http://${host}:${port}`));


// Keep untrusted/heavy Excel parsing out of the web server process.
function previewInWorker(buffer, filename) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import-worker.js', import.meta.url), {
      workerData: { buffer, filename },
      resourceLimits: { maxOldGenerationSizeMb: 256 }
    });
    let settled = false;
    const timer = setTimeout(() => {
      void worker.terminate();
      finish(new Error('Excel processing timed out. Please simplify the workbook or contact support.'), null, 422);
    }, 45000);
    function finish(error, result, status) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(Object.assign(error, { status: status || error.status || 422 }));
      else resolve(result);
    }
    worker.once('message', message => message.ok
      ? finish(null, message.result)
      : finish(new Error(message.error || 'Excel import failed'), null, message.status || 422));
    worker.once('error', error => finish(new Error('Excel processing failed: ' + error.message), null, 422));
    worker.once('exit', code => {
      if (!settled) finish(new Error('Excel processing stopped unexpectedly (code ' + code + ').'), null, 422);
    });
  });
}
