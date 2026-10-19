import ExcelJS from 'exceljs';
export const lbKeys=['name','hostIp','hostPort','hostProtocol','vip','vipProtocol','port','dns','notes'];
const invalid=message=>Object.assign(new Error(message),{status:422});
const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={name:['hostname','name'],hostIp:['hostipaddress','hostip','backendip','backendipaddress'],hostPort:['hostport','backendport'],hostProtocol:['hostprotocol','backendprotocol'],vip:['lbwafvip','lbvip','vip','loadbalancervip'],vipProtocol:['lbvipprotocol','vipprotocol'],port:['vipport','lbport'],dns:['dnsurlinthiqah','dnsurl','dns','url','urls'],notes:['note','notes']};
export async function previewLoadBalancers(buffer){
 const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
 const rows=[],warnings=[];
 for(const sheet of book.worksheets){
  if(sheet.rowCount>10000||sheet.columnCount>200)throw invalid('Please use a focused LB sheet with at most 10,000 rows and 200 columns.');
  let mapping=null;
  for(let r=1;r<=sheet.rowCount;r++){
   const row=sheet.getRow(r),candidate={};
   row.eachCell((cell,col)=>{const header=normalize(cell.text);for(const [key,names] of Object.entries(aliases))if(names.includes(header)||(key==='dns'&&/^dnsurls?(?:in|for|at)/.test(header)))candidate[key]=col;});
   if(candidate.vip&&candidate.hostIp&&candidate.hostPort){mapping=candidate;continue;}
   if(!mapping)continue;
   // A title or recommendation merged across columns is not a mapping row.
   if(row.getCell(mapping.hostIp).master.address===row.getCell(mapping.vip).master.address)continue;
   const item=Object.fromEntries(lbKeys.map(k=>{const cell=mapping[k]?row.getCell(mapping[k]):null;const text=String(cell?.text||'');const value=k==='dns'&&/https?:\/\//i.test(text)?text:cell?.hyperlink||text;return [k,String(value).replace(/\r\n?/g,'\n').trim()];}));
   if(!item.hostIp&&!item.vip)continue;
   if(!item.hostIp||!item.vip){warnings.push(`${sheet.name}, row ${r}: missing host IP or VIP; row skipped.`);continue;}
   if(Object.values(item).some(v=>v.length>1000))throw invalid(`Row ${r} contains a cell longer than 1,000 characters. Split it into more rows.`);
   rows.push(item);if(rows.length>300)throw invalid('Import up to 300 load balancer rows at a time.');
  }
 }
 if(!rows.length)throw invalid('No load balancer rows found. Include Host IP Address, Host Port and LB / WAF VIP column headers.');
 return {rows,warnings};
}
export function mergeLoadBalancers(existing, incoming){
 if(!Array.isArray(incoming)||!incoming.length||incoming.length>300)throw invalid('Provide between 1 and 300 load balancer rows.');
 const signature=row=>JSON.stringify(lbKeys.map(k=>String(row[k]||'').replace(/\r\n?/g,'\n').trim()));
 const rows=[...existing],seen=new Set(existing.map(signature));let skipped=0;
 for(const input of incoming){
  if(!input||typeof input!=='object'||Array.isArray(input))throw invalid('Invalid load balancer row.');
  const item=Object.fromEntries(lbKeys.map(k=>[k,String(input[k]??'').replace(/\r\n?/g,'\n').trim()]));
  if(!item.hostIp||!item.vip||Object.values(item).some(v=>v.length>1000))throw invalid('Each row needs a host IP and VIP, with at most 1,000 characters per cell.');
  const key=signature(item);if(seen.has(key)){skipped++;continue;}seen.add(key);rows.push(item);
 }
 if(rows.length>300)throw invalid('This import would exceed 300 load balancer records for the service.');
 return {rows,added:rows.length-existing.length,skipped};
}
