import test from 'node:test';
import assert from 'node:assert/strict';
import { periodOf, kpisFor, compare, delta, trend, anomalies, forecastNext, doneSeries, reportText, reportCsv, answer, workload, reportHtml, EMPTY_INPUT } from '../src/lib/reports.ts';

const T = (id, o = {}) => ({ id, team_id: 't', project: 'p', title: id, notes: '', assignee: 'u1', priority: 'normal', status: 'todo', due: null, est_min: null, parent: null, depends_on: [], recurrence: 'none', block_reason: '', created_by: 'u', created_at: '2026-10-01T09:00:00Z', ...o });
const TODAY = '2026-11-05'; // giovedì
test('periodi: settimana da lunedì, mese, trimestre, precedente', () => {
  assert.deepEqual([periodOf('week', 0, TODAY).from, periodOf('week', 0, TODAY).to], ['2026-11-02', '2026-11-08']);
  assert.equal(periodOf('week', -1, TODAY).from, '2026-10-26');
  const m = periodOf('month', 0, TODAY); assert.deepEqual([m.from, m.to, m.label], ['2026-11-01', '2026-11-30', 'novembre 2026']);
  assert.equal(periodOf('month', -1, TODAY).to, '2026-10-31');
  const q = periodOf('quarter', 0, TODAY); assert.deepEqual([q.from, q.to], ['2026-10-01', '2026-12-31']);
  assert.equal(periodOf('quarter', -1, TODAY).from, '2026-07-01');
});
test('indicatori dei task: chiusi, nei tempi, ritardi, giorni medi', () => {
  const tasks = [
    T('a', { status: 'done', done_at: '2026-11-03T10:00:00Z', due: '2026-11-04', created_at: '2026-11-01T10:00:00Z' }),
    T('b', { status: 'done', done_at: '2026-11-04T10:00:00Z', due: '2026-11-03', created_at: '2026-11-02T10:00:00Z' }),
    T('c', { due: '2026-11-01' }), T('d', { due: '2026-12-01' }), T('x', { status: 'done', done_at: '2026-09-01T10:00:00Z' }),
  ];
  const k = Object.fromEntries(kpisFor({ ...EMPTY_INPUT, tasks }, periodOf('month', 0, TODAY), TODAY).map((x) => [x.id, x.value]));
  assert.equal(k.done, 2); assert.equal(k.late, 1); assert.equal(k.ontime, 50); assert.equal(k.cycle, 2); assert.equal(k.created, 2);
  const mine = kpisFor({ ...EMPTY_INPUT, tasks: [...tasks, T('z', { assignee: 'u2', status: 'done', done_at: '2026-11-03T10:00:00Z' })] }, periodOf('month', 0, TODAY), TODAY, { user: 'u2' });
  assert.equal(mine.find((x) => x.id === 'done').value, 1);
});
test('confronto con il periodo prima e variazione', () => {
  const tasks = [T('a', { status: 'done', done_at: '2026-11-03T10:00:00Z' }), T('b', { status: 'done', done_at: '2026-11-04T10:00:00Z' }), T('c', { status: 'done', done_at: '2026-10-20T10:00:00Z' })];
  const c = compare({ ...EMPTY_INPUT, tasks }, 'month', 0, TODAY); const done = c.kpis.find((k) => k.id === 'done');
  assert.equal(done.value, 2); assert.equal(done.prev, 1); assert.deepEqual(delta(done), { abs: 1, pct: 100, dir: 'up', good: true });
  assert.equal(delta({ value: 3, prev: 1, better: 'down' }).good, false); assert.equal(delta({ value: 1, prev: null, better: 'up' }), null);
});
test('ore, vendite, assistenza, assenze, riunioni', () => {
  const inp = { ...EMPTY_INPUT, tasks: [T('a')], time: [{ task: 'a', user_id: 'u1', day: '2026-11-03', minutes: 90 }, { task: 'a', user_id: 'u1', day: '2026-10-03', minutes: 60 }],
    deals: [{ id: 'd', team_id: 't', contact: 'c', title: 'x', stage: 'won', amount: 1000, currency: 'CHF', expected_close: null, renewal: null, probability: null, owner: null, notes: '', lost_reason: '', updated_at: '2026-11-02T10:00:00Z' }, { id: 'e', team_id: 't', contact: 'c', title: 'y', stage: 'quote', amount: 2000, currency: 'CHF', expected_close: null, renewal: null, probability: null, owner: null, notes: '', lost_reason: '', updated_at: '2026-11-02T10:00:00Z' }],
    tickets: [{ id: 'k', team_id: 't', contact: null, title: 't', text: '', priority: 'normal', status: 'resolved', assignee: null, created_at: '2026-11-02T08:00:00Z', resolved_at: '2026-11-02T14:00:00Z' }],
    absences: [{ user_id: 'u', from_day: '2026-10-30', to_day: '2026-11-03', status: 'approved' }, { user_id: 'u', from_day: '2026-11-10', to_day: '2026-11-11', status: 'requested' }], meetings: [{ day: '2026-11-04', dur: 90, status: 'ended' }] };
  const k = Object.fromEntries(kpisFor(inp, periodOf('month', 0, TODAY), TODAY).map((x) => [x.id, x.value]));
  assert.equal(k.hours, 1.5); assert.equal(k.won, 1000); assert.equal(k.forecast, 1000); assert.equal(k.tHours, 6); assert.equal(k.absDays, 3); assert.equal(k.meetN, 1); assert.equal(k.meetH, 1.5);
});
test('tendenza, anomalie e previsione', () => {
  assert.equal(trend([1, 2, 3, 4, 5, 6, 7]).dir, 'su'); assert.equal(trend([5, 5, 5, 5, 5]).dir, 'stabile'); assert.equal(trend([9, 7, 5, 3, 1]).dir, 'giù');
  assert.deepEqual(anomalies([2, 2, 3, 2, 2, 3, 2, 2, 20, 2]), [8]); assert.deepEqual(anomalies([1, 2, 3]), []);
  assert.deepEqual(forecastNext([1, 2, 3, 4, 5], 2), [6, 7]); assert.ok(forecastNext([5, 4, 3, 2, 1], 3).every((v) => v >= 0));
  const s = doneSeries([T('a', { status: 'done', done_at: '2026-11-03T10:00:00Z' })], periodOf('week', 0, TODAY)); assert.equal(s.length, 7); assert.equal(s[1].v, 1);
});
test('report scritto, CSV, HTML, domande', () => {
  const tasks = [T('a', { status: 'done', done_at: '2026-11-03T10:00:00Z', due: '2026-11-05' }), T('b', { due: '2026-10-20' })];
  const c = compare({ ...EMPTY_INPUT, tasks }, 'month', 0, TODAY); const w = workload(tasks, () => 'Giulia');
  const text = reportText({ title: 'Sito nuovo', period: c.period, kpis: c.kpis, currency: 'CHF', workload: w });
  assert.match(text, /Report: Sito nuovo/); assert.match(text, /1 task in ritardo/); assert.match(text, /Che cosa fare/);
  assert.match(reportCsv(c), /^﻿Indicatore;Valore/); assert.match(reportCsv(c), /"Task chiusi";1/);
  assert.match(reportHtml({ title: 'X', period: c.period, kpis: c.kpis, text, brand: { company: 'Rossi <Srl>', address: '', email: '', phone: '', vat: '', footer: 'Riservato', color: '#0F766E' } }), /Rossi &lt;Srl&gt;/);
  const o = { kpis: c.kpis, workload: w, currency: 'CHF', period: c.period };
  assert.match(answer('Quanti task in ritardo abbiamo?', o), /1 task in ritardo/); assert.match(answer('chi ha più lavoro?', o), /Giulia/); assert.equal(answer('che tempo fa', o), null);
});
