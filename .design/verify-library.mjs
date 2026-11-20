import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire('C:/Users/杨忠豪/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const root = process.cwd();
const site = pathToFileURL(path.join(root, 'index.html')).href;
const records = JSON.parse(await readFile('.design/bulk-import/catalog.json', 'utf8'));
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
const sha = data => createHash('sha256').update(data).digest('hex');
check(records.length === 181 && new Set(records.map(r => r.fileName)).size === 181, '181 unique image filenames');
const source = 'C:/Users/杨忠豪/Desktop/水浒插图';
check((await readdir(source)).filter(f => /\.jpeg$/i.test(f)).length === 181, 'Source still has exactly 181 pictures');
check(!(await readdir(source)).some(f => /^\d{3}\.jpeg$/.test(f)), 'All source pictures renamed');
for (const row of records) {
  const [original, copied] = await Promise.all([readFile(path.join(source, row.fileName)), readFile(path.join(root, row.src))]);
  check(sha(original) === row.sha256 && sha(copied) === row.sha256 && copied.length === row.bytes, `Source and copy unchanged: ${row.fileName}`);
  check(row.description.trim() && !/待核|TODO|undefined/.test(row.description), `Confirmed excerpt present: ${row.fileName}`);
}
const screenshots = path.join(root, '.design/screenshots');
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let server;
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  const localRequests = [];
  page.on('request', req => localRequests.push(req.url()));
  await page.goto(site);
  await page.evaluate(() => document.fonts.ready);
  check(await page.locator('[data-resource-count]').textContent() === '181 份资料', 'All 181 in resource catalog');
  check(await page.evaluate(() => window.BLOG_ARTWORKS.length === 181), 'Full pool shared by hero');
  async function checkHero() {
    const selected = await page.locator('.art-page').evaluateAll(async cards => {
      await Promise.all(cards.map(card => card.querySelector('img').decode()));
      return cards.map(card => ({ id: +card.dataset.artworkId, name: card.querySelector('.art-name').textContent, description: card.querySelector('.art-description').textContent, src: card.querySelector('img').getAttribute('src'), loaded: card.querySelector('img').naturalWidth > 0 }));
    });
    check(selected.length === 2 && selected[0].id !== selected[1].id, 'Two distinct pictures');
    check(selected.every(a => { const r = records.find(r => r.id === a.id); return r && a.name === r.name && a.description === r.description && a.src === r.src && a.loaded; }), 'Picture, name, description match');
  }
  await checkHero();
  const artworkIds = () => page.locator('.art-page').evaluateAll(cards => cards.map(card => +card.dataset.artworkId));
  for (let click = 0; click < 6; click++) {
    const before = await artworkIds();
    const beforeURL = page.url();
    await page.locator('#refresh-artworks').click();
    await checkHero();
    check((await artworkIds()).every(id => !before.includes(id)), 'Switch replaces both currently displayed pictures');
    check(page.url() === beforeURL, 'Switch does not navigate or reload');
  }
  await page.locator('#refresh-artworks').focus();
  for (const key of ['Enter', 'Space']) {
    const before = await artworkIds();
    await page.keyboard.press(key);
    await checkHero();
    check((await artworkIds()).every(id => !before.includes(id)), `Keyboard ${key} switches pictures`);
  }
  const reachability = await page.evaluate(() => {
    const originalRandom = Math.random;
    const results = [];
    try {
      for (let wanted = 0; wanted < window.BLOG_ARTWORKS.length; wanted++) {
        let step = window.BLOG_ARTWORKS.length - 1;
        Math.random = () => step-- === wanted ? 0 : 0.9999999;
        randomizeHeroArtworks();
        results.push(+document.querySelector('.art-page').dataset.artworkId);
      }
    } finally { Math.random = originalRandom; }
    return results;
  });
  check(reachability.every((id, index) => id === records[index].id), 'Every one of the 181 entries can reach the homepage');
  await checkHero();
  // Force the two longest transcriptions for layout QA; this affects the test page only.
  await page.evaluate(() => {
    let step = window.BLOG_ARTWORKS.length - 1;
    const original = Math.random;
    const wanted = [...window.BLOG_ARTWORKS.keys()].sort((a,b) => window.BLOG_ARTWORKS[b].description.length - window.BLOG_ARTWORKS[a].description.length).slice(0,2);
    Math.random = () => { const i = step--; return i === wanted[0] ? 0 : i === wanted[1] ? 1 / (i + 1) : 0.9999999; };
    try { randomizeHeroArtworks(); } finally { Math.random = original; }
  });
  await checkHero();
  check(await page.locator('.art-description').evaluateAll(nodes => nodes.every(node => node.scrollHeight <= node.clientHeight + 1 && !['hidden','clip'].includes(getComputedStyle(node).overflowY))), 'Full long inscriptions are displayed without truncation');
  await page.locator('#refresh-artworks').blur();
  await page.screenshot({ path: path.join(screenshots, 'home-library-desktop.png'), fullPage: true });
  const selectedBefore = await page.locator('.art-page').evaluateAll(cards => cards.map(c => c.dataset.artworkId));
  await page.goto(site + '#resources');
  check(await page.locator('.resource-row').count() === 20, 'Pagination renders 20 rows');
  check(await page.locator('#resource-page-status').textContent() === '第 1 / 10 页', 'Ten pages for 181 images');
  check(await page.locator('#resource-previous').isDisabled(), 'First page has no previous');
  for (let n = 2; n <= 10; n++) {
    await page.locator('#resource-next').click();
    check(await page.locator('#resource-page-status').textContent() === `第 ${n} / 10 页`, `Page ${n} navigates`);
  }
  check(await page.locator('.resource-row').count() === 1 && await page.locator('.resource-name').textContent() === '山寨喽啰.jpeg', 'Last page keeps final image accessible');
  check(await page.locator('#resource-next').isDisabled(), 'Last page has no next');
  await page.locator('#resource-search').fill('武松');
  const wusuResults = await page.locator('.resource-name').allTextContents();
  check(wusuResults.includes('武松-01.jpeg') && wusuResults.includes('武松-02.jpeg') && wusuResults.length === records.filter(r => `${r.fileName} ${r.path} ${r.description}`.includes('武松')).length, 'Search resets page and finds both variants and matching inscriptions');
  check(await page.locator('#resource-pagination').isHidden(), 'Small search results do not need pagination');
  await page.locator('#resource-search').fill('风雪山神庙');
  check(await page.locator('.resource-name').textContent() === '林冲-01.jpeg', 'Inscription text is searchable');
  check((await page.locator('.resource-description').textContent()).includes('风雪山神庙'), 'Inscription displayed on resource row');
  await page.locator('#resource-search').fill('不存在的资料');
  check(await page.locator('#resource-state h2').textContent() === '没有找到匹配的资料', 'No-results state works');
  await page.locator('#reset-resources').click();
  await page.locator('[data-filter="document"]').click();
  check(await page.locator('.resource-row').count() === 0 && await page.locator('#resource-pagination').isHidden(), 'Empty category hides pagination');
  await page.locator('[data-filter="image"]').click();
  check(await page.locator('.resource-row').count() === 20, 'Image filter restores first page');
  await page.locator('#reset-resources').click();
  await page.locator('.resource-thumb').evaluateAll(async imgs => { imgs.forEach(i => i.loading = 'eager'); await Promise.all(imgs.map(i => i.decode())); });
  await page.screenshot({ path: path.join(screenshots, 'resources-library-desktop.png'), fullPage: true });
  await page.goto(site + '#home');
  check(JSON.stringify(await page.locator('.art-page').evaluateAll(cards => cards.map(c => c.dataset.artworkId))) === JSON.stringify(selectedBefore), 'Changing sections keeps current pictures');
  check(localRequests.every(url => !/^https?:/.test(url) && !url.includes('/api/')), 'Direct open uses only local assets');
  const target = 'https://www.bilibili.com/video/BV1GJ411x7h7/';
  check(await page.locator('.hero-links #prank-link').getAttribute('href') === target && await page.locator('#prank-link').textContent() === '原神攻略', 'Prank link moved to home actions with requested label');
  check(await page.locator('.site-footer #prank-link').count() === 0, 'Prank link removed from footer');
  check(await page.locator('#prank-link').getAttribute('target') === null, 'Extra link stays in same tab');
  for (const width of [320, 390, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'resources', 'games']) {
      await page.goto(site + '#' + route);
      const fits = await page.evaluate(() => {
        const visible = [...document.querySelectorAll('.page:not([hidden]) .art-page, .page:not([hidden]) .art-description, .page:not([hidden]) .hero-links, .page:not([hidden]) .art-caption-actions, .page:not([hidden]) .resource-pagination, .page:not([hidden]) .resource-row')].filter(el => !el.hidden);
        return document.documentElement.scrollWidth <= innerWidth && visible.every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1 && (!el.matches('.art-description, .resource-description') || el.scrollHeight <= el.clientHeight + 1); });
      });
      check(fits, `Content fits ${width}px on ${route}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(site);
  await page.evaluate(() => {
    let step = window.BLOG_ARTWORKS.length - 1;
    const original = Math.random;
    const wanted = [...window.BLOG_ARTWORKS.keys()].sort((a,b) => window.BLOG_ARTWORKS[b].description.length - window.BLOG_ARTWORKS[a].description.length).slice(0,2);
    Math.random = () => { const i = step--; return i === wanted[0] ? 0 : i === wanted[1] ? 1 / (i + 1) : 0.9999999; };
    try { randomizeHeroArtworks(); } finally { Math.random = original; }
  });
  await checkHero();
  check(await page.locator('.art-description').evaluateAll(nodes => nodes.every(node => node.scrollHeight <= node.clientHeight + 1)), 'Longest transcriptions fit mobile without vertical clipping');
  await page.screenshot({ path: path.join(screenshots, 'home-library-mobile.png'), fullPage: true });
  await page.goto(site + '#resources');
  await page.screenshot({ path: path.join(screenshots, 'resources-library-mobile.png'), fullPage: true });
  // Test-only static host, closed in finally; no server dependency is added to the site.
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith('/blog/')) { res.writeHead(404).end(); return; }
      const file = path.resolve(root, decodeURIComponent(pathname.slice(6)) || 'index.html');
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const hosted = `http://127.0.0.1:${server.address().port}/blog/`;
  await page.goto(hosted + '#resources');
  await page.locator('#resource-search').fill('苏东坡');
  check(await page.locator('.resource-name').textContent() === '苏东坡.jpeg', 'Corrected character indexed under static hosting');
  const previewPromise = page.waitForEvent('popup');
  await page.locator('.resource-name').click();
  const preview = await previewPromise;
  await preview.waitForLoadState();
  check(await preview.locator('img').evaluate(img => img.naturalWidth > 0), 'Chinese filename preview opens');
  await preview.close();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.resource-download').click();
  const download = await downloadPromise;
  check(download.suggestedFilename() === '苏东坡.jpeg', 'Download retains character filename');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  check(sha(Buffer.concat(chunks)) === records.find(r => r.id === 27).sha256, 'Downloaded image unchanged');
  await page.goto(hosted);
  await checkHero();
  await page.route(target, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Destination check</title>' }));
  await page.locator('#prank-link').click();
  await page.waitForURL(target);
  check(page.url() === target, 'Genshin guide label opens the original Bilibili URL in the same tab');
  check(errors.length === 0, `No JavaScript errors: ${errors.join(', ')}`);
  const report = { result: 'PASS', checks, images: 181, names: new Set(records.map(r => r.name)).size, sha256Verified: 181, modes: ['file://', 'static /blog/ subdirectory'], widths: [320,390,768,1024,1280,1920], errors, descriptions: 'Expanded side inscriptions; unresolved cursive marked explicitly, full text displayed' };
  await writeFile('.design/library-validation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
