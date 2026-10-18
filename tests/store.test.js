import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import ExcelJS from 'exceljs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hub-store-'));process.env.DATA_DIR=dir;const store=await import('../server/store.js');test.after(()=>fs.rm(dir,{recursive:true,force:true}));
test('older workbook migrates without lost rows; platform inventory survives edits, export/import and duplicate import',async()=>{
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Services');sheet.addRow(['id','name','code','revision']);sheet.addRow(['legacy','Legacy Service','LEG','1']);await book.xlsx.writeFile(path.join(dir,'services.xlsx'));
 let rows=await store.list();assert.equal(rows.length,1);assert.deepEqual(rows[0].Components,[]);
 let r=rows[0];r.service.hostingType='Hybrid';r.service.tpmName='Sample TPM';r.Components=[{name:'API',type:'OpenShift',namespace:'sample',environment:'Production'}];r.Servers=[{name:'PN3-APP',privateIp:'192.0.2.1',platform:'VM'}];r.Connections=[{type:'VPN',tunnelName:'Partner VPN',vpnType:'Site-to-site IPsec',environment:'Production',localGateway:'192.0.2.1',remoteGateway:'198.51.100.1',localSubnets:'10.1.0.0/24',remoteSubnets:'10.2.0.0/24',vpnStatus:'Planned'}];r=await store.upsert('legacy',r);const child=r.Components[0].id;const rev=r.service.revision;
 await assert.rejects(store.upsert('legacy',{...r,service:{...r.service,revision:'0'}}),e=>e.status===409);
 r=await store.upsert('legacy',r);assert.equal(r.Components[0].id,child);assert.equal(r.Components[0].namespace,'sample');
 for(let i=0;i<3;i++)assert.equal((await store.list()).length,1);
 const buffer=await fs.readFile(await store.workbookPath());const parsed=await store.previewWorkbook(buffer);assert.equal(parsed[0].Components[0].namespace,'sample');assert.equal(parsed[0].service.tpmName,'Sample TPM');for(const key of ['tunnelName','vpnType','environment','localGateway','remoteGateway','localSubnets','remoteSubnets','vpnStatus'])assert.equal(parsed[0].Connections[0][key],r.Connections[0][key]);const imported=await store.importRecords(parsed);assert.equal(imported.imported,0);assert.equal(imported.skipped,1);
 await store.remove('legacy');assert.equal((await store.list()).length,0);
});
