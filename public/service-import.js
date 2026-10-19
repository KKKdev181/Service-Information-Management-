import {access,apiFetch} from './access.js';
import {lbTable} from './lb-table.js';
export function initServiceImport(getService,onSaved){
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action="import-service"]');if(!button||!access.canEdit)return;
  const service=getService(button.dataset.id);if(!service)return;
  const dialog=document.createElement('dialog');dialog.className='service-import-dialog';
  dialog.innerHTML=`<div class="modal-head"><div><h2>Import load balancer sheet</h2><p class="import-target"></p></div><button class="btn import-close" aria-label="Close import">×</button></div><div class="service-import-body"><p>Upload an Excel (.xlsx) file. Preview the rows, then add them to this service. Existing records are kept and exact duplicates are skipped.</p><label class="btn">Choose Excel file <input type="file" accept=".xlsx" class="lb-file"></label><p class="import-status" role="status" aria-live="polite"></p><div class="import-preview"></div></div><div class="modal-footer"><button class="btn import-close">Cancel</button><button class="btn primary import-commit" disabled>Import into service</button></div>`;
  dialog.querySelector('.import-target').textContent=service.service.name;
  document.body.append(dialog);dialog.showModal();let rows=[],busy=false;
  const status=dialog.querySelector('.import-status'),commit=dialog.querySelector('.import-commit'),fileInput=dialog.querySelector('.lb-file');
  const close=()=>{if(busy)return;dialog.close();dialog.remove();button.focus();};
  dialog.querySelectorAll('.import-close').forEach(b=>b.onclick=close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  fileInput.onchange=async()=>{
   const file=fileInput.files[0];rows=[];commit.disabled=true;dialog.querySelector('.import-preview').replaceChildren();if(!file)return;
   if(file.size>12*1024*1024){status.textContent='Choose a file smaller than 12 MB.';return;}
   busy=true;fileInput.disabled=true;status.textContent='Reading Excel and preparing preview…';
   try{
    const response=await apiFetch(`/api/services/${encodeURIComponent(service.service.id)}/import/lb/preview`,{method:'POST',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:file});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Could not read the file.');
    rows=result.rows;dialog.querySelector('.import-preview').innerHTML=lbTable(rows);
    status.textContent=`${rows.length} rows ready to import. ${result.warnings.join(' ')}`;commit.disabled=false;
   }catch(error){status.textContent=error.message;}finally{busy=false;fileInput.disabled=false;}
  };
  commit.onclick=async()=>{
   if(busy||!rows.length)return;busy=true;commit.disabled=true;fileInput.disabled=true;status.textContent='Saving load balancer records…';
   try{
    const response=await apiFetch(`/api/services/${encodeURIComponent(service.service.id)}/import/lb/commit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows,revision:service.service.revision})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Import failed.');
    busy=false;close();await onSaved(result);
   }catch(error){status.textContent=error.message;busy=false;commit.disabled=false;fileInput.disabled=false;}
  };
 });
}
