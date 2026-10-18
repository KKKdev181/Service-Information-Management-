import readline from 'node:readline';
import {Writable} from 'node:stream';
import {saveUser} from '../server/access.js';
let hidden=false;
const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
const rl=readline.createInterface({input:process.stdin,output,terminal:true});
const ask=question=>new Promise(resolve=>rl.question(question,resolve));
try{
 const username=await ask('Admin username: '),name=await ask('Display name: ');
 process.stdout.write('Password (12+ characters; hidden): ');hidden=true;const password=await ask('');hidden=false;process.stdout.write('\n');
 process.stdout.write('Confirm password: ');hidden=true;const confirm=await ask('');hidden=false;process.stdout.write('\n');
 if(password!==confirm)throw Error('Passwords do not match');
 await saveUser(null,{username,name,password,role:'admin'},{bootstrap:true});
 console.log('Admin created. Open the portal and select Sign in.');
}catch(e){hidden=false;console.error(e.message);process.exitCode=1;}finally{rl.close();}
