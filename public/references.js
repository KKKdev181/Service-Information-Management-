import {access,apiFetch} from './access.js';
const categories=['Public IP','Internal Network','Connectivity','Technical Reference'];
const fields=[
 ['category','Category'],['name','Reference name'],['value','IP / subnet / connection'],['relatedIp','Mapped / internal IP'],['service','Related service'],['environment','Environment'],['location','Hosting location'],['purpose','Purpose'],['details','Technical notes']
];
let items=[],filter='',term='',editing=null;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const matches=r=>(!filter||r.category===filter)&&Object.values(r).some(v=>String(v??'').toLowerCase().includes(term.toLowerCase()));
const api=async(url,options)=>{const r=await apiFetch(url,options);let body={};try{body=await r.json()}catch{}if(!r.ok)throw Error(body.error||'Request failed: '+r.status);return body};
function form(){
 const x=editing||{};
 return `<div class="ref-modal" role="dialog" aria-modal="true" aria-label="Edit reference"><div class="ref-modal-card"><div class="ref-heading"><h2>${x.id?'Edit reference':'Add reference'}</h2><button data-ref-action="close" type="button">✕</button></div><form id="ref-form"><div class="ref-fields">${fields.map(([key,label])=>`<label>${e(label)}${key==='name'?' *':''}${key==='category'?`<select name="category" required>${categories.map(v=>`<option value="${e(v)}" ${x.category===v?'selected':''}>${e(v)}</option>`).join('')}</select>`:key==='details'?`<textarea name="details" rows="3">${e(x[key])}</textarea>`:`<input name="${key}" value="${e(x[key])}" ${key==='name'?'required':''} />`}</label>`).join('')}</div><div class="ref-actions"><button class="btn primary" type="submit">Save reference</button><button class="btn" data-ref-action="close" type="button">Cancel</button></div></form></div></div>`;
}
function show(){
 const root=document.querySelector('#app');if(!root)return;
 const list=items.filter(matches);
 root.innerHTML=`<div class="content ref-page"><div class="page-head"><div><h1>Infrastructure Reference</h1><p>Shared IPs, networks, connectivity and technical knowledge for Technology Delivery.</p></div><button class="btn primary" data-ref-action="add">＋ Add reference</button></div><div class="ref-toolbar"><input id="ref-search" placeholder="Search IPs, services, networks or notes..." value="${e(term)}" aria-label="Search infrastructure references"/><select id="ref-category"><option value="">All categories</option>${categories.map(v=>`<option ${v===filter?'selected':''}>${e(v)}</option>`).join('')}</select><span>${list.length} records</span></div><div class="ref-grid">${list.map(x=>`<article class="ref-card"><div class="ref-card-head"><span>${e(x.category)}</span><div><button data-ref-action="edit" data-id="${e(x.id)}" type="button">Edit</button><button data-ref-action="delete" data-id="${e(x.id)}" type="button">Delete</button></div></div><h3>${e(x.name)}</h3><strong class="ref-ip">${e(x.value)||'No address specified'}</strong><dl>${[['Mapped IP',x.relatedIp],['Service',x.service],['Environment',x.environment],['Hosting',x.location],['Purpose',x.purpose],['Notes',x.details]].filter(a=>a[1]).map(([a,b])=>`<div><dt>${e(a)}</dt><dd>${e(b)}</dd></div>`).join('')}</dl><small>Updated by ${e(x.updatedBy||'Not specified')} · ${e(x.updatedAt?.slice(0,10)||'—')}</small></article>`).join('')||'<div class="ref-empty">No reference entries found. Add your first record.</div>'}</div></div>${editing!==null?form():''}`;
}
export async function referencePage(){
 try{items=await api('/api/references');if(location.hash.startsWith('#/references'))show();}
 catch(err){document.querySelector('#app').innerHTML=`<div class="content"><h1>Infrastructure Reference</h1><p>${e(err.message)}</p><button class="btn" data-ref-action="reload">Retry</button></div>`;}
}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-ref-action]');if(!b)return;
 const action=b.dataset.refAction;if(!access.canEdit&&['add','edit','delete'].includes(action))return;
 if(action==='reload')return referencePage();
 if(action==='add'){editing={category:categories[0]};return show();}
 if(action==='close'){editing=null;return show();}
 if(action==='edit'){editing=items.find(x=>x.id===b.dataset.id)||null;return show();}
 if(action==='delete'){if(!confirm('Delete this infrastructure reference?'))return;try{await api('/api/references/'+encodeURIComponent(b.dataset.id),{method:'DELETE'});await referencePage();}catch(err){alert(err.message)}}
});
document.addEventListener('input',ev=>{if(ev.target.id==='ref-search'){term=ev.target.value;const p=ev.target.selectionStart;show();const input=document.querySelector('#ref-search');input.focus();input.setSelectionRange(p,p)}});
document.addEventListener('change',ev=>{if(ev.target.id==='ref-category'){filter=ev.target.value;show()}});
document.addEventListener('submit',async ev=>{
 if(ev.target.id!=='ref-form')return;ev.preventDefault();
 const form=ev.target,button=form.querySelector('[type=submit]');button.disabled=true;
 const value=Object.fromEntries(new FormData(form));
 const id=editing?.id;
 try{await api(id?'/api/references/'+encodeURIComponent(id):'/api/references',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});editing=null;await referencePage();}
 catch(err){alert(err.message);button.disabled=false}
});
