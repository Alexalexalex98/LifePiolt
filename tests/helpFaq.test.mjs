import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FAQ, FAQ_COUNT, matchFaq, faqTokens } from '../src/lib/helpFaq.ts';

test('guida ampia: voci e domande-tipo', () => {
  assert.ok(FAQ.length >= 100, `solo ${FAQ.length} voci`);
  assert.ok(FAQ_COUNT >= 450, `solo ${FAQ_COUNT} domande`);
  assert.equal(new Set(FAQ.map((f) => f.id)).size, FAQ.length);
  for (const f of FAQ) { assert.ok(f.answer.length > 40, f.id); for (const q of f.questions) assert.ok(faqTokens(q).length >= 2, `domanda troppo corta: «${q}»`); }
});
test('ogni pagina indicata esiste davvero nell\'app', () => {
  const pages = new Set(fs.readdirSync(new URL('../src/app/(tabs)/', import.meta.url)).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, '')));
  for (const f of FAQ) if (f.page) assert.ok(pages.has(f.page), `${f.id}: pagina inesistente «${f.page}»`);
});
test('ogni domanda del corpus porta alla propria risposta', () => {
  const bad = [];
  for (const f of FAQ) for (const q of f.questions) { const h = matchFaq(q); if (!h || h.faq.id !== f.id) bad.push(`«${q}» (${f.id}) -> ${h ? h.faq.id + ' «' + h.question + '»' : 'nessuna'}`); }
  assert.equal(bad.length, 0, '\n' + bad.slice(0, 40).join('\n'));
});
test('varianti naturali', () => {
  const id = (t) => matchFaq(t)?.faq.answer.slice(0, 30) ?? null;
  const saved = matchFaq('Dove vedo i post salvati?').faq;
  assert.equal(saved.page, 'savedPosts'); assert.match(saved.answer, /Post salvati/);
  assert.equal(matchFaq('dove trovo i post che ho salvato').faq.id, saved.id);
  assert.equal(matchFaq('dov è la ricerca').faq.page, 'searchPage');
  assert.equal(matchFaq('come cambio lingua').faq.page, 'settings');
  assert.equal(matchFaq('come faccio a ritirare i soldi').faq.page, 'withdraw');
  assert.equal(matchFaq('dove vedo cosa ho pagato').faq.page, 'myServices');
  assert.ok(id('Dove sono le notifiche'));
});
test('domande fuori tema: nessuna risposta inventata', () => {
  assert.equal(matchFaq('qual è la capitale della francia'), null);
  assert.equal(matchFaq('che tempo farà domani'), null);
  assert.equal(matchFaq('raccontami una barzelletta'), null);
});

test('frasi più lunghe con altre parole: vince la voce con più parole in comune', () => {
  assert.equal(matchFaq('dove vedo chi ha pagato il mio seminario').faq.page, 'seminarPage');
  assert.equal(matchFaq('scusa dove posso trovare tutti i post che ho salvato').faq.page, 'savedPosts');
});
