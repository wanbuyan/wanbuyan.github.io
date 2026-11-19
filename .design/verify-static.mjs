import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire('C:/Users/杨忠豪/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const root = process.cwd();
const fixture = path.resolve(root, '.design', `static-check-${randomUUID()}`);
assert(path.dirname(fixture) === path.resolve(root, '.design'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let server;
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const site = pathToFileURL(path.join(root, 'index.html')).href;
  await page.goto(site, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  check(await page.locator('[data-page="home"]').isVisible(), 'Home opens directly from disk');
  check(await page.locator('[data-resource-count]').textContent() === '0 份资料', 'Static count works without API');
  for (const route of ['resources', 'games', 'notes', 'about', 'home']) {
    await page.locator(`.site-nav a[href="#${route}"]`).click();
    await page.locator(`[data-page="${route}"]`).waitFor({ state: 'visible' });
    check(await page.locator('.page:visible').count() === 1, `Disk route ${route} works`);
  }
  await page.goto(site + '#resources');
  check(await page.locator('#resource-state h2').textContent() === '暂无资料', 'Disk repository displays empty state');
  await page.goto(site + '#games');
  for (const [index, expected] of ['中国象棋', 'Neon Serpent'].entries()) {
    const popupPromise = page.waitForEvent('popup');
    await page.locator('[data-game-list="full"] .game-caption > a').nth(index).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    check((await popup.title()).includes(expected), 'Existing game opens directly from disk');
    await popup.close();
  }
  check(requests.every(url => !url.includes('/api/') && !/^https?:/.test(url)), 'Blog requests only local static assets');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(site);
  await page.locator('.menu-toggle').click();
  await page.locator('.site-nav a[href="#resources"]').click();
  await page.locator('[data-page="resources"]').waitFor({ state: 'visible' });
  check(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false', 'Mobile navigation still works');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Static repository fits mobile');

  await mkdir(fixture);
  await cp(path.join(root, 'index.html'), path.join(fixture, 'index.html'));
  await cp(path.join(root, 'assets'), path.join(fixture, 'assets'), { recursive: true });
  await mkdir(path.join(fixture, '资料', '课程'), { recursive: true });
  const records = [{ path: '课程/中文 #&%.txt', size: 12 }, { name: '代码示例', path: '示例.py' }, { path: '截图.PNG' }];
  await writeFile(path.join(fixture, 'assets', 'resources.js'), `window.BLOG_RESOURCES = ${JSON.stringify(records)};`);
  await writeFile(path.join(fixture, '资料', '课程', '中文 #&%.txt'), '资料下载验证。', 'utf8');
  await writeFile(path.join(fixture, '资料', '示例.py'), 'print("test")');
  await cp(path.join(root, 'assets', 'images', 'chess.png'), path.join(fixture, '资料', '截图.PNG'));
  const fixtureURL = pathToFileURL(path.join(fixture, 'index.html')).href;
  await page.goto(fixtureURL + '#resources');
  check(await page.locator('.resource-row').count() === 3, 'Static entries load from local script');
  await page.locator('[data-filter="code"]').click();
  check(await page.locator('.resource-row').count() === 1 && await page.locator('.resource-name').textContent() === '代码示例', 'Static file type detection works');
  await page.locator('#reset-resources').click();
  await page.locator('#resource-search').fill('中文');
  check(await page.locator('.resource-row').count() === 1, 'Static Chinese search works');
  const localDownload = await page.locator('.resource-download').getAttribute('href');
  check(localDownload.startsWith('资料/') && !localDownload.startsWith('/'), 'Downloads use relative static links');
  await page.locator('#resource-search').fill('不存在');
  check(await page.locator('#resource-state h2').textContent() === '没有找到匹配的资料', 'Search no-result state works');
  await page.locator('#reset-resources').click();
  check(await page.locator('.resource-row').count() === 3 && await page.locator('#resource-search').inputValue() === '', 'Reset restores all static entries');
  await page.locator('[data-filter="image"]').click();
  check(await page.locator('.resource-name').textContent() === '截图.PNG', 'Uppercase extensions classified correctly');

  // Test-only HTTP server models a static host mounted at /blog/. It exits in finally.
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/blog/')) { res.writeHead(404); res.end(); return; }
      const file = path.resolve(fixture, decodeURIComponent(url.pathname.slice('/blog/'.length)) || 'index.html');
      const rel = path.relative(fixture, file);
      if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); res.end(); return; }
      const data = await readFile(file);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const hosted = `http://127.0.0.1:${server.address().port}/blog/`;
  await page.goto(hosted + '#resources', { waitUntil: 'networkidle' });
  check(await page.locator('.resource-row').count() === 3, 'Static site works under a hosting subdirectory');
  await page.locator('#resource-search').fill('中文');
  const preview = await page.request.get(new URL(await page.locator('.resource-name').getAttribute('href'), hosted).href);
  check(preview.status() === 200 && await preview.text() === '资料下载验证。', 'Encoded nested preview resolves on static host');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.resource-download').click();
  const download = await downloadPromise;
  check(download.suggestedFilename() === '中文 #&%.txt', 'Static download keeps Chinese and special characters');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  check(Buffer.concat(chunks).toString('utf8') === '资料下载验证。', 'Static download bytes match source');
  check(errors.length === 0, `No JavaScript errors: ${errors.join(', ')}`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(site + '#resources');
  await page.screenshot({ path: '.design/screenshots/resources-static-desktop.png', fullPage: true });
  console.log(JSON.stringify({ result: 'PASS', checks, modes: ['file:// direct open', 'static host under /blog/'], errors }, null, 2));
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  assert(path.dirname(fixture) === path.resolve(root, '.design'));
  await rm(fixture, { recursive: true, force: true });
}
