// Smoke test end-to-end delle schermate (web export + Playwright). NON fa parte di `npm test`.
//
//   1) npx expo export --platform web --output-dir /tmp/lp-web
//   2) node <server statico che serve /tmp/lp-web con fallback su .html, es. /tmp/claude-0/smoke/serve2.cjs> /tmp/lp-web 8142 &
//   3) node tests/e2e/smoke.mjs http://localhost:8142
//
// Variabili: PLAYWRIGHT_PATH (default /opt/node-tools/node_modules/playwright), CHROMIUM_PATH (default /opt/pw-browsers/chromium).
// Esce con codice 1 se qualcosa fallisce.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');

const BASE = (process.argv[2] || 'http://localhost:8081').replace(/\/$/, '');
const failures = [];
const log = (...a) => console.log(...a);
function check(name, ok, detail = '') {
  if (ok) log('  ok   ', name);
  else { log('  FAIL ', name, detail ? '- ' + String(detail).slice(0, 300) : ''); failures.push(name); }
}

// errori attesi/innocui: idratazione del rendering statico del web (#418) e risorse opzionali
const IGNORED = [/#418/, /Minified React error #4(18|23|25)/, /favicon/i, /Failed to load resource/i, /net::ERR/i];
const pageErrors = [];
let expectErrors = false; // true mentre si provoca di proposito un errore

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
let where = 'avvio';
page.on('pageerror', (e) => { if (!expectErrors && !IGNORED.some((r) => r.test(String(e)))) pageErrors.push(`[${where}] pageerror: ${String(e).slice(0, 240)}`); });
page.on('console', (m) => { if (m.type() === 'error' && !expectErrors) { const t = m.text(); if (!IGNORED.some((r) => r.test(t))) pageErrors.push(`[${where}] console.error: ${t.slice(0, 240)}`); } });
page.on('dialog', async (d) => { await d.dismiss().catch(() => {}); });

const text = () => page.evaluate(() => document.body.innerText);
const flat = async () => (await text()).replace(/\n/g, ' | ');
const wait = (ms) => page.waitForTimeout(ms);
async function closeGuide() {
  const b = page.getByText('Inizia', { exact: true });
  if (await b.count()) { await b.last().click({ timeout: 2500 }).catch(() => {}); await wait(300); }
}
async function open(path, ms = 1300) {
  where = path;
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await wait(ms);
  await closeGuide();
}
async function send(m) {
  const i = page.getByPlaceholder(/Scrivi/).last();
  await i.fill(m); await i.press('Enter'); await wait(900);
}
async function clickText(t, opts = {}) {
  const l = page.getByText(t, { exact: opts.exact ?? false }).last();
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await l.click({ timeout: 5000 });
  await wait(opts.wait ?? 500);
}

try {
  // ---------- onboarding + guida all'apertura ----------
  log('Onboarding e guida');
  where = 'onboarding';
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await wait(900);
  check('onboarding: campo nome', (await page.getByPlaceholder('Il tuo nome').count()) > 0);
  check('onboarding: link privacy', /Come usiamo i tuoi dati/.test(await text()));
  await page.getByText('Come usiamo i tuoi dati').last().click(); await wait(500);
  check('onboarding: informativa mostrata', /Cosa resta sul tuo telefono/.test(await text()));
  await page.getByText('Chiudi', { exact: true }).last().click(); await wait(400);
  await page.getByPlaceholder('Il tuo nome').fill('Alex');
  await page.getByText('Esplora con dati demo').click();
  await wait(2800);
  check('guida all\'apertura: compare dopo l\'onboarding', (await page.getByText('Inizia', { exact: true }).count()) > 0);
  await closeGuide();
  check('guida chiusa con "Inizia"', (await page.getByText('Inizia', { exact: true }).count()) === 0);
  check('home dopo onboarding', /Alex/.test(await text()));

  // ---------- pagine principali ----------
  log('Pagine');
  const pages = [
    ['/', /Alex/], ['/plan', /Pianifica il mese/], ['/lifetask', /LifeTask/], ['/ai', /LifeChat/], ['/lifehealth', /LifeHealth/],
    ['/lifefinance', /LifeFinance/], ['/lifeforecast', /Previsioni future/], ['/taxdecl', /Dichiarazione fiscale/], ['/stocks', /Watchlist/],
    ['/portfolio', /Portafoglio/], ['/mood', /Il tuo umore/], ['/lifenetwork', /LifeNetwork/], ['/messagesPage', /Messaggi/],
    ['/notificationsPage', /Notifiche/], ['/lifenotes', /LifeNotes/], ['/lifedrive', /LifeDrive/], ['/lifetravel', /LifeTravel/],
    ['/profile', /Profilo/], ['/settings', /Backup e ripristino/], ['/lifepointsPage', /LifePoints/], ['/privacy', /Privacy e permessi/],
  ];
  for (const [path, re] of pages) {
    const before = pageErrors.length;
    await open(path);
    const t = await text();
    check(`pagina ${path}: testo atteso ${re}`, re.test(t), t.slice(0, 120));
    check(`pagina ${path}: nessun errore`, pageErrors.length === before, pageErrors.slice(before).join(' // '));
  }

  // ---------- assistente: aggiungi al piano con conflitto ----------
  log('Assistente: conflitto');
  await open('/ai');
  await send('aggiungi riunione con anna domani alle 10');
  let t = await text();
  check('assistente: segnala il conflitto', /hai già/.test(t), t.slice(-300));
  check('assistente: offre "Tieni entrambi"', /Tieni entrambi/.test(t));
  await clickText('Tieni entrambi', { exact: true, wait: 800 });
  t = await text();
  check('assistente: conferma dopo "Tieni entrambi"', /Fatto|aggiunt|Lo trovi nel Plan/i.test(t.slice(-700)), t.slice(-300));

  // ---------- assistente: pianifica il mese e applica ----------
  log('Assistente: pianifica il mese');
  await send('pianificami tutto il mese');
  t = await text();
  check('mese: proposta con numero di impegni', /Ti propongo \d+ impegni/.test(t), t.slice(-300));
  check('mese: pulsante Applica', (await page.getByText('Applica', { exact: true }).count()) > 0);
  await clickText('Applica', { exact: true, wait: 900 });
  t = await text();
  check('mese: applicato', /ho aggiunto \d+ impegni/.test(t), t.slice(-300));
  await open('/plan');
  t = await text();
  check('plan: pagina raggiungibile dopo l\'applicazione', /Ottobre|Novembre|Dicembre|Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre/i.test(t));

  // ---------- chat: scegli un orario e controlla il Plan ----------
  log('Chat: orario proposto');
  await open('/conversationPage?id=g%3Ademo-aura', 1600);
  const d = new Date(); d.setDate(d.getDate() + 2);
  const p2 = (n) => String(n).padStart(2, '0');
  const slotLabel = `${p2(d.getDate())}/${p2(d.getMonth() + 1)} · 10:00`;
  t = await text();
  check('chat: proposta di orari presente', /Riunione di allineamento/.test(t) && t.includes(slotLabel), `cerco "${slotLabel}"`);
  await clickText(slotLabel, { wait: 800 });
  t = await text();
  if (/Scegli comunque/.test(t)) await clickText('Scegli comunque (tieni entrambi)', { wait: 800 });
  t = await text();
  check('chat: orario scelto e aggiunto al piano', /Scelto e aggiunto al tuo piano|Nel tuo piano/.test(t), t.slice(-200));
  await open('/plan', 1500);
  await page.getByText(String(d.getDate()), { exact: true }).last().click(); await wait(700);
  t = await text();
  check('plan: compare l\'orario scelto in chat', /Riunione di allineamento/.test(t.slice(t.lastIndexOf('Chiudi') - 20)) || /10:00 · Riunione di allineamento/.test(t));

  // ---------- privacy ----------
  log('Privacy');
  await open('/privacy');
  t = await text();
  for (const k of ['Cosa resta sul tuo telefono', 'Permessi richiesti dall\'app', 'Salute (Apple Salute)', 'Calendario', 'Notifiche', 'Microfono', 'Contatti', 'I tuoi diritti', 'Apri le impostazioni di sistema'])
    check(`privacy: "${k}"`, t.includes(k));

  // ---------- impostazioni: notifiche, backup, errori ----------
  log('Impostazioni');
  await open('/settings');
  t = await text();
  check('impostazioni: briefing del mattino', t.includes('Briefing del mattino') && t.includes('Riepilogo serale'));
  check('impostazioni: backup', t.includes('Esporta backup') && t.includes('Ripristina da file'));
  check('impostazioni: elimina dati', t.includes('Elimina tutti i miei dati'));
  check('impostazioni: problemi riscontrati', t.includes('Problemi riscontrati'));

  // errore volutamente provocato -> compare nel registro
  expectErrors = true;
  await page.evaluate(() => { setTimeout(() => { throw new Error('errore-di-prova-e2e'); }, 0); });
  await wait(600);
  expectErrors = false;
  await page.getByText('Apri', { exact: true }).last().click(); await wait(500);
  t = await text();
  check('registro errori: contiene l\'errore di prova', t.includes('errore-di-prova-e2e'), t.slice(-300));
  check('registro errori: pulsanti Copia / Invia / Cancella', t.includes('Copia') && t.includes('Invia al supporto') && t.includes('Cancella'));
  await clickText('Cancella', { exact: true });
  check('registro errori: cancellato', /Nessun problema registrato/.test(await text()));
  await page.getByText('Chiudi', { exact: true }).last().click().catch(() => {}); await wait(300);

  // backup: esporta (download) -> verifica contenuto
  const tmp = mkdtempSync(join(tmpdir(), 'lp-e2e-'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), clickText('Esporta backup', { exact: true, wait: 800 })]);
  check('backup: download avviato', !!dl);
  let backupPath = '';
  if (dl) {
    backupPath = join(tmp, 'backup.json');
    await dl.saveAs(backupPath);
    const bk = JSON.parse(readFileSync(backupPath, 'utf8'));
    check('backup: formato LifePilot', bk.app === 'LifePilot' && bk.format === 1 && !!bk.createdAt);
    check('backup: contiene tutti gli store', ['app', 'life', 'health', 'finance', 'chat', 'network'].every((k) => bk.stores['lp2-' + k]), Object.keys(bk.stores).join(','));
    check('backup: nome file con data', /lifepilot-backup-\d{4}-\d{2}-\d{2}\.json/.test(dl.suggestedFilename()));
  }

  // file non valido: rifiutato con messaggio
  const badPath = join(tmp, 'bad.json');
  writeFileSync(badPath, JSON.stringify({ hello: 'world' }));
  {
    const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null), clickText('Ripristina da file', { exact: true, wait: 200 })]);
    check('ripristino: selettore file', !!fc);
    if (fc) await fc.setFiles(badPath);
    await wait(900);
    check('ripristino: file non LifePilot rifiutato', /non è un backup di LifePilot/.test(await text()), (await text()).slice(-200));
    await page.getByText('Chiudi', { exact: true }).last().click().catch(() => {}); await wait(300);
  }
  const futPath = join(tmp, 'future.json');
  writeFileSync(futPath, JSON.stringify({ app: 'LifePilot', format: 99, createdAt: new Date().toISOString(), stores: { 'lp2-app': { state: {} } } }));
  {
    const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null), clickText('Ripristina da file', { exact: true, wait: 200 })]);
    if (fc) await fc.setFiles(futPath);
    await wait(900);
    check('ripristino: versione futura rifiutata', /più recente/.test(await text()), (await text()).slice(-200));
    await page.getByText('Chiudi', { exact: true }).last().click().catch(() => {}); await wait(300);
  }

  // ripristino reale: altero il nome, poi ripristino e deve tornare "Alex"
  if (backupPath) {
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('lp2-app'));
      raw.state.account.name = 'Zed';
      localStorage.setItem('lp2-app', JSON.stringify(raw));
    });
    await open('/settings');
    check('ripristino: stato alterato (Zed)', (await text()).includes('Zed'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null), clickText('Ripristina da file', { exact: true, wait: 200 })]);
    if (fc) await fc.setFiles(backupPath);
    await wait(900);
    t = await text();
    check('ripristino: anteprima con data e categorie', /Backup del/.test(t) && /categorie/.test(t), t.slice(-300));
    await clickText('Continua', { exact: true });
    check('ripristino: seconda conferma', /Sei sicuro/.test(await text()));
    await clickText('Sovrascrivi', { exact: true, wait: 1500 });
    t = await text();
    check('ripristino: eseguito', /Dati ripristinati/.test(t) || t.includes('Alex'), t.slice(-200));
    await open('/settings');
    t = await text();
    check('ripristino: nome tornato "Alex"', t.includes('Alex') && !t.includes('Zed'));
  }

  // ---------- eliminazione completa ----------
  log('Eliminazione dati');
  await open('/settings');
  await clickText('Elimina tutti i miei dati', { exact: true });
  check('elimina: prima conferma', /Eliminare tutti i miei dati/.test(await text()));
  await clickText('Continua', { exact: true });
  check('elimina: ultima conferma', /Ultima conferma/.test(await text()));
  await clickText('Elimina tutto', { exact: true, wait: 1800 });
  await wait(800);
  check('elimina: si torna all\'onboarding', (await page.getByPlaceholder('Il tuo nome').count()) > 0, (await text()).slice(0, 150));
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('lp2-')).map((k) => [k, (localStorage.getItem(k) || '').length]));
  const withData = await page.evaluate(() => {
    const out = [];
    for (const k of Object.keys(localStorage).filter((x) => x.startsWith('lp2-'))) {
      try { const s = JSON.parse(localStorage.getItem(k)).state; for (const [f, v] of Object.entries(s)) if (Array.isArray(v) && v.length && !['navItems', 'devices'].includes(f)) out.push(`${k}.${f}=${v.length}`); } catch { /* ignore */ }
    }
    return out;
  });
  check('elimina: nessun dato personale rimasto negli store', withData.length === 0, withData.join(', ') + ` (chiavi: ${left.map((x) => x[0]).join(',')})`);
} catch (e) {
  check('esecuzione senza eccezioni', false, e instanceof Error ? e.message : e);
  try { await page.screenshot({ path: join(tmpdir(), 'lp-e2e-fail.png') }); log('screenshot: ' + join(tmpdir(), 'lp-e2e-fail.png')); } catch { /* ignore */ }
}

await browser.close();
const uniq = [...new Set(pageErrors)];
if (uniq.length) { log('\nErrori JS/console rilevati:'); uniq.forEach((e) => log('  ' + e)); }
check('nessun pageerror / console.error durante tutto il test', uniq.length === 0);
log(failures.length ? `\n${failures.length} controlli falliti` : '\nTutti i controlli superati');
process.exit(failures.length ? 1 : 0);
