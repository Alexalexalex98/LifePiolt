import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAiActions, validate, findByText } from '../src/lib/assistant/aiActionsCore.ts';

test('azioni proposte dall\'AI: si estraggono e si toglie la riga dal testo', () => {
  const r = parseAiActions('Imposto il piano.\n[[AZIONE {"type":"vacation_set","name":"Viaggio","goal":2000,"month":"2026-12"}]]\n[[AZIONE {"type":"task_add","t":"Chiamare Marco","due":"2026-11-03"}]]');
  assert.equal(r.text, 'Imposto il piano.');
  assert.deepEqual(r.actions.map((a) => a.type), ['vacation_set', 'task_add']);
});

test('azioni non valide o inventate vengono scartate', () => {
  assert.equal(validate({ type: 'vacation_set', name: 'x', goal: -5, month: '2026-12' }), null);
  assert.equal(validate({ type: 'event_add', title: 'a', date: '2026-13-40', time: '10:00' }), null);
  assert.equal(validate({ type: 'event_add', title: 'a', date: '2026-11-03', time: '25:00' }), null);
  assert.equal(validate({ type: 'open', page: 'evil' }), null);
  assert.equal(validate({ type: 'delete_everything' }), null);
  assert.equal(parseAiActions('ciao [[AZIONE {non json}]]').actions.length, 0);
});

test('al massimo 4 azioni per risposta', () => {
  const l = Array.from({ length: 6 }, (_, i) => `[[AZIONE {"type":"note_add","text":"n${i}"}]]`).join('\n');
  assert.equal(parseAiActions(l).actions.length, 4);
});

test('trovare una voce: unica, nessuna o ambigua', () => {
  const tasks = [{ t: 'Prenotare il dentista' }, { t: 'Comprare il latte' }, { t: 'Prenotare il treno' }];
  assert.equal(findByText(tasks, (x) => x.t, 'dentista').length, 1);
  assert.equal(findByText(tasks, (x) => x.t, 'prenotare').length, 2);
  assert.equal(findByText(tasks, (x) => x.t, 'pizza').length, 0);
});

import { cutCandidates } from '../src/lib/theia/core.ts';
test('dove tagliare: niente voci essenziali, in ordine di risparmio', () => {
  const r = cutCandidates([
    { name: 'Cassa X', cls: 'Cassa malati e assicurazioni', monthly: 993, kind: 'fissa' },
    { name: 'Netflix', cls: 'Abbonamenti', monthly: 100, kind: 'fissa' },
    { name: 'Bar', cls: 'Ristoranti e bar', monthly: 200, kind: 'variabile' },
    { name: 'Varie', cls: 'Altro', monthly: 1000, kind: 'variabile' },
  ]);
  assert.deepEqual(r.map((x) => x.item.name), ['Varie', 'Bar', 'Netflix']);
  assert.deepEqual(r.map((x) => x.save), [200, 60, 40]);
});

import { isLearnable, recall, makeEntry, addEntry } from '../src/lib/theiaMemory.ts';
test('memoria: impara solo conoscenza generale, non cose personali o legate all\'ora', () => {
  const r = 'La fotosintesi è il processo con cui le piante trasformano luce, acqua e anidride carbonica in zuccheri e ossigeno.';
  assert.equal(isLearnable('Come funziona la fotosintesi clorofilliana nelle piante', r), true);
  assert.equal(isLearnable('Quanto ho speso questo mese in ristoranti', r), false);
  assert.equal(isLearnable('Che tempo fa domani a Lugano', r), false);
  assert.equal(isLearnable('E quello invece come funziona', r), false);
  assert.equal(isLearnable('Come funziona la fotosintesi clorofilliana nelle piante', 'Non lo so, riprova più tardi con un altra domanda.'), false);
});
test('memoria: ritrova una domanda simile e non una diversa', () => {
  const e = makeEntry('Come funziona la fotosintesi clorofilliana nelle piante', 'Risposta lunga abbastanza per essere ricordata dal telefono di Theia.');
  const kb = addEntry([], e);
  assert.equal(recall(kb, 'Come funziona la fotosintesi nelle piante')?.id, e.id);
  assert.equal(recall(kb, 'Come funziona il motore a scoppio delle automobili'), null);
});

