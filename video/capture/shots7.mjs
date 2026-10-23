import { openApp, goPage } from './lib.mjs';
const seed = () => { localStorage.setItem('lp2-petHome', JSON.stringify({ state: { coins: 640, owned: [{ uid: 'a', item: 'sofa:1', boughtAt: Date.now() - 20 * 86400000 }, { uid: 'b', item: 'rug:0', boughtAt: Date.now() - 12 * 86400000 }, { uid: 'c', item: 'plant:2', boughtAt: Date.now() - 2 * 86400000 }, { uid: 'd', item: 'lamp:1', boughtAt: Date.now() - 40 * 86400000 }, { uid: 'e', item: 'art:1', boughtAt: Date.now() - 3 * 86400000 }], placed: { living: { sofa: 'a', rug: 'b', plant: 'c', lamp: 'd', art: 'e' } }, tier: 1, room: 'living', claimed: [] }, version: 0 })); };
const { browser, page } = await openApp({ seed });
await goPage(page, '/theiaPet'); await page.waitForTimeout(1800); await page.screenshot({ path: '/tmp/claude-0/shots/home1.png' });
await page.getByText('Home', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(900); await page.screenshot({ path: '/tmp/claude-0/shots/home2.png' });
await browser.close();
