import { openApp, goPage } from './lib.mjs';
const pages = [['dashboard', '/'], ['theia', '/theia'], ['privacy-center', '/privacyCenter'], ['food-plan', '/fitnessMealPlan'], ['fridge', '/fitnessFridge'], ['finance', '/lifefinance'], ['fitness', '/lifefitness'], ['settings', '/settings']];
const { browser, page } = await openApp();
for (const [n, p] of pages) { if (p !== '/') await goPage(page, p); await page.waitForTimeout(1200); await page.screenshot({ path: `/tmp/claude-0/shots/${n}.png` }); }
await browser.close();
