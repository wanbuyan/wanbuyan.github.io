import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/Users/杨忠豪/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const root = process.cwd();
const base = 'http://127.0.0.1:4173';
const shots = path.join(root, '.design', 'screenshots');
await mkdir(shots, { recursive: true });
const fixture = path.resolve(root, '资料', `博客验证-${Date.now()}`);
assert(path.dirname(fixture) === path.resolve(root, '资料'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
try {
  const response = await page.goto(base, { waitUntil: 'networkidle' });
  check(response.status() === 200, 'Home responds successfully');
  await page.evaluate(() => document.fonts.ready);
  check(await page.evaluate(() => document.fonts.check('700 21px "Blog Sans"', '万不言的博客')), 'Local sans-serif font loads');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const documentNode = await cdp.send('DOM.getDocument');
  const brandNode = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '.brand' });
  const renderedFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: brandNode.nodeId });
  check(renderedFonts.fonts.some(font => font.isCustomFont && font.glyphCount >= '万不言的博客'.length), 'Chinese site title actually renders using local Noto Sans');
  check(await page.locator('.brand-mark').count() === 0, 'Old seal mark removed');
  check(await page.locator('body').evaluate(el => !/把好奇心|留在这里|玩一局|灵感来|你好，我是|亲手做的/.test(el.innerText)), 'Old conversational headings removed');
  await page.waitForFunction(() => document.querySelector('#resource-summary').textContent === '共 0 份资料');
  check(await page.locator('[data-page="home"]').isVisible(), 'Home visible');
  check(await page.locator('.hero .primary').isVisible(), 'Hero primary action visible');
  check(await page.locator('.hero .primary').evaluate(el => el.getBoundingClientRect().bottom < 800), 'Hero action fits in laptop viewport');
  await page.locator('img').evaluateAll(async images => { for (const img of images) img.loading = 'eager'; await Promise.all(images.map(img => img.decode())); });
  check(await page.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), 'All actual game captures load');
  await page.screenshot({ path: path.join(shots, 'home-desktop.png'), fullPage: true });
  for (const route of ['resources', 'games', 'notes', 'about', 'home']) {
    await page.locator(`.site-nav a[href="#${route}"]`).click();
    await page.locator(`[data-page="${route}"]`).waitFor({ state: 'visible' });
    check(await page.locator(`[data-page="${route}"]`).isVisible(), `${route} navigation works`);
    check(await page.locator('.page:visible').count() === 1, 'Exactly one active page');
    check(await page.locator('.site-nav [aria-current="page"]').getAttribute('href') === `#${route}`, 'Current navigation is accessible');
  }
  await page.goto(`${base}/#games`);
  await page.screenshot({ path: path.join(shots, 'games-desktop.png'), fullPage: true });
  for (const [index, title] of ['中国象棋', 'Neon Serpent'].entries()) {
    const popupPromise = page.waitForEvent('popup');
    await page.locator('[data-game-list="full"] .game-caption > a').nth(index).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    check((await popup.title()).includes(title), 'Game entry opens the correct existing game');
    check(popup.url().startsWith(base), 'Game stays on the local host');
    await popup.close();
  }
  await page.goto(`${base}/#resources`);
  await page.waitForFunction(() => document.querySelector('#resource-summary').textContent === '共 0 份资料');
  check((await page.locator('#resource-state h2').textContent()) === '暂无资料', 'Empty repository is honest');
  await page.screenshot({ path: path.join(shots, 'resources-empty-desktop.png'), fullPage: true });

  await mkdir(fixture);
  await writeFile(path.join(fixture, '中文 资料 & #%.txt'), '这是真实下载内容。\n', 'utf8');
  await writeFile(path.join(fixture, '示例.py'), 'print("你好")\n', 'utf8');
  await writeFile(path.join(fixture, '预览.png'), await readFile(path.join(root, 'assets', 'images', 'chess.png')));
  await page.locator('#refresh-resources').click();
  await page.waitForFunction(() => document.querySelectorAll('.resource-row').length === 3);
  check(await page.locator('.resource-row').count() === 3, 'New nested files appear without editing source');
  await page.locator('[data-filter="code"]').click();
  check(await page.locator('.resource-row').count() === 1, 'Code filter works');
  check((await page.locator('.resource-name').textContent()) === '示例.py', 'Code filter returns correct file');
  await page.locator('[data-filter="all"]').click();
  await page.locator('#resource-search').fill('中文');
  check(await page.locator('.resource-row').count() === 1, 'Chinese filename search works');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.resource-download').click();
  const download = await downloadPromise;
  check(download.suggestedFilename() === '中文 资料 & #%.txt', 'Special characters survive download');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  check(Buffer.concat(chunks).toString('utf8') === '这是真实下载内容。\n', 'Downloaded bytes match stored file');
  const previewURL = await page.locator('.resource-name').getAttribute('href');
  const preview = await page.request.get(base + previewURL);
  check(preview.status() === 200, 'Encoded preview URL resolves');
  check(preview.headers()['content-security-policy'].includes('sandbox'), 'Resource previews are isolated');
  await page.locator('#resource-search').fill('不存在的资料');
  check(await page.locator('.resource-row').count() === 0, 'Search with no results is empty');
  check((await page.locator('#resource-state h2').textContent()).includes('没有找到'), 'Search empty state is distinct');
  await page.locator('#resource-search').fill('');
  await page.screenshot({ path: path.join(shots, 'resources-filled-desktop.png'), fullPage: true });

  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'games', 'resources', 'notes']) {
      await page.goto(`${base}/#${route}`, { waitUntil: 'networkidle' });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} has no horizontal overflow at ${width}`);
      check(await page.locator('main').evaluate(el => el.getBoundingClientRect().width <= window.innerWidth), 'Container fits viewport');
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.locator('.menu-toggle').click();
  check(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'true', 'Mobile menu opens');
  await page.locator('.site-nav a[href="#games"]').click();
  await page.locator('[data-page="games"]').waitFor({ state: 'visible' });
  check(await page.locator('[data-page="games"]').isVisible(), 'Mobile navigation works');
  check(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false', 'Mobile menu closes after navigation');
  await page.screenshot({ path: path.join(shots, 'games-mobile.png'), fullPage: true });
  await page.goto(`${base}/#home`);
  await page.screenshot({ path: path.join(shots, 'home-mobile.png'), fullPage: true });

  for (const denied of ['/server.mjs', '/.hallmark/preflight.json', '/api/download?file=../server.mjs', '/api/download?file=%2e%2e%2fserver.mjs', '/api/download?file=%2fserver.mjs', '/%2egit/config']) {
    const response = await page.request.get(base + denied);
    check(response.status() >= 400, `Private or outside path denied: ${denied}`);
  }
  await page.route('**/api/resources', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto(`${base}/#resources`);
  await page.locator('#refresh-resources').click();
  await page.waitForFunction(() => document.querySelector('#resource-summary').textContent === '读取失败');
  check(await page.locator('#resource-state button').isVisible(), 'Failed read offers retry');
  await page.unroute('**/api/resources');
  await page.locator('#resource-state button').click();
  await page.waitForFunction(() => document.querySelectorAll('.resource-row').length === 3);
  check(await page.locator('.resource-row').count() === 3, 'Retry restores real data');
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '#resources');
  check((await page.locator('#resource-state h2').textContent()) === '请启动本地服务', 'Direct-file mode gives a working startup path');
  check(errors.length === 0, `No frontend JavaScript errors: ${errors.join(', ')}`);
  await rm(fixture, { recursive: true, force: true });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(shots, 'home-mobile.png'), fullPage: true });
  console.log(JSON.stringify({ result: 'PASS', checks, testedWidths: [320, 390, 768, 1280, 1920], screenshots: shots, frontendErrors: errors }, null, 2));
} finally {
  await browser.close();
  // The fixture is generated in this run and checked to stay immediately inside the resource folder.
  assert(path.dirname(fixture) === path.resolve(root, '资料'));
  await rm(fixture, { recursive: true, force: true });
}
