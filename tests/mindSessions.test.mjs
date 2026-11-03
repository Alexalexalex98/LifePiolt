import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMS, SESSIONS, SESSION_BY_ID, sessionSeconds, sessionsOf, fit } from '../src/lib/mindSessions.ts';
test('programmi: ogni sessione esiste e ha fonti', () => {
  for (const p of PROGRAMS) { assert.ok(p.basedOn.length > 0, p.id); assert.equal(sessionsOf(p).length, p.sessions.length, p.id); }
  assert.equal(new Set(SESSIONS.map((s) => s.id)).size, SESSIONS.length);
});
test('la durata dichiarata è quella vera (±15%)', () => {
  for (const s of SESSIONS) { const d = sessionSeconds(s) / 60; assert.ok(d > s.minutes * 0.85 && d < s.minutes * 1.15, `${s.id}: ${d.toFixed(1)} vs ${s.minutes}`); assert.ok(s.beats.some((b) => b.say), s.id); assert.ok(s.why.length > 20, s.id); }
});
test('fit scala solo le pause', () => {
  const out = fit([{ say: 'ciao' }, { pause: 10 }], 1); assert.equal(out[0].say, 'ciao'); assert.ok(out[1].pause > 50);
});
test('le sessioni respiro hanno il ritmo del cerchio', () => { assert.ok(SESSION_BY_ID['a2-sospiro'].pace.hold1 === 1 && SESSION_BY_ID['m1-respiro'].pace.out === 6); });
