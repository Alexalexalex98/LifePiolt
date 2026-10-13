import test from 'node:test';
import assert from 'node:assert/strict';
import { verbsIn, wantsPlace, domainsIn } from '../src/lib/assistant/dictionary.ts';
import { detectPlace, detectPlaceSearch, planPlaceSearch, PLACE_CATEGORIES } from '../src/lib/findPlace.ts';

const id = (t) => detectPlace(t)?.cat.id ?? null;

test('verbi: radici e frasi', () => {
  assert.ok(verbsIn('Voglio ordinare una pizza').has('want') && verbsIn('Voglio ordinare una pizza').has('order'));
  assert.ok(verbsIn('prenotami un tavolo').has('book'));
  assert.ok(verbsIn('ho fame').has('eat'));
  assert.ok(verbsIn('cercami un idraulico').has('find'));
  assert.ok(verbsIn('manda 10 lp a Giulia').has('send'));
  assert.ok(verbsIn('sposta la riunione').has('change'));
});
test('luoghi: le richieste di tutti i giorni', () => {
  assert.equal(id('Voglio ordinare una pizza'), 'pizzeria');
  assert.equal(id('Ho voglia di sushi stasera'), 'sushi');
  assert.equal(id('ho fame'), 'ristorante');
  assert.equal(id('Mi serve un idraulico urgente'), 'idraulico');
  assert.equal(id('Devo prenotare il parrucchiere'), 'parrucchiere');
  assert.equal(id('Cerco un hotel a Lugano'), 'hotel');
  assert.equal(id('vorrei prenotare un taxi'), 'taxi');
  assert.equal(id('Dov\'è la farmacia più vicina?'), 'farmacia');
  assert.equal(id('Dove posso fare un aperitivo?'), 'bar');
  assert.equal(id('Voglio andare in palestra'), 'palestra');
  assert.equal(id('Devo fare il pieno'), 'benzinaio');
  assert.equal(id('Trovami un meccanico per il tagliando'), 'meccanico');
});
test('ordinare = consegna a domicilio', () => {
  assert.equal(detectPlace('Voglio ordinare una pizza').order, true);
  assert.equal(detectPlace('Cerco una pizzeria').order, false);
  const plan = planPlaceSearch(PLACE_CATEGORIES.find((c) => c.id === 'pizzeria'), [], 4.3, true);
  assert.match(decodeURIComponent(plan.url), /pizza consegna a domicilio vicino a me/);
});
test('niente falsi positivi con task, note, soldi, chiamate', () => {
  assert.equal(detectPlace('Aggiungi task chiamare il dentista'), null);
  assert.equal(detectPlace('Ricordami di prenotare il dentista'), null);
  assert.equal(detectPlace('Devo chiamare il dentista'), null);
  assert.equal(detectPlace('Voglio vedere le spese del mese'), null);
  assert.equal(detectPlace('Ho speso 12 franchi al supermercato'), null);
  assert.equal(detectPlace('Aggiungi riunione al piano domani alle 15'), null);
  assert.equal(detectPlace('Cosa devo fare adesso?'), null);
  assert.equal(detectPlace('Come sto di salute?'), null);
  assert.equal(detectPlaceSearch('Devo prenotare un dentista')?.id, 'dentista');
});
test('argomenti dell\'app dal contesto', () => {
  assert.equal(domainsIn('quanti soldi ho risparmiato')[0].id, 'finanze');
  assert.equal(domainsIn('ho dormito poco e ho il battito alto')[0].id, 'salute');
  assert.equal(domainsIn('voglio vedere il mio saldo lifepoints')[0].id, 'lifepoints');
  assert.deepEqual(domainsIn('blablabla'), []);
});
test('desiderio senza luogo: nessuna ricerca', () => {
  assert.equal(wantsPlace('voglio un gelato').find, true);
  assert.equal(wantsPlace('il cielo è blu').find, false);
});
