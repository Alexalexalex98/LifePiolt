import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlaceSearch, rankInApp, planPlaceSearch, externalSearchUrl, PLACE_CATEGORIES } from '../src/lib/findPlace.ts';

const cat = (id) => PLACE_CATEGORIES.find((c) => c.id === id);
const provs = [
  { name: 'Dr. Rossi', role: 'Dentista', rating: 4.8, price: 90 },
  { name: 'Dr. Bianchi', role: 'Dentista', rating: 4.1, price: 70 },
  { name: 'Anna Verdi', role: 'Psicologa', rating: 4.9, price: 80 },
  { name: 'Nuovo', role: 'Dentista', rating: 0 },
];

test('riconosce le richieste di prenotazione', () => {
  assert.equal(detectPlaceSearch('Devo prenotare un dentista')?.id, 'dentista');
  assert.equal(detectPlaceSearch('trovami una pizzeria per stasera')?.id, 'pizzeria');
  assert.equal(detectPlaceSearch('Cerco un buon medico vicino')?.id, 'medico');
  assert.equal(detectPlaceSearch('Prenota un tavolo per due')?.id, 'ristorante');
});
test('non scambia task e note per ricerche', () => {
  assert.equal(detectPlaceSearch('Aggiungi task chiamare il dentista'), null);
  assert.equal(detectPlaceSearch('ricordami di prenotare il dentista'), null);
  assert.equal(detectPlaceSearch('Cosa devo fare adesso?'), null);
});
test('classifica in app per voto e ignora altre categorie', () => {
  assert.deepEqual(rankInApp(cat('dentista'), provs).map((p) => p.name), ['Dr. Rossi', 'Dr. Bianchi', 'Nuovo']);
});
test('piano: in app se c\'è qualcuno abbastanza buono', () => {
  const p = planPlaceSearch(cat('dentista'), provs);
  assert.equal(p.kind, 'in-app');
  assert.deepEqual(p.best.map((x) => x.name), ['Dr. Rossi']);
  assert.deepEqual(p.others.map((x) => x.name), ['Dr. Bianchi', 'Nuovo']);
});
test('piano: fuori app se nessuno è abbastanza buono o non ce ne sono', () => {
  assert.equal(planPlaceSearch(cat('dentista'), provs, 4.9).kind, 'external');
  const none = planPlaceSearch(cat('pizzeria'), provs);
  assert.equal(none.kind, 'external');
  assert.match(none.url, /maps\/search\/pizzeria%20vicino%20a%20me/);
  assert.equal(externalSearchUrl(cat('medico')).startsWith('https://'), true);
});
