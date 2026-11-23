/* 只读 .xlsx：ZIP + SpreadsheetML，不执行单元格公式或外部链接。 */
(function (root) {
  "use strict";
  async function archive(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 22 || bytes.length > 8 * 1024 * 1024) throw new Error("请选择 8 MB 以内的 .xlsx 金句表格。");
    const view = new DataView(buffer);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
    }
    if (end < 0) throw new Error("无法识别此文件，请在 Excel 中另存为 .xlsx 格式。");
    const count = view.getUint16(end + 10, true);
    if (count > 3000 || view.getUint16(end + 4, true) !== 0) throw new Error("此 Excel 文件格式暂不支持。");
    const files = new Map();
    let cursor = view.getUint32(end + 16, true), total = 0;
    const decoder = new TextDecoder();
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Excel 文件目录损坏。");
      const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
      const compressed = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true), extra = view.getUint16(cursor + 30, true), comment = view.getUint16(cursor + 32, true);
      const offset = view.getUint32(cursor + 42, true);
      total += size;
      if (flags & 1 || size > 10 * 1024 * 1024 || total > 32 * 1024 * 1024 || cursor + 46 + nameLength > bytes.length) throw new Error("不支持加密或过大的 Excel 文件。");
      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
      files.set(name, { method, compressed, size, offset });
      cursor += 46 + nameLength + extra + comment;
    }
    return async name => {
      const entry = files.get(name);
      if (!entry) return null;
      const p = entry.offset;
      if (p + 30 > bytes.length || view.getUint32(p, true) !== 0x04034b50) throw new Error("Excel 文件内容损坏。");
      const start = p + 30 + view.getUint16(p + 26, true) + view.getUint16(p + 28, true);
      if (start + entry.compressed > bytes.length) throw new Error("Excel 文件不完整。");
      const input = bytes.slice(start, start + entry.compressed);
      let output;
      if (entry.method === 0) output = input;
      else if (entry.method === 8) {
        let stream;
        try { stream = new DecompressionStream("deflate-raw"); }
        catch { throw new Error("当前浏览器无法读取 Excel，请使用新版 Chrome、Edge 或 Safari。"); }
        const reader = new Blob([input]).stream().pipeThrough(stream).getReader();
        const chunks = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > entry.size || size > 10 * 1024 * 1024) { await reader.cancel(); throw new Error("Excel 文件内容异常。"); }
          chunks.push(value);
        }
        output = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
      } else throw new Error("Excel 压缩格式暂不支持，请重新另存为 .xlsx。");
      if (output.length !== entry.size) throw new Error("Excel 文件长度校验失败。");
      return decoder.decode(output);
    };
  }
  function xml(text) {
    if (!text || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Excel XML 内容无效。");
    const document = new DOMParser().parseFromString(text, "application/xml");
    if (document.getElementsByTagName("parsererror").length) throw new Error("Excel XML 内容损坏。");
    return document;
  }
  const tags = (node, name) => [...node.getElementsByTagNameNS("*", name)];
  const string = node => tags(node, "t").map(text => text.textContent).join("");
  async function read(buffer) {
    const get = await archive(buffer);
    const workbook = xml(await get("xl/workbook.xml"));
    const sheets = tags(workbook, "sheet").filter(sheet => sheet.getAttribute("state") !== "hidden");
    const sheet = sheets.find(sheet => sheet.getAttribute("name") === "金句") ?? sheets[0];
    if (!sheet) throw new Error("Excel 中没有可读取的工作表。");
    const id = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? sheet.getAttribute("r:id");
    const relationships = tags(xml(await get("xl/_rels/workbook.xml.rels")), "Relationship");
    const target = relationships.find(rel => rel.getAttribute("Id") === id && rel.getAttribute("TargetMode") !== "External")?.getAttribute("Target");
    if (!target) throw new Error("无法定位金句工作表。");
    const sheetPath = new URL(target, "https://xlsx.invalid/xl/").pathname.slice(1);
    const shared = await get("xl/sharedStrings.xml");
    const strings = shared ? tags(xml(shared), "si").map(string) : [];
    const rows = tags(xml(await get(sheetPath)), "row");
    if (rows.length > 20000) throw new Error("金句表格最多支持 20000 行。");
    return rows.map(row => {
      const result = [];
      let next = 0;
      for (const cell of tags(row, "c")) {
        const letters = /^[A-Z]+/.exec(cell.getAttribute("r") || "")?.[0];
        let index = letters ? [...letters].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1 : next;
        next = index + 1;
        if (index > 63) continue;
        const type = cell.getAttribute("t");
        const value = tags(cell, "v")[0]?.textContent ?? "";
        if (type === "s") {
          if (strings[Number(value)] === undefined) throw new Error("Excel 文本索引无效。");
          result[index] = strings[Number(value)];
        } else result[index] = type === "inlineStr" ? string(cell) : value;
      }
      return Array.from({ length: result.length }, (_, index) => result[index] ?? "");
    });
  }
  root.QuoteWorkbook = { read };
})(typeof window === "object" ? window : globalThis);
