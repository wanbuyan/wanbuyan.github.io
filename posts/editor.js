"use strict";
(() => {
  let posts = Array.isArray(window.BLOG_POSTS) ? structuredClone(window.BLOG_POSTS) : [];
  let editingId = null;
  const fields = ["title", "id", "date", "category", "excerpt", "content", "draft"];
  const by = name => document.querySelector("#editor-" + name);
  const message = by("message");
  function read() { return Object.fromEntries(fields.map(name => [name, name === "draft" ? by(name).checked : by(name).value.trim()])); }
  function preview() {
    const post = read();
    document.querySelector("#preview-title").textContent = post.title || "帖子标题";
    BlogPosts.render(post.content, document.querySelector("#preview-content"));
    try { localStorage.setItem("wanbuyan-post-draft", JSON.stringify({ post, editingId })); } catch {}
  }
  function fill(post = {}) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    for (const name of fields) { if (name === "draft") by(name).checked = Boolean(post[name]); else by(name).value = post[name] ?? (name === "date" ? today : name === "category" ? "随笔" : ""); }
    preview();
  }
  function options() {
    const select = by("existing"); select.replaceChildren(new Option("新建帖子", ""));
    posts.forEach(post => select.add(new Option(post.title + (post.draft ? "（草稿）" : ""), post.id)));
    select.value = editingId ?? "";
  }
  document.querySelector("#post-form").addEventListener("input", preview);
  by("existing").addEventListener("change", () => { editingId = by("existing").value || null; fill(posts.find(post => post.id === editingId)); message.textContent = ""; });
  by("new").addEventListener("click", () => { editingId = null; by("existing").value = ""; fill(); message.textContent = ""; });
  document.querySelector("#post-form").addEventListener("submit", event => {
    event.preventDefault();
    const post = read();
    if (!BlogPosts.validDate(post.date)) { message.textContent = "请填写有效日期。"; return; }
    if (posts.some(item => item.id === post.id && item.id !== editingId)) { message.textContent = "文章标识已存在，请换一个。"; return; }
    const index = posts.findIndex(item => item.id === editingId);
    if (index >= 0) posts[index] = post; else posts.push(post);
    editingId = post.id;
    options(); preview();
    const text = "// 由写帖工具导出。替换网站 posts/posts.js 后上传 GitHub。\nwindow.BLOG_POSTS = " + JSON.stringify(posts, null, 2) + ";\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "posts.js"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.textContent = "已导出全部 " + posts.length + " 篇帖子。请替换网站 posts/posts.js，再上传 GitHub。";
  });
  options();
  let saved;
  try { saved = JSON.parse(localStorage.getItem("wanbuyan-post-draft")); } catch {}
  if (saved?.post) { editingId = saved.editingId ?? null; by("existing").value = editingId ?? ""; fill(saved.post); message.textContent = "已恢复当前浏览器暂存的内容。"; }
  else fill();
})();
