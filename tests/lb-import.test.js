import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {previewLoadBalancers,mergeLoadBalancers} from '../server/lb-import.js';
import {lbTable} from '../public/lb-table.js';
const headers=['Host Name','Host IP Address','Host Port','Host Protocol','LB / WAF VIP','LB VIP Protocol','VIP Port','DNS URL In Thiqah','Note'];
const values=['app-one\napp-two','192.0.2.1\n192.0.2.2',8080,'TCP','198.51.100.1','TCP',443,'https://example.test/\nhttps://other.example.test/','External <script>'];
export async function exampleWorkbook(){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('LB');sheet.mergeCells('A1:I1');sheet.getCell('A1').value='LoadBalancer Configuration';sheet.addRow(headers);sheet.mergeCells('A3:I3');sheet.getCell('A3').value='Recommended';sheet.addRow(values);return book.xlsx.writeBuffer();}
test('LB screenshot layout parses title, headers and multiline fields without importing decoration',async()=>{
 const result=await previewLoadBalancers(await exampleWorkbook());assert.equal(result.rows.length,1);assert.equal(result.rows[0].hostIp,values[1]);assert.equal(result.rows[0].dns,values[7]);assert.equal(result.rows[0].port,'443');assert.equal(result.rows[0].notes,values[8]);
 const rendered=lbTable(result.rows);assert.match(rendered,/Host IP Address/);assert.match(rendered,/192\.0\.2\.1\n192\.0\.2\.2/);assert.doesNotMatch(rendered,/<script>/);
 const existing=[{...result.rows[0],id:'keep',pool:'preserved'}];const merged=mergeLoadBalancers(existing,[result.rows[0],{...result.rows[0],port:'8443'}]);assert.equal(merged.added,1);assert.equal(merged.skipped,1);assert.equal(merged.rows[0].pool,'preserved');assert.equal(merged.rows[0].id,'keep');
});
test('unrecognized workbooks and invalid rows fail without creating empty data',async()=>{
 const book=new ExcelJS.Workbook();book.addWorksheet('Other').addRow(['Unknown']);await assert.rejects(previewLoadBalancers(await book.xlsx.writeBuffer()),/No load balancer rows/);
 assert.throws(()=>mergeLoadBalancers([], [{hostIp:'192.0.2.1'}]),/host IP and VIP/);
});
