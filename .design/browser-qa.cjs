/* 无第三方依赖的本地 Chrome 集成验证。node .design/browser-qa.cjs */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome;
let quoteServer;
async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'wanbuyan-browser-'));
  const shots = path.join(root, '.design', 'qa');
  await fs.mkdir(shots, { recursive: true });
  const executable = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  chrome = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + temp, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', chunk => { stderr += chunk; });
  chrome.on('error', error => { stderr += error.stack; });
  chrome.on('exit', code => { stderr += '\nChrome exit: ' + code; });
  try { await until(async () => /DevTools listening on (ws:\/\/[^\s]+)/.test(stderr), 15000, 'Chrome debugger'); }
  catch (error) { throw new Error(error.message + '\n' + stderr); }
  const browserUrl = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr)[1];
  const origin = 'http://' + new URL(browserUrl).host;
  const target = await (await fetch(origin + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const promise = pending.get(message.id); if (!promise) return; pending.delete(message.id); message.error ? promise.reject(new Error(JSON.stringify(message.error))) : promise.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = (expression, label = expression) => until(() => evaluate(expression), 12000, label);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (selector, value) => evaluate(`{ const element = document.querySelector(${JSON.stringify(selector)}); element.value = ${JSON.stringify(value)}; element.dispatchEvent(new Event('input', { bubbles: true })); }`);
  const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(shots, name + '.png'), Buffer.from(result.data, 'base64')); };
  const navigate = async file => { await evaluate('window.__qaOldDocument = true'); await send('Page.navigate', { url: pathToFileURL(path.join(root, file)).href }); await wait('document.readyState === "complete" && !window.__qaOldDocument', 'new page ready'); };
  const viewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  const boardState = () => evaluate(`Array.from(document.querySelectorAll('#board .intersection')).map(cell => ({ piece: cell.querySelector('.stone').textContent, red: cell.hasAttribute('data-red'), occupied: cell.hasAttribute('data-occupied') }))`);
  const move = async (from, to, blackView = false) => {
    const a = blackView ? 89 - from : from, b = blackView ? 89 - to : to;
    await click('#board .intersection:nth-child(' + (a + 1) + ')');
    await click('#board .intersection:nth-child(' + (b + 1) + ')');
  };
  async function openGame(mode, side = 'red', fixture = null) {
    await navigate('chess/index.html');
    await wait('!document.querySelector("#blog-page-transition")', 'loading transition finished');
    await wait('document.querySelector("#restart-dialog").open', 'opening dialog');
    if (fixture) await evaluate('window.__blindFixture = ' + JSON.stringify(fixture));
    await click(`input[name="opening-mode"][value="${mode}"]`);
    await click(`input[name="opening-side"][value="${side}"]`);
    await click('#restart-dialog button[value="restart"]');
    await evaluate('document.querySelector("#piece-motion").checked = false; document.querySelector("#piece-sound").checked = false;');
    await wait('!document.querySelector("#restart-dialog").open', 'game started');
    const label = { practice: '练习模式', casual: '娱乐对局', challenge: '挑战模式', blind: '盲棋模式' }[mode];
    await wait('document.querySelector("#mode-label").textContent === ' + JSON.stringify(label) + ' && document.querySelector("#status-title").textContent !== "选择开局"', 'mode initialized');
  }
  await send('Page.enable'); await send('Runtime.enable');
  const blindOnly = process.argv.includes('--blind-only');
  if (!blindOnly) {
  await viewport(1440, 1100);
  await navigate('index.html');
  await wait('document.querySelectorAll(".game-card").length === 4', 'game cards');
  await evaluate('document.querySelectorAll(".game-picture img").forEach(img => img.loading = "eager")');
  await wait('Array.from(document.querySelectorAll(".game-picture img")).every(img => img.complete && img.naturalWidth > 0 && img.src.endsWith("-cover.svg"))', 'new SVG covers load');
  assert.equal(await evaluate('document.querySelectorAll("#home-post-list .post-card").length'), 3);
  assert.match(await evaluate('document.querySelector("#home-post-list h3 a").textContent'),/DC4/);
  assert.equal(await evaluate('document.querySelector("#prank-link")'), null);
  assert.equal(await evaluate('window.BLOG_ARTWORKS.length'), 181);
  assert.equal(await evaluate('document.querySelector("#refresh-artworks")'), null);
  assert.equal(await evaluate('document.querySelector("#daily-quote-content").textContent'), '昨夜西风凋碧树，独上高楼，望尽天涯路。');
  assert.equal(await evaluate('document.querySelector("#daily-quote-source").textContent'), '晏殊《蝶恋花》');
  const initialArt = await evaluate('[...document.querySelectorAll(".art-page")].map(card => card.dataset.artworkId)');
  assert.equal(await evaluate('document.querySelector("#artwork-relation").textContent === BlogDaily.pickArtworks(BLOG_ARTWORKS,BLOG_ARTWORK_RELATIONS,BlogDaily.hourIndex()).relation'),true);
  assert.equal(await evaluate('document.querySelector("#artwork-relation").hidden'),false);
  await wait('[...document.querySelectorAll(".art-page img")].every(img=>img.complete && img.naturalWidth>0)','daily related portraits load');
  await navigate('index.html');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".art-page")].map(card => card.dataset.artworkId)'), initialArt);
  await evaluate('window.__realDateNow = Date.now; window.__qaBaseTime = Date.parse(BlogDaily.dateKey()+"T10:59:59+08:00"); Date.now = () => window.__qaBaseTime; document.dispatchEvent(new Event("visibilitychange"))');
  const artBeforeHour = await evaluate('[...document.querySelectorAll(".art-page")].map(card => card.dataset.artworkId)');
  const quoteBeforeHour = await evaluate('({ date: document.querySelector("#daily-quote").dataset.date, content: document.querySelector("#daily-quote-content").textContent })');
  await evaluate('Date.now = () => window.__qaBaseTime + 2000; document.dispatchEvent(new Event("visibilitychange"))');
  assert.notDeepEqual(await evaluate('[...document.querySelectorAll(".art-page")].map(card => card.dataset.artworkId)'), artBeforeHour);
  assert.deepEqual(await evaluate('({ date: document.querySelector("#daily-quote").dataset.date, content: document.querySelector("#daily-quote-content").textContent })'),quoteBeforeHour);
  assert.match(await evaluate('document.querySelector("#hero-art-pages").dataset.hour'),/T11$/);
  await evaluate('Date.now = () => window.__qaBaseTime + 14*3600000 + 2000; document.dispatchEvent(new Event("visibilitychange"))');
  assert.notEqual(await evaluate('document.querySelector("#daily-quote").dataset.date'),quoteBeforeHour.date);
  await evaluate('Date.now = window.__realDateNow; document.dispatchEvent(new Event("visibilitychange"))');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".art-page")].map(card => card.dataset.artworkId)'), initialArt);
  assert.ok(await evaluate('document.querySelector(".home-games").getBoundingClientRect().height < 360'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".home-content-grid")).gridTemplateColumns.split(" ").length'), 2);
  await screenshot('blog-desktop');
  await evaluate('document.querySelector(".home-content-grid").scrollIntoView({block:"center",behavior:"instant"})');
  await screenshot('blog-compact-content');
  await viewport(390,844);
  await evaluate('window.scrollTo(0,0)');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".home-content-grid")).gridTemplateColumns.split(" ").length'), 1);
  await screenshot('blog-daily-mobile');
  await viewport(1440,1100);
  const fixtureDir = path.join(root, '.design/workbook/outputs/01a1f1c4-67d5-7ab3-8ce9-ece32ba06140');
  const chooseWorkbook = async file => {
    const document = await send('DOM.getDocument');
    const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#local-quote-file' });
    await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [file] });
  };
  await chooseWorkbook(path.join(fixtureDir, 'append-fixture.xlsx'));
  await wait('document.querySelector("#local-quote-status").textContent.includes("已导入 2 条")', 'Excel append and inline/shared strings');
  const importedText = await evaluate('document.querySelector("#daily-quote-content").textContent');
  await navigate('index.html');
  assert.equal(await evaluate('document.querySelector("#daily-quote").dataset.input'), 'local');
  assert.equal(await evaluate('document.querySelector("#daily-quote-content").textContent'), importedText);
  await chooseWorkbook(path.join(fixtureDir,'invalid-fixture.xlsx'));
  await wait('document.querySelector("#local-quote-status").textContent.includes("导入失败")', 'invalid Excel header');
  assert.equal(await evaluate('document.querySelector("#daily-quote-content").textContent'), importedText);
  await evaluate('localStorage.removeItem("wanbuyan-local-quote-workbook-v1")');
  let onlineWorkbook = await fs.readFile(path.join(root,'金句/金句.xlsx'));
  let quoteRequests = 0;
  quoteServer = http.createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if (pathname === '/金句/金句.xlsx') { quoteRequests++; res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Cache-Control':'no-store'}); res.end(onlineWorkbook); return; }
      const file = path.resolve(root,'.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
      res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
      res.end(await fs.readFile(file));
    } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
  });
  await new Promise(resolve=>quoteServer.listen(0,'127.0.0.1',resolve));
  const localHttp = 'http://127.0.0.1:' + quoteServer.address().port + '/index.html';
  const online = async () => { await send('Page.navigate',{url:localHttp}); await wait('document.querySelector("#daily-quote")?.dataset.input === "excel"','online reads Excel directly'); };
  await online();
  assert.equal(await evaluate('document.querySelector("#local-quote-tools").hidden'), true);
  assert.equal(await evaluate('document.querySelector("#daily-quote-content").textContent'), '昨夜西风凋碧树，独上高楼，望尽天涯路。');
  onlineWorkbook = await fs.readFile(path.join(fixtureDir,'append-fixture.xlsx'));
  await online();
  assert.ok(quoteRequests >= 2);
  const actualRows = await evaluate('fetch("金句/金句.xlsx").then(r=>r.arrayBuffer()).then(b=>QuoteWorkbook.read(b))');
  assert.equal(actualRows.length,3);
  const expected = require('../assets/daily-core.js');
  const today = expected.pick(expected.normalizeQuotes(actualRows),1,expected.dayIndex(),'quotes')[0];
  assert.equal(await evaluate('document.querySelector("#daily-quote-content").textContent'), today.content);
  await navigate('index.html');
  console.log('PASS content schedule: stable hourly related images, independent daily quotes, midnight rollover, compact desktop/mobile layout and Excel import/HTTP updates');
  await evaluate('location.hash = "posts/dc2-walkthrough"');
  await wait('document.querySelector("#post-title").textContent === "DC-2靶场全流程——万不言"','DC-2 post route');
  assert.equal(await evaluate('document.querySelectorAll("#post-content img").length'),15);
  assert.equal(await evaluate('document.querySelectorAll("#post-content h3").length'),8);
  assert.equal(await evaluate('BLOG_RESOURCES.some(item=>item.path === "DC-2流程——万不言.docx" && item.type === "document")'),true);
  await evaluate('document.querySelectorAll("#post-content img").forEach(img=>img.loading="eager")');
  await wait('[...document.querySelectorAll("#post-content img")].every(img=>img.complete && img.naturalWidth>0)','all original DC-2 screenshots load');
  await screenshot('post-dc2-desktop');
  const attachment = await evaluate(`document.querySelector('#post-content a[href*="posts/files/"]').href`);
  assert.ok((await fs.stat(require('node:url').fileURLToPath(attachment))).size>3800000);
  await viewport(390,844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('post-dc2-mobile');
  await evaluate('document.querySelectorAll("#post-content h3")[6].scrollIntoView({behavior:"instant",block:"start"})');
  await screenshot('post-dc2-commands-mobile');
  console.log('PASS DC-2 post: direct route, seven sections, all 14 original images (15 placements), attachment and mobile layout');
  await viewport(1440,1100);
  await evaluate('location.hash = "posts/dc3-walkthrough"');
  await wait('document.querySelector("#post-title").textContent === "DC-3全流程——万不言"','DC-3 post route');
  assert.match(await evaluate('document.querySelector("#post-date").textContent'),/2026-11-24/);
  assert.equal(await evaluate('document.querySelectorAll("#post-content img").length'),28);
  assert.equal(await evaluate('document.querySelectorAll("#post-content h3").length'),9);
  await evaluate('document.querySelectorAll("#post-content img").forEach(img=>img.loading="eager")');
  await wait('[...document.querySelectorAll("#post-content img")].every(img=>img.complete && img.naturalWidth>0)','all original DC-3 screenshots load');
  const dc3Download = await evaluate(`document.querySelector('#post-content a[href*="DC-3"]').href`);
  assert.equal((await fs.stat(require('node:url').fileURLToPath(dc3Download))).size,9453018);
  await screenshot('post-dc3-desktop');
  await viewport(390,844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('post-dc3-mobile');
  await evaluate('document.querySelectorAll("#post-content h3")[2].scrollIntoView({behavior:"instant",block:"start"})');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('post-dc3-command-mobile');
  await evaluate('location.hash = "resources"');
  await wait('!document.querySelector("[data-page=resources]").hidden','resource library visible');
  await fill('#resource-search','DC-3');
  await click('[data-filter=document]');
  assert.equal(await evaluate('document.querySelectorAll("#resource-list .resource-download").length'),1);
  assert.equal(await evaluate('document.querySelector("#resource-list .resource-download").href'),dc3Download);
  assert.equal(await evaluate('document.querySelector("#resource-list .resource-download").download'),'DC-3全流程——万不言.docx');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('resource-dc3-mobile');
  await click('#reset-resources');
  await evaluate('location.hash = "posts"');
  await fill('#post-search','DC-3');
  assert.equal(await evaluate('document.querySelectorAll("#post-list .post-card").length'),1);
  await click('#post-list h2 a');
  await wait('document.querySelector("#post-title").textContent === "DC-3全流程——万不言"','DC-3 search result opens');
  console.log('PASS DC-3: first home entry, post route/search, all 28 original screenshots, shared 9,453,018-byte document, resource search/filter/download and mobile layout');
  await viewport(1440,1100);
  await evaluate('location.hash = "posts/dc4-walkthrough"');
  await wait('document.querySelector("#post-title").textContent === "DC4——万不言"','DC4 post route');
  assert.match(await evaluate('document.querySelector("#post-date").textContent'),/2026-11-25/);
  assert.equal(await evaluate('document.querySelectorAll("#post-content img").length'),5);
  assert.equal(await evaluate('document.querySelectorAll("#post-content h3").length'),5);
  await evaluate('document.querySelectorAll("#post-content img").forEach(img=>img.loading="eager")');
  await wait('[...document.querySelectorAll("#post-content img")].every(img=>img.complete && img.naturalWidth>0)','all original DC4 screenshots load');
  const dc4Download = await evaluate(`document.querySelector('#post-content a[href*="DC4"]').href`);
  assert.equal((await fs.stat(require('node:url').fileURLToPath(dc4Download))).size,1259841);
  await screenshot('post-dc4-desktop');
  await viewport(390,844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('post-dc4-mobile');
  await evaluate('document.querySelectorAll("#post-content h3")[3].scrollIntoView({behavior:"instant",block:"start"})');
  await screenshot('post-dc4-shell-mobile');
  await evaluate('location.hash = "resources"');
  await wait('!document.querySelector("[data-page=resources]").hidden','resource library visible');
  await fill('#resource-search','DC4');
  await click('[data-filter=document]');
  assert.equal(await evaluate('document.querySelectorAll("#resource-list .resource-download").length'),1);
  assert.equal(await evaluate('document.querySelector("#resource-list .resource-download").href'),dc4Download);
  assert.equal(await evaluate('document.querySelector("#resource-list .resource-download").download'),'DC4——万不言.docx');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('resource-dc4-mobile');
  await click('#reset-resources');
  await evaluate('location.hash = "posts"');
  await fill('#post-search','DC4');
  assert.equal(await evaluate('document.querySelectorAll("#post-list .post-card").length'),1);
  await click('#post-list h2 a');
  await wait('document.querySelector("#post-title").textContent === "DC4——万不言"','DC4 search result opens');
  console.log('PASS DC4: first home entry, post route/search, all five original screenshots, shared 1,259,841-byte document, resource search/filter/download and mobile layout');
  await viewport(1440,1100);
  await navigate('index.html');
  if (process.argv.includes('--daily-only')) { assert.deepEqual(errors,[]); ws.close(); return; }
  await evaluate('location.hash = "games"');
  await wait('!document.querySelector("[data-page=games]").hidden', 'games page');
  await screenshot('games-desktop');
  await evaluate('location.hash = "posts"');
  await wait('!document.querySelector("[data-page=posts]").hidden', 'posts page');
  await fill('#post-search', '不存在的文章123');
  assert.equal(await evaluate('document.querySelector("#post-empty").hidden'), false);
  await fill('#post-search', '沙盘');
  assert.equal(await evaluate('document.querySelectorAll("#post-list .post-card").length'), 1);
  await click('#post-list h2 a');
  await wait('!document.querySelector("#post-reader").hidden', 'reader');
  assert.match(await evaluate('document.querySelector("#post-title").textContent'), /沙盘/);
  await viewport(390, 844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('post-mobile');
  await evaluate('location.hash = "posts/missing-post"');
  await wait('document.querySelector("#post-title").textContent === "帖子不存在"', 'missing article');
  await evaluate(`BlogPosts.render('[点击](javascript:alert(1)) ![x](data:text/html,hello) <script>bad()</script> **粗体**', document.querySelector('#post-content'))`);
  assert.equal(await evaluate('document.querySelector("#post-content").querySelectorAll("a,img,script").length'), 0);
  assert.equal(await evaluate('document.querySelector("#post-content strong").textContent'), '粗体');
  console.log('PASS blog: covers, gallery preservation, posts, search, routing, mobile layout and safe Markdown');

  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'] });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  for (const [title, file, width, selector] of [
    ['象棋', '/chess/index.html', 1440, '[data-game-list="full"] .game-caption a[data-game-title="象棋"]'],
    ['贪吃蛇', '/gameGPT/neon-serpent/dist/index.html', 390, '[data-game-list="full"] .game-picture[data-game-title="贪吃蛇"]']
  ]) {
    await viewport(width, 900);
    await navigate('index.html');
    await evaluate('location.hash = "games"');
    await wait('!document.querySelector("[data-page=games]").hidden', 'game entries visible');
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
    const tabsBefore = (await (await fetch(origin + '/json/list')).json()).length;
    const box = await evaluate(`{ const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); ({x: r.x+r.width/2, y: r.y+r.height/2}); }`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await wait('document.querySelector("#blog-page-transition")?.classList.contains("is-visible")', 'departure overlay appears on the blog');
    await sleep(80);
    assert.equal(await evaluate('location.pathname.endsWith("/index.html") && !location.pathname.includes("/chess/") && !location.pathname.includes("/dist/")'), true);
    const departureOpacity = await evaluate('Number(getComputedStyle(document.querySelector("#blog-page-transition")).opacity)');
    assert.ok(departureOpacity > 0 && departureOpacity < 1, 'blog fades into the loading scene before navigation');
    await screenshot('entry-from-blog-' + (width === 1440 ? 'desktop' : 'mobile'));
    await wait(`location.pathname.endsWith(${JSON.stringify(file)}) && document.readyState === 'complete'`, 'same-tab game navigation');
    assert.equal(await evaluate('document.querySelector("#page-transition-title").textContent'), title);
    assert.equal(await evaluate('Number(getComputedStyle(document.querySelector(".page-transition-center")).opacity)'), 1);
    assert.equal(await evaluate('document.querySelector(".page-transition-center").getAnimations().length'), 0, 'destination continues the scene without replaying fade-in');
    assert.equal(await evaluate('new URL(location.href).searchParams.has("_transition")'), false);
    assert.equal((await (await fetch(origin + '/json/list')).json()).length, tabsBefore, 'no blank new tab');
    await wait('!document.querySelector("#blog-page-transition")', 'continued transition completes');
    const history = await send('Page.getNavigationHistory');
    await send('Page.navigateToHistoryEntry', { entryId: history.entries[history.currentIndex - 1].id });
    await wait('typeof window.BlogPageTransition?.navigate === "function" && document.querySelectorAll(".game-card").length === 4', 'return to blog');
    assert.equal(await evaluate('document.querySelector("#blog-page-transition")'), null);
  }
  console.log('PASS game entry: actual mouse clicks, blog fade before navigation, same tab, destination scene continuity and browser Back on desktop/mobile');
  const timingProbe = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__loadingTiming = {};
    window.__entryFrames = [];
    let injectedDialog = false;
    function sampleEntry() {
      const dialog = document.querySelector('#blog-page-transition');
      if (dialog?.classList.contains('is-visible') && !dialog.classList.contains('is-leaving')) {
        const t = performance.now();
        window.__entryFrames.push({ t, opacity: Number(getComputedStyle(dialog.querySelector('.page-transition-center')).opacity) });
        if (!injectedDialog) {
          injectedDialog = true;
          // 模拟游戏脚本稍晚打开开始弹窗，确保不会打断已经开始的渐入。
          setTimeout(() => {
            const extra = document.createElement('dialog');
            document.documentElement.append(extra); extra.showModal();
            setTimeout(() => { extra.close(); extra.remove(); }, 600);
          }, 100);
        }
      }
      if (!dialog?.classList.contains('is-leaving')) requestAnimationFrame(sampleEntry);
    }
    requestAnimationFrame(sampleEntry);
    new MutationObserver(records => {
      for (const record of records) {
        const dialog = record.target;
        if (dialog.id !== 'blog-page-transition') continue;
        const timing = window.__loadingTiming;
        if (dialog.classList.contains('is-visible') && !timing.visible) timing.visible = performance.now();
        if (dialog.classList.contains('is-leaving') && !timing.leaving) timing.leaving = performance.now();
        if (record.attributeName === 'open' && !dialog.open && timing.leaving) timing.removed = performance.now();
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class', 'open'] });
  ` });
  for (const [file, motion] of [
    ['chess/index.html', 'no-preference'], ['gameGPT/neon-serpent/dist/index.html', 'no-preference'],
    ['chess/index.html', 'reduce'], ['gameGPT/neon-serpent/dist/index.html', 'reduce']
  ]) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }] });
    await navigate(file);
    await wait('document.querySelector("#blog-page-transition")?.classList.contains("is-visible")', 'loading animation visible');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".page-transition-dots span")).animationName'), motion === 'reduce' ? 'page-transition-pulse' : 'page-transition-dot');
    const beforeDots = await evaluate('[...document.querySelectorAll(".page-transition-dots span")].map(dot => getComputedStyle(dot).opacity)');
    await sleep(180);
    const afterDots = await evaluate('[...document.querySelectorAll(".page-transition-dots span")].map(dot => getComputedStyle(dot).opacity)');
    assert.notDeepEqual(afterDots, beforeDots, 'dots visibly animate under both motion settings');
    try { await wait('document.querySelector("#blog-page-transition")?.classList.contains("is-leaving")', 'fast load minimum display'); }
    catch (error) { console.log(file, await evaluate('({ timing: window.__loadingTiming, ready: document.readyState, layer: document.querySelector("#blog-page-transition")?.outerHTML, hidden: document.hidden, now: performance.now() })'), errors); throw error; }
    await sleep(80);
    const opacity = await evaluate('Number(getComputedStyle(document.querySelector("#blog-page-transition")).opacity)');
    assert.ok(opacity > 0 && opacity < 1, 'loading overlay fades smoothly over the prepared game');
    await wait('!document.querySelector("#blog-page-transition")', 'fast load fade finished');
    const timing = await evaluate('window.__loadingTiming');
    const frames = await evaluate('window.__entryFrames');
    const discontinuities = frames.slice(1).filter((frame, index) => {
      const previous = frames[index];
      return frame.t - previous.t < 45 && (frame.opacity < previous.opacity - .03 || frame.opacity > previous.opacity + .25);
    });
    assert.deepEqual(discontinuities, [], 'entry opacity remains continuous when another dialog opens');
    assert.ok(timing.leaving - timing.visible >= 1900, JSON.stringify(timing));
    assert.ok(timing.removed - timing.leaving >= 420, JSON.stringify(timing));
  }
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: timingProbe.identifier });
  console.log('PASS fast loading: dots change opacity, fade-in plus full 1.6s hold and smooth fade-out in both games, with normal and reduced motion; prank button removed');
  const heldReady = await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__holdReady = event => event.stopImmediatePropagation(); window.addEventListener("blog:page-ready", window.__holdReady, true);' });
  const releaseReady = () => evaluate('window.removeEventListener("blog:page-ready", window.__holdReady, true); window.dispatchEvent(new Event("blog:page-ready"));');
  await viewport(1440, 900);
  for (const [file, title, name] of [['chess/index.html', '象棋', 'loading-chess-desktop'], ['gameGPT/neon-serpent/dist/index.html', '贪吃蛇', 'loading-snake-desktop']]) {
    await navigate(file);
    assert.equal(await evaluate('document.querySelector("#blog-page-transition").open'), true);
    assert.equal(await evaluate('document.querySelector("#page-transition-title").textContent'), title);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#blog-page-transition")).backgroundColor'), 'rgb(248, 247, 243)');
    assert.equal(await evaluate('Boolean(document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest("#blog-page-transition"))'), true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("body")).visibility'), 'hidden');
    if (title === '象棋') {
      assert.equal(await evaluate('document.querySelector("#restart-dialog").open'), true);
      assert.equal(await evaluate('getComputedStyle(document.querySelector("#restart-dialog")).visibility'), 'hidden');
    } else {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      assert.equal(await evaluate('document.querySelector("#arena").dataset.state'), 'ready');
    }
    await screenshot(name);
    await releaseReady();
    await wait('!document.querySelector("#blog-page-transition")', 'loading layer removed');
    assert.equal(await evaluate('document.documentElement.classList.contains("blog-page-loading")'), false);
    assert.notEqual(await evaluate('getComputedStyle(document.querySelector("body")).visibility'), 'hidden');
    if (title === '象棋') assert.equal(await evaluate('document.querySelector("#restart-dialog").contains(document.activeElement)'), true);
    else { await click('#primary'); assert.equal(await evaluate('document.querySelector("#arena").dataset.state'), 'running'); }
  }
  await viewport(390, 844);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('chess/index.html');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".page-transition-dots span")).animationName'), 'page-transition-pulse');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".page-transition-dots span")).transform'), 'none');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#blog-page-transition")).transitionDuration'), '0.42s');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('loading-chess-mobile');
  await releaseReady(); await wait('!document.querySelector("#blog-page-transition")', 'reduced motion transition ends');
  await send('Emulation.setEmulatedMedia', { features: [] });
  await navigate('chess/index.html');
  await wait('document.querySelector("#page-transition-status").textContent.includes("加载时间较长")', 'slow load recovery options');
  await evaluate('window.dispatchEvent(new ErrorEvent("error", { message: "QA simulated resource error", filename: "game.js" }))');
  assert.match(await evaluate('document.querySelector("#page-transition-status").textContent'), /加载失败/);
  assert.equal(await evaluate('document.querySelector(".page-transition-retry").hidden'), false);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: heldReady.identifier });
  await click('.page-transition-retry');
  await wait('!document.querySelector("#blog-page-transition")', 'retry completes successfully');
  console.log('PASS loading: both games, warm-white preview, top-layer ordering, input isolation, readiness, focus restore, mobile/reduced motion, slow loading and retry');

  await viewport(1440, 1100);
  await openGame('practice');
  await wait('document.querySelector("#training-state").textContent === "分析完成"', 'initial coaching worker');
  assert.match(await evaluate('document.querySelector("#training-advice").textContent'), /可参考/);
  await click('#coach-hint');
  assert.equal(await evaluate('document.querySelector("#board-guides").hidden'), false);
  assert.equal(await evaluate('document.querySelector("#coach-hint").getAttribute("aria-pressed")'), 'true');
  await screenshot('chess-practice');
  const original = await boardState();
  // A cannon capture on the right-hand horse is a legal but unprotected landing.
  await click('#board .intersection:nth-child(65)');
  assert.equal(await evaluate('document.querySelectorAll("#board [data-risk-target]").length > 0'), true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#board [data-risk-target]"), "::after").content'), '"!"');
  await click('#sandbox-enter');
  await wait('document.body.classList.contains("is-sandbox")', 'sandbox entered');
  await move(54, 45); await move(27, 36);
  assert.equal(await evaluate('document.querySelector("#sandbox-state").textContent'), '已推演 2 步');
  await click('#sandbox-back');
  await move(29, 38);
  await click('#sandbox-back');
  assert.equal(await evaluate('document.querySelectorAll("#sandbox-branches button").length'), 2);
  await click('#sandbox-branches button:first-child');
  assert.equal(await evaluate('document.querySelector("#sandbox-state").textContent'), '已推演 2 步');
  await click('#sandbox-reset');
  assert.deepEqual(await boardState(), original);
  await wait('!document.querySelector("#sandbox-reply").disabled', 'sandbox suggestion');
  await click('#sandbox-reply');
  assert.equal(await evaluate('document.querySelector("#sandbox-state").textContent'), '已推演 1 步');
  await click('#sandbox-exit');
  assert.deepEqual(await boardState(), original);
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'), '0 步');
  await move(54,45);
  await click('#sandbox-enter');
  const paused = await boardState();
  await sleep(1600);
  assert.deepEqual(await boardState(), paused);
  await click('#sandbox-exit');
  await wait('document.querySelector("#move-count").textContent === "2 步"', 'computer resumes after sandbox');
  await wait('document.querySelector("#training-state").textContent === "分析完成"', 'updated coaching');
  await click('#undo');
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'), '0 步');
  assert.deepEqual(await boardState(), original);
  console.log('PASS practice: coach Worker, hint arrow, sandbox moves, preserved branches, computer reply, exact restore, paused/resumed AI and undo');

  await openGame('practice', 'black');
  await wait('document.querySelector("#move-count").textContent === "1 步"', 'computer opening against black');
  await wait('document.querySelector("#training-state").textContent === "分析完成"', 'black coaching');
  const blackOriginal = await boardState();
  await click('#sandbox-enter');
  // Select one of the actual highlighted black-side moves, using oriented cells.
  await evaluate(`{ const cell = [...document.querySelectorAll('#board .intersection')].find(cell => cell.hasAttribute('data-playable')); cell.click(); document.querySelector('#board [data-target]').click(); }`);
  assert.equal(await evaluate('document.querySelector("#sandbox-state").textContent'), '已推演 1 步');
  await viewport(390, 844); await screenshot('chess-sandbox-mobile');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await click('#sandbox-board-back');
  assert.equal(await evaluate('document.querySelector("#sandbox-state").textContent'), '已推演 0 步');
  await click('#sandbox-board-exit'); assert.deepEqual(await boardState(), blackOriginal);
  await viewport(1440, 1100);
  await openGame('casual');
  const casual = await boardState();
  await click('#sandbox-enter');
  await wait('document.body.classList.contains("is-sandbox")', 'casual sandbox entered');
  assert.equal(await evaluate('document.querySelector("#convert").disabled'), true);
  await move(54, 45); await click('#sandbox-exit');
  assert.deepEqual(await boardState(), casual);
  assert.equal(await evaluate('document.querySelector("#convert").disabled'), false);
  await openGame('challenge');
  assert.equal(await evaluate('document.querySelector("#sandbox-section").hidden'), true);
  assert.equal(await evaluate('document.querySelector("#draft-dialog").open'), true);
  console.log('PASS black-side orientation, mobile chess, casual sandbox isolation and challenge mode unaffected');
  }

  const blindHook = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    let wrappedFactory;
    Object.defineProperty(window,'createBlindChess',{configurable:true,get(){return wrappedFactory;},set(factory){
      wrappedFactory = base => {
        const api = factory(base), createState = api.createState, createEngine = api.createEngine;
        api.createState = (...args) => {
          const fixture = window.__blindFixture;
          const state = fixture?.board ? {hidden:fixture.hidden.slice(),identities:fixture.identities.slice(),remaining:fixture.remaining.slice()} : createState(...args);
          for(const [where,piece] of Object.entries(fixture?.force || {})) {
            const square = Number(where), other = state.identities.indexOf(piece);
            [state.identities[square],state.identities[other]] = [state.identities[other],state.identities[square]];
          }
          window.__qaBlindState = state;
          return state;
        };
        api.createEngine = state => {
          const engine = createEngine(state);
          if(window.__blindFixture?.board) engine.initialBoard = () => window.__blindFixture.board.slice();
          return engine;
        };
        return api;
      };
    }});
    const NativeWorker = window.Worker;
    window.__blindMessages = [];
    window.Worker = class extends NativeWorker {
      postMessage(data,...rest) { if(data.blind) window.__blindMessages.push(structuredClone(data)); return super.postMessage(data,...rest); }
    };
  ` });
  await viewport(1440,1100);
  await openGame('blind','red',{force:{54:-5}});
  assert.equal(await evaluate('document.querySelectorAll("#board [data-blind]").length'),30);
  assert.equal(await evaluate('document.querySelector("#sandbox-section").hidden'),true);
  assert.equal(await evaluate('document.querySelector("#blind-panel").hidden'),false);
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(86) .stone").textContent'),'帅');
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(5) .stone").textContent'),'将');
  const blindOpening = await boardState();
  await click('#board .intersection:nth-child(86)');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#board .intersection")].flatMap((cell,i)=>cell.hasAttribute("data-target")?[i]:[])'),[76,84,86]);
  await click('#board .intersection:nth-child(68)');
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'),'0 步');
  await click('#board .intersection:nth-child(28)');
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'),'0 步');
  assert.equal(await evaluate('document.querySelectorAll("[data-blind-role]").length'),0);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#board [data-blind] .stone"),"::after").content'),'none');
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(55)").getAttribute("aria-label").includes("车")'),false);
  await screenshot('chess-blind-desktop');
  await evaluate('document.querySelector("#piece-motion").checked = true');
  await move(54,45);
  assert.equal(await evaluate('document.querySelector("#board-motion [data-blind] .stone")?.textContent'),'暗');
  await wait('document.querySelector("#board-motion").children.length === 0','blind piece flips on landing');
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(46) .stone").textContent'),'车');
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(46)").hasAttribute("data-red")'),false);
  await click('#undo');
  assert.deepEqual(await boardState(),blindOpening);
  assert.equal(await evaluate('window.__qaBlindState.identities[54]'),-5);
  await evaluate('document.querySelector("#piece-motion").checked = false');
  await move(54,45);
  await wait('document.querySelector("#move-count").textContent === "2 步"','blind AI worker reply');
  assert.equal(await evaluate('window.__blindMessages.length > 0'),true);
  assert.deepEqual(await evaluate('Object.keys(window.__blindMessages[0].blind)'),['hidden','remaining']);
  assert.equal(await evaluate('window.__blindMessages[0].blind.remaining.every((value,i,list)=>i===0||list[i-1]<=value)'),true);
  assert.match(await evaluate('document.querySelector("#move-list").textContent'),/卧底/);
  await viewport(390,844);
  await openGame('blind','black');
  await wait('document.querySelector("#move-count").textContent === "1 步"','blind black-side computer opening');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('chess-blind-mobile');
  function blindFixture(pieces,secrets={}) {
    const board=Array(90).fill(0);board[4]=-1;board[85]=1;
    for(const [square,piece]of Object.entries(pieces))board[square]=piece;
    const hidden=Array(90).fill(false),identities=Array(90).fill(0);
    for(const [square,piece]of Object.entries(secrets)){hidden[square]=true;identities[square]=piece;}
    return {board,hidden,identities,remaining:Object.values(secrets).sort((a,b)=>a-b)};
  }
  await viewport(1440,1100);
  await openGame('blind','red',blindFixture({36:5,27:-7},{27:-4}));
  await evaluate('document.querySelector("#piece-motion").checked = true');
  await move(36,27);
  assert.equal(await evaluate('document.querySelector("#board-motion [data-capture-back] .stone")?.textContent'),'暗');
  assert.equal(await evaluate('Number(getComputedStyle(document.querySelector("[data-capture-reveal]")).opacity)'),0);
  await wait('document.querySelector("[data-capture-reveal]") && Number(getComputedStyle(document.querySelector("[data-capture-reveal]")).opacity) === 1','captured hidden horse reveals');
  assert.equal(await evaluate('document.querySelector("[data-capture-reveal] .stone").textContent'),'马');
  assert.equal(await evaluate('document.querySelector("[data-capture-reveal]").hasAttribute("data-red")'),false);
  assert.equal(await evaluate('document.querySelectorAll("[data-blind-role]").length'),0);
  await screenshot('chess-blind-captured-reveal');
  await wait('document.querySelector("#board-motion").children.length === 0','captured identity fades out');
  assert.equal(await evaluate('document.querySelector("#red-player .capture-list").textContent.includes("马")'),true);
  await click('#undo');
  assert.equal(await evaluate('window.__qaBlindState.identities[27]'),-4);
  await move(36,27);
  await wait('document.querySelector("[data-capture-reveal]") && Number(getComputedStyle(document.querySelector("[data-capture-reveal]")).opacity) === 1','repeat capture reveal');
  await click('#undo');
  assert.equal(await evaluate('document.querySelector("#board-motion").children.length'),0);
  assert.equal(await evaluate('document.querySelectorAll("#board [data-moving]").length'),0);
  assert.equal(await evaluate('window.__qaBlindState.hidden[27]'),true);
  await sleep(1100);
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'),'0 步');
  assert.equal(await evaluate('document.querySelector("#board-motion").children.length'),0);
  await openGame('blind','red',blindFixture({40:5}));
  await move(40,4);
  await wait('document.querySelector("#result-dialog").open','king capture ends blind game');
  assert.equal(await evaluate('document.querySelector("#result-title").textContent'),'你赢了');
  assert.match(await evaluate('document.querySelector("#result-detail").textContent'),/黑方将帅已被吃/);
  await click('#result-undo');
  await wait('document.querySelector("#move-count").textContent === "0 步"','undo king capture');
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(5) .stone").textContent'),'将');
  await openGame('blind','red',blindFixture({81:5},{81:-7}));
  await move(81,85);
  await wait('document.querySelector("#result-dialog").open','self-inflicted king capture ends game');
  assert.equal(await evaluate('document.querySelector("#result-title").textContent'),'电脑获胜');
  assert.match(await evaluate('document.querySelector("#move-list").textContent'),/误伤红帅/);
  assert.equal(await evaluate('document.querySelector("#red-player .capture-list").textContent.includes("帅")'),true);
  await click('#result-undo');
  await wait('document.querySelector("#move-count").textContent === "0 步"','restore hidden identity after self-capture');
  assert.equal(await evaluate('document.querySelectorAll("#board [data-blind]").length'),1);
  await click('#restart'); await click('input[name="opening-mode"][value="casual"]'); await click('#restart-dialog button[value="restart"]');
  await wait('document.querySelector("#mode-label").textContent === "娱乐对局"','switch back to ordinary chess');
  assert.equal(await evaluate('document.querySelectorAll("#board [data-blind]").length'),0);
  await click('#board .intersection:nth-child(86)');
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(68)").hasAttribute("data-target")'),false);
  assert.equal(await evaluate('document.querySelector("#board .intersection:nth-child(77)").hasAttribute("data-target")'),true);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:blindHook.identifier});
  console.log('PASS blind chess: concealment, original-slot movement, landing reveal, undercover allegiance, undo, public-only AI Worker, black-side/mobile, king capture, friendly fire and mode isolation');
  if (blindOnly) { assert.deepEqual(errors,[]); ws.close(); return; }

  await navigate('posts/editor.html');
  await fill('#editor-title', '集成验证帖子'); await fill('#editor-id', 'qa-post');
  await fill('#editor-content', '## 正文\n\n**测试内容**\n\n![封面](assets/images/chess-cover.svg)');
  await wait('document.querySelector("#preview-content strong")?.textContent === "测试内容"', 'editor preview');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temp });
  await click('#post-form button[type=submit]');
  await wait('document.querySelector("#editor-message").textContent.includes("已导出全部 5 篇")', 'export');
  await until(async () => { try { return (await fs.stat(path.join(temp, 'posts.js'))).size > 0; } catch { return false; } }, 5000, 'export download');
  const data = await fs.readFile(path.join(temp,'posts.js'), 'utf8');
  assert.match(data, /chess-practice-and-sandbox/); assert.match(data, /dc3-walkthrough/); assert.match(data, /dc4-walkthrough/); assert.match(data, /qa-post/);
  await viewport(390, 844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('editor-mobile');
  assert.deepEqual(errors, []);
  console.log('PASS editor preview, complete-manifest download, mobile layout; no JavaScript runtime errors');
  console.log('Screenshots: ' + shots);
  ws.close();
}
async function until(fn, timeout, label) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await fn()) return; await sleep(100); }
  throw new Error('Timed out: ' + label);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (chrome) chrome.kill(); if (quoteServer) { quoteServer.closeAllConnections(); quoteServer.close(); } });
