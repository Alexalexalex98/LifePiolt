import { openApp, goPage } from './lib.mjs';
const { browser, page } = await openApp();
await goPage(page, '/theiaPet'); await page.waitForTimeout(1200);
await page.mouse.wheel(0, 700); await page.waitForTimeout(500); await page.screenshot({ path: '/tmp/claude-0/shots/game1.png' });
await page.getByText("Let's try").first().click(); await page.waitForTimeout(800); await page.screenshot({ path: '/tmp/claude-0/shots/game2.png' });
await browser.close();
