import test from 'node:test';
import assert from 'node:assert/strict';
import { DOC_TYPES, docType, proofread, changeTone, slidesFromText, slidesFromProject, slidesHtml, docHtml } from '../src/lib/writing.ts';

const O = { tone: 'formale', today: '2026-11-05', from: 'Alex Rossi' };
test('ogni modello produce un testo e lascia [campi] da completare', () => {
  assert.ok(DOC_TYPES.length >= 10);
  for (const d of DOC_TYPES) { const t = d.build({}, O); assert.ok(t.length > 20, d.id); assert.match(t, /\[/, d.id + ' campi vuoti'); }
  const e = docType('email').build({ a: 'Bianchi', oggetto: 'Preventivo', testo: 'Allego il preventivo.' }, O);
  assert.match(e, /^Oggetto: Preventivo/); assert.match(e, /Gentile Bianchi,/); assert.match(e, /Cordiali saluti\nAlex Rossi/);
  assert.match(docType('email').build({ a: 'Marco', testo: 'x' }, { ...O, tone: 'diretto' }), /Ciao Marco,/);
});
test('nota spese somma le voci', () => {
  const t = docType('spese').build({ motivo: 'Trasferta', voci: 'Treno - 45,50\nPranzo - 22\nTaxi 10.5', valuta: 'chf' }, O);
  assert.match(t, /Totale: 78[.,]00 CHF/); assert.match(t, /- Treno - 45,50/);
});
test('ferie con date leggibili', () => { assert.match(docType('ferie').build({ a: 'Giulia', dal: '2026-12-24', al: '2026-12-31' }, O), /dal 24\/12\/2026 al 31\/12\/2026/); });
test('correzione di refusi e punteggiatura', () => {
  const r = proofread('perchè non vieni ?  ciao,come stai. sopratutto un pò di più');
  assert.match(r.text, /Perché non vieni\?/); assert.match(r.text, /Ciao, come stai\. Soprattutto un po' di più/); assert.ok(r.fixes.length >= 4);
  assert.deepEqual(proofread('Tutto a posto.').fixes, []);
});
test('cambio di tono', () => {
  assert.equal(changeTone('Ciao Marco,\nti mando il file.\nA presto', 'formale'), 'Gentile Marco,\nle invio il file.\nCordiali saluti');
  assert.match(changeTone('Gentile Anna,\ngrazie\nCordiali saluti', 'diretto'), /Ciao Anna,[\s\S]*Grazie e a presto/);
});
test('presentazione da testo e da progetto', () => {
  const s = slidesFromText('# Obiettivi\n- Crescere\n- Assumere\nRisultati:\nFatturato +10%\nNOTE FINALI\nGrazie');
  assert.deepEqual(s.map((x) => x.title), ['Obiettivi', 'Risultati', 'Note finali']); assert.deepEqual(s[0].bullets, ['Crescere', 'Assumere']);
  const long = slidesFromText('Titolo:\n' + Array.from({ length: 9 }, (_, i) => `- punto ${i}`).join('\n')); assert.equal(long.length, 2); assert.match(long[1].title, /segue/);
  const p = slidesFromProject({ title: 'Sito', goal: 'Online a dicembre', progress: 60, due: '2026-12-15', done: ['Testi'], late: ['Foto'], next: ['Pubblicare'], hours: 40 });
  assert.deepEqual(p.map((x) => x.title), ['Sito', 'Cosa è stato fatto', 'Cosa è in ritardo', 'Prossimi passi']); assert.match(p[0].bullets[1], /60% · scadenza 15\/12\/2026/);
  const h = slidesHtml(p, { company: 'Rossi <Srl>', address: '', email: '', phone: '', vat: '', footer: '', color: '#0F766E', logo: null }, 'Sito'); assert.match(h, /Rossi &lt;Srl&gt;/); assert.equal((h.match(/<section/g) ?? []).length, 4);
  assert.match(docHtml('Ciao\n- uno\n- due', { company: 'X', address: '', email: '', phone: '', vat: '', footer: 'Riservato', color: '#0F766E' }), /<ul><li>uno<\/li>/);
});

import { linesToBlocks } from '../src/lib/blocksFromText.ts';
test('un testo diventa blocchi: sezioni, punti, testo', () => {
  const b = linesToBlocks('Verbale: Avvio\n2026-11-05 · 10:00\n\nDecisioni\n- Si parte lunedì (Giulia)\nDa fare\n- Testi · Giulia\nPresenti: A, B');
  assert.deepEqual(b.map((x) => x.t), ['p', 'p', 'h', 'bullet', 'h', 'bullet', 'p']); assert.equal(b[3].text, 'Si parte lunedì (Giulia)');
});