import { findChecks, dueFixed, chartCategory } from '../src/lib/statementChecks.ts';
const mk = (label, amount, ...dates) => dates.map((date) => ({ date, label, amount }));
test('controlli estratto: due casse malati nello stesso periodo => domanda, non si indovina', () => {
  const rows = [...mk('Concordia', -874, '2026-06-07', '2026-07-07', '2026-08-07'), ...mk('Css Kranken', -481, '2026-06-07', '2026-07-07', '2026-08-07')];
  const fixed = [{ name: 'Cassa malati e assicurazioni: Concordia', key: 'concordia', cls: 'Cassa malati e assicurazioni', monthly: 874 }, { name: 'Cassa malati e assicurazioni: Css Kranken', key: 'css kranken', cls: 'Cassa malati e assicurazioni', monthly: 481 }];
  const c = findChecks({ rows, fixed, incomes: [], answers: {} });
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'multi');
  assert.equal(findChecks({ rows, fixed, incomes: [], answers: { [c[0].id]: 'all' } }).length, 0);
});
test('controlli estratto: due stipendi in periodi diversi => cambio lavoro', () => {
  const rows = [...mk('Ditta A', 4000, '2026-01-25', '2026-02-25', '2026-03-25'), ...mk('Ditta B', 4500, '2026-06-25', '2026-07-25', '2026-08-25')];
  const c = findChecks({ rows, fixed: [], incomes: [{ name: 'Ditta A', key: 'ditta a', monthly: 4000 }, { name: 'Ditta B', key: 'ditta b', monthly: 4500 }], answers: {} });
  assert.equal(c[0].kind, 'income-seq'); assert.deepEqual(c[0].options[0].effect.excludeIncome, ['ditta a']);
});
test('spese fisse non ancora addebitate questo mese', () => {
  const rows = mk('Affitto S Immo Sa', -1905, '2026-08-27', '2026-09-27');
  const d = dueFixed(rows, [{ name: 'Affitto: S Immo', key: 'affitto s immo sa', cls: 'Affitto', monthly: 1905 }], '2026-10-22');
  assert.equal(d.length, 1); assert.equal(d[0].day, 27);
});
test('grafico del mese usa la stessa classe dell\'estratto', () => {
  assert.equal(chartCategory('Bmw Schweiz Ag Abteilung Leasing', {}, () => 'Altro'), 'Prestiti e leasing');
  assert.equal(chartCategory('Concordia', {}, () => 'Altro'), 'Cassa malati');
});

import { oneOffTransfers, moveKey } from '../src/lib/financeCalc.ts';
test('giroconto una tantum resta fuori, uno che torna ogni mese conta come entrata', () => {
  const mv = (label, amount, date) => ({ label, amount, date });
  const months = ['Agosto 2026', 'Settembre 2026', 'Ottobre 2026'].map((label, i) => ({ label, start: 0, movements: [mv('Giro conto Mamma', 200, '05/0' + (8 + i)), ...(i === 2 ? [mv('Giro conto 2', 1000, '20/10')] : [])] }));
  const kinds = { [moveKey('Ottobre 2026', months[2].movements[0])]: 'transfer', [moveKey('Ottobre 2026', months[2].movements[1])]: 'transfer' };
  const off = oneOffTransfers(months, kinds, (l) => l.toLowerCase());
  assert.equal(off.has(moveKey('Ottobre 2026', months[2].movements[1])), true);
  assert.equal(off.has(moveKey('Ottobre 2026', months[2].movements[0])), false);
});

