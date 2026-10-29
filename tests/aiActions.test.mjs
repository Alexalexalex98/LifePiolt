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

test('al massimo 12 azioni per risposta', () => {
  const l = Array.from({ length: 15 }, (_, i) => `[[AZIONE {"type":"note_add","text":"n${i}"}]]`).join('\n');
  assert.equal(parseAiActions(l).actions.length, 12);
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
  assert.equal(tick(p, t0 + 100 * 3600000).water, 35);
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
  assert.equal(streakNow(r.pet, '2026-10-26'), 1);
  assert.equal(available(r.pet, e, day).snack, 0);
});
test('pet: livelli, umore e vista pubblica senza dettagli privati', () => {
  assert.equal(levelOf(0), 1); assert.equal(levelOf(20), 2); assert.equal(levelOf(80), 3);
  assert.equal(moodOf({ ...newPet(), food: 5 }, 12).expr, 'relaxed');
  assert.ok(!/male|fame|sete|triste/i.test(moodOf({ ...newPet(), food: 5 }, 12).label));
  assert.deepEqual(Object.keys(publicOf(newPet(Date.now()), '2026-10-23')).sort(), ['expr', 'label', 'level', 'name', 'streak']);
});

import { detectCrisis } from '../src/lib/safety.ts';
test('sicurezza: riconosce messaggi di rischio, non frasi normali', () => {
  for (const s of ['Voglio morire', 'a volte penso di farla finita', 'I want to kill myself', 'ich will mich umbringen', 'mi taglio le vene', 'Non voglio più vivere']) assert.equal(detectCrisis(s), true, s);
  for (const s of ['Voglio morire dal ridere ahah', 'ho mal di testa', 'quanto costa un taglio di capelli', 'mi sono tagliato la barba', 'mi taglio i capelli domani']) assert.equal(detectCrisis(s), false, s);
});

import { progressOf, inviteText, daysOf } from '../src/lib/challenges.ts';
test('sfide cooperative: si sommano i due, tetto giornaliero, nessuna penalità', () => {
  const c = { id: 'c', withName: 'Anna', kind: 'water', target: 10, startDay: '2026-10-20', days: 3, friend: { '2026-10-20': 3, '2026-10-21': 9 }, createdAt: 0 };
  assert.deepEqual(daysOf(c), ['2026-10-20', '2026-10-21', '2026-10-22']);
  const p = progressOf(c, '2026-10-21', (d) => (d === '2026-10-20' ? 2 : 10));
  assert.equal(p.mine, 2 + 4); assert.equal(p.friend, 3 + 4); assert.equal(p.total, 13); assert.equal(p.state, 'reached');
  assert.equal(progressOf({ ...c, friend: {} }, '2026-10-30', () => 0).state, 'ended');
  assert.ok(!/perd|colpa|classifica/i.test(inviteText('Io', c)));
});

import { EXERCISES, visibleSteps, stepDone, insightsOf } from '../src/lib/mindExercises.ts';
test('spazio consapevolezza: passi condizionati, passi facoltativi, diario solo con conteggi', () => {
  const loop = EXERCISES.find((e) => e.id === 'loop');
  assert.ok(visibleSteps(loop, { act: 'Sì' }).some((s) => s.id === 'small')); assert.ok(!visibleSteps(loop, { act: 'Sì' }).some((s) => s.id === 'later'));
  assert.ok(visibleSteps(loop, { act: 'No, non adesso' }).some((s) => s.id === 'later'));
  const th = EXERCISES.find((e) => e.id === 'thought');
  assert.equal(stepDone(th.steps[0], ''), false); assert.equal(stepDone(th.steps.find((s) => s.id === 'friend'), undefined), true);
  const now = Date.now();
  const ins = insightsOf([{ id: '1', ex: 'name', ts: now, answers: { emo: ['Ansia', 'Stanchezza'] } }, { id: '2', ex: 'name', ts: now, answers: { emo: ['Ansia'] } }, { id: '3', ex: 'thought', ts: now, answers: { b1: 80, b2: 50 } }, { id: '4', ex: 'name', ts: now - 90 * 86400000, answers: { emo: ['Rabbia'] } }], now);
  assert.equal(ins.total, 3); assert.equal(ins.topEmotions[0].n, 'Ansia'); assert.equal(ins.beliefShift.avg, 30);
  assert.ok(EXERCISES.every((e) => !/devi\b|sbagliat[oa]\b.*emozion/i.test(e.steps.map((s) => s.prompt).join(' '))));
});

