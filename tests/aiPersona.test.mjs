import test from 'node:test';
import assert from 'node:assert/strict';
import { readStyle, styleHints, humanize, tidy, toBlocks, inlineBold, HONESTY, guardClaims } from '../src/lib/aiPersona.ts';

test('stile di chi scrive: lei/tu, lunghezza, tono', () => {
  assert.equal(readStyle(['Buongiorno, potrebbe aiutarmi con una scadenza?']).formal, true);
  assert.equal(readStyle(['ciao dimmi cosa devo fare']).formal, false);
  assert.equal(readStyle(['ok', 'si', 'dimmi']).length, 'brevissima');
  assert.equal(readStyle(['vorrei capire meglio come organizzare la settimana con tutte le cose che ho da fare tra lavoro e famiglia e anche sport']).length, 'media');
  assert.equal(readStyle(['ciao come va', 'cosa faccio oggi', 'dimmi']).casual, true);
  assert.equal(readStyle(['Perfetto grazie mille!']).warm, true);
  assert.equal(readStyle([]).length, 'breve');
});
test('istruzioni al modello', () => {
  const h = styleHints(['Buongiorno, potrebbe dirmi cosa scade oggi?']);
  assert.match(h, /lei/); assert.match(h, /niente emoji/); assert.match(h, /stessa lingua/);
  assert.match(styleHints(['ok']), /brevissimi/);
});
test('si tolgono i segni da chat-bot', () => {
  const raw = '* **Stato d\'animo:** Hai impostato l\'umore su **Felice**.\n* **Da fare adesso:**\n  * **Energia Ticino SA:** scade oggi (*Soldi*).\n\n\n\n## Titolo\n`codice` resta';
  const out = humanize(raw);
  assert.ok(!out.includes('**') && !out.includes('##'));
  assert.match(out, /^– Stato d'animo: Hai impostato l'umore su Felice\./);
  assert.match(out, /Energia Ticino SA: scade oggi \(Soldi\)/);
  assert.ok(!out.includes('\n\n\n'));
  assert.equal(humanize('2 * 3 = 6'), '2 * 3 = 6');
});

test('tidy: tiene il grassetto e rende leggibili gli elenchi', () => {
  const out = tidy('## Dove sei carente\n* **Proteine:** poche\n- Fibre basse\n\n\n\nFine');
  assert.match(out, /^\*\*Dove sei carente\*\*/);
  assert.match(out, /• \*\*Proteine:\*\* poche/);
  assert.match(out, /• Fibre basse/);
  assert.ok(!out.includes('\n\n\n'));
});

test('blocchi di visualizzazione: titoli, elenchi, numerati, paragrafi', () => {
  const b = toBlocks('Dove sei carente:\n• Proteine: poche\n  • dettaglio\n1. Prima cosa\n\nUna frase normale.');
  assert.deepEqual(b.map((x) => x.kind), ['h', 'li', 'li', 'li', 'p', 'p']);
  assert.equal(b[0].text, 'Dove sei carente');
  assert.equal(b[2].indent, 1);
  assert.equal(b[3].n, '1');
  assert.deepEqual(inlineBold('ho **500 ml** di acqua'), [{ t: 'ho ', b: false }, { t: '500 ml', b: true }, { t: ' di acqua', b: false }]);
});

test('onestà: le regole ci sono e le finte azioni vengono smentite', () => {
  assert.match(HONESTY, /non inventare mai/i);
  assert.match(HONESTY, /posizione/i);
  const g = guardClaims('Ti ho mandato il percorso esatto sul telefono, lo trovi nelle notifiche.');
  assert.equal(g.flagged, true);
  assert.match(g.text, /non ho inviato né eseguito nessuna azione/);
  assert.equal(guardClaims('Non ho questo dato: usa un\'app di mappe.').flagged, false);
  assert.equal(guardClaims('Ho mandato un messaggio a Marco').flagged, true);
});

test('inlineBold: i link restano con il solo testo breve e l\'indirizzo a parte', () => {
  assert.deepEqual(inlineBold('vedi [ansa.it](https://www.ansa.it/a?x=1) e **ok**'), [{ t: 'vedi ', b: false }, { t: 'ansa.it', b: false, href: 'https://www.ansa.it/a?x=1' }, { t: ' e ', b: false }, { t: 'ok', b: true }]);
});
