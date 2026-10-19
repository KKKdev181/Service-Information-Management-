import {environmentName} from './service-facts.js';
import {serverLocation} from './server-rules.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=v=>esc(v||'—');
const columns=[['name','Server'],['site','Site'],['environment','Environment'],['privateIp','Private IP'],['role','Role'],['os','Operating system'],['cpu','CPU'],['ram','RAM'],['storage','Storage']];
const environments=['Production','Staging','QA','Dev','Dev/QA','DR'];
function review(n){return /^host\s*name$/i.test(n.name||'')||n.environment&&!environments.includes(environmentName(n.environment));}
const display=(n,key)=>key==='site'?serverLocation(n):key==='environment'?environmentName(n.environment):n[key]||'';
export function serverTable(rows,state={}){
 if(!rows.length)return '<div class="hub-empty">No servers match this view.</div>';
 const key=columns.some(([k])=>k===state.serverSort)?state.serverSort:'name',descending=state.serverDescending===true;
 const sorted=[...rows].sort((a,b)=>String(display(a,key)).localeCompare(String(display(b,key)),undefined,{numeric:true,sensitivity:'base'})*(descending?-1:1));
 const count=rows.filter(review).length;
 return `<div class="server-table-intro"><span>Expand a server for network details and notes. Resource values use the recorded units.</span>${count?`<span class="server-review">${count} record${count===1?'':'s'} need review</span>`:''}</div><div class="server-table-scroll" tabindex="0" role="region" aria-label="Server inventory"><table class="server-inventory"><caption class="server-visually-hidden">Server inventory. Select a column heading to sort.</caption><thead><tr><th scope="col"><span class="server-visually-hidden">Details</span></th>${columns.map(([k,label])=>`<th scope="col" aria-sort="${k===key?(descending?'descending':'ascending'):'none'}"><button data-action="server-sort" data-key="${k}">${label}<span aria-hidden="true">${k===key?(descending?'↓':'↑'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>${sorted.map((n,i)=>{
 const env=environmentName(n.environment),tone=({'Production':'prod','Staging':'stg','QA':'qa','Dev':'dev','Dev/QA':'dev','DR':'dr'})[env]||'unknown';
 const details=[['Public IP',n.publicIp],['Domain / FQDN',n.domain],['Zone',n.zone],['Platform',n.platform],['Recorded site',n.site],['Recorded environment',n.environment],['Notes',n.notes]];
 return `<tr class="server-main-row"><td><button class="server-expand" data-action="server-expand" aria-expanded="false" aria-controls="server-detail-${i}" aria-label="Show details for ${esc(n.name||'unnamed server')}">＋</button></td><th scope="row"><strong>${value(n.name)}</strong><small>${value(n.platform)}${review(n)?' · <span class="server-review">Review imported values</span>':''}</small></th><td><span class="server-site">${value(serverLocation(n))}</span></td><td><span class="server-environment ${tone}">${value(environments.includes(env)||env==='Not specified'?env:'Needs review')}</span></td><td class="server-address">${value(n.privateIp)}</td><td>${value(n.role)}</td><td>${value(n.os)}</td><td class="server-resource">${value(n.cpu)}</td><td class="server-resource">${value(n.ram)}</td><td class="server-resource">${value(n.storage)}</td></tr><tr class="server-detail-row" id="server-detail-${i}" hidden><td colspan="10"><dl>${details.map(([label,v])=>`<div><dt>${label}</dt><dd>${value(v)}</dd></div>`).join('')}</dl></td></tr>`;
 }).join('')}</tbody></table></div>`;
}
