import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../..');
const output = path.join(folder, 'outputs/01a1f1c4-67d5-7ab3-8ce9-ece32ba06140');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(path.join(root, '金句'), { recursive: true });
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('金句');
sheet.getRange('A1:C2').values = [
  ['出处', '作者', '内容'],
  ['蝶恋花', '晏殊', '昨夜西风凋碧树，独上高楼，望尽天涯路。']
];
sheet.showGridLines = false;
sheet.getRange('A1:C2').format.font = { name: 'SimSun', size: 12, color: '#292A26' };
sheet.getRange('A1:C2').format.verticalAlignment = 'center';
sheet.getRange('A1:C1').format.fill = '#EEECE5';
sheet.getRange('A1:C1').format.font.bold = true;
sheet.getRange('A1:C1').format.horizontalAlignment = 'center';
sheet.getRange('A1:C1').format.rowHeight = 28;
sheet.getRange('A2:C2').format.wrapText = true;
sheet.getRange('A2:C2').format.rowHeight = 58;
sheet.getRange('A1:A2').format.columnWidth = 20;
sheet.getRange('B1:B2').format.columnWidth = 15;
sheet.getRange('C1:C2').format.columnWidth = 72;
sheet.freezePanes.freezeRows(1);
workbook.recalculate();
console.log((await workbook.inspect({ kind: 'table', range: '金句!A1:C2', include: 'values', tableMaxRows: 2, tableMaxCols: 3 })).ndjson);
const preview = await workbook.render({ sheetName: '金句', range: 'A1:C2', scale: 1.6, format: 'png' });
await fs.writeFile(path.join(output, 'preview.png'), new Uint8Array(await preview.arrayBuffer()));
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(path.join(output, '金句.xlsx'));
await fs.copyFile(path.join(output, '金句.xlsx'), path.join(root, '金句/金句.xlsx'));
console.log('金句 Excel 已生成。');

// 浏览器验证的临时输入，保留在忽略目录，不复制到网站。
sheet.getRange('A3:C3').values = [['测试出处', '测试作者', '仅用于验证追加 Excel 行。']];
workbook.recalculate();
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(output, 'append-fixture.xlsx'));
sheet.getRange('C1').values = [['正文']];
workbook.recalculate();
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(output, 'invalid-fixture.xlsx'));
