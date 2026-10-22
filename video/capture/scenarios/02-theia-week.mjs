import { record } from '../lib.mjs';

const seed = () => {
  const iso = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  localStorage.setItem('lp2-fitness', JSON.stringify({ state: { profile: { goal: 'tonificare', level: 'intermedio', place: 'casa', days: 4, minutes: 30 }, activeProgram: 'push-pull-legs', lunch: { on: true, from: '12:30', to: '13:30' }, history: [{ id: 'h1', date: iso(-3), programId: 'push-pull-legs', session: 0, minutes: 32, sets: 10 }] }, version: 0 }));
};

/** Video 2 · Theia pianifica la settimana (turni, task, allenamenti, pausa pranzo). */
export default () => record('02-theia-week', async (a) => {
  const { page } = a;
  await a.cue('open', async () => {
    await a.tap(page.getByText('AI', { exact: true }).last());
    await a.pause(1200);
    const sk = page.getByText(/Skip all tutorials|Salta tutti/); if (await sk.count()) { await sk.first().click(); await a.pause(500); }
  });
  await a.cue('ask', async () => {
    await a.type(page.locator('textarea, input').last(), 'Plan my week', 80);
    await page.locator('textarea, input').last().press('Enter');
    await a.pause(1800);
  });
  await a.cue('proposal', async () => {
    await a.tap(page.getByText(/See the proposal|View the proposal|Vedi la proposta/).first(), { focus: true });
    await a.pause(1600);
  });
  await a.cue('review', async () => { await a.scroll(420, 1800); await a.pause(500); await a.scroll(420, 1400); await a.pause(400); });
  await a.cue('confirm', async () => {
    await a.scroll(-1600, 800);
    await a.tap(page.getByText(/^(Add \d+ items? to the Plan|Aggiungi \d+ voci al Plan)/).first(), { focus: true });
    await a.pause(1800);
  });
}, { seed });
