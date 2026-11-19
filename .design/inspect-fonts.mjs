import { createRequire } from 'node:module';
const require = createRequire('C:/Users/杨忠豪/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  for (const selector of ['.brand', '.hero h1', '.game-caption h3', '.game-caption p', '.overview-copy h2']) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    console.log(JSON.stringify({ selector, styles: await page.locator(selector).first().evaluate(el => ({ font: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight })), fonts: await cdp.send('CSS.getPlatformFontsForNode', { nodeId }) }));
  }
} finally { await browser.close(); }
