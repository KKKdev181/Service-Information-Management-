const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function lbTable(rows){
 const columns=[['name','Host Name'],['hostIp','Host IP Address'],['hostPort','Host Port'],['hostProtocol','Host Protocol'],['vip','LB / WAF VIP'],['vipProtocol','LB VIP Protocol'],['port','VIP Port'],['dns','DNS URL'],['notes','Note']];
 return `<div class="lb-table-scroll" tabindex="0" role="region" aria-label="Load balancer configuration"><table class="lb-sheet"><caption>Load Balancer Configuration</caption><thead><tr>${columns.map(([,label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${esc(row[key]||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
