(() => {
 const key='technology-service-hub-theme',media=matchMedia('(prefers-color-scheme: dark)');
 let preference='light';try{preference=localStorage.getItem(key)||'light';}catch{}
 if(!['light','dark','system'].includes(preference))preference='light';
 function apply(){document.documentElement.dataset.theme=preference==='system'?(media.matches?'dark':'light'):preference;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',document.documentElement.dataset.theme==='dark'?'#10151f':'#f4f6fa');window.dispatchEvent(new Event('themechange'));}
 apply();media.addEventListener('change',apply);
 document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-theme-picker]').forEach(host=>{const label=document.createElement('label');label.className='theme-picker';label.textContent='Appearance';const select=document.createElement('select');select.setAttribute('aria-label','Appearance');for(const value of ['light','dark','system']){const option=document.createElement('option');option.value=value;option.textContent=value[0].toUpperCase()+value.slice(1);select.append(option);}select.value=preference;select.onchange=()=>{preference=select.value;try{localStorage.setItem(key,preference);}catch{}apply();document.querySelectorAll('.theme-picker select').forEach(s=>s.value=preference);};label.append(select);host.append(label);});});
})();
