import { parentPort, workerData } from 'node:worker_threads';
import { previewLoadBalancers } from './lb-import.js';
import { previewWorkbook } from './store.js';

try {
  const items = workerData.mode==='lb' ? await previewLoadBalancers(Buffer.from(workerData.buffer)) : await previewWorkbook(Buffer.from(workerData.buffer), workerData.filename);
  parentPort.postMessage({ ok: true, result: items });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error.status ? error.message : 'Unable to process this Excel file safely. Review its format and size.',
    status: error.status || 422
  });
}
