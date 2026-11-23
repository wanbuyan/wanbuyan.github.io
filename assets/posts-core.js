/* 静态帖子的安全 Markdown 子集：不解释 HTML。 */
(function (root) {
  "use strict";
  function safeUrl(value, image = false) {
    if (typeof value !== "string" || /[\u0000-\u0020\\]/.test(value)) return null;
    if (/^https?:\/\//i.test(value)) return value;
    if (!image && /^mailto:/i.test(value)) return value;
    if (/^(?:#|\.\.?\/|[\w\u3400-\u9fff-])/.test(value) && !/^[^/]*:/.test(value) && !value.startsWith("//")) return value;
    return null;
  }
  function inline(text, parent) {
    const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0, match;
    while ((match = pattern.exec(text))) {
      parent.append(document.createTextNode(text.slice(last, match.index)));
      if (match[1] !== undefined) {
        const src = safeUrl(match[2], true);
        if (src) { const img = new Image(); img.src = src; img.alt = match[1]; img.loading = "lazy"; parent.append(img); }
        else parent.append(document.createTextNode(match[0]));
      } else if (match[3] !== undefined) {
        const href = safeUrl(match[4]);
        if (href) { const link = document.createElement("a"); link.href = href; link.textContent = match[3]; if (/^https?:/.test(href)) { link.target = "_blank"; link.rel = "noopener noreferrer"; } parent.append(link); }
        else parent.append(document.createTextNode(match[0]));
      } else {
        const el = document.createElement(match[5] !== undefined ? "strong" : "code");
        el.textContent = match[5] ?? match[6]; parent.append(el);
      }
      last = pattern.lastIndex;
    }
    parent.append(document.createTextNode(text.slice(last)));
  }
  function render(content, container) {
    container.replaceChildren();
    const lines = String(content ?? "").replace(/\r/g, "").split("\n");
    let paragraph = [], list = null, quote = [], code = null;
    function flush() {
      if (paragraph.length) { const p = document.createElement("p"); inline(paragraph.join("\n"), p); container.append(p); paragraph = []; }
      if (quote.length) { const p = document.createElement("blockquote"); inline(quote.join("\n"), p); container.append(p); quote = []; }
      list = null;
    }
    for (const line of lines) {
      if (line.startsWith("```")) {
        flush();
        if (code !== null) { const pre = document.createElement("pre"), el = document.createElement("code"); el.textContent = code.join("\n"); pre.append(el); container.append(pre); code = null; }
        else code = [];
        continue;
      }
      if (code !== null) { code.push(line); continue; }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      const bullet = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
      if (!line.trim()) { flush(); continue; }
      if (heading) { flush(); const h = document.createElement("h" + Math.min(heading[1].length + 1, 4)); inline(heading[2], h); container.append(h); }
      else if (bullet) {
        if (paragraph.length || quote.length) flush();
        const tag = /^\s*\d+\./.test(line) ? "OL" : "UL";
        if (!list || list.tagName !== tag) { list = document.createElement(tag); container.append(list); }
        const li = document.createElement("li"); inline(bullet[1], li); list.append(li);
      } else if (line.startsWith("> ")) { if (paragraph.length || list) flush(); quote.push(line.slice(2)); }
      else { if (list || quote.length) flush(); paragraph.push(line); }
    }
    flush();
    if (code !== null) { const pre = document.createElement("pre"); pre.textContent = code.join("\n"); container.append(pre); }
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T00:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function normalize(posts) {
    const ids = new Set();
    return (Array.isArray(posts) ? posts : []).filter(post => {
      if (!post || typeof post.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(post.id) || ids.has(post.id) || typeof post.title !== "string" || !post.title.trim() || !validDate(post.date) || typeof post.content !== "string" || post.draft) return false;
      ids.add(post.id); return true;
    }).map(post => ({ ...post, category: String(post.category || "未分类"), excerpt: String(post.excerpt || post.content.replace(/[#*`>]/g, "").slice(0, 100)) })).sort((a, b) => b.date.localeCompare(a.date));
  }
  root.BlogPosts = { render, normalize, safeUrl, validDate };
})(typeof window === "object" ? window : globalThis);
