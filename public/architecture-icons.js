// Self-contained SVG illustrations: also included in exported diagrams.
const rack = `<path d="M13 8 45 3l9 7v40l-9 6-32-5Z" fill="#26364d"/><path d="m45 3 9 7v40l-9 6Z" fill="#152136"/><rect x="11" y="8" width="35" height="44" rx="4" fill="#566b86" stroke="#a6bed8"/>${[13,25,37].map(y=>`<rect x="15" y="${y}" width="27" height="9" rx="2" fill="#182738"/><path d="M19 ${y+4}h12" stroke="#93abc4"/><circle cx="37" cy="${y+4}" r="1.5" fill="#67e2bb"/>`).join('')}`;
const appliance = `<path d="m4 25 12-9h36l9 9v20H4Z" fill="#314b65" stroke="#90bcd9"/><path d="M4 25h57v20H4Z" fill="#1c3147"/><path d="m4 25 12-9h36l9 9Z" fill="#587a98"/>${[10,20,30,40].map(x=>`<rect x="${x}" y="31" width="7" height="7" rx="1" fill="#0d1d2b" stroke="#93bdd1"/>`).join('')}<circle cx="54" cy="35" r="2" fill="#6ae4bb"/>`;
const cloud = `<path d="M16 46C1 46 0 27 13 25 12 9 36 3 44 21c18-3 24 25 5 25Z" fill="#456b8d" stroke="#a2d5f5" stroke-width="2"/><path d="M14 27c2-12 17-16 25-7" stroke="#c9eaff" opacity=".5" fill="none"/>`;
const screen = `<rect x="3" y="7" width="58" height="40" rx="4" fill="#526987" stroke="#b8cce3"/><rect x="7" y="12" width="50" height="30" rx="2" fill="#14253b"/><path d="M32 47v7M21 55h22" stroke="#a2b7cf" stroke-width="3"/>`;
const shield = `<path d="m32 5 23 8v16c0 13-12 22-23 28C21 51 9 42 9 29V13Z" fill="#31766f" stroke="#93e5cf" stroke-width="2"/><path d="m21 29 8 8 15-18" fill="none" stroke="#dcfff4" stroke-width="4"/>`;
const database = `<path d="M10 13v36c0 12 44 12 44 0V13" fill="#28695e" stroke="#89dcca" stroke-width="1.5"/><ellipse cx="32" cy="13" rx="22" ry="9" fill="#75cdb6" stroke="#c0f5e6"/><path d="M10 25c0 12 44 12 44 0M10 37c0 12 44 12 44 0" fill="none" stroke="#89dcca" stroke-width="2"/><path d="M17 22v24" stroke="#b4f6df" opacity=".3" stroke-width="3"/>`;
const cubes = `${[[7,18],[28,18],[18,37]].map(([x,y])=>`<path d="m${x} ${y} 10-6 10 6-10 6Z" fill="#b8a5f0"/><path d="m${x} ${y} 10 6v13l-10-6Z" fill="#7b61bb"/><path d="m${x+10} ${y+6} 10-6v13l-10 6Z" fill="#4b3a81" stroke="#b4a0eb" stroke-width=".6"/>`).join('')}`;
const globe = `<circle cx="32" cy="29" r="23" fill="#24577d" stroke="#9bd5ef" stroke-width="2"/><ellipse cx="32" cy="29" rx="10" ry="23" fill="none" stroke="#80bddb"/><path d="M9 29h46M14 16h36M14 42h36" stroke="#80bddb"/>`;
const icons = {
 Server:rack,
 VM:`${screen}<rect x="12" y="17" width="24" height="18" rx="2" fill="#7863b5" stroke="#c9b9ff"/><rect x="29" y="23" width="22" height="17" rx="2" fill="#3b305e" stroke="#cab8ff"/><path d="m34 29 3 5 3-5m3 5v-5l3 3 3-3v5" fill="none" stroke="#ede6ff" stroke-width="1.2"/>`,
 'Load Balancer':`${appliance}<path d="M32 3v8M13 17v-6h38v6M32 11v6" fill="none" stroke="#77e4e6" stroke-width="2.5"/><path d="m10 14 3 4 3-4m13 0 3 4 3-4m16-4v8m-3-4 3 4 3-4" fill="none" stroke="#77e4e6" stroke-width="2"/>`,
 Database:database,
 Firewall:`<path d="m5 15 8-6h46v42l-8 6H5Z" fill="#703f36"/><rect x="5" y="15" width="47" height="40" rx="2" fill="#b9634b" stroke="#f3b394"/><path d="M5 28h47M5 41h47M20 15v13M38 15v13M12 28v13M30 28v13M46 28v13M20 41v14M38 41v14" fill="none" stroke="#ffd1ad" stroke-width="2"/>`,
 WAF:`<rect x="2" y="7" width="42" height="33" rx="3" fill="#2e4259" stroke="#9aaec6"/><path d="M2 16h42" stroke="#9aaec6"/><g transform="translate(20,11) scale(.7)">${shield}</g>`,
 Storage:`<path d="m6 13 9-7h40l4 7v41H6Z" fill="#34586a"/><rect x="6" y="13" width="48" height="41" rx="4" fill="#466e7e" stroke="#a2d9df"/>${[18,29,40].map(y=>`<rect x="11" y="${y}" width="37" height="8" rx="2" fill="#172e3c"/><circle cx="42" cy="${y+4}" r="1.5" fill="#6ce1bc"/><path d="M16 ${y+4}h17" stroke="#a0c9d2"/>`).join('')}`,
 API:`${screen}<path d="m22 20-8 7 8 7m20-14 8 7-8 7m-7-18-6 22" stroke="#e7bf7f" stroke-width="3" fill="none"/>`,
 DNS:`${globe}<rect x="15" y="37" width="43" height="18" rx="4" fill="#18334e" stroke="#aad6f2"/><text x="36" y="50" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#e0f4ff" stroke="none">DNS</text>`,
 URL:`<rect x="3" y="6" width="58" height="45" rx="4" fill="#324861" stroke="#b4cee2"/><rect x="7" y="18" width="50" height="29" fill="#172b40"/><path d="M9 12h2m4 0h2m4 0h30" stroke="#abcadd" stroke-width="2"/><g transform="translate(14,12) scale(.55)">${globe}</g>`,
 OpenShift:`${cubes}<path d="M18 14a20 20 0 0 1 30 14M46 46a20 20 0 0 1-30-12" fill="none" stroke="#ef6e72" stroke-width="6"/><path d="m44 15 5 14 7-11M9 44l6-12 7 10" fill="none" stroke="#ffa6a8" stroke-width="2"/>`,
 Kubernetes:cubes,Container:cubes,Docker:cubes,
 External:cloud,Cloud:cloud,Internet:globe,
 'External System':`${screen}<path d="M19 27h24m-6-6 6 6-6 6" stroke="#c6c7fa" stroke-width="3" fill="none"/>`,
 Router:`${appliance}<path d="M17 9h29m-5-4 5 4-5 4M46 52H17m5-4-5 4 5 4" fill="none" stroke="#89d7ef" stroke-width="2"/>`,
 Switch:appliance,
 VPN:`${cloud}<rect x="24" y="30" width="21" height="21" rx="3" fill="#dcb573" stroke="#ffe0a1"/><path d="M28 30v-6a7 7 0 0 1 14 0v6" fill="none" stroke="#ffe0a1" stroke-width="3"/><circle cx="34" cy="39" r="2.5" fill="#534329"/><path d="M34 39v6" stroke="#534329" stroke-width="2"/>`,
 NAT:`${appliance}<path d="M12 7h34m-5-4 5 4-5 4M51 53H17m5-4-5 4 5 4" stroke="#f1c782" fill="none" stroke-width="2.5"/>`,
 Monitoring:`${screen}<path d="M10 29h9l5-10 9 17 6-12 5 5h10" fill="none" stroke="#74e2b5" stroke-width="2.5"/>`,
 User:`<circle cx="32" cy="17" r="11" fill="#c9b5df" stroke="#e8daff"/><path d="M11 55V43c0-21 42-21 42 0v12Z" fill="#6d6095" stroke="#cdbde8"/>`,
 'Message Queue':`${[9,25,41].map(y=>`<rect x="6" y="${y}" width="42" height="12" rx="3" fill="#6e5734" stroke="#e5be80"/><path d="M12 ${y+6}h18" stroke="#f3d7a7"/>`).join('')}<path d="M53 13v37m-5-6 5 6 5-6" fill="none" stroke="#e5be80" stroke-width="2"/>`,
 Backup:`${database}<path d="M47 31a12 12 0 1 1-11 8m0-8v8h8" fill="none" stroke="#d4e6ff" stroke-width="3"/>`,
 'DR Site':`<g transform="translate(-2,4) scale(.75)">${rack}</g><g transform="translate(27,16) scale(.6)">${rack}</g>`
};
// Strong silhouettes remain recognizable when a large diagram is zoomed out.
icons['Load Balancer'] = `<circle cx="32" cy="30" r="24" fill="#123e4b" stroke="#55dfdf" stroke-width="2"/><path d="M32 12v12M32 24 17 39m15-15 15 15M32 24v23M12 34l5 5 5-5m20 0 5 5 5-5m-25 8 5 5 5-5" fill="none" stroke="#8cffff" stroke-width="3"/>`;
icons.API = `<path d="m32 3 26 15v29L32 62 6 47V18Z" fill="#493621" stroke="#f0bc69" stroke-width="2"/><path d="m23 23-9 9 9 9m18-18 9 9-9 9m-5-22-8 26" fill="none" stroke="#ffda9e" stroke-width="3"/>`;
icons.OpenShift = `<path d="M49 17a23 23 0 1 0 0 30" fill="none" stroke="#ff7e8a" stroke-width="10"/><path d="m41 11 15 10M41 53l15-10" stroke="#ffacb4" stroke-width="7"/><path d="M6 27h14M6 38h14" stroke="#832f43" stroke-width="5"/>`;
const aliases={'Physical Server':'Server','Windows Server':'Server','Linux Server':'Server',Oracle:'Database','SQL Server':'Database',PostgreSQL:'Database',Redis:'Database','S3 / MinIO':'Storage','API Gateway':'API',DataPower:'API','3scale':'API',Apigee:'API',Proxy:'Router',Kafka:'Message Queue'};
export function icon(type){return `<g stroke-linecap="round" stroke-linejoin="round">${icons[aliases[type]||type]||icons.Server}</g>`;}

