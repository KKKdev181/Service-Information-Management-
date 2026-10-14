import { inflateRawSync } from 'node:zlib';
const invalid = text => Object.assign(new Error(text), { status: 422 });
const attribute = (tag, key) => {
  const match = tag.match(new RegExp('(?:\\s|^)' + key + '="([^"]*)"'));
  return match ? match[1] : '';
};
const entities = value => String(value ?? '').replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|amp|lt|gt|quot|apos);/gi, (raw, hex, digit) => {
  if (hex || digit) {
    const code = parseInt(hex || digit, hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }
  return ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[raw.toLowerCase()] ?? raw;
});
const richText = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match => entities(match[1])).join('');

function openZip(buffer) {
  let tail = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { tail = i; break; }
  }
  if (tail < 0) throw invalid('Invalid Excel archive');
  const count = buffer.readUInt16LE(tail + 10);
  if (count > 2000) throw invalid('Too many Excel archive entries');
  let pointer = buffer.readUInt32LE(tail + 16);
  const index = new Map();
  for (let i = 0; i < count; i++) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) throw invalid('Invalid Excel directory');
    const method = buffer.readUInt16LE(pointer + 10);
    const compressed = buffer.readUInt32LE(pointer + 20);
    const expanded = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const offset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);
    if (name.startsWith('xl/')) index.set(name, { method, compressed, expanded, offset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  function xml(name, max = 8 * 1024 * 1024) {
    const part = index.get(name);
    if (!part) return null;
    if (part.compressed > max || part.expanded > max) throw invalid('Oversized Excel XML part');
    const p = part.offset;
    if (p + 30 > buffer.length || buffer.readUInt32LE(p) !== 0x04034b50) throw invalid('Invalid Excel file entry');
    const start = p + 30 + buffer.readUInt16LE(p + 26) + buffer.readUInt16LE(p + 28);
    if (start + part.compressed > buffer.length) throw invalid('Truncated Excel part');
    const bytes = buffer.subarray(start, start + part.compressed);
    const data = part.method === 8
      ? inflateRawSync(bytes, { maxOutputLength: max })
      : part.method === 0 ? bytes : (() => { throw invalid('Unsupported Excel compression'); })();
    return data.toString('utf8');
  }
  return xml;
}

export function readLegacyWorkbook(buffer) {
  const xml = openZip(buffer);
  const workbook = xml('xl/workbook.xml');
  const relationships = xml('xl/_rels/workbook.xml.rels');
  if (!workbook || !relationships) throw invalid('Missing Excel workbook metadata');
  const relations = new Map();
  for (const match of relationships.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = attribute(match[0], 'Id');
    if (id) relations.set(id, attribute(match[0], 'Target'));
  }
  const targets = new Map();
  for (const match of workbook.matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = entities(attribute(match[0], 'name'));
    const target = relations.get(attribute(match[0], 'r:id'));
    if (target) targets.set(name, target);
  }
  if (!targets.has('Server Details') || !targets.has('Summary')) return null;
  const shared = xml('xl/sharedStrings.xml', 5 * 1024 * 1024);
  const strings = shared ? [...shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m => richText(m[1])) : [];
  const rowLimits = { Summary: 25, 'Server Details': 400, 'APP Comm Matrix': 1000, 'Standard Comm Matrix': 1000, NATTING: 25 };
  const worksheets = new Map();
  for (const [name, rowLimit] of Object.entries(rowLimits)) {
    const target = targets.get(name);
    if (!target) continue;
    const resolved = target.startsWith('/') ? target.slice(1) : target.startsWith('xl/') ? target : 'xl/' + target.replace(/^\.\//, '');
    if (resolved.includes('..')) throw invalid('Invalid worksheet path');
    const source = xml(resolved);
    if (!source) continue;
    const rows = new Map();
    let rowCount = 0;
    for (const cell of source.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const coordinate = /^([A-Z]+)(\d+)$/.exec(attribute(cell[1], 'r'));
      if (!coordinate) continue;
      const row = Number(coordinate[2]);
      if (row < 1 || row > rowLimit) continue;
      let column = 0;
      for (const letter of coordinate[1]) column = column * 26 + letter.charCodeAt(0) - 64;
      if (column > 100) continue;
      const type = attribute(cell[1], 't');
      const body = cell[2] || '';
      const match = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
      let value = type === 'inlineStr' ? richText(body) : entities(match?.[1] ?? '');
      if (type === 's') value = strings[Number(value)] ?? '';
      if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      if (!rows.has(row)) rows.set(row, new Map());
      rows.get(row).set(column, String(value).slice(0, 2000));
      rowCount = Math.max(rowCount, row);
    }
    worksheets.set(name, {
      rowCount,
      getRow: row => ({ getCell: col => ({ text: rows.get(row)?.get(col) ?? '' }) })
    });
  }
  return { getWorksheet: name => worksheets.get(name) };
}
