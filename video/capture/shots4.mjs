import { openApp, goPage } from './lib.mjs';
const { browser, page } = await openApp();
await goPage(page, '/theiaPet'); await page.waitForTimeout(1500); await page.screenshot({ path: '/tmp/claude-0/shots/pet1.png' });
await page.mouse.wheel(0, 650); await page.waitForTimeout(500); await page.screenshot({ path: '/tmp/claude-0/shots/pet2.png' });
await goPage(page, '/settings'); await page.waitForTimeout(800);
const t = page.getByText(/^Theia$|Mascot|mascotte/i).first(); if (await t.count()) await t.click().catch(() => {});
await page.waitForTimeout(800); await page.screenshot({ path: '/tmp/claude-0/shots/pet-settings.png' });
await browser.close();
