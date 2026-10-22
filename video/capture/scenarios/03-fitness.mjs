import { record, goPage } from '../lib.mjs';

const seed = () => {
  const iso = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const hist = [-6, -5, -3].map((n, i) => ({ id: 'h' + i, date: iso(n), programId: 'push-pull-legs', session: i, minutes: 30, sets: 10 }));
  localStorage.setItem('lp2-fitness', JSON.stringify({ state: { profile: { goal: 'tonificare', level: 'intermedio', place: 'casa', days: 5, minutes: 30 }, activeProgram: 'push-pull-legs', history: hist }, version: 0 }));
};

/** Video 3 · LifeFitness: settimana, programmi, libreria di esercizi con foto animate. */
export default () => record('03-fitness', async (a) => {
  const { page } = a;
  await goPage(page, '/lifefitness');
  const sk = page.getByText(/Skip all tutorials|Salta tutti/); if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(500); }
  await a.cue('week', async () => { await a.pause(900); await a.focus(page.getByText(/Your week|La tua settimana/).first(), 2.2); await a.pause(600); });
  await a.cue('tabs', async () => {
    await a.tap({ x: 197, y: 129 }, { focus: true });
    await a.pause(250);
  });
  await a.cue('exercises', async () => {
    await a.tap(page.getByText(/^(Exercises|Esercizi)$/).first(), { focus: true });
    await a.pause(900);
    await a.scroll(420, 1500);
  });
  await a.cue('card', async () => {
    await a.tap(page.getByRole('button', { name: /Squat/ }).first());
    await a.pause(3200);
  });
  await a.cue('back', async () => {
    await a.tap({ x: 340, y: 234 });
    await a.pause(1500);
  });
}, { seed });
