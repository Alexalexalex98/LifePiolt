import { record, goPage } from '../lib.mjs';

const seed = () => {
  const k = Object.keys(localStorage).find((x) => /^lp2-fin/.test(x)) || 'lp2-finance';
  const f = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":0}');
  f.state.statementInfo = { salary: { monthly: 5200, used: 6, method: 'median', months: [], sources: [{ name: 'Alpine Studio AG', key: 'alpine', monthly: 3900, months: 6 }, { name: 'Freelance Design', key: 'freelance', monthly: 1300, months: 5 }] }, fixed: [{ name: 'Rent', monthly: 1700 }, { name: 'Health insurance', monthly: 400 }], variable: [{ name: 'Groceries and daily life', monthly: 900 }], extraordinary: [], months: 6, from: '2026-04-01', to: '2026-10-20', count: 120, balanceKnown: true, at: 1 };
  localStorage.setItem(k, JSON.stringify(f));
};

/** Video 4 · Risparmio per la vacanza: quanto mettere da parte ogni mese, con più stipendi. */
export default () => record('04-vacation', async (a) => {
  const { page } = a;
  await goPage(page, '/vacationPlan');
  const sk = page.getByText(/Skip all tutorials|Salta tutti/); if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(500); }
  await a.cue('goal', async () => { await a.pause(900); await a.type(page.getByPlaceholder(/e\.g\. 2000|Es\. 2000/i), '2000', 140); });
  await a.cue('month', async () => { await a.tap(page.getByText(/december 2026|dicembre 2026/i).first(), { focus: true }); await a.pause(1200); });
  await a.cue('result', async () => { await a.scroll(380, 1500); await a.pause(900); });
  await a.cue('split', async () => { await a.scroll(420, 1400); await a.pause(1500); });
}, { seed });
