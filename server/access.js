import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(crypto.scrypt);
const folder=path.resolve(process.env.DATA_DIR||'./data');
const file=path.join(folder,'users.json');
const sessions=new Map(), attempts=new Map();
let queue=Promise.resolve();
const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const publicUser=u=>u?{id:u.id,username:u.username,name:u.name,role:u.role,enabled:u.enabled,createdAt:u.createdAt}:null;
async function users(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function persist(data){await fs.mkdir(folder,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
async function hash(password){if(typeof password!=='string'||password.length<12||password.length>200)throw fail('Use a password of 12–200 characters');const salt=crypto.randomBytes(16).toString('hex');return {salt,hash:(await scrypt(password,salt,64)).toString('hex')};}
export const listUsers=async()=>(await users()).map(publicUser);
export const saveUser=(id,input,{bootstrap=false}={})=>serial(async()=>{
 const all=await users();if(bootstrap&&all.length)throw fail('An account already exists. Use Users in the portal to manage accounts.');
 const old=all.find(u=>u.id===id);if(id&&!old)throw fail('User not found',404);
 const username=String(input.username??old?.username??'').trim().toLowerCase();
 const name=String(input.name??old?.name??'').trim();const role=bootstrap?'admin':input.role??old?.role;
 if(!/^[a-z0-9][a-z0-9._@-]{2,99}$/.test(username))throw fail('Username must be 3–100 letters, numbers, dots, @, hyphens or underscores');
 if(!name||name.length>100)throw fail('Name is required (up to 100 characters)');
 if(!['admin','viewer'].includes(role))throw fail('Choose Admin or Viewer');
 if(all.some(u=>u.id!==id&&u.username===username))throw fail('Username is already in use',409);
 const enabled=input.enabled===undefined?(old?.enabled??true):input.enabled;
 if(typeof enabled!=='boolean')throw fail('Invalid account status');
 if(old?.role==='admin'&&old.enabled&&(role!=='admin'||!enabled)&&!all.some(u=>u.id!==id&&u.role==='admin'&&u.enabled))throw fail('Keep at least one enabled admin');
 const credentials=input.password?await hash(input.password):old?.credentials;
 if(!credentials)throw fail('Password is required');
 const user={id:id||crypto.randomUUID(),username,name,role,enabled,credentials,createdAt:old?.createdAt||new Date().toISOString(),version:(old?.version||0)+1};
 await persist([...all.filter(u=>u.id!==id),user]);
 for(const [token,session] of sessions)if(session.id===id)sessions.delete(token);
 return publicUser(user);
});
function token(req){return /(?:^|;\s*)tda_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];}
function cookie(req,value,maxAge){const secure=process.env.COOKIE_SECURE==='true'||req.secure;return `tda_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export async function identify(req,res,next){try{
 res.setHeader('Cache-Control','no-store');
 const session=sessions.get(token(req));req.user=null;
 if(session&&session.expires>Date.now()){const user=(await users()).find(u=>u.id===session.id&&u.enabled&&u.version===session.version);if(user)req.user=publicUser(user);}
 else if(session)sessions.delete(token(req));
 next();}catch(e){next(e);}}
export function adminOnly(req,res,next){if(req.user?.role!=='admin')return res.status(req.user?403:401).json({error:'Sign in with an admin account to make changes'});next();}
export function mutationGuard(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 // Custom header requires a CORS preflight cross-origin; this app never grants CORS.
 if(req.get('X-Portal-Request')!=='1')return res.status(403).json({error:'Invalid request. Reload the portal and try again.'});
 return adminOnly(req,res,next);
}
export async function login(req,res){
 if(req.get('X-Portal-Request')!=='1')throw fail('Invalid request',403);
 const username=String(req.body?.username||'').trim().toLowerCase();const password=req.body?.password;
 if(typeof password!=='string'||password.length>200||username.length>100)throw fail('Invalid username or password',401);
 const now=Date.now();for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);
 const keys=['ip:'+req.ip,'user:'+username];
 if(keys.some(k=>(attempts.get(k)?.count||0)>=10))throw fail('Too many attempts. Try again in 15 minutes.',429);
 if(attempts.size>5000)throw fail('Sign-in is busy. Try again later.',429);
 for(const k of keys){const a=attempts.get(k)||{count:0,until:now+15*60e3};a.count++;attempts.set(k,a);}
 const user=(await users()).find(u=>u.username===username);
 const result=await scrypt(password,user?.credentials.salt||'invalid-user',64);
 const expected=user?Buffer.from(user.credentials.hash,'hex'):Buffer.alloc(64);
 if(!user?.enabled||!crypto.timingSafeEqual(result,expected))throw fail('Invalid username or password',401);
 for(const k of keys)attempts.delete(k);
 for(const [k,s] of sessions)if(s.expires<=now)sessions.delete(k);
 sessions.delete(token(req));const value=crypto.randomBytes(32).toString('hex');
 sessions.set(value,{id:user.id,version:user.version,expires:now+8*60*60e3});
 res.setHeader('Set-Cookie',cookie(req,value,8*60*60));res.json({user:publicUser(user)});
}
export function logout(req,res){if(req.get('X-Portal-Request')!=='1')return res.status(403).json({error:'Invalid request'});sessions.delete(token(req));res.setHeader('Set-Cookie',cookie(req,'',0));res.status(204).end();}
