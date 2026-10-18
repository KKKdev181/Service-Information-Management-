import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const folder = path.resolve(process.env.DATA_DIR || './data');
const filename = path.join(folder, 'infrastructure-reference.xlsx');
const fields = ['id','category','name','value','relatedIp','service','environment','location','purpose','details','updatedBy','updatedAt','createdAt'];
const categories = ['Public IP','Internal Network','Connectivity','Technical Reference'];
let lock = Promise.resolve();
const serialize = task => {const run=lock.then(task);lock=run.catch(()=>{});return run;};
const clean = v => String(v ?? '').trim().slice(0,1500);
const protect = v => /^[=+@\-\t\r]/.test(clean(v)) ? "'" + clean(v) : clean(v);
const unprotect = v => String(v ?? '').replace(/^'(?=[=+@\-\t\r])/,'');
function invalid(message) {return Object.assign(new Error(message),{status:400});}
function validate(input) {
  if(!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Invalid reference record');
  if(!categories.includes(input.category)) throw invalid('Select a valid category');
  if(!clean(input.name)) throw invalid('Name is required');
  if(!clean(input.value) && input.category !== 'Technical Reference') throw invalid('IP address, network or connection detail is required');
}
async function load() {
  await fs.mkdir(folder,{recursive:true});
  const book=new ExcelJS.Workbook();
  if(await fs.stat(filename).catch(()=>null)) await book.xlsx.readFile(filename);
  let sheet=book.getWorksheet('References');
  if(!sheet) {
    sheet=book.addWorksheet('References');
    sheet.addRow(fields);
    sheet.getRow(1).font={bold:true};
    sheet.views=[{state:'frozen',ySplit:1}];
    fields.forEach((_,i)=>sheet.getColumn(i+1).width=24);
  }
  const items=[];
  sheet.eachRow((row,index)=>{
    if(index===1)return;
    const item=Object.fromEntries(fields.map((key,i)=>[key,unprotect(row.getCell(i+1).text)]));
    if(item.id)items.push(item);
  });
  return {book,sheet,items};
}
async function persist(book,sheet,items) {
  if(sheet.rowCount>1)sheet.spliceRows(2,sheet.rowCount-1);
  for(const item of items)sheet.addRow(fields.map(field=>protect(item[field])));
  const temp=path.join(folder,'.reference-'+crypto.randomUUID()+'.xlsx');
  try {
    await book.xlsx.writeFile(temp);
    if(await fs.stat(filename).catch(()=>null))await fs.copyFile(filename,path.join(folder,'infrastructure-reference.backup.xlsx'));
    await fs.rename(temp,filename);
  } finally {await fs.rm(temp,{force:true});}
}
export const listReferences = ()=>serialize(async()=> (await load()).items);
export const saveReference = (id,input)=>serialize(async()=>{
  validate(input);
  const {book,sheet,items}=await load();
  const current=id?items.find(i=>i.id===id):null;
  if(id&&!current)throw Object.assign(new Error('Reference not found'),{status:404});
  const timestamp=new Date().toISOString();
  const item=Object.fromEntries(fields.map(k=>[k,clean(input[k])]));
  item.id=id||crypto.randomUUID();
  item.createdAt=current?.createdAt||timestamp;
  item.updatedAt=timestamp;
  item.updatedBy=clean(input.updatedBy)||'Not specified';
  await persist(book,sheet,[...items.filter(i=>i.id!==item.id),item]);
  return item;
});
export const deleteReference = id=>serialize(async()=>{
  const {book,sheet,items}=await load();
  if(!items.some(i=>i.id===id))throw Object.assign(new Error('Reference not found'),{status:404});
  await persist(book,sheet,items.filter(i=>i.id!==id));
});

// Shared dropdown values stay in DATA_DIR, independently of service deletion.
const tpmFile=path.join(folder,'tpms.json');
async function readTpms(){try{return JSON.parse(await fs.readFile(tpmFile,'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
export const listTpms=()=>serialize(readTpms);
export const addTpm=input=>serialize(async()=>{
 if(typeof input?.name!=='string')throw invalid('TPM name is required');
 const name=input.name.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!name||name.length>100)throw invalid('Enter a TPM name of 1–100 characters');
 const names=await readTpms();const existing=names.find(n=>n.toLowerCase()===name.toLowerCase());
 if(existing)return {name:existing};
 if(names.length>=2000)throw invalid('The TPM list is full');
 names.push(name);names.sort((a,b)=>a.localeCompare(b));await fs.mkdir(folder,{recursive:true});
 const temp=tpmFile+'.'+crypto.randomUUID()+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify(names,null,2));await fs.rename(temp,tpmFile);}finally{await fs.rm(temp,{force:true});}
 return {name};
});
