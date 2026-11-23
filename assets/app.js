"use strict";

const games = [
  { name: "象棋", href: "chess/index.html", image: "assets/images/chess-cover.svg", key: "chess", description: "盲棋、技能挑战、练习与沙盘推演", tags: ["盲棋", "练习指导", "沙盘推演"] },
  { name: "贪吃蛇", href: "gameGPT/neon-serpent/dist/index.html", image: "assets/images/snake-cover.svg", key: "snake", description: "随机强化、连击冲刺与触屏操作", tags: ["随机强化", "连击冲刺", "触屏可玩"] }
];

function icon(name, className = "icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svg.namespaceURI, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

for (const list of document.querySelectorAll("[data-game-list]")) {
  for (const game of games) {
    const article = document.createElement("article");
    article.className = "game-card";
    const picture = document.createElement("a");
    picture.className = `game-picture game-picture-${game.key}`;
    picture.href = game.href;
    picture.dataset.gameTitle = game.name;
    picture.setAttribute("aria-label", `打开${game.name}`);
    const img = new Image();
    img.src = game.image;
    img.alt = game.name === "象棋" ? "中国象棋封面：楚河棋盘上的红黑棋子" : "贪吃蛇封面：深蓝赛场上的绿色蛇与食物";
    img.width = game.key === "chess" ? 1000 : 1200;
    img.height = 900;
    img.loading = "lazy";
    picture.append(img);
    const caption = document.createElement("div");
    caption.className = "game-caption";
    const text = document.createElement("div");
    const heading = document.createElement(list.dataset.gameList === "full" ? "h2" : "h3");
    heading.textContent = game.name;
    const description = document.createElement("p");
    description.textContent = game.description;
    text.append(heading, description);
    const play = document.createElement("a");
    play.href = game.href;
    play.className = "text-link";
    play.dataset.gameTitle = game.name;
    play.textContent = "开始游戏";
    play.setAttribute("aria-label", `开始${game.name}`);
    caption.append(text, play);
    article.append(picture, caption);
    list.append(article);
  }
}

document.addEventListener("click", event => {
  const link = event.target.closest?.("a[data-game-title]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !window.BlogPageTransition?.navigate) return;
  event.preventDefault();
  window.BlogPageTransition.navigate(link.href, link.dataset.gameTitle);
});

const pages = [...document.querySelectorAll("[data-page]")];
const nav = document.querySelector("#site-nav");
const menu = document.querySelector(".menu-toggle");
const titles = { home: "首页", resources: "资料仓库", games: "自制游戏", posts: "帖子", notes: "随笔", about: "关于" };
let previousPage;
function closeMenu() { nav.classList.remove("is-open"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "展开导航"); }
function route() {
  const [pageName, postId] = location.hash.slice(1).split("/");
  let current = pageName || "home";
  if (!Object.hasOwn(titles, current)) { current = "home"; history.replaceState(null, "", "#home"); }
  for (const page of pages) page.hidden = page.dataset.page !== current;
  for (const link of nav.querySelectorAll("a")) {
    if (link.hash === `#${current}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.title = current === "home" ? "万不言的博客" : `${titles[current]} | 万不言的博客`;
  if (current === "posts") window.renderBlogPosts(postId);
  closeMenu();
  const routeKey = current + (current === "posts" && postId ? "/" + postId : "");
  if (previousPage && previousPage !== routeKey) { window.scrollTo({ top: 0, behavior: "instant" }); document.querySelector("#main").focus({ preventScroll: true }); }
  previousPage = routeKey;
}
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  nav.classList.toggle("is-open", open);
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "收起导航" : "展开导航");
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") { closeMenu(); menu.focus(); } });
window.addEventListener("hashchange", route);
route();

let resources = [];
let selectedType = "all";
let currentResourcePage = 1;
const resourcesPerPage = 20;
let loadState = "ready";
const search = document.querySelector("#resource-search");
const state = document.querySelector("#resource-state");
const resourceList = document.querySelector("#resource-list");
const summary = document.querySelector("#resource-summary");
const reset = document.querySelector("#reset-resources");
const pagination = document.querySelector("#resource-pagination");
const previousResourcePage = document.querySelector("#resource-previous");
const nextResourcePage = document.querySelector("#resource-next");
const pageStatus = document.querySelector("#resource-page-status");
const typeNames = { document: "文档", code: "代码", image: "图片", other: "其他" };

function showState(title, copy) {
  state.replaceChildren(icon("folder", "empty-icon icon"));
  const h = document.createElement("h2"); h.textContent = title;
  const p = document.createElement("p"); p.textContent = copy;
  state.append(h);
  if (copy) state.append(p);
  state.hidden = false;
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderResources() {
  resourceList.replaceChildren();
  pagination.hidden = true;
  if (loadState === "error") { summary.textContent = "读取失败"; showState("资料目录加载失败", "请检查资料目录文件后刷新页面。"); return; }
  const term = search.value.trim().toLocaleLowerCase();
  const matched = resources.filter(file => (selectedType === "all" || file.type === selectedType) && `${file.name} ${file.path} ${file.description}`.toLocaleLowerCase().includes(term));
  summary.textContent = term || selectedType !== "all" ? `找到 ${matched.length} 份 / 共 ${resources.length} 份资料` : `共 ${resources.length} 份资料`;
  if (!resources.length) { showState("暂无资料", ""); return; }
  if (!matched.length) { showState("没有找到匹配的资料", "请修改搜索关键词或文件类型。"); return; }
  state.hidden = true;
  const totalPages = Math.ceil(matched.length / resourcesPerPage);
  currentResourcePage = Math.max(1, Math.min(currentResourcePage, totalPages));
  pagination.hidden = totalPages <= 1;
  previousResourcePage.disabled = currentResourcePage === 1;
  nextResourcePage.disabled = currentResourcePage === totalPages;
  pageStatus.textContent = `第 ${currentResourcePage} / ${totalPages} 页`;
  for (const file of matched.slice((currentResourcePage - 1) * resourcesPerPage, currentResourcePage * resourcesPerPage)) {
    const row = document.createElement("article"); row.className = "resource-row";
    if (file.type === "image") {
      const thumbnail = new Image();
      thumbnail.className = "resource-thumb";
      thumbnail.src = file.url;
      thumbnail.alt = "";
      thumbnail.width = 56;
      thumbnail.height = 72;
      thumbnail.loading = "lazy";
      row.append(thumbnail);
    } else row.append(icon("file", "resource-file-icon icon"));
    const info = document.createElement("div");
    const name = document.createElement("a"); name.className = "resource-name"; name.textContent = file.name; name.href = file.url; name.target = "_blank"; name.rel = "noopener";
    const path = document.createElement("p"); path.className = "resource-path"; path.textContent = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "资料 /";
    info.append(name, path);
    if (file.description) {
      const description = document.createElement("p");
      description.className = "resource-description";
      description.textContent = file.description;
      info.append(description);
    }
    const type = document.createElement("span"); type.className = "resource-type"; type.textContent = typeNames[file.type] || "其他";
    const size = document.createElement("span"); size.className = "resource-size"; size.textContent = formatSize(file.size);
    const download = document.createElement("a"); download.className = "resource-download"; download.href = file.url; download.download = file.name; download.setAttribute("aria-label", `下载 ${file.name}`); download.append(icon("download"), "下载");
    row.append(info, type, size, download);
    resourceList.append(row);
  }
}

function loadResources() {
  try {
    if (!Array.isArray(window.BLOG_RESOURCES)) throw new Error("Invalid resource list");
    const types = {
      document: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md", "epub", "odt", "rtf"],
      code: ["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "java", "c", "cpp", "h", "php", "sql", "sh", "go", "rs", "ipynb", "yml", "yaml"],
      image: ["png", "jpg", "jpeg", "svg", "webp", "gif", "bmp", "avif"]
    };
    resources = window.BLOG_RESOURCES.map(file => {
      if (!file || typeof file.path !== "string") throw new Error("Invalid resource path");
      const parts = file.path.split("/");
      if (parts.some(part => !part || part === "." || part === ".." || /[\\\u0000-\u001f]/.test(part))) throw new Error("Invalid resource path");
      const name = typeof file.name === "string" && file.name.trim() ? file.name : parts.at(-1);
      const extension = parts.at(-1).split(".").at(-1).toLowerCase();
      const type = Object.hasOwn(typeNames, file.type) ? file.type : Object.keys(types).find(key => types[key].includes(extension)) || "other";
      return { name, path: file.path, type, size: file.size, description: typeof file.description === "string" ? file.description : "", url: `资料/${parts.map(encodeURIComponent).join("/")}` };
    });
    loadState = "ready";
    for (const count of document.querySelectorAll("[data-resource-count]")) count.textContent = `${resources.length} 份资料`;
  } catch {
    loadState = "error";
    for (const count of document.querySelectorAll("[data-resource-count]")) count.textContent = "目录加载失败";
  }
  renderResources();
}
search.addEventListener("input", () => { currentResourcePage = 1; renderResources(); });
function changeResourcePage(delta) {
  currentResourcePage += delta;
  renderResources();
  document.querySelector(".resource-workspace").scrollIntoView({ block: "start" });
}
previousResourcePage.addEventListener("click", () => changeResourcePage(-1));
nextResourcePage.addEventListener("click", () => changeResourcePage(1));
reset.addEventListener("click", () => {
  search.value = "";
  selectedType = "all";
  currentResourcePage = 1;
  for (const filter of document.querySelectorAll("[data-filter]")) filter.setAttribute("aria-pressed", String(filter.dataset.filter === "all"));
  renderResources();
});
for (const button of document.querySelectorAll("[data-filter]")) {
  button.addEventListener("click", () => {
    selectedType = button.dataset.filter;
    currentResourcePage = 1;
    for (const filter of document.querySelectorAll("[data-filter]")) filter.setAttribute("aria-pressed", String(filter === button));
    renderResources();
  });
}
loadResources();