import { signalsOf, nextInvite, newInviteState, suggestHuman } from '../src/lib/wellbeing.ts';
const base = { today: '2026-10-23', sleep: [], mood: [], tasksDone: [], workoutDays: [], sentDays: [], declined: 0, overdueTasks: 0, mealDays: [], texts: [] };
const days = (n, from = '2026-10-10') => Array.from({ length: n }, (_, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10));
test('segnali: nessun dato => nessun intervento; tutto nella norma => silenzio', () => {
  assert.deepEqual(signalsOf(base), []);
  assert.deepEqual(signalsOf({ ...base, sleep: days(7, '2026-10-17').map((d) => ({ d, v: 7.5 })) }), []);
});
test('segnali: umore pesante per due settimane, frasi dure ripetute, niente allenamento dopo averli fatti', () => {
  const mood = days(10, '2026-10-12').map((d) => ({ d, v: 2 }));
  assert.equal(signalsOf({ ...base, mood })[0].id, 'mood');
  const texts = [{ d: '2026-10-15', text: 'Tanto andrà male' }, { d: '2026-10-18', text: 'non ne faccio una giusta' }, { d: '2026-10-20', text: 'Nessuno mi capisce' }];
  assert.ok(signalsOf({ ...base, texts }).some((s) => s.id === 'pessimism'));
  assert.ok(signalsOf({ ...base, workoutDays: days(6, '2026-09-20') }).some((s) => s.id === 'moves'));
  assert.ok(!signalsOf({ ...base, texts: [{ d: '2026-10-22', text: 'Oggi il capo mi ha scritto una mail' }] }).length);
});
test('proposte: una ogni 3 giorni, silenziabili, spegnibili; il supporto umano solo se dura', () => {
  const sig = signalsOf({ ...base, mood: days(10, '2026-10-12').map((d) => ({ d, v: 2 })) });
  const now = Date.parse('2026-10-23');
  const st = newInviteState();
  assert.equal(nextInvite(sig, st, now).id, 'mood');
  assert.equal(nextInvite(sig, { ...st, lastAny: now - 86400000 }, now), null);
  assert.equal(nextInvite(sig, { ...st, muted: ['mood'] }, now), null);
  assert.equal(nextInvite(sig, { ...st, on: false }, now), null);
  assert.equal(suggestHuman(sig, st, '2026-10-23'), false);
});
test('body: attacco di panico => propone respiro e sensi subito', () => {
  const s = signalsOf({ ...base, texts: [{ d: '2026-10-23', text: 'Ho avuto un attacco di panico' }] });
  assert.deepEqual(s[0].exercises, ['senses', 'breath']);
});

