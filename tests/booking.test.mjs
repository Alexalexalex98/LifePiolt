import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/lib/booking.ts';
import * as R from '../src/lib/relevance.ts';

const H = 3600000;
test('disdetta entro 24 ore prima, riprogrammare sempre prima dell\'inizio', () => {
  const start = 100 * H;
  assert.equal(B.canCancel(start, 70 * H), true);
  assert.equal(B.canCancel(start, 76 * H), true); // esattamente 24 ore prima
  assert.equal(B.canCancel(start, 77 * H), false);
  assert.equal(B.canReschedule({ status: 'enrolled', startsAt: start }, 90 * H), true);
  assert.equal(B.canReschedule({ status: 'enrolled', startsAt: start }, 101 * H), false);
  assert.equal(B.canReschedule({ status: 'attended', startsAt: start }, 1), false);
});
test('partecipanti: riepilogo e visibilità solo per chi organizza', () => {
  const s = B.summarizeParticipants([{ name: 'a', paid: 25, paidAt: 1 }, { name: 'b', paid: 0, paidAt: 2 }, { name: 'c', paid: 25, paidAt: 3 }]);
  assert.deepEqual(s, { count: 3, paidCount: 2, totalPaid: 50, free: 1 });
  assert.equal(B.canSeeParticipants('Anna', 'Anna'), true);
  assert.equal(B.canSeeParticipants('Bea', 'Anna'), false);
  assert.equal(B.canSeeParticipants('', ''), false);
});
test('si paga prima: saldo insufficiente blocca la prenotazione', () => {
  assert.ok(B.bookingPayBlock(25, 10));
  assert.equal(B.bookingPayBlock(25, 25), null);
  assert.equal(B.bookingPayBlock(0, 0), null);
});
test('temi dai testi', () => {
  assert.ok(R.themesOf('Scarpe da corsa leggere').includes('scarpe'));
  assert.ok(R.themesOf('Scarpe da corsa leggere').includes('corsa'));
  assert.ok(R.themesOf('Dalla camminata ai 5 km').includes('corsa'));
  assert.ok(R.themesOf('Sedute di psicologia').includes('mente'));
  assert.deepEqual(R.themesOf('Quaderno agenda 2027').includes('studio'), true);
});
test('chi ama le scarpe vede più scarpe che sedute con la psicologa', () => {
  const w = R.addSignal(undefined, 'scarpe', R.SIGNAL.interest);
  const items = [
    { kind: 'servizio', text: 'Psicologa: sedute individuali' },
    { kind: 'prodotto', text: 'Scarpe da città in pelle' },
    { kind: 'seminario', text: 'Organizzare il budget familiare' },
  ];
  assert.equal(R.rankMixed(items, w)[0].kind, 'prodotto');
});
test('chi ama le scarpe da corsa vede anche i corsi di corsa', () => {
  const w = R.addSignal(R.addSignal(undefined, 'scarpe da corsa', R.SIGNAL.interest), 'scarpe da corsa', R.SIGNAL.buy);
  const items = [
    { kind: 'servizio', text: 'Psicologa: sedute individuali' },
    { kind: 'seminario', text: 'Correre il primo 10km senza infortuni' },
    { kind: 'prodotto', text: 'Scarpe da corsa leggere' },
    { kind: 'prodotto', text: 'Scarpe eleganti' },
    { kind: 'club', text: 'Dalla camminata ai 5 km' },
  ];
  const out = R.rankMixed(items, w).map((x) => x.text);
  assert.ok(out.indexOf('Scarpe da corsa leggere') < out.indexOf('Psicologa: sedute individuali'));
  assert.ok(out.indexOf('Correre il primo 10km senza infortuni') < out.indexOf('Psicologa: sedute individuali'));
});
test('senza interessi resta l\'ordine di partenza', () => {
  const items = [{ kind: 'a', text: 'x' }, { kind: 'b', text: 'y' }];
  assert.deepEqual(R.rankMixed(items, undefined).map((i) => i.text), ['x', 'y']);
});

test('proposta di servizio in chat: stati e validazione', () => {
  const o = { startsAt: 100 * H };
  assert.equal(B.offerState(o, 'Anna', 'Io', 50 * H), 'prenotabile');
  assert.equal(B.offerState(o, 'Io', 'Io', 50 * H), 'tua');
  assert.equal(B.offerState(o, 'Anna', 'Io', 101 * H), 'scaduta');
  assert.equal(B.offerState({ ...o, booked: { by: 'Io' } }, 'Anna', 'Io', 50 * H), 'prenotata');
  assert.equal(B.offerError({ title: 'Seduta', price: 80, startsAt: 100 * H, durationMin: 50 }, 50 * H), null);
  assert.ok(B.offerError({ title: ' ', price: 80, startsAt: 100 * H, durationMin: 50 }, 50 * H));
  assert.ok(B.offerError({ title: 'x', price: -1, startsAt: 100 * H, durationMin: 50 }, 50 * H));
  assert.ok(B.offerError({ title: 'x', price: 5, startsAt: 10 * H, durationMin: 50 }, 50 * H));
});
