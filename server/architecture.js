import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const directory=path.resolve(process.env.DATA_DIR||'./data','architecture');
let queue=Promise.resolve();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function location(id){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw fail('Invalid service ID');return path.join(directory,id+'.json');}
export async function readArchitecture(id){try{return JSON.parse(await fs.readFile(location(id),'utf8'));}catch(e){if(e.code==='ENOENT')return {revision:0,nodes:[],edges:[]};throw e;}}
export function validateGraph(input){
 if(!input||!Array.isArray(input.nodes)||!Array.isArray(input.edges)||input.nodes.length>500||input.edges.length>2000)throw fail('Invalid diagram size or format');
 const ids=new Set();
 const str=x=>String(x??'').slice(0,1000);
 const nodes=input.nodes.map(n=>{if(!n||typeof n.id!=='string'||ids.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw fail('Invalid component');ids.add(n.id);return {id:str(n.id),label:str(n.label),type:str(n.type),ip:str(n.ip),environment:str(n.environment),notes:str(n.notes),zone:str(n.zone),architectureRole:str(n.architectureRole),width:Math.max(224,Math.min(700,Number(n.width)||224)),height:Math.max(116,Math.min(500,Number(n.height)||116)),x:Math.max(0,Math.min(10000,n.x)),y:Math.max(0,Math.min(10000,n.y))};});
 const edgeIds=new Set();
 const edges=input.edges.map(e=>{if(!e||typeof e.id!=='string'||edgeIds.has(e.id)||!ids.has(e.source)||!ids.has(e.target)||e.source===e.target)throw fail('Invalid connection');edgeIds.add(e.id);return {id:str(e.id),source:e.source,target:e.target,type:str(e.type),protocol:str(e.protocol),port:str(e.port),notes:str(e.notes),...(e.route&&typeof e.route.signature==='string'&&Array.isArray(e.route.points)&&e.route.points.length>=2&&e.route.points.length<=100&&e.route.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=100000&&Math.abs(p.y)<=100000)?{route:{signature:e.route.signature.slice(0,5000),points:e.route.points.map(p=>({x:p.x,y:p.y}))}}:{})};});
 const positions=[];const positionIds=new Set();
 if(input.positions!==undefined){
 if(!Array.isArray(input.positions)||input.positions.length>1000)throw fail('Invalid diagram positions');
 for(const p of input.positions){
 if(!p||typeof p.id!=='string'||p.id.length>1000||positionIds.has(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw fail('Invalid diagram position');
 positionIds.add(p.id);positions.push({id:p.id,x:Math.max(0,Math.min(10000,p.x)),y:Math.max(0,Math.min(10000,p.y))});
 }
 }
 const arrows=[];const arrowIds=new Set();
 if(input.arrows!==undefined){
 if(!Array.isArray(input.arrows)||input.arrows.length>1000)throw fail('Invalid arrow list');
 for(const a of input.arrows){if(!a||typeof a.id!=='string'||a.id.length>1000||arrowIds.has(a.id)||!['x1','y1','x2','y2'].every(k=>Number.isFinite(a[k])&&a[k]>=0&&a[k]<=10000))throw fail('Invalid arrow');arrowIds.add(a.id);arrows.push({id:a.id,x1:a.x1,y1:a.y1,x2:a.x2,y2:a.y2});}
 }
 return {nodes,edges,positions,arrows,inventorySignature:typeof input.inventorySignature==='string'?input.inventorySignature.slice(0,1000):''};
}
export function saveArchitecture(id,input){const result=queue.then(async()=>{const file=location(id),graph=validateGraph(input),old=await readArchitecture(id);if(input.revision!==old.revision)throw fail('This diagram was updated in another session. Reload the page before saving.',409);await fs.mkdir(directory,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';const saved={...graph,revision:old.revision+1,updatedAt:new Date().toISOString()};try{await fs.writeFile(temp,JSON.stringify(saved,null,2));if(old.revision)await fs.copyFile(file,file+'.backup');await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return saved;});queue=result.catch(()=>{});return result;}
