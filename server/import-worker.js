import { parentPort, workerData } from 'node:worker_threads';
import { previewWorkbook } from './store.js';

try {
  const items = await previewWorkbook(Buffer.from(workerData.buffer), workerData.filename);
  parentPort.postMessage({ ok: true, result: items });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error.status ? error.message : 'Unable to process this Excel file safely. Review its format and size.',
    status: error.status || 422
  });
}
