import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const directory=path.resolve(process.env.DATA_DIR||'./data','architecture');
let queue=Promise.resolve();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function location(id){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw fail('معرف الخدمة غير صحيح');return path.join(directory,id+'.json');}
export async function readArchitecture(id){try{return JSON.parse(await fs.readFile(location(id),'utf8'));}catch(e){if(e.code==='ENOENT')return {revision:0,nodes:[],edges:[]};throw e;}}
export function validateGraph(input){
 if(!input||!Array.isArray(input.nodes)||!Array.isArray(input.edges)||input.nodes.length>500||input.edges.length>2000)throw fail('حجم أو صيغة الرسم غير صحيحة');
 const ids=new Set();
 const str=x=>String(x??'').slice(0,1000);
 const nodes=input.nodes.map(n=>{if(!n||typeof n.id!=='string'||ids.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw fail('عنصر غير صحيح');ids.add(n.id);return {id:str(n.id),label:str(n.label),type:str(n.type),ip:str(n.ip),environment:str(n.environment),notes:str(n.notes),x:Math.max(0,Math.min(10000,n.x)),y:Math.max(0,Math.min(10000,n.y))};});
 const edgeIds=new Set();
 const edges=input.edges.map(e=>{if(!e||typeof e.id!=='string'||edgeIds.has(e.id)||!ids.has(e.source)||!ids.has(e.target)||e.source===e.target)throw fail('اتصال غير صحيح');edgeIds.add(e.id);return {id:str(e.id),source:e.source,target:e.target,type:str(e.type),protocol:str(e.protocol),port:str(e.port),notes:str(e.notes)};});
 return {nodes,edges};
}
export function saveArchitecture(id,input){const result=queue.then(async()=>{const file=location(id),graph=validateGraph(input),old=await readArchitecture(id);if(input.revision!==old.revision)throw fail('الرسم تغير في جلسة أخرى. افتح الصفحة مجددًا قبل الحفظ.',409);await fs.mkdir(directory,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';const saved={...graph,revision:old.revision+1,updatedAt:new Date().toISOString()};try{await fs.writeFile(temp,JSON.stringify(saved,null,2));if(old.revision)await fs.copyFile(file,file+'.backup');await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return saved;});queue=result.catch(()=>{});return result;}
