import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportHtml, esc } from '../src/lib/reportHtml.ts';

const full = {
  name: 'Alex', from: '2026-10-02', to: '2026-10-08',
  health: [{ label: 'Sonno', value: '7,4 h', delta: '+0,3 vs settimana prima' }, { label: 'Passi', value: "8'420", delta: null }],
  mood: { avg: 3.8, days: 5, best: 'sabato', worst: 'lunedì' },
  finance: { income: 0, spent: 412.5, net: -412.5, top: [{ name: 'Alimentari/Casa', amount: 210 }], monthNet: 1200, alerts: ['Abbonamenti: superato il budget di 40 CHF'] },
  tasks: { done: ['Chiamare il dentista', 'Pagare <b>bolletta</b>'], open: 3 },
  events: { past: 6, upcoming: [{ day: '2026-10-09', time: '09:00', title: 'Fisco: Controlla acconti' }] },
  correlations: [{ sentence: 'Nei giorni con sonno più alto, umore tende a essere più alto', detail: 'r = 0.52 su 30 giorni', status: 'Confermata nel tempo' }],
  generatedAt: '2026-10-08T10:00:00',
};
test('esc: caratteri HTML neutralizzati', () => {
  assert.equal(esc('<img src=x onerror="a()"> & \'q\''), '&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;q&#39;');
});
test('report completo: tutte le sezioni e i numeri', () => {
  const h = buildReportHtml(full);
  for (const s of ['Salute', 'Umore', 'Finanze', 'Task completati', 'Impegni', 'Cosa influenza cosa']) assert.ok(h.includes(`<h2>${s}</h2>`), s);
  assert.match(h, /02\.10\.2026 – 08\.10\.2026/);
  assert.match(h, /7,4 h/); assert.match(h, /8&#39;420/);
  assert.match(h, /3,8<\/b> su 5, 5 giorni registrati/);
  assert.match(h, /412 CHF|413 CHF/); assert.match(h, /Alimentari\/Casa 210 CHF/);
  assert.match(h, /<b>2<\/b> task completati, 3 ancora aperti/);
  assert.match(h, /ven 09\.10 09:00/);
  assert.match(h, /non cause/);
  assert.match(h, /Confermata nel tempo/);
  assert.match(h, /superato il budget/);
});
test('contenuto dinamico con escape (niente HTML iniettato)', () => {
  const h = buildReportHtml(full);
  assert.ok(!h.includes('<b>bolletta</b>'));
  assert.ok(h.includes('Pagare &lt;b&gt;bolletta&lt;/b&gt;'));
});
test('report vuoto: messaggi chiari, nessun crash', () => {
  const h = buildReportHtml({ from: '2026-10-02', to: '2026-10-08', health: [], mood: null, finance: null, tasks: { done: [], open: 0 }, events: { past: 0, upcoming: [] }, correlations: [], generatedAt: '2026-10-08T10:00:00' });
  assert.match(h, /Nessun dato di salute/); assert.match(h, /Nessun check-in/); assert.match(h, /Nessun movimento/);
  assert.match(h, /Nessun task completato/); assert.match(h, /Nessun impegno nei prossimi 7 giorni/); assert.match(h, /Ancora nessun legame/);
  assert.ok(h.startsWith('<!doctype html>'));
});
