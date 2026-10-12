import test from 'node:test';
import assert from 'node:assert/strict';
import { add, log, getEntries, clearLog, resetLog, setStorage, flush, loadPersisted, sanitize, errToString, MEM_MAX, DISK_MAX, serialize, formatLog, counts, categories, subscribeLog, setMinLevel } from '../src/lib/log.ts';
import { buildReport, kindOfId, groupScheduled } from '../src/lib/diagnosticsReport.ts';

test('livelli, categorie e filtri', () => {
  resetLog();
  log.debug('a', 'dbg'); log.info('b', 'inf'); log.warn('b', 'wrn'); log.error('c', 'err');
  assert.equal(getEntries().length, 4);
  assert.deepEqual(getEntries({ level: 'warn' }).map((e) => e.msg), ['err', 'wrn']);
  assert.deepEqual(getEntries({ cat: 'b' }).map((e) => e.msg), ['wrn', 'inf']);
  assert.deepEqual(getEntries({ text: 'ERR' }).map((e) => e.msg), ['err']);
  assert.equal(getEntries({ limit: 1 }).length, 1);
  assert.deepEqual(categories(), ['a', 'b', 'c']);
  assert.deepEqual(counts(), { debug: 1, info: 1, warn: 1, error: 1 });
  setMinLevel('warn');
  log.info('x', 'ignorata');
  assert.equal(getEntries({ cat: 'x' }).length, 0);
});

test('redazione automatica di email, IBAN, carte, telefoni, percorsi e token', () => {
  resetLog();
  log.error('t', 'Utente mario.rossi@example.com con IBAN CH93 0076 2011 6238 5295 7 e carta 4111 1111 1111 1111 tel +41 79 123 45 67', 'file /home/mario/app/x.js token abcdefghijklmnopqrstuvwxyz0123456789ABCD Bearer abc123def456ghi789');
  const [e] = getEntries();
  const all = e.msg + ' ' + e.data;
  for (const bad of ['mario.rossi@', '0076 2011', '4111 1111', '79 123 45 67', '/home/mario', 'abcdefghijklmnopqrstuvwxyz0123456789', 'abc123def456ghi789']) assert.ok(!all.includes(bad), bad + ' ancora presente: ' + all);
  assert.ok(/\[EMAIL\]/.test(e.msg) && /\[IBAN\]/.test(e.msg) && /\[CARTA\]/.test(e.msg) && /\[TELEFONO\]/.test(e.msg));
  assert.equal(sanitize('https://x.it/api?token=segreto&u=1'), 'https://x.it/api?[...]');
  assert.equal(errToString(new TypeError('x')), 'TypeError: x');
});

test('ring buffer in memoria e limite su disco', () => {
  resetLog();
  for (let i = 0; i < MEM_MAX + 20; i++) log.info('r', 'm' + i);
  assert.equal(getEntries().length, MEM_MAX);
  assert.equal(getEntries({ limit: 1 })[0].msg, 'm' + (MEM_MAX + 19));
  const s = JSON.parse(serialize(getEntries().reverse()));
  assert.equal(s.length, DISK_MAX);
  log.debug('r', 'solo memoria');
  assert.ok(!serialize(getEntries().reverse()).includes('solo memoria'));
});

test('persistenza: salva e ricarica con redazione; clearLog svuota anche il file', async () => {
  resetLog();
  let disk = null;
  setStorage({ load: async () => disk, save: async (t) => { disk = t; } });
  log.warn('p', 'prima del riavvio');
  log.info('p', 'altra');
  await flush();
  assert.ok(disk && disk.includes('prima del riavvio'));
  // "riavvio": nuovo processo, il file contiene anche una riga con un'email scritta da una vecchia versione
  const saved = JSON.parse(disk); saved.push({ ts: 1, level: 'error', cat: 'p', msg: 'vecchio mario@example.com' });
  disk = JSON.stringify(saved);
  resetLog();
  setStorage({ load: async () => disk, save: async (t) => { disk = t; } });
  assert.equal(await loadPersisted(), 3);
  const msgs = getEntries().map((e) => e.msg).join('|');
  assert.ok(msgs.includes('prima del riavvio') && !msgs.includes('mario@'));
  let notified = 0;
  subscribeLog(() => notified++);
  clearLog();
  assert.equal(getEntries().length, 0);
  assert.equal(disk, '[]');
  assert.ok(notified >= 1);
  // storage che fallisce non lancia
  setStorage({ load: async () => { throw new Error('x'); }, save: async () => { throw new Error('y'); } });
  log.error('p', 'ok');
  await flush();
  assert.equal(await loadPersisted(), 0);
});

test('formatLog e voci senza dati sensibili nel testo esportato', () => {
  resetLog();
  log.info('n', 'a'); log.error('n', 'b', 'dettaglio');
  const t = formatLog();
  assert.ok(/INFO\s+\[n\] a/.test(t) && /ERROR \[n\] b \| dettaglio/.test(t));
  void add;
});

test('rapporto di diagnostica: nessun dato personale, raggruppa le notifiche per tipo senza testi', () => {
  resetLog();
  log.error('app', 'Errore per anna.bianchi@example.com', 'iban IT60 X054 2811 1010 0000 0123 456');
  const info = {
    app: { name: 'LifePilot', version: '0.1.0', sdk: '57', build: '1', runtime: 'app installata' },
    device: { platform: 'android', os: '15', model: 'Pixel', locale: 'it-IT', tz: 'Europe/Zurich' },
    storage: { engine: 'AsyncStorage', keys: 20, kb: 300 },
    notifications: { supported: true, permission: 'concesso', scheduled: [{ id: 'lp-ev-2026-10-12-0-lead', at: 1760000000000 }, { id: 'lp-ev-2026-10-12-1-start', at: 1760000900000 }, { id: 'lp-bill-9-1', at: 1760001000000 }, { id: 'lp-briefing-morning', at: null }] },
    background: { supported: true, registered: true, system: 'available', reason: '', last: { ts: 1760000000000, source: 'background', ok: true, ran: ['reminders'], clock: null, ms: 120 } },
    permissions: { notifiche: 'concesso', microfono: 'negato' },
    errors: 1,
    log: getEntries().reverse(),
  };
  const r = buildReport(info, 1760000000000);
  assert.ok(r.includes('promemoria impegni: 2') && r.includes('scadenze bollette: 1') && r.includes('briefing: 1'));
  assert.ok(r.includes('microfono: negato') && r.includes('Programmate: 4'));
  assert.ok(!/anna\.bianchi|0542 8111|IT60/.test(r), r);
  assert.equal(kindOfId('lp-test'), 'prova');
  assert.equal(groupScheduled(info.notifications.scheduled).length, 3);
});
