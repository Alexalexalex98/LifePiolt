import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMS, EXERCISES, EX, PARTNER_GYMS } from '../src/lib/fitness/data.ts';
import { recommend, trainingDays, nextSessionIndex, weekView, sessionMinutes, stats, matchScore } from '../src/lib/fitness/plan.ts';
import { FOODS, searchFoods, macrosFor, sumMacros, dailyTarget } from '../src/lib/fitness/nutrition.ts';
import { startSub, premiumState, hasAccess, renewIfDue, checkIn, visitsByGym, daysLeft, PREMIUM_PRICE_LP, passPayload } from '../src/lib/fitness/premium.ts';

test('dati coerenti: ogni passo usa un esercizio esistente, ID unici', () => {
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  assert.equal(new Set(PROGRAMS.map((p) => p.id)).size, PROGRAMS.length);
  for (const p of PROGRAMS) for (const s of p.sessions) for (const st of s.steps) { assert.ok(EX(st.ex), `${p.id}: ${st.ex}`); assert.ok(st.reps || st.secs, `${p.id} ${st.ex}`); }
  assert.ok(PROGRAMS.length >= 14); assert.ok(PARTNER_GYMS.length >= 10);
});
test('consigli del trainer: obiettivo, luogo e livello pesano', () => {
  const r = recommend({ goal: 'massa', level: 'intermedio', place: 'palestra', days: 4, minutes: 60 });
  assert.equal(r[0].id, 'massa');
  const c = recommend({ goal: 'resistenza', level: 'principiante', place: 'casa', days: 3, minutes: 30 });
  assert.equal(c[0].id, 'corsa-5k');
  const m = recommend({ goal: 'mobilità', level: 'principiante', place: 'casa', days: 5, minutes: 15 });
  assert.equal(m[0].id, 'mobilita');
  assert.ok(matchScore(PROGRAMS.find((p) => p.id === 'massa'), { goal: 'massa', level: 'avanzato', place: 'casa', days: 2, minutes: 30 }) < 90);
});
test('settimana: giorni, sessioni in ordine, fatte', () => {
  assert.deepEqual(trainingDays(3), [0, 2, 4]); assert.equal(trainingDays(10).length, 7);
  const p = PROGRAMS.find((x) => x.id === 'massa');
  assert.equal(nextSessionIndex(p, []), 0);
  assert.equal(nextSessionIndex(p, [{ id: 'a', date: '2026-10-12', programId: 'massa', session: 1, minutes: 50, sets: 14 }]), 2);
  assert.equal(nextSessionIndex(p, [{ id: 'a', date: '2026-10-12', programId: 'massa', session: 3, minutes: 50, sets: 14 }]), 0);
  const w = weekView(p, { days: 4 }, [{ id: 'a', date: '2026-10-13', programId: 'massa', session: 0, minutes: 40, sets: 10 }], new Date(2026, 9, 14));
  assert.equal(w.length, 7); assert.equal(w.filter((d) => d.planned).length, 4); assert.equal(w.find((d) => d.date === '2026-10-13').done, true);
  assert.ok(sessionMinutes(p, 0) >= 20 && sessionMinutes(p, 0) <= 90);
});
test('statistiche e serie di giorni', () => {
  const h = ['2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => ({ id: 'x' + i, date: d, programId: 'p', session: 0, minutes: 30, sets: 9 }));
  const s = stats(h, new Date(2026, 9, 14)); assert.equal(s.streakDays, 3); assert.equal(s.week, 3); assert.equal(s.minutesWeek, 90);
  assert.equal(stats([], new Date()).streakDays, 0);
});
test('calorie: ricerca, porzioni, fabbisogno', () => {
  assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
  assert.equal(searchFoods('spaghetti')[0].id, 'pasta'); assert.ok(searchFoods('pizza').some((f) => f.id === 'pizza')); assert.deepEqual(searchFoods('x'), []);
  const pasta = FOODS.find((f) => f.id === 'pasta');
  assert.equal(macrosFor(pasta, 200).kcal, 316); assert.equal(macrosFor(pasta, 0).kcal, 0);
  assert.equal(sumMacros([macrosFor(pasta, 100), macrosFor(pasta, 100)]).kcal, 316);
  const t = dailyTarget({ sex: 'm', age: 30, weightKg: 75, heightCm: 178, activity: 'media', goal: 'mantenere' });
  assert.ok(t > 2300 && t < 2800, String(t));
  assert.ok(dailyTarget({ sex: 'f', age: 30, weightKg: 60, heightCm: 165, activity: 'bassa', goal: 'dimagrire' }) >= 1200);
  assert.ok(dailyTarget({ sex: 'm', age: 30, weightKg: 75, heightCm: 178, activity: 'media', goal: 'dimagrire' }) < t);
});
test('premium: stati, rinnovo, ingressi', () => {
  const D = 86400000, now = 1_800_000_000_000;
  assert.equal(PREMIUM_PRICE_LP, 30);
  const sub = startSub(now);
  assert.equal(premiumState(null, now), 'nessuno'); assert.equal(premiumState(sub, now + D), 'attivo'); assert.equal(premiumState({ ...sub, autoRenew: false }, now + D), 'in-scadenza');
  assert.equal(premiumState(sub, now + 31 * D), 'scaduto'); assert.equal(hasAccess({ ...sub, autoRenew: false }, now + D), true); assert.equal(daysLeft(sub, now + 25 * D), 5);
  assert.equal(renewIfDue(sub, now + 31 * D, 100).charged, 30); assert.equal(renewIfDue(sub, now + 31 * D, 10).ended, true);
  assert.equal(renewIfDue({ ...sub, autoRenew: false }, now + 31 * D, 100).ended, true); assert.equal(renewIfDue(sub, now + D, 0).charged, 0);
  assert.equal(checkIn(null, [], 'g1', now).ok, false);
  assert.equal(checkIn(sub, [], 'g1', now + 1000).ok, true);
  const v = [{ id: '1', gymId: 'g1', ts: now + 1000 }];
  assert.equal(checkIn(sub, v, 'g1', now + 5000).ok, false);
  const v2 = [...v, { id: '2', gymId: 'g2', ts: now + 2000 }];
  assert.equal(checkIn(sub, v2, 'g3', now + 6000).ok, false);
  assert.deepEqual(visitsByGym(v2, now, now + D), { g1: 1, g2: 1 });
  assert.ok(passPayload('Alex B.', sub, now).startsWith('lifepilot://gym-pass?u=Alex%20B.'));
});
