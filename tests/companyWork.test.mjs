import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, normsFor, aiMode, notifAllowed, DEFAULT_NOTIF, auditFilter, auditGroups, auditKind, csvCell, toCsv, exportBundle, fmtMoney } from '../src/lib/companyWork.ts';
import { searchItems, words } from '../src/lib/workSearch.ts';

test('paese e norme', () => {
  assert.equal(COUNTRIES.CH.currency, 'CHF'); assert.equal(COUNTRIES.IT.vat, 22);
  assert.ok(normsFor('CH').some((l) => /QR-fattura/.test(l)) && normsFor('IT').some((l) => /SdI/.test(l)));
  assert.match(fmtMoney(1234.5, 'IT'), /EUR$/); assert.match(fmtMoney(1234.5, 'CH'), /CHF$/);
});
test('piano AI: azienda, personale, nessuno', () => {
  assert.deepEqual([aiMode({ plan: true, covered: true, personal: false }).on, aiMode({ plan: true, covered: true, personal: false }).by], [true, 'azienda']);
  assert.equal(aiMode({ plan: true, covered: false, personal: true }).by, 'personale');
  const off = aiMode({ plan: false, covered: false, personal: false }); assert.equal(off.on, false); assert.match(off.text, /comandi semplici/);
  assert.match(aiMode({ plan: true, covered: false, personal: false }).text, /amministratore/);
});
test('notifiche per persona', () => {
  assert.equal(notifAllowed('cancelled', DEFAULT_NOTIF), true);
  assert.equal(notifAllowed('cancelled', { muted: true, off: [] }), false);
  assert.equal(notifAllowed('reschedule_ask', { muted: true, off: ['riunioni'] }), true, 'le richieste che aspettano risposta si vedono sempre');
  assert.equal(notifAllowed('trip_decided', { muted: false, off: ['trasferte'] }), false);
  assert.equal(notifAllowed('cancelled', { muted: false, off: ['trasferte'] }), true);
});
test('cronologia', () => {
  const rows = [{ id: 1, user_id: 'a', action: 'creato', target: 't', label: 'task: Offerta', at: '2026-11-05T10:00:00Z' }, { id: 2, user_id: 'b', action: 'eliminato', target: 'p', label: 'pagina: Bilancio', at: '2026-11-05T11:00:00Z' }, { id: 3, user_id: 'a', action: 'modificato', target: 's', label: 'impostazioni: CH CHF · piano AI attivo', at: '2026-11-04T09:00:00Z' }];
  assert.equal(auditKind(rows[2]), 'impostazioni'); assert.equal(auditFilter(rows, { kind: 'task' }).length, 1); assert.equal(auditFilter(rows, { user: 'a' }).length, 2); assert.equal(auditFilter(rows, { action: 'eliminato' })[0].id, 2);
  const g = auditGroups(rows); assert.deepEqual(g.map((x) => x.day), ['2026-11-05', '2026-11-04']); assert.equal(g[0].rows[0].id, 2);
});
test('csv e esportazione', () => {
  assert.equal(csvCell('a;b'), '"a;b"'); assert.equal(csvCell('di "x"'), '"di ""x"""'); assert.equal(csvCell(null), '');
  assert.equal(toCsv(['a', 'b'], [{ a: 1, b: 'x;y' }]), 'a;b\n1;"x;y"');
  const b = exportBundle({ team: 'Rossi Srl', at: '2026-11-05', pages: [{ title: 'Idee', text: 'testo' }], tasks: [{ title: 'T', status: 'todo' }], meetings: [{ title: 'Avvio', day: '2026-11-01', time: '10:00', minutes: null }], clients: [], docs: [] });
  assert.equal(b.files.length, 4); assert.match(b.files[0].content, /# Rossi Srl[\s\S]*### Idee[\s\S]*### Avvio · 2026-11-01 10:00\n\(senza verbale\)/); assert.match(b.files[1].content, /^title;status/);
});
test('ricerca globale', () => {
  const items = [{ kind: 'task', id: '1', title: 'Offerta Bianchi', text: 'preparare il preventivo', tab: 'task' }, { kind: 'client', id: '2', title: 'Bianchi Srl', text: 'Via Roma 1, Milano', tab: 'clienti' }, { kind: 'page', id: '3', title: 'Verbale', text: 'Si è parlato dell\'offerta di Bianchi e del budget', tab: 'pagine' }];
  const r = searchItems('bianchi offerta', items); assert.deepEqual(r.map((x) => x.id), ['1', '3']);
  assert.equal(searchItems('è', items).length, 0); assert.equal(searchItems('PREVENTIVO', items)[0].id, '1');
  assert.deepEqual(words('Città, Milano!'), ['citta', 'milano']);
  assert.match(searchItems('budget', items)[0].snippet, /budget/);
  assert.equal(searchItems('inesistente', items).length, 0);
});
