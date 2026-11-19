import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire('C:/Users/杨忠豪/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
await mkdir('.design/references', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const results = await Promise.allSettled([
    ['antfu', 'https://antfu.me/projects'], ['leerob', 'https://leerob.com/'], ['josh', 'https://www.joshwcomeau.com/']
  ].map(async ([name, url]) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);
      const styles = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const title = document.querySelector('h1, h2');
        const h = title ? getComputedStyle(title) : body;
        return { background: body.backgroundColor, color: body.color, bodyFont: body.fontFamily, headingFont: h.fontFamily, headingSize: h.fontSize };
      });
      await page.screenshot({ path: `.design/references/${name}.png` });
      return { name, url, styles };
    } finally { await page.close(); }
  }));
  await writeFile('.design/references/research.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
