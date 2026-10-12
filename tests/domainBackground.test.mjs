import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, detectClockChange, emptyState, INTERVAL, HOUR, pruneTrash, pruneNotifications, TRASH_DAYS, IOS_WARN } from '../src/lib/backgroundPlan.ts';

const NOW = Date.UTC(2026, 9, 12, 8, 0, 0);
const base = (over = {}) => ({ now: NOW, state: emptyState(), tz: 'Europe/Zurich', offsetMin: -120, scheduledCount: 10, permission: true, source: 'background', platform: 'android', ...over });
const fresh = (ago = 0) => ({ lastRun: { reminders: NOW - ago, bills: NOW - ago, briefings: NOW - ago, cleanup: NOW - ago, habits: NOW - ago }, tz: 'Europe/Zurich', offsetMin: -120 });

test('primo avvio: tutto da eseguire e nessun cambio orologio', () => {
  const d = decide(base());
  assert.deepEqual(d.run.sort(), ['bills', 'briefings', 'cleanup', 'reminders']);
  assert.equal(d.clock, null);
  assert.equal(d.next.tz, 'Europe/Zurich');
  assert.equal(d.next.lastRun.reminders, NOW);
});

test('niente da fare se e\' tutto recente', () => {
  const d = decide(base({ state: fresh(10 * 60000) }));
  assert.deepEqual(d.run, []);
  assert.deepEqual(d.next.lastRun, fresh(10 * 60000).lastRun);
});

test('scadenze per compito: promemoria e bollette 6 h, briefing 12 h, pulizia 24 h', () => {
  let d = decide(base({ state: fresh(7 * HOUR) }));
  assert.deepEqual(d.run.sort(), ['bills', 'reminders']);
  d = decide(base({ state: fresh(13 * HOUR) }));
  assert.deepEqual(d.run.sort(), ['bills', 'briefings', 'reminders']);
  d = decide(base({ state: fresh(25 * HOUR) }));
  assert.ok(d.run.includes('cleanup'));
  assert.equal(INTERVAL.cleanup, 24 * HOUR);
});

test('cambio di fuso orario e di ora legale riprogrammano tutte le notifiche subito', () => {
  assert.equal(detectClockChange({ tz: 'Europe/Zurich', offsetMin: -120 }, { tz: 'America/New_York', offsetMin: 240 }), 'timezone');
  assert.equal(detectClockChange({ tz: 'Europe/Zurich', offsetMin: -120 }, { tz: 'Europe/Zurich', offsetMin: -60 }), 'dst');
  assert.equal(detectClockChange({ tz: 'Europe/Zurich', offsetMin: -120 }, { tz: 'Europe/Zurich', offsetMin: -120 }), null);
  assert.equal(detectClockChange({ tz: null, offsetMin: null }, { tz: 'X', offsetMin: 0 }), null);
  let d = decide(base({ state: fresh(60000), tz: 'Asia/Tokyo', offsetMin: -540 }));
  assert.equal(d.clock, 'timezone');
  assert.deepEqual(d.run.sort(), ['bills', 'briefings', 'reminders']);
  assert.match(d.reasons.reminders, /fuso/);
  d = decide(base({ state: fresh(60000), offsetMin: -60 }));
  assert.equal(d.clock, 'dst');
  assert.match(d.reasons.bills, /ora legale/);
  assert.equal(d.next.offsetMin, -60);
});

test('riavvio del telefono: ricalcola i compiti sulle notifiche', () => {
  const d = decide(base({ state: fresh(60000), source: 'boot' }));
  assert.deepEqual(d.run.sort(), ['bills', 'briefings', 'reminders']);
  assert.match(d.reasons.reminders, /riavvio/);
});

test('nessuna notifica programmata: ricalcola i promemoria solo se l\'ultima volta e\' passato un po\'', () => {
  assert.ok(decide(base({ state: fresh(HOUR), scheduledCount: 0 })).run.includes('reminders'));
  assert.ok(!decide(base({ state: fresh(60000), scheduledCount: 0 })).run.includes('reminders'));
  assert.ok(!decide(base({ state: fresh(HOUR), scheduledCount: null })).run.includes('reminders'));
});

test('permesso negato e web: nessuna programmazione ma la pulizia continua', () => {
  let d = decide(base({ permission: false }));
  assert.deepEqual(d.run, ['cleanup']);
  assert.ok(d.notes.length);
  d = decide(base({ platform: 'web' }));
  assert.deepEqual(d.run, ['cleanup']);
});

test('iOS vicino al tetto di 64 notifiche: avvisa; abitudini solo se abilitate e ogni 15 minuti', () => {
  const d = decide(base({ platform: 'ios', scheduledCount: IOS_WARN, state: fresh(60000) }));
  assert.ok(d.notes.some((n) => /64/.test(n)));
  assert.ok(!decide(base({ state: fresh(HOUR) })).run.includes('habits'));
  assert.ok(decide(base({ state: fresh(HOUR), habitsEnabled: true })).run.includes('habits'));
  assert.ok(!decide(base({ state: fresh(5 * 60000), habitsEnabled: true })).run.includes('habits'));
});

test('pulizia: cestino a 30 giorni e notifiche in-app lette vecchie', () => {
  const day = 86400000;
  const trash = [{ at: NOW - 29 * day, k: 'a' }, { at: NOW - 31 * day, k: 'b' }, { at: NOW, k: 'c' }];
  assert.deepEqual(pruneTrash(trash, NOW).map((x) => x.k), ['a', 'c']);
  assert.equal(TRASH_DAYS, 30);
  assert.deepEqual(pruneTrash(undefined, NOW), []);
  const n = [{ id: NOW - 90 * day, read: true }, { id: NOW - 90 * day + 1, read: false }, { id: NOW - 5 * day, read: true }, { id: 5, read: true }];
  const out = pruneNotifications(n, NOW);
  assert.deepEqual(out.map((x) => x.id), [NOW - 90 * day + 1, NOW - 5 * day, 5]);
  const many = Array.from({ length: 300 }, (_, i) => ({ id: NOW - i, read: false }));
  assert.equal(pruneNotifications(many, NOW).length, 200);
});
