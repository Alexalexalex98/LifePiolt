/**
 * Registrazione dell'app REALE (build web di Expo) con Playwright.
 * Cattura i fotogrammi dallo schermo con la sorgente CDP "screencast" alla risoluzione del dispositivo (DPR 2),
 * e annota tocchi, zoom e "cue" (le fasi del video) con i loro tempi. Remotion usa poi questi dati per ritmo, evidenziazioni e zoom.
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');
export const VIEW = { width: 390, height: 844 };
export const FPS = 30;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/** Frasi italiane che l'inglese non copre ancora: se compaiono a schermo il video sarebbe in due lingue, quindi le segnalo. */
const SRC = join(ROOT, '..', 'src', 'i18n');
const readJ = (f) => { try { return JSON.parse(readFileSync(join(SRC, f), 'utf8')); } catch { return {}; } };
const _src = readJ('source.json');
const _en = { ...readJ('locales/en.json'), ...readJ('overrides/en.json') };
const MISSING = new Set((Array.isArray(_src) ? _src : Object.keys(_src)).filter((k) => !(k in _en)));
const IT_WORDS = /\b(il|lo|la|le|gli|un|una|di|del|della|che|non|per|con|sono|hai|tuo|tua|tuoi|oggi|ancora|nessun|aggiungi|vuoi|puoi|qui)\b/i;

export const APP_URL = process.env.APP_URL || 'http://localhost:8099';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

