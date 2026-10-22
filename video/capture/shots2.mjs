import { openApp, goPage } from './lib.mjs';
const { browser, page } = await openApp();
await goPage(page, '/legalDoc?doc=privacy'); await page.waitForTimeout(1200); await page.screenshot({ path: '/tmp/claude-0/shots/legal-privacy.png' });
await goPage(page, '/legalDoc?doc=terms'); await page.waitForTimeout(800); await page.screenshot({ path: '/tmp/claude-0/shots/legal-terms.png' });
await browser.close();
