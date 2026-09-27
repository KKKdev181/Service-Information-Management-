import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

export async function readLegacyBuffer(buffer, filename) {
  const wanted=new Set(['Summary','Server Details','APP Comm Matrix','Standard Comm Matrix','NATTING']);
  const sheets=new Map();
  const reader=new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([buffer]),{sharedStrings:'cache',styles:'ignore',worksheets:'emit',hyperlinks:'ignore'});
  for await (const sheet of reader) {
    if(!wanted.has(sheet.name)) { for await (const ignored of sheet) {} continue; }
    const rows=new Map();
    for await(const row of sheet){
      const cells=new Map();
      row.eachCell({includeEmpty:false},(cell,col)=>cells.set(col,String(cell.text ?? '')));
      rows.set(row.number,cells);
    }
    sheets.set(sheet.name,{rowCount:Math.max(0,...rows.keys()),getRow:r=>({getCell:c=>({text:rows.get(r)?.get(c)||''})})});
  }
  return parseImplementationSheet({getWorksheet:name=>sheets.get(name)},filename);
}

const text = (sheet, row, col) => {
  const v = sheet?.getRow(row).getCell(col).text ?? '';
  return String(v).trim().replace(/\s+/g, ' ');
};
const placeholder = value => !value || /^(TBD|N\/A|NA|XXXXX|XXX|0|Filled by TPM|Filled By DCO NW)$/i.test(value);
const val = (sheet, row, col) => { const v=text(sheet,row,col); return placeholder(v)?'':v; };
const pair = (...parts) => parts.filter(Boolean).join(' · ');
const rowWith = (sheet, label, col=5, max=100) => {
  for (let r=1;r<=Math.min(sheet.rowCount,max);r++) if(text(sheet,r,col).toLowerCase()===label.toLowerCase()) return r;
  return 0;
};
const has = (sheet, row, col, fragment) => text(sheet,row,col).toLowerCase().includes(fragment.toLowerCase());
const addUnique = (arr, item, key) => { if (!arr.some(a=>key(a)===key(item))) arr.push(item); };

