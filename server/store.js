import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const directory = path.resolve(process.env.DATA_DIR || './data');
const file = path.join(directory, 'services.xlsx');
const sheets = {
  Services: ['id', 'name', 'code', 'customer', 'owner', 'status', 'environment', 'description', 'updatedAt', 'updatedBy', 'revision'],
  Servers: ['id', 'serviceId', 'name', 'environment', 'role', 'privateIp', 'publicIp', 'os', 'site', 'notes'],
  Endpoints: ['id', 'serviceId', 'url', 'dns', 'vip', 'port', 'protocol', 'environment', 'notes'],
  LoadBalancers: ['id', 'serviceId', 'name', 'vip', 'pool', 'members', 'port', 'waf', 'notes'],
  Connections: ['id', 'serviceId', 'type', 'source', 'destination', 'port', 'reference', 'notes']
};
const children = ['Servers', 'Endpoints', 'LoadBalancers', 'Connections'];
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
  for (const [name, columns] of Object.entries(sheets)) {
    if (!book.getWorksheet(name)) {
      const sheet = book.addWorksheet(name);
      sheet.addRow(columns);
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF153C37' } };
      columns.forEach((_, i) => sheet.getColumn(i + 1).width = 22);
    }
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
function rewrite(book, name, records) {
  const sheet = book.getWorksheet(name);
  if (sheet.rowCount > 1) sheet.spliceRows(2, sheet.rowCount - 1);
  for (const record of records) sheet.addRow(sheets[name].map(column => textCell(record[column])));
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
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('بيانات الخدمة غير صحيحة'), { status: 400 });
  const service = input.service;
  if (!service || !safe(service.name)) throw Object.assign(new Error('اسم الخدمة مطلوب'), { status: 400 });
  if (safe(service.name).length > 180) throw Object.assign(new Error('اسم الخدمة طويل جدًا'), { status: 400 });
  for (const name of children) {
    if (!Array.isArray(input[name]) || input[name].length > 300) throw Object.assign(new Error(`قسم ${name} غير صحيح`), { status: 400 });
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
  if (id && !existing) throw Object.assign(new Error('الخدمة غير موجودة'), { status: 404 });
  if (existing && Number(input.service.revision) !== Number(existing.revision)) throw Object.assign(new Error('تم تحديث الخدمة بواسطة شخص آخر. حدّث الصفحة قبل الحفظ.'), { status: 409 });
  const serviceId = id || crypto.randomUUID();
  const record = Object.fromEntries(sheets.Services.map(key => [key, safe(input.service[key])]));
  Object.assign(record, { id: serviceId, updatedAt: new Date().toISOString(), updatedBy: safe(input.updatedBy) || 'غير محدد', revision: String((Number(existing?.revision) || 0) + 1) });
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
  if (!services.some(item => item.id === id)) throw Object.assign(new Error('الخدمة غير موجودة'), { status: 404 });
  rewrite(book, 'Services', services.filter(item => item.id !== id));
  for (const name of children) rewrite(book, name, rows(book, name).filter(item => item.serviceId !== id));
  await save(book);
});
