import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const folder=path.resolve(process.env.DATA_DIR||'./data','history');
let queue=Promise.resolve();
const ignored=new Set(['updatedAt','revision','updatedBy']);
export function changes(before,after,prefix=''){
 const result=[];
 function walk(a,b,p){
 if(JSON.stringify(a)===JSON.stringify(b))return;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
 if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(v=>v&&typeof v==='object'&&v.id)){
 const left=Object.fromEntries(a.map(v=>[v.id,v])),right=Object.fromEntries(b.map(v=>[v.id,v]));walk(left,right,p);return;
 }
 for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(!ignored.has(k))walk(a[k],b[k],p?p+'.'+k:k);
 }else result.push({field:p||'record',before:a??null,after:b??null});
 }
 walk(before,after,prefix);return result;
}
async function write(event){await fs.mkdir(folder,{recursive:true});const file=path.join(folder,event.id+'.json'),temp=file+'.tmp';try{await fs.writeFile(temp,JSON.stringify(event),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
// A durable pending entry is written before the mutation. Interrupted writes are
// shown as unconfirmed, never silently presented as completed or discarded.
export function audited(actor,meta,before,mutate,after){
 const run=queue.then(async()=>{
 const previous=await before();
 const event={id:Date.now()+'-'+crypto.randomUUID(),at:new Date().toISOString(),actor:{id:actor.id,name:actor.name,username:actor.username},...meta,status:'pending',changes:[]};
 event.label||=previous?.service?.name||previous?.name||meta.kind;
 await write(event);
 let value;
 try{value=await mutate();}catch(error){event.status=error.status>=400&&error.status<500?'rejected':'unconfirmed';await write(event);throw error;}
 try{const current=await after(value);event.changes=changes(previous,current);event.status='completed';event.entityId||=value?.service?.id||value?.id||'';event.label||=value?.service?.name||value?.name||meta.kind;await write(event);}
 catch(error){console.error('History finalization failed:',error);throw Object.assign(new Error('The change may have been saved, but its history could not be finalized. Refresh before retrying.'),{status:503});}
 return value;
 });queue=run.catch(()=>{});return run;
}
export async function readHistory({offset=0,query='',kind='',entityId='',includeUsers=false}={}){
 await fs.mkdir(folder,{recursive:true});const files=(await fs.readdir(folder)).filter(n=>/^\d+-[a-f0-9-]+\.json$/.test(n)).sort().reverse();
 const rows=[];let total=0;
 for(const name of files){const event=JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));if(event.kind==='users'&&!includeUsers)continue;if(kind&&event.kind!==kind||entityId&&event.entityId!==entityId)continue;
 if(query&&!JSON.stringify([event.label,event.actor,event.action]).toLowerCase().includes(query.toLowerCase()))continue;
 if(total>=offset&&rows.length<50)rows.push(event);total++;
 }
 return {items:rows,total,offset,limit:50};
}