import { transferSource } from '../src/lib/financeCalc.ts';
test('giroconti ricorrenti: stesso conto o contanti, non conti diversi', () => {
  const p = (l) => l.toLowerCase();
  assert.equal(transferSource('Versamento contanti sportello', p), 'contanti');
  assert.equal(transferSource('Deposito Cash Lugano', p), 'contanti');
  assert.notEqual(transferSource('Giro da Mario', p), transferSource('Giro da Anna', p));
});

import { estimateIncome, spreadOver, monthsNeeded, buildMonthPlan, detectLumpy, detectDuplicates, matchRefunds, findSavingsMove, goalMonthly } from '../src/lib/monthPlan.ts';
test('entrata prevista: fissa, a ore con straordinari, a percentuale, manuale vince', () => {
  assert.equal(estimateIncome({ mode: 'fixed', amount: 4200 }).total, 4200);
  assert.equal(estimateIncome({ mode: 'hourly', hours: 160, rate: 30, overtimeHours: 10, overtimeRate: 40 }).total, 5200);
  assert.equal(estimateIncome({ mode: 'commission', amount: 2000, revenue: 20000, pct: 10 }).total, 4000);
  assert.equal(estimateIncome({ mode: 'fixed', amount: 4200, manualNext: 3900 }).total, 3900);
});
test('dilazione: somma esatta e mesi necessari', () => {
  const s = spreadOver(1000, 3, '2026-11');
  assert.deepEqual(s.map((x) => x.ym), ['2026-11', '2026-12', '2027-01']);
  assert.equal(Math.round(s.reduce((a, x) => a + x.amount, 0) * 100) / 100, 1000);
  assert.equal(monthsNeeded(1000, 300), 4);
});
test('piano del mese: entrata - fisse - da parte = da vivere', () => {
  const p = buildMonthPlan({ ym: '2026-11', income: { mode: 'fixed', amount: 4000 }, fixed: [{ label: 'Affitto', amount: 1900 }, { label: 'Cassa', amount: 500 }], goals: [{ id: 'g', name: 'Vacanza', kind: 'vacation', total: 1200, targetYm: '2027-02' }], plans: [{ id: 'p', name: 'Fattura', total: 600, startYm: '2026-11', months: 3 }], daysLeft: 30 });
  assert.equal(p.fixedTotal, 2400); assert.equal(p.setAsideTotal, 500); assert.equal(p.free, 1100); assert.equal(p.status, 'ok');
  assert.equal(goalMonthly({ id: 'g', name: 'v', kind: 'vacation', total: 1200, targetYm: '2027-02' }, '2026-11'), 300);
});
test('fattura troppo alta, doppi addebiti, rimborsi, spostamento risparmi', () => {
  const rows = [{ date: '2026-07-01', label: 'Axa', amount: -100 }, { date: '2026-08-01', label: 'Axa', amount: -100 }, { date: '2026-09-01', label: 'Axa', amount: -100 }, { date: '2026-10-01', label: 'Axa', amount: -900 }];
  assert.equal(detectLumpy(rows, 4000).length, 1);
  assert.equal(detectDuplicates([{ date: '2026-10-05', label: 'Coop', amount: -50 }, { date: '2026-10-05', label: 'Coop', amount: -50 }]).length, 1);
  assert.equal(matchRefunds([{ date: '2026-09-01', label: 'Zalando', amount: -80 }, { date: '2026-09-20', label: 'Zalando', amount: 80 }]).length, 1);
  assert.ok(findSavingsMove([{ date: '2026-11-25', label: 'Giroconto risparmio', amount: -500 }], 500));
  assert.equal(findSavingsMove([{ date: '2026-11-25', label: 'Coop', amount: -300 }], 500), null);
});

import { parseContract } from '../src/lib/contractParse.ts';
test('contratto: solo lordo => chiede il netto, non lo inventa', () => {
  const r = parseContract('ecco: {"tipo":"fisso","stipendio_netto_mensile":null,"stipendio_lordo_mensile":5200,"note":"periodo di prova 3 mesi"}');
  assert.equal(r.model.mode, 'fixed'); assert.equal(r.model.amount, undefined); assert.equal(r.grossOnly, true);
  const o = parseContract('{"tipo":"ore","ore_settimanali":40,"paga_oraria_lorda":32}');
  assert.equal(o.model.mode, 'hourly'); assert.equal(o.model.hours, 173); assert.equal(parseContract('niente json'), null);
});