export async function parseImplementationSheet(book, filename='') {
  const detail=book.getWorksheet('Server Details');
  if(!detail || !book.getWorksheet('Summary') || !rowWith(detail,'Host Name',3)) return null;
  const projectRow=rowWith(detail,'Project Name',4);
  const name=val(detail,projectRow,5) || val(book.getWorksheet('Summary'),1,3);
  if(!name) throw Object.assign(new Error('تعذر تحديد اسم الخدمة من القالب. اكتب اسمها في خانة Project Name.'),{status:400});
  const service={name,code:'',customer:'',owner:'',status:'Active',environment:'Multiple',description:`مستورد من Implementation Sheet: ${filename}`};
  const record={service,Servers:[],Endpoints:[],LoadBalancers:[],Connections:[],Networks:[]};
  for(let h=1;h<=Math.min(detail.rowCount,50);h++){
    if(text(detail,h,5)!=='Subnet Name')continue;
    const first=has(detail,h,6,'Required Ips');
    for(let r=h+1;r<=Math.min(h+15,detail.rowCount);r++){
      const network=val(detail,r,5);
      if(!network)break;
      if(first)record.Networks.push({name:network,ipam:val(detail,r,8),range:val(detail,r,9),vlan:val(detail,r,12),subnet:val(detail,r,13),gateway:val(detail,r,14),context:val(detail,r,7),notes:pair(val(detail,r,6)&&`Required IPs: ${val(detail,r,6)}`,val(detail,r,11)&&`VLAN Name: ${val(detail,r,11)}`)});
      else record.Networks.push({name:network,ipam:val(detail,r,6),range:val(detail,r,7),vlan:val(detail,r,8),subnet:val(detail,r,9),gateway:val(detail,r,10),context:'',notes:''});
    }
  }
  const header=rowWith(detail,'Host Name',3);
  for(let r=header+1;r<=Math.min(detail.rowCount,header+300);r++){
    const host=val(detail,r,3);
    if(!host || /^Host Name$/i.test(host)) continue;
    if(r>header+2 && (/^(Current Setup|Assumptions|Physical Server)/i.test(text(detail,r,2)) || text(detail,r,2)==='Current Setup')) break;
    if(!val(detail,r,4) && !val(detail,r,8) && !val(detail,r,9) && !val(detail,r,14)) continue;
    addUnique(record.Servers,{name:host,privateIp:val(detail,r,4),publicIp:'',environment:val(detail,r,9),role:val(detail,r,11)||val(detail,r,12)||val(detail,r,8),os:val(detail,r,5),site:val(detail,r,6),domain:val(detail,r,7),cpu:val(detail,r,14),ram:val(detail,r,15),storage:pair(val(detail,r,16),val(detail,r,17),val(detail,r,18)),notes:pair(val(detail,r,10),val(detail,r,13))},x=>x.name.toLowerCase());
  }
  const urlHeader=rowWith(detail,'URL',6,12);
  for(let r=urlHeader+1;urlHeader && r<=Math.min(urlHeader+3,detail.rowCount);r++){
    const env=val(detail,r,5),url=val(detail,r,6),publicIp=val(detail,r,8),waf=val(detail,r,9),vip=val(detail,r,10),port=val(detail,r,11);
    if(!/^(Production|Staging|Dev|QA)$/i.test(env) || ![url,publicIp,waf,vip,port].some(Boolean)) continue;
    record.Endpoints.push({url,dns:url,vip,port,protocol:url.startsWith('https')?'HTTPS':'',environment:env,notes:pair(publicIp&&`Public IP: ${publicIp}`,waf&&`WAF IP: ${waf}`)});
  }
  const lbHeader=rowWith(detail,'Host Name',5,100);
  for(let r=lbHeader+1;lbHeader && r<=Math.min(lbHeader+30,detail.rowCount);r++){
    if(has(detail,r,5,'Cluster IP')) break;
    const host=val(detail,r,5),vip=val(detail,r,10);
    if(!host || !vip) continue;
    addUnique(record.LoadBalancers,{name:host,vip,pool:val(detail,r,13),members:val(detail,r,6),port:val(detail,r,12),waf:'',notes:pair(val(detail,r,7)&&`Host Port: ${val(detail,r,7)}`,val(detail,r,8)&&`Host Protocol: ${val(detail,r,8)}`,val(detail,r,9)&&`Type: ${val(detail,r,9)}`,val(detail,r,11)&&`VIP Protocol: ${val(detail,r,11)}`,val(detail,r,14)&&`Certificate/Content Switching: ${val(detail,r,14)}`)},x=>`${x.name}|${x.vip}`);
  }
  for(const sheetName of ['APP Comm Matrix','Standard Comm Matrix']){
    const sheet=book.getWorksheet(sheetName);if(!sheet)continue;
    for(let r=13;r<=Math.min(sheet.rowCount,1000);r++){
      const source=pair(val(sheet,r,3),val(sheet,r,4));
      const destination=pair(val(sheet,r,5),val(sheet,r,6));
      const port=val(sheet,r,8),protocol=val(sheet,r,7);
      if(!source && !destination) continue;
      record.Connections.push({type:'Firewall',source,destination,port:pair(protocol,port),reference:sheetName,notes:pair(val(sheet,r,9),val(sheet,r,10))});
    }
  }
  const nat=book.getWorksheet('NATTING');
  if(nat){for(const [from,to,direction] of [[6,9,'Provider'],[13,16,'Consumer']]){
    for(let r=from;r<=to;r++){
      const env=val(nat,r,2),source=val(nat,r,3),snat=val(nat,r,4),port=val(nat,r,5),dnat=val(nat,r,6),lb=val(nat,r,7),lbPorts=val(nat,r,8),destination=val(nat,r,9);
      if(![source,snat,port,dnat,lb,lbPorts,destination].some(Boolean))continue;
      record.Connections.push({type:'NAT',source:pair(source,snat&&`SNAT ${snat}`),destination:pair(destination,dnat&&`DNAT ${dnat}`),port:pair(port,lbPorts&&`LB ${lbPorts}`),reference:pair('NATTING',env,direction),notes:lb&&`LB: ${lb}`});
    }
  }}
  return record;
}
