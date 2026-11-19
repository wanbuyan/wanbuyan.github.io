import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire('C:/Users/杨忠豪/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
await mkdir('assets/images', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 });
page.on('pageerror', error => console.error(error.message));
try {
  await page.goto('http://127.0.0.1:4173/chess/', { waitUntil: 'networkidle' });
  await page.locator('#board .stone').first().waitFor();
  await page.locator('input[name="opening-mode"][value="casual"]').check();
  await page.locator('#restart-dialog button[value="restart"]').click();
  await page.locator('#restart-dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
  await page.locator('.board-frame').screenshot({ path: 'assets/images/chess.png' });
  await page.goto('http://127.0.0.1:4173/gameGPT/neon-serpent/dist/', { waitUntil: 'domcontentloaded' });
  await page.locator('#primary').waitFor();
  await page.locator('#sound').click();
  await page.locator('#primary').click();
  await page.waitForTimeout(300);
  await page.locator('.machine').screenshot({ path: 'assets/images/snake.png' });
  console.log('Captured real chess board and running snake machine.');
} finally { await browser.close(); }
