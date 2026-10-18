import test from 'node:test';
import assert from 'node:assert/strict';
import { readStyle, styleHints, humanize } from '../src/lib/aiPersona.ts';

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
