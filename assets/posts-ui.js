"use strict";
(() => {
  const posts = BlogPosts.normalize(window.BLOG_POSTS);
  const search = document.querySelector("#post-search");
  const category = document.querySelector("#post-category");
  function card(post, compact = false) {
    const article = document.createElement("article"); article.className = "post-card";
    const meta = document.createElement("div"); meta.className = "post-meta";
    const time = document.createElement("time"); time.dateTime = post.date; time.textContent = post.date;
    const tag = document.createElement("span"); tag.textContent = post.category; meta.append(time, tag);
    const heading = document.createElement(compact ? "h3" : "h2");
    const link = document.createElement("a"); link.href = "#posts/" + post.id; link.textContent = post.title; heading.append(link);
    const excerpt = document.createElement("p"); excerpt.textContent = post.excerpt;
    const read = document.createElement("a"); read.className = "text-link"; read.href = link.href; read.textContent = "阅读全文"; read.setAttribute("aria-label", "阅读全文：" + post.title);
    article.append(meta, heading, excerpt, read); return article;
  }
  const home = document.querySelector("#home-post-list");
  home.replaceChildren(...posts.slice(0, 3).map(post => card(post, true)));
  if (!posts.length) home.textContent = "暂无帖子";
  for (const name of [...new Set(posts.map(post => post.category))]) { const option = document.createElement("option"); option.value = name; option.textContent = name; category.append(option); }
  function renderList() {
    const term = search.value.trim().toLocaleLowerCase();
    const matched = posts.filter(post => (!category.value || post.category === category.value) && `${post.title} ${post.excerpt} ${post.content}`.toLocaleLowerCase().includes(term));
    document.querySelector("#post-list").replaceChildren(...matched.map(post => card(post)));
    document.querySelector("#post-count").textContent = matched.length + " 篇帖子";
    document.querySelector("#post-empty").hidden = Boolean(matched.length);
  }
  window.renderBlogPosts = id => {
    const list = document.querySelector("#posts-browse"), article = document.querySelector("#post-reader");
    list.hidden = Boolean(id); article.hidden = !id;
    if (!id) { renderList(); return; }
    const post = posts.find(post => post.id === id);
    document.querySelector("#post-title").textContent = post?.title ?? "帖子不存在";
    document.querySelector("#post-date").textContent = post ? post.date + " · " + post.category : "该帖子可能已移除，或链接有误。";
    document.querySelector("#post-content").replaceChildren();
    if (post) { BlogPosts.render(post.content, document.querySelector("#post-content")); document.title = post.title + " | 万不言的博客"; }
  };
  search.addEventListener("input", renderList); category.addEventListener("change", renderList);
})();
