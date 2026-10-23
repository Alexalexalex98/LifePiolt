import { openApp, goPage } from './lib.mjs';
const own = (items) => items.map((i, n) => ({ uid: 'u' + n, item: i, boughtAt: Date.now() - 3 * 86400000 }));
const living = ['sofa:1', 'rug:1', 'plant:1', 'lamp:1', 'art:1', 'shelf:1'];
const seed = () => { const own = (items) => items.map((i, n) => ({ uid: 'u' + n, item: i, boughtAt: Date.now() - 3 * 86400000 })); const mk = (list) => ({ owned: own(list), placed: { living: Object.fromEntries(list.map((x, n) => [x.split(':')[0], 'u' + n])) } });
  const l = mk(['sofa:2', 'rug:2', 'plant:2', 'lamp:2', 'art:2', 'shelf:2']); localStorage.setItem('lp2-petHome', JSON.stringify({ state: { coins: 640, ...l, tier: 3, room: 'living', claimed: [], seen: ['home', 'friends', 'goals'] }, version: 0 }));
  localStorage.setItem('lp2-pet', JSON.stringify({ state: { pet: { name: 'Theia', born: Date.now(), xp: 600, food: 80, water: 80, joy: 80, ts: Date.now(), streak: 5, streakDay: '', spent: { day: '', snack: 0, water: 0, fit: 0, love: 0, pet: 0 }, share: false }, others: {}, visits: {} }, version: 0 })); };
const { browser, page } = await openApp({ seed });
await goPage(page, '/theiaPet'); await page.waitForTimeout(1800); await page.screenshot({ path: '/tmp/claude-0/shots/art1.png' });
await browser.close();
