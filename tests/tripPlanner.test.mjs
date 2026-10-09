import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDestinations, buildItinerary, tripEvents, addDaysKey, nightsBetween, suggestBudget, estimateCost, destMeta } from '../src/lib/tripPlanner.ts';

const base = { interests: [], recent: [], budget: 1500, nights: 3, month: 6 };

test('il ranking cambia con gli interessi', () => {
  const a = rankDestinations({ ...base, interests: ['natura', 'sport', 'relax'] });
  const b = rankDestinations({ ...base, interests: ['musei', 'libri', 'architettura'] });
  assert.notEqual(a[0].id, b[0].id);
  assert.ok(a[0].reasons.some((r) => r.t.startsWith('Perché ti piace')));
});
test('il ranking cambia con il budget', () => {
  const rich = rankDestinations({ ...base, interests: ['musei'], budget: 6000, nights: 5 });
  const poor = rankDestinations({ ...base, interests: ['musei'], budget: 500, nights: 5 });
  assert.ok(rich.find((r) => r.id === 'newyork').fits);
  assert.ok(!poor.find((r) => r.id === 'newyork').fits);
  assert.ok(poor[0].cost <= rich.find((r) => r.id === poor[0].id).cost + 1);
  assert.ok(poor.slice(0, 3).every((r) => r.fits || poor.every((x) => !x.fits)));
});
test('ricerche recenti e periodo producono motivi', () => {
  const r = rankDestinations({ ...base, recent: [{ q: 'voli Lisbona' }, { q: 'hotel a Parigi' }] });
  const p = r.find((x) => x.id === 'parigi');
  assert.ok(p.reasons.some((x) => x.t === 'Hai cercato {0} di recente' && x.a[0] === 'Parigi'));
  assert.ok(r.find((x) => x.id === 'lugano').reasons.some((x) => x.t === 'Periodo adatto'));
  const lug = r.find((x) => x.id === 'lugano');
  assert.ok(lug.reasons.some((x) => x.t.startsWith('Rientra nel budget')));
});
test('la città di partenza è esclusa', () => {
  assert.ok(!rankDestinations({ ...base, from: 'Zurigo' }).some((r) => r.id === 'zurigo'));
});
test('itinerario: 2-4 attività al giorno, nel budget, per interesse', () => {
  const it = buildItinerary({ destination: 'parigi', nights: 4, interests: ['caffe', 'architettura'], budget: 2000 });
  assert.equal(it.days.length, 5);
  for (const d of it.days) assert.ok(d.items.length >= 2 && d.items.length <= 4);
  assert.ok(it.fits && it.total <= 2000);
  assert.ok(it.days.flatMap((d) => d.items).some((i) => /caffetteria|bar|pasticceria/i.test(i.title)));
  assert.ok(it.days.flatMap((d) => d.items).some((i) => /palazz|cattedral|edific|architettura/i.test(i.title)));
  assert.ok(!JSON.stringify(it).includes('{city}'));
  assert.equal(it.total, it.flight + it.lodging.total + it.food + it.activities);
});
test('budget stretto: alternative gratuite e dichiarazione', () => {
  const it = buildItinerary({ destination: 'newyork', nights: 5, interests: ['musei', 'musica'], budget: 900 });
  assert.ok(!it.fits);
  assert.ok(it.notes.some((n) => n.t.startsWith('Il viaggio supera il budget')));
  assert.ok(it.notes.some((n) => n.t.startsWith('Alternativa')));
  const ok = buildItinerary({ destination: 'lucerna', nights: 3, interests: ['cucina', 'musei', 'musica'], budget: 700 });
  assert.ok(ok.fits && ok.total <= 700);
});
test('più budget, più comfort', () => {
  const lo = buildItinerary({ destination: 'berna', nights: 3, interests: ['storia'], budget: 800 });
  const hi = buildItinerary({ destination: 'berna', nights: 3, interests: ['storia'], budget: 5000 });
  assert.ok(['budget', 'standard'].includes(lo.level) && hi.level === 'comfort');
});
test('eventi di calendario con ref e date consecutive', () => {
  const it = buildItinerary({ destination: 'lugano', nights: 2, interests: ['natura'], budget: 1500 });
  const ev = tripEvents(it, '2026-12-30');
  assert.ok(ev.every((e) => e.ref === 'trip:lugano-2026-12-30'));
  assert.equal(ev[0].day, '2026-12-30');
  assert.equal(ev.at(-1).day, '2027-01-01');
  assert.equal(addDaysKey('2026-02-27', 2), '2026-03-01');
  assert.equal(nightsBetween('2026-12-30', '2027-01-02'), 3);
});
test('budget suggerito: fondo emergenza e stima', () => {
  const s = suggestBudget({ balance: 5000, avgNet: 400, avgExpense: 2000, emergencySaved: 1000, monthsUntil: 2 });
  assert.equal(s.efTarget, 6000); assert.ok(!s.efOk);
  assert.ok(s.amount > 0 && s.amount <= 5000 * 0.15 + 400 * 2 * 0.8 + 5);
  assert.equal(suggestBudget({ balance: -100, avgNet: -50, avgExpense: 0, emergencySaved: 0 }).amount, 0);
});