test('azioni piano del mese: validate', () => {
  assert.equal(validate({ type: 'income_set', mode: 'hourly', hours: 160, rate: 30 }).mode, 'hourly');
  assert.equal(validate({ type: 'income_set', mode: 'hourly' }), null);
  assert.equal(validate({ type: 'bill_spread', name: 'Imposte', total: 3000 }), null);
  assert.equal(validate({ type: 'bill_spread', name: 'Imposte', total: 3000, months: 12 }).months, 12);
  assert.equal(validate({ type: 'fixed_change', match: 'cassa malati', amount: 480 }).amount, 480);
  assert.equal(validate({ type: 'save_goal', name: 'Divano', total: 900, month: '2027-03' }).month, '2027-03');
});

import { staleDays } from '../src/lib/statementChecks.ts';
test('spesa fissa cambiata di colpo => domanda; estratto vecchio => giorni', () => {
  const rows = [...mk('Axa', -100, '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'), ...mk('Axa', -180, '2026-10-01')];
  const c = findChecks({ rows, fixed: [{ name: 'Cassa: Axa', key: 'axa', cls: 'Cassa malati e assicurazioni', monthly: 100 }], incomes: [], answers: {} });
  assert.equal(c[0].kind, 'change'); assert.equal(c[0].options[0].effect.override.amount, 180);
  assert.equal(staleDays(rows, '2026-12-01'), 61);
});

import { newPet, tick, earnedToday, give, available, levelOf, moodOf, streakNow, publicOf } from '../src/lib/pet.ts';
test('pet: le necessità calano con le ore, i gettoni si guadagnano facendo cose vere', () => {
  const t0 = Date.UTC(2026, 9, 23, 8);
  const p = newPet(t0);
  assert.equal(tick(p, t0 + 10 * 3600000).food, 70 - 35);
  assert.equal(tick(p, t0 + 100 * 3600000).water, 0);
  const e = earnedToday({ tasksDone: 9, mealsLogged: 1, waterMl: 1200, workouts: 0, moodLogged: true });
  assert.deepEqual(e, { snack: 6, water: 2, fit: 0, love: 1 });
});
test('pet: senza gettone non mangia; con il gettone sì, e la serie parte con cibo+acqua', () => {
  const t0 = Date.UTC(2026, 9, 23, 8), day = '2026-10-23';
  let p = { ...newPet(t0), food: 20, water: 20 };
  assert.equal(give(p, 'snack', { snack: 0, water: 0, fit: 0, love: 0 }, day, t0).ok, false);
  const e = { snack: 1, water: 1, fit: 0, love: 0 };
  let r = give(p, 'snack', e, day, t0); assert.equal(r.ok, true); assert.equal(r.pet.food, 45);
  r = give(r.pet, 'snack', e, day, t0); assert.equal(r.ok, false);
  r = give(r.pet, 'water', e, day, t0); assert.equal(r.pet.streak, 1); assert.equal(streakNow(r.pet, day), 1);
  assert.equal(streakNow(r.pet, '2026-10-26'), 0);
  assert.equal(available(r.pet, e, day).snack, 0);
});
test('pet: livelli, umore e vista pubblica senza dettagli privati', () => {
  assert.equal(levelOf(0), 1); assert.equal(levelOf(20), 2); assert.equal(levelOf(80), 3);
  assert.equal(moodOf({ ...newPet(), food: 5 }, 12).expr, 'crying');
  assert.equal(moodOf({ ...newPet(), food: 20 }, 12).expr, 'hungry');
  assert.deepEqual(Object.keys(publicOf(newPet(Date.now()), '2026-10-23')).sort(), ['expr', 'label', 'level', 'name', 'streak']);
});
