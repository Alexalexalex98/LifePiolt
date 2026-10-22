import { openApp, goPage } from './lib.mjs';
const seed = () => {
  const ym = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  localStorage.setItem('lp2-monthPlan', JSON.stringify({ state: { income: { mode: 'fixed', amount: 4200 }, extraFixed: [{ id: 'a', name: 'Rent', amount: 1900 }, { id: 'b', name: 'Health insurance', amount: 480 }], goals: [{ id: 'g', name: 'Holiday in Greece', kind: 'vacation', total: 2000, targetYm: ym(4), saved: 200 }], plans: [{ id: 'p', name: 'Tax bill', total: 1800, startYm: ym(1), months: 6 }], savingsAccount: 'Savings account', answers: {} }, version: 0 }));
};
const { browser, page } = await openApp({ seed });
for (const [n, p] of [['monthplan', '/monthPlan'], ['finance2', '/lifefinance'], ['privacy2', '/privacyCenter']]) { await goPage(page, p); await page.waitForTimeout(1500); await page.screenshot({ path: `/tmp/claude-0/shots/${n}.png` }); }
await page.evaluate(() => window.scrollTo(0, 0));
await goPage(page, '/monthPlan'); await page.mouse.wheel(0, 700); await page.waitForTimeout(600); await page.screenshot({ path: '/tmp/claude-0/shots/monthplan2.png' });
await browser.close();
