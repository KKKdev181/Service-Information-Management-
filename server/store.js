import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { readLegacyBuffer } from './legacy.js';

const directory = path.resolve(process.env.DATA_DIR || './data');
const file = path.join(directory, 'services.xlsx');
const sheets = {
  Services: ['id', 'name', 'code', 'customer', 'owner', 'status', 'environment', 'description', 'updatedAt', 'updatedBy', 'revision', 'createdAt'],
  Servers: ['id', 'serviceId', 'name', 'environment', 'role', 'privateIp', 'publicIp', 'os', 'site', 'domain', 'cpu', 'ram', 'storage', 'notes'],
  Endpoints: ['id', 'serviceId', 'url', 'dns', 'vip', 'port', 'protocol', 'environment', 'publicIp', 'wafIp', 'notes'],
  LoadBalancers: ['id', 'serviceId', 'name', 'vip', 'pool', 'members', 'port', 'waf', 'hostIp', 'hostPort', 'hostProtocol', 'vipProtocol', 'publishType', 'certificate', 'notes'],
  Connections: ['id', 'serviceId', 'type', 'source', 'destination', 'port', 'reference', 'notes', 'sourceIp', 'sourceHost', 'destinationIp', 'destinationHost', 'protocol', 'duration'],
  Networks: ['id', 'serviceId', 'name', 'ipam', 'range', 'vlan', 'subnet', 'gateway', 'context', 'notes']
};
const children = ['Servers', 'Endpoints', 'LoadBalancers', 'Connections', 'Networks'];
let queue = Promise.resolve();
const safe = value => String(value ?? '').trim().slice(0, 1000);
const textCell = value => {
  const v = safe(value);
  return /^[=+@\-\t\r]/.test(v) ? `'${v}` : v;
};
const parseCell = value => String(value ?? '').replace(/^'(?=[=+@\-\t\r])/, '');
const serialize = task => {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
};

async function readBook() {
  await fs.mkdir(directory, { recursive: true });
  const book = new ExcelJS.Workbook();
  if (await fs.stat(file).catch(() => null)) await book.xlsx.readFile(file);
  let repaired=false;
  for (const [name, columns] of Object.entries(sheets)) {
    if (!book.getWorksheet(name)) {
      const sheet = book.addWorksheet(name);
      sheet.addRow(columns);
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF153C37' } };
      columns.forEach((_, i) => sheet.getColumn(i + 1).width = 22);
    }
    const sheet=book.getWorksheet(name);
    const oldHeaders=sheet.getRow(1).values.slice(1).map(String);
    if(columns.some((column,i)=>oldHeaders[i]!==column)) {
      const oldRows=[];
      sheet.eachRow((row,index)=>{if(index>1)oldRows.push(Object.fromEntries(oldHeaders.map((key,i)=>[key,row.getCell(i+1).value??''])))});
      clearDataRows(sheet);
      columns.forEach((column,i)=>sheet.getRow(1).getCell(i+1).value=column);
      for(const row of oldRows)sheet.addRow(columns.map(key=>row[key]??''));
    }
  }
  // Repair only byte-equivalent row values, including IDs; distinct records remain untouched.
  for(const name of Object.keys(sheets)){
    const records=rows(book,name),seen=new Set(),unique=[];
    for(const record of records){const key=JSON.stringify(record);if(seen.has(key)){repaired=true;continue;}seen.add(key);unique.push(record);}
    if(unique.length!==records.length)rewrite(book,name,unique);
  }
  if(repaired){
    await fs.copyFile(file,path.join(directory,'services.before-duplicate-repair.'+Date.now()+'.xlsx'));
    await save(book);
  }
  return book;
}
function rows(book, name) {
  const sheet = book.getWorksheet(name), columns = sheets[name], result = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record = Object.fromEntries(columns.map((column, i) => [column, parseCell(row.getCell(i + 1).text)]));
    if (record.id) result.push(record);
  });
  return result;
}
function clearDataRows(sheet){
  // spliceRows at the end of a sheet is unreliable in this ExcelJS version.
  for(let i=2;i<=sheet.rowCount;i++)sheet.getRow(i).values=[];
}
function rewrite(book, name, records) {
  const sheet = book.getWorksheet(name);
  clearDataRows(sheet);
  records.forEach((record,index)=>{sheet.getRow(index+2).values=sheets[name].map(column=>textCell(record[column]));});
}
async function save(book) {
  const temp = path.join(directory, `.${crypto.randomUUID()}.xlsx`);
  try {
    await book.xlsx.writeFile(temp);
    try { await fs.copyFile(file, path.join(directory, 'services.backup.xlsx')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, { force: true }); }
}
function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Invalid service data'), { status: 400 });
  const service = input.service;
  if (!service || !safe(service.name)) throw Object.assign(new Error('Service name is required'), { status: 400 });
  if (safe(service.name).length > 180) throw Object.assign(new Error('Service name is too long'), { status: 400 });
  for (const name of children) {
    if (!Array.isArray(input[name]) || input[name].length > 300) throw Object.assign(new Error(`Section ${name} is invalid`), { status: 400 });
  }
}
function snapshot(book) {
  const all = Object.fromEntries(Object.keys(sheets).map(name => [name, rows(book, name)]));
  return all.Services.map(service => ({ service, ...Object.fromEntries(children.map(name => [name, all[name].filter(row => row.serviceId === service.id)])) }));
}
export const list = () => serialize(async () => snapshot(await readBook()));
export const workbookPath = () => serialize(async () => { const book = await readBook(); if (!(await fs.stat(file).catch(() => null))) await save(book); return file; });
export const upsert = (id, input) => serialize(async () => {
  validate(input);
  const book = await readBook();
  const services = rows(book, 'Services');
  const existing = services.find(item => item.id === id);
  if (id && !existing) throw Object.assign(new Error('Service not found'), { status: 404 });
  if (existing && Number(input.service.revision) !== Number(existing.revision)) throw Object.assign(new Error('This service was updated by someone else. Refresh the page before saving.'), { status: 409 });
  const serviceId = id || crypto.randomUUID();
  const record = Object.fromEntries(sheets.Services.map(key => [key, safe(input.service[key])]));
  Object.assign(record, { id: serviceId, createdAt: existing ? (existing.createdAt || '') : new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: safe(input.updatedBy) || 'Not specified', revision: String((Number(existing?.revision) || 0) + 1) });
  rewrite(book, 'Services', [...services.filter(item => item.id !== serviceId), record]);
  for (const name of children) {
    const kept = rows(book, name).filter(row => row.serviceId !== serviceId);
    const added = input[name].map(item => ({
      ...Object.fromEntries(sheets[name].map(key => [key, safe(item[key])])),
      id: crypto.randomUUID(), serviceId
    }));
    rewrite(book, name, [...kept, ...added]);
  }
  await save(book);
  return { service: record, ...Object.fromEntries(children.map(name => [name, rows(book, name).filter(row => row.serviceId === serviceId)])) };
});
export const remove = id => serialize(async () => {
  const book = await readBook();
  const services = rows(book, 'Services');
  if (!services.some(item => item.id === id)) throw Object.assign(new Error('Service not found'), { status: 404 });
  rewrite(book, 'Services', services.filter(item => item.id !== id));
  for (const name of children) rewrite(book, name, rows(book, name).filter(item => item.serviceId !== id));
  await save(book);
});

