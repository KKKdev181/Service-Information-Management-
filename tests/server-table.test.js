import test from 'node:test';
import assert from 'node:assert/strict';
import {serverTable} from '../public/server-table.js';
test('server inventory sorts numeric resources without changing records and preserves details',()=>{
 const rows=[{name:'app-2',cpu:'16',environment:'Production',privateIp:'192.0.2.2',notes:'<script>bad</script>',domain:'example.test'},{name:'app-1',cpu:'4',environment:'32',privateIp:'192.0.2.1'}];
 const original=JSON.stringify(rows),html=serverTable(rows,{serverSort:'cpu'});
 assert.ok(html.indexOf('<strong>app-1')<html.indexOf('<strong>app-2'));
 assert.match(html,/Needs review/);assert.match(html,/Recorded environment/);assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/aria-expanded="false"/);assert.match(html,/id="server-detail-0" hidden/);assert.equal(JSON.stringify(rows),original);
 const descending=serverTable(rows,{serverSort:'cpu',serverDescending:true});assert.ok(descending.indexOf('<strong>app-2')<descending.indexOf('<strong>app-1'));
});
