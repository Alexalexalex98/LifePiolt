import { record } from '../lib.mjs';

/** Video 1 · La Dashboard a widget. Le fasi (cue) corrispondono alle frasi di videos/01-dashboard.json. */
export default () => record('01-dashboard', async (a) => {
  const { page } = a;
  await a.cue('hello', async () => { await a.pause(1800); });
  await a.cue('add', async () => {
    await a.tap(page.getByText('Mood', { exact: true }).first(), { focus: true }).catch(() => {});
    await a.tap(page.getByRole('button', { name: /Widget/ }).first(), { focus: true });
    await a.pause(900);
    await a.tap(page.getByText(/^(Today|Oggi)$/).first());
    await a.pause(900);
  });
  await a.cue('hold', async () => {
    await a.hold(page.getByText('Life Score', { exact: true }).first(), 900);
    await a.pause(1500);
  });
  await a.cue('result', async () => {
    await a.scroll(260, 1400); await a.pause(400); await a.scroll(-260, 900);
  });
}, {});