export async function previewWorkbook(buffer, filename='') {
  try { const legacy=await readLegacyBuffer(buffer,filename); if(legacy)return [legacy]; }
  catch(error) { if(error.status)throw error; /* Some simple workbooks are unsupported by ExcelJS streaming; use regular parsing below. */ }
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(buffer); }
  catch { throw Object.assign(new Error('Could not read the file. Choose an Excel in xlsx.'), { status: 400 }); }
  const imported={};
  for (const [name, columns] of Object.entries(sheets)) {
    const sheet = book.getWorksheet(name);
    if(!sheet && name==='Networks'){imported[name]=[];continue;}
    const headers=sheet && sheet.getRow(1).values.slice(1).map(String);
    if (!sheet || !headers.includes('id') || (name!=='Services' && !headers.includes('serviceId')) || (name==='Services' && !headers.includes('name')))
      throw Object.assign(new Error('The file format does not match the portal export template. A sample of the original template is needed to configure its import.'), { status: 400 });
    const parsed=[];
    sheet.eachRow((row,index)=>{if(index>1){const entry=Object.fromEntries(columns.map(key=>[key,headers.includes(key)?parseCell(row.getCell(headers.indexOf(key)+1).text):'']));if(entry.id)parsed.push(entry)}});
    imported[name]=parsed;
  }
  const records = imported.Services.map(service=>({service,...Object.fromEntries(children.map(name=>[name,imported[name].filter(row=>row.serviceId===service.id)]))}));
  if (records.length > 1000) throw Object.assign(new Error('The file contains more than 1000 services. Split it into smaller files.'), { status: 400 });
  return records.map(item => ({ ...item, service: Object.fromEntries(sheets.Services.map(k => [k, item.service[k]])) }));
}

export const importRecords = items => serialize(async () => {
  if (!Array.isArray(items) || items.length > 1000) throw Object.assign(new Error('Invalid service count'), { status: 400 });
  const book = await readBook();
  const current = Object.fromEntries(Object.keys(sheets).map(name => [name, rows(book, name)]));
  const known = new Set(current.Services.map(s => `${safe(s.code).toLowerCase()}|${safe(s.name).toLowerCase()}`));
  let imported = 0, skipped = 0;
  for (const item of items) {
    validate(item);
    const name = safe(item.service.name), code = safe(item.service.code);
    const identity = `${code.toLowerCase()}|${name.toLowerCase()}`;
    if (known.has(identity)) { skipped++; continue; }
    const id = crypto.randomUUID();
    current.Services.push({ ...Object.fromEntries(sheets.Services.map(key => [key, safe(item.service[key])])), id, name, code, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: 'Import Excel', revision: '1' });
    for (const section of children) {
      for (const row of item[section]) current[section].push({ ...Object.fromEntries(sheets[section].map(key => [key, safe(row[key])])), id: crypto.randomUUID(), serviceId: id });
    }
    known.add(identity); imported++;
  }
  if (imported) {
    for (const section of Object.keys(sheets)) rewrite(book, section, current[section]);
    await save(book);
  }
  return { imported, skipped };
});
