import { openApp, goPage } from './lib.mjs';
const { browser, page } = await openApp();
await goPage(page, '/theiaPet'); await page.waitForTimeout(1500); await page.screenshot({ path: '/tmp/claude-0/shots/game3.png' });
await page.getByText('Friends').first().click().catch(() => {}); await page.waitForTimeout(800); await page.screenshot({ path: '/tmp/claude-0/shots/game4.png' });
await browser.close();