import { newHome, buy, repair, place, unplace, sell, upgrade, wearOf, itemOf, ITEMS, HOUSES, houseOf } from '../src/lib/petHome.ts';
test('casa di Theia: si compra con le stelline, si piazza solo dove c\'è posto, si consuma e si ripara', () => {
  const t0 = Date.UTC(2026, 9, 1);
  let s = { ...newHome(), coins: 100 };
  assert.equal(ITEMS.length, 102);
  assert.equal(buy(s, 'sofa:2', t0).ok, false);
  let r = buy(s, 'sofa:0', t0); assert.equal(r.ok, true); assert.equal(r.state.coins, 60);
  const u = r.state.owned[0].uid;
  assert.equal(place(r.state, 'living', u).ok, true); assert.equal(place(r.state, 'kitchen', u).ok, false);
  assert.equal(wearOf(r.state.owned[0], t0 + 7 * 86400000), 50);
  assert.equal(wearOf(r.state.owned[0], t0 + 99 * 86400000), 100);
  const rp = repair(r.state, u, t0 + 20 * 86400000); assert.equal(rp.ok, true); assert.equal(rp.state.coins, 60 - 16); assert.equal(wearOf(rp.state.owned[0], t0 + 20 * 86400000), 0);
  const sl = sell(place(r.state, 'living', u).state, u); assert.equal(sl.state.coins, 70); assert.equal(sl.state.owned.length, 0);
  assert.deepEqual(unplace(place(r.state, 'living', u).state, 'living', 'sofa').placed.living, {});
});
test('casa di Theia: salire di casa richiede livello e stelline; l\'attico ha 5 stanze', () => {
  let s = { ...newHome(), coins: 500 };
  assert.equal(upgrade(s, 1).ok, false); assert.equal(upgrade(s, 3).ok, true);
  assert.equal(houseOf(upgrade(s, 3).state).rooms.length, 2);
  assert.equal(HOUSES[3].rooms.length, 5); assert.equal(upgrade({ ...s, tier: 3, coins: 9999 }, 99).ok, false);
});

import { milestonesOf, claimable, stageOf, sizeFactor } from '../src/lib/petMilestones.ts';
test('traguardi: scattano con i numeri veri, si ritirano una volta, Theia cresce senza mai rimpicciolire', () => {
  const stats = { tasksDone: 12, workouts: 0, goalsDone: 1, meals: 0, mindEntries: 0, challengesReached: 0, careDays: 3, savingMonths: 0, level: 1 };
  const c = claimable(stats, []).map((m) => m.id);
  assert.deepEqual(c.sort(), ['careDays:3', 'goalsDone:1', 'tasksDone:10']);
  assert.equal(claimable(stats, ['tasksDone:10']).some((m) => m.id === 'tasksDone:10'), false);
  assert.equal(milestonesOf(stats, []).find((m) => m.id === 'tasksDone:50').pct, 24);
  assert.equal(stageOf(1).name, 'Cucciolo'); assert.equal(stageOf(7).name, 'Adulto'); assert.equal(stageOf(12).name, 'Saggio');
  assert.ok(sizeFactor(10) > sizeFactor(1) && sizeFactor(20) === sizeFactor(10));
});

import { rewardFor } from '../src/lib/petHome.ts';
test('stelline: calano se si ripete sempre la stessa cosa, premio piccolo per la varietà', () => {
  const now = Date.now();
  const same = (n) => Array.from({ length: n }, () => ({ k: 'fit', ts: now - 1000 }));
  const r = [0, 1, 2, 3, 5, 9].map((n) => rewardFor('fit', same(n), now));
  assert.equal(r[0], 5); assert.ok(r[1] < r[0] && r[2] < r[1] && r[5] <= r[3] && r[5] <= 1);
  assert.equal(rewardFor('pet', [], now), 0);
  const mixed = [{ k: 'snack', ts: now - 1 }, { k: 'water', ts: now - 1 }, { k: 'love', ts: now - 1 }];
  assert.ok(rewardFor('fit', mixed, now) > rewardFor('fit', [], now) - 1);
});

test('Theia scrive piu\' messaggi brevi: si dividono sulla riga |||', async () => {
  const { splitReply } = await import('../src/lib/assistant/aiActionsCore.ts');
  assert.deepEqual(splitReply('Certo.\n|||\nEcco i numeri:\n• a\n• b\n\n|||\n\nVuoi che li metta nel piano?'), ['Certo.', 'Ecco i numeri:\n• a\n• b', 'Vuoi che li metta nel piano?']);
  assert.deepEqual(splitReply('Un solo messaggio'), ['Un solo messaggio']);
  assert.deepEqual(splitReply('a\n|||\n|||\nb|||c'), ['a', 'bc']);
  assert.equal(splitReply('1\n|||\n2\n|||\n3\n|||\n4\n|||\n5\n|||\n6').length, 5);
});

