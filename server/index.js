import { readArchitecture, saveArchitecture } from './architecture.js';
import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list, upsert, remove, workbookPath, previewWorkbook, importRecords } from './store.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
app.get('/api/services', asyncRoute(async (req, res) => res.json(await list())));
app.post('/api/services', asyncRoute(async (req, res) => res.status(201).json(await upsert(null, req.body))));
app.put('/api/services/:id', asyncRoute(async (req, res) => res.json(await upsert(req.params.id, req.body))));
app.delete('/api/services/:id', asyncRoute(async (req, res) => { await remove(req.params.id); res.status(204).end(); }));
app.get('/api/services/:id/architecture', asyncRoute(async (req,res)=>{if(!(await list()).some(x=>x.service.id===req.params.id))return res.status(404).json({error:'Service not found'});res.json(await readArchitecture(req.params.id));}));
app.put('/api/services/:id/architecture', asyncRoute(async (req,res)=>{if(!(await list()).some(x=>x.service.id===req.params.id))return res.status(404).json({error:'Service not found'});res.json(await saveArchitecture(req.params.id,req.body));}));
app.get('/api/export', asyncRoute(async (req, res) => res.download(await workbookPath(), 'service-implementation.xlsx')));
app.post('/api/import/preview', express.raw({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', limit: '12mb' }), asyncRoute(async (req, res) => res.json(await previewWorkbook(req.body, decodeURIComponent(req.get('X-Import-Filename') || '')))));
app.post('/api/import/commit', asyncRoute(async (req, res) => res.json(await importRecords(req.body.records))));
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.get('/vendor/elk.bundled.js', (req,res)=>res.sendFile(createRequire(import.meta.url).resolve('elkjs/lib/elk.bundled.js')));
app.use(express.static(publicDir));
app.get('/{*path}', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).json({ error: err.status ? err.message : 'An error occurred while processing the request' }); });
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res)).catch(next); }
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`Service portal: http://${host}:${port}`));
