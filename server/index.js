import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list, upsert, remove, workbookPath } from './store.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
app.get('/api/services', asyncRoute(async (req, res) => res.json(await list())));
app.post('/api/services', asyncRoute(async (req, res) => res.status(201).json(await upsert(null, req.body))));
app.put('/api/services/:id', asyncRoute(async (req, res) => res.json(await upsert(req.params.id, req.body))));
app.delete('/api/services/:id', asyncRoute(async (req, res) => { await remove(req.params.id); res.status(204).end(); }));
app.get('/api/export', asyncRoute(async (req, res) => res.download(await workbookPath(), 'service-implementation.xlsx')));
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.use(express.static(publicDir));
app.get('/{*path}', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).json({ error: err.status ? err.message : 'حدث خطأ أثناء معالجة الطلب' }); });
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res)).catch(next); }
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`Service portal: http://${host}:${port}`));