// Functional colors are shared by the diagram, overview and SVG export.
const palette = {
 Server:'#8fbaff', VM:'#bb9aff', 'Load Balancer':'#55dfdf', Database:'#68dfaa',
 Firewall:'#ffae70', WAF:'#ffcf78', Storage:'#a6c975', API:'#f0bc69', DNS:'#77caff',
 URL:'#89b9ff', OpenShift:'#ff7e8a', Kubernetes:'#779eff', Container:'#b39aff',
 Docker:'#64cafa', External:'#a7b7cf', Cloud:'#8dceff', Internet:'#79d7ed',
 'External System':'#c6a6ec', Router:'#7edbcc', Switch:'#94c7da', VPN:'#e2c778',
 NAT:'#edb88e', Monitoring:'#79dfba', User:'#e1b4ec', 'Message Queue':'#ecc777',
 Backup:'#b9d99b', 'DR Site':'#9cbbec'
};
export function componentType(node) {
 // Respect a configured type; only refine generic servers using recorded roles.
 if (!['Server','Physical Server','VM'].includes(node.type)) return node.type;
 const role = String(node.role || String(node.notes || '').match(/^role:\s*(.+)$/im)?.[1] || '');
 if (node.architectureRole === 'Databases' || /\b(database|db|sql|oracle|postgresql)\b/i.test(role)) return 'Database';
 return node.type;
}
export function componentColor(type) { return palette[aliases[type] || type] || '#a7b7cf'; }
