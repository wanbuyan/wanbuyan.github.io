/* 无第三方依赖的本地 Chrome 集成验证。node .design/browser-qa.cjs */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome;
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
  async function openGame(mode, side = 'red') {
    await navigate('chess/index.html');
    await wait('!document.querySelector("#blog-page-transition")', 'loading transition finished');
    await wait('document.querySelector("#restart-dialog").open', 'opening dialog');
    await click(`input[name="opening-mode"][value="${mode}"]`);
    await click(`input[name="opening-side"][value="${side}"]`);
    await click('#restart-dialog button[value="restart"]');
    await evaluate('document.querySelector("#piece-motion").checked = false; document.querySelector("#piece-sound").checked = false;');
    await wait('!document.querySelector("#restart-dialog").open', 'game started');
    const label = { practice: '练习模式', casual: '娱乐对局', challenge: '挑战模式' }[mode];
    await wait('document.querySelector("#mode-label").textContent === ' + JSON.stringify(label) + ' && document.querySelector("#status-title").textContent !== "选择开局"', 'mode initialized');
  }
  await send('Page.enable'); await send('Runtime.enable');
  await viewport(1440, 1100);
  await navigate('index.html');
  await wait('document.querySelectorAll(".game-card").length === 4', 'game cards');
  await evaluate('document.querySelectorAll(".game-picture img").forEach(img => img.loading = "eager")');
  await wait('Array.from(document.querySelectorAll(".game-picture img")).every(img => img.complete && img.naturalWidth > 0 && img.src.endsWith("-cover.svg"))', 'new SVG covers load');
  assert.equal(await evaluate('document.querySelectorAll("#home-post-list .post-card").length'), 1);
  assert.equal(await evaluate('document.querySelector("#prank-link")'), null);
  assert.equal(await evaluate('window.BLOG_ARTWORKS.length'), 181);
  await screenshot('blog-desktop');
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

  await navigate('posts/editor.html');
  await fill('#editor-title', '集成验证帖子'); await fill('#editor-id', 'qa-post');
  await fill('#editor-content', '## 正文\n\n**测试内容**\n\n![封面](assets/images/chess-cover.svg)');
  await wait('document.querySelector("#preview-content strong")?.textContent === "测试内容"', 'editor preview');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temp });
  await click('#post-form button[type=submit]');
  await wait('document.querySelector("#editor-message").textContent.includes("已导出全部 2 篇")', 'export');
  await until(async () => { try { return (await fs.stat(path.join(temp, 'posts.js'))).size > 0; } catch { return false; } }, 5000, 'export download');
  const data = await fs.readFile(path.join(temp,'posts.js'), 'utf8');
  assert.match(data, /chess-practice-and-sandbox/); assert.match(data, /qa-post/);
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
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (chrome) chrome.kill(); });