test('le varianti dei modelli aperti: senza AZIONE e con un elenco', () => {
  const a = parseAiActions('Ok.\n[[{"type":"open","page":"lifefinance"}]]');
  assert.deepEqual(a.actions, [{ type: 'open', page: 'lifefinance' }]); assert.equal(a.text, 'Ok.');
  const b = parseAiActions('Fatto [[AZIONE [{"type":"open","page":"plan"},{"type":"note_add","text":"x"}]]]');
  assert.equal(b.actions.length, 2); assert.equal(b.text, 'Fatto');
});

test('comando «crea queste task» con un file: riconosciuto; testo normale no', () => {
  const MAKE = /\b(crea|creami|creare|aggiung\w*|import\w*|trasform\w*|fai|fammi|metti|inserisc\w*)\b.*\b(task|attivit\w*|compiti|to-?do|progett\w*|voci|lista|elenco)\b/i;
  assert.ok(MAKE.test('Crea queste task')); assert.ok(MAKE.test('trasforma il file in un progetto')); assert.ok(!MAKE.test('cosa dice il documento?'));
});

test('l\'AI propone azioni solo se le chiedi o dici si: mai a un saluto', async () => {
  const { filterActions } = await import('../src/lib/assistant/aiActionsCore.ts');
  const open = { type: 'open', page: 'lifefinance' }, task = { type: 'task_add', t: 'x' };
  assert.deepEqual(filterActions('Ciao come stai?', [open, task]), []);
  assert.deepEqual(filterActions('apri le finanze', [open, task]), [open]);
  assert.deepEqual(filterActions('aggiungi un task', [open, task]), [task]);
  assert.deepEqual(filterActions('Sì crea le task', [open, task]), [open, task]);
});

test('«Si ho una domanda…» non e\' un si all\'azione', async () => {
  const { filterActions } = await import('../src/lib/assistant/aiActionsCore.ts');
  assert.deepEqual(filterActions('Si ho una domanda com\'è nato l\'universo?', [{ type: 'open', page: 'lifefinance' }]), []);
});

test('liveParts: testo in arrivo senza separatori a meta e senza azioni', async () => {
  const { liveParts } = await import('../src/lib/assistant/aiActionsCore.ts');
  assert.deepEqual(liveParts('Ciao'), ['Ciao']);
  assert.deepEqual(liveParts('Ciao\n|'), ['Ciao']);
  assert.deepEqual(liveParts('Ciao\n||'), ['Ciao']);
  assert.deepEqual(liveParts('Ciao\n|||\nSecondo mess'), ['Ciao', 'Secondo mess']);
  assert.deepEqual(liveParts('Fatto.\n[[AZIONE {"type":"task_'), ['Fatto.']);
  assert.deepEqual(liveParts(''), []);
});

test('casa di Theia: due oggetti nello stesso punto della stanza non coesistono, il nuovo prende il posto', async () => {
  const { newHome, buy, place, EXTRA_KINDS, ROOMS, zoneOf } = await import('../src/lib/petHome.ts');
  assert.ok(EXTRA_KINDS.length >= 20);
  let s = { ...newHome(), coins: 500 };
  const a = buy(s, 'armchair:0', 1); const b = buy(a.state, 'tvstand:0', 2);
  const ua = b.state.owned[0].uid, ub = b.state.owned[1].uid;
  let r = place(b.state, 'living', ua); assert.equal(r.ok, true);
  r = place(r.state, 'living', ub); assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.state.placed.living), ['tvstand']);
  assert.equal(zoneOf('armchair'), zoneOf('tvstand'));
  assert.ok(ROOMS.every((x) => x.slots.length >= 10));
});