/** Dati di esempio realistici (non quelli veri di nessuno): ogni scenario può aggiungerne altri con `seed`. */
export async function openApp({ name = 'Giulia', seed } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--force-device-scale-factor=2'] });
  const ctx = await browser.newContext({ viewport: VIEW, locale: 'en-US', timezoneId: 'Europe/Zurich' });
  const page = await ctx.newPage();
  await page.goto(APP_URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/name|nome/i).fill(name);
  await page.getByText(/demo data|dati demo/i).first().click();
  await page.waitForTimeout(2500);
  // l'app DEVE essere in inglese per i video
  await page.evaluate(() => { const k = 'lp2-app'; const v = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":0}'); v.state = { ...v.state, language: 'en' }; localStorage.setItem(k, JSON.stringify(v)); });
  await page.evaluate(() => localStorage.setItem('lp2-tour', JSON.stringify({ state: { mode: 'open', level: 9, allUnlocked: true }, version: 0 })));
  // dati demo in inglese (quelli dell'app sono in italiano)
  await page.evaluate(() => {
    const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const k = 'lp2-life'; const v = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":0}');
    v.state.tasks = [{ id: 'v1', t: 'Book the dentist', urgent: true }, { id: 'v2', t: 'Prepare the Monday meeting' }, { id: 'v3', t: 'Renew car insurance', due: day(4) }];
    v.state.events = { [day(0)]: [{ time: '10:00', title: 'Team sync', dur: 30 }, { time: '15:30', title: 'Call with Marco', dur: 45 }], [day(1)]: [{ time: '09:30', title: 'Client workshop', dur: 90 }], [day(2)]: [{ time: '18:30', title: 'Dinner with Anna', dur: 90 }] };
    v.state.goals = [];
    localStorage.setItem(k, JSON.stringify(v));
  });
  if (seed) await page.evaluate(seed);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const skip = page.getByText('Salta tutti i tutorial');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
  return { browser, ctx, page };
}

/** Naviga a una pagina interna senza ricaricare l'app (restano i dati). */
export async function goPage(page, path) {
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForTimeout(1200);
}

export async function record(name, build, opts = {}) {
  const { browser, ctx, page } = await openApp(opts);
  const dir = join(ROOT, '.tmp', name);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = []; // {t, file}
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(dir, `f${String(n++).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ t: f.metadata.timestamp, file });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* chiusura */ }
  });
  const cues = [], taps = [], focuses = [];
  const seen = new Set();
  let t0 = 0, cur = null;
  const now = () => Date.now() / 1000 - t0;
  const api = {
    page,
    /** Una fase del video: durante `fn` succedono azioni; la frase del voice over con lo stesso id viene allineata a questa fase. */
    async cue(id, fn) {
      cur = { id, start: now() };
      await fn(api);
      await api.audit();
      cur.end = now(); cues.push(cur); cur = null;
    },
    pause: (ms) => sleep(ms),
    /** Cerca testo non inglese a schermo (le righe dell'app che mancano nel catalogo inglese). */
    async audit() {
      const lines = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.offsetParent !== null).map((e) => (e.textContent || '').trim()).filter(Boolean));
      for (const l of lines) if (!seen.has(l) && (MISSING.has(l) || (l.length > 12 && IT_WORDS.test(l) && /[a-z]/.test(l) && l.split(' ').length > 2 && !/^[A-Z][a-z]+ [A-Z]/.test(l)))) { seen.add(l); console.log('  [NON INGLESE?]', JSON.stringify(l)); }
    },
    /** Tocca un elemento (o un punto): registra il tocco per l'animazione. */
    async tap(target, { focus = false } = {}) {
      const box = target && 'x' in target && !('boundingBox' in target) ? { x: target.x - 24, y: target.y - 24, width: 48, height: 48 } : await (typeof target === 'string' ? page.locator(target).first() : target).boundingBox();
      if (!box) throw new Error('elemento non visibile: ' + String(target));
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (focus) focuses.push({ t: now(), x: box.x, y: box.y, w: box.width, h: box.height, dur: 1.4 });
      await sleep(350);
      taps.push({ t: now(), x, y });
      await page.mouse.click(x, y);
      await sleep(450);
    },
    /** Tiene premuto (come per aggiungere un widget). */
    async hold(target, ms = 900) {
      const loc = typeof target === 'string' ? page.locator(target).first() : target;
      const box = await loc.boundingBox();
      if (!box) throw new Error('elemento non visibile: ' + String(target));
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await sleep(300);
      taps.push({ t: now(), x, y });
      await page.mouse.move(x, y); await page.mouse.down(); await sleep(ms); await page.mouse.up();
      await sleep(500);
    },
    /** Evidenzia/ingrandisce un elemento senza toccarlo. */
    async focus(target, dur = 1.8) {
      const loc = typeof target === 'string' ? page.locator(target).first() : target;
      const box = await loc.boundingBox();
      if (!box) throw new Error('elemento non visibile: ' + String(target));
      focuses.push({ t: now(), x: box.x, y: box.y, w: box.width, h: box.height, dur });
      await sleep(dur * 1000 * 0.6);
    },
    /** Scrive come una persona. */
    async type(target, text, delay = 70) {
      const loc = typeof target === 'string' ? page.locator(target).first() : target;
      await api.tap(loc);
      await loc.pressSequentially(text, { delay });
      await sleep(300);
    },
    /** Scorre la pagina in modo fluido (px verso il basso; negativo = su). */
    async scroll(px, ms = 1200) {
      const steps = Math.max(8, Math.round(ms / 40));
      for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await sleep(ms / steps); }
      await sleep(250);
    },
  };
  await sleep(500);
  t0 = Date.now() / 1000;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: VIEW.width * 2, maxHeight: VIEW.height * 2, everyNthFrame: 1 });
  await sleep(300);
  await build(api);
  await sleep(500);
  const total = now();
  mkdirSync(join(ROOT, '.tmp'), { recursive: true });
  writeFileSync(join(ROOT, '.tmp', `flagged-${name}.json`), JSON.stringify([...seen], null, 2));
  await cdp.send('Page.stopScreencast');
  await sleep(300);
  await browser.close();
  // fotogrammi irregolari -> video a 30 fps costanti (ogni fotogramma resta fino al successivo)
  const base = frames[0]?.t ?? 0;
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, ((frames[i + 1]?.t ?? f.t + 0.2) - f.t)).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(join(dir, 'list.txt'), list);
  const out = join(ROOT, 'public', 'clips', `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', out]);
  // i tempi dei cue sono relativi a t0; il primo fotogramma può arrivare dopo: allineo allo stesso zero
  const shift = (frames[0]?.t ?? t0) - t0;
  const fix = (x) => ({ ...x, t: x.t - shift });
  const meta = {
    name, fps: FPS, view: VIEW, duration: Math.max(0.1, total - shift),
    cues: cues.map((c) => ({ id: c.id, start: Math.max(0, c.start - shift), end: c.end - shift })),
    taps: taps.map(fix), focuses: focuses.map(fix),
  };
  writeFileSync(join(ROOT, 'public', 'data', `${name}.capture.json`), JSON.stringify(meta, null, 2));
  rmSync(dir, { recursive: true, force: true });
  return meta;
}
