import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, MAX_LEVEL, WELCOME_ID, applyUnlock, decideMode, emptyTourState, featureLevel, homeLayout, initialState, isUnlocked, markSeen,
  nextTour, nextUnlock, pageFromPath, pageLevel, remainingLevels, tourSteps, unlockAll, unlockUpTo, upcoming, dayNo,
} from '../src/lib/tour.ts';
import { nextEvent } from '../src/lib/homeNext.ts';
import { allFeatures, featureOfDay } from '../src/data/features.ts';

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const T0 = at(2026, 10, 1);
const seenWelcome = (s) => markSeen(s, WELCOME_ID);

test('livelli: 7 livelli, ogni pagina ha un solo livello e il livello 1 è Oggi+Piano+Theia', () => {
  assert.equal(LEVELS.length, MAX_LEVEL);
  const seen = new Map();
  for (const l of LEVELS) for (const p of l.pages) { assert.ok(!seen.has(p), `pagina doppia ${p}`); seen.set(p, l.level); }
  for (const p of ['home', 'index', 'mood', 'plan', 'ai']) assert.equal(pageLevel(p), 1);
  assert.equal(pageLevel('lifetask'), 2); assert.equal(pageLevel('lifenotes'), 2);
  assert.equal(pageLevel('lifehealth'), 3);
  assert.equal(pageLevel('lifefinance'), 4); assert.equal(pageLevel('taxdecl'), 4);
  assert.equal(pageLevel('lifetravel'), 5); assert.equal(pageLevel('lifedrive'), 5);
  assert.equal(pageLevel('lifenetwork'), 6); assert.equal(pageLevel('lifepointsPage'), 6);
  assert.equal(pageLevel('reports'), 7);
});

test('pagine sempre aperte: profilo, impostazioni, messaggi, notifiche, ricerca, privacy, live', () => {
  for (const p of ['profile', 'settings', 'messagesPage', 'notificationsPage', 'searchPage', 'privacy', 'liveRoom', 'userProfile', 'conversationPage', 'qualcosaDiSconosciuto', '', null, undefined]) {
    const lvl = pageLevel(p);
    assert.ok(lvl <= 1, `${p} -> ${lvl}`);
  }
  const s = initialState('guided', T0);
  for (const p of ['profile', 'settings', 'messagesPage', 'privacy', 'liveRoom', 'sconosciuta']) assert.equal(isUnlocked(s, p), true, p);
  assert.equal(pageFromPath('/'), 'home'); assert.equal(pageFromPath('/lifefinance?x=1'), 'lifefinance'); assert.equal(pageFromPath('/index'), 'home');
});

test('modo: nuovo = guided, demo = demo, installazione esistente = open', () => {
  assert.equal(decideMode({ firstSeenAt: null, demo: false }), 'guided');
  assert.equal(decideMode({ firstSeenAt: null, demo: true }), 'demo');
  assert.equal(decideMode({ firstSeenAt: T0, demo: false }), 'open');
  assert.equal(decideMode({ firstSeenAt: T0, demo: true }), 'open');
});

test('utente nuovo: solo il livello 1 è aperto, il resto è bloccato', () => {
  const s = initialState('guided', T0);
  assert.equal(s.level, 1);
  assert.equal(isUnlocked(s, 'home'), true); assert.equal(isUnlocked(s, 'plan'), true); assert.equal(isUnlocked(s, 'ai'), true);
  for (const p of ['lifetask', 'lifenotes', 'lifehealth', 'lifefinance', 'lifetravel', 'lifedrive', 'lifenetwork', 'reports']) assert.equal(isUnlocked(s, p), false, p);
  assert.equal(remainingLevels(s), 6);
  assert.equal(upcoming(s).level, 2);
});

test('utente esistente: niente blocchi e nessun tour; stato vuoto non blocca nulla', () => {
  const s = initialState('open', T0);
  for (const l of LEVELS) for (const p of l.pages) assert.equal(isUnlocked(s, p), true, p);
  assert.equal(nextTour(s), null);
  assert.equal(nextUnlock(s, { mood: 99 }, T0 + 99 * 86400000), null);
  assert.equal(remainingLevels(s), 0);
  const empty = emptyTourState();
  assert.equal(isUnlocked(empty, 'lifefinance'), true);
  assert.equal(nextTour(empty), null);
});

test('tour: prima il benvenuto, poi eventuali "Nuovo: ..."; da rivedere quando si vuole', () => {
  let s = initialState('guided', T0);
  assert.equal(nextTour(s), WELCOME_ID);
  s = seenWelcome(s);
  assert.equal(nextTour(s), null);
  s = applyUnlock(s, 2, { mood: 1 }, T0 + 1000);
  assert.equal(nextTour(s), 'lvl-2');
  s = markSeen(s, 'lvl-2');
  assert.equal(nextTour(s), null);
  assert.ok(s.seen.includes('lvl-2') && s.pending == null);
});

test('benvenuto: 6 passi, 3 cose + introduzione + "il resto arriva dopo"; demo offre "sblocca tutto"', () => {
  const g = tourSteps(WELCOME_ID, 'guided');
  assert.equal(g.length, 6);
  assert.deepEqual(g.map((x) => x.target ?? null), [null, 'home.mood', 'home.next', 'nav.plan', 'nav.ai', null]);
  assert.equal(g[0].title.includes('{0}'), true);
  assert.equal(g[4].bullets.length, 3);
  assert.ok(!g[5].offerUnlockAll);
  assert.equal(tourSteps(WELCOME_ID, 'demo')[5].offerUnlockAll, true);
  const ids = g.map((x) => x.id); assert.equal(new Set(ids).size, ids.length);
});

test('mini-tour "Nuovo: ..." per ogni livello dal 2 al 7, con azione finale', () => {
  for (let l = 2; l <= MAX_LEVEL; l++) {
    const st = tourSteps(`lvl-${l}`);
    assert.equal(st.length, 2);
    assert.ok(st[0].title.startsWith('Nuovo: '));
    assert.equal(st[1].cta.page, LEVELS[l - 1].openPage);
  }
  assert.deepEqual(tourSteps('lvl-1'), []);
  assert.ok(/privacy|condivid|decidi|privato/i.test(tourSteps('lvl-6')[1].text), 'LifeNetwork spiega la privacy');
});

test('sblocco progressivo: serve prima il benvenuto; poi "usato" oppure i giorni; mai più di un livello', () => {
  let s = initialState('guided', T0, { mood: 0, events: 0 });
  // senza benvenuto non sblocca
  assert.equal(nextUnlock(s, { mood: 3 }, T0), null);
  s = seenWelcome(s);
  assert.equal(nextUnlock(s, { mood: 0, events: 0 }, T0), null);
  // registrare l'umore o aggiungere un impegno apre il livello 2
  assert.deepEqual(nextUnlock(s, { mood: 1, events: 0 }, T0), { level: 2, reason: 'used' });
  assert.deepEqual(nextUnlock(s, { mood: 0, events: 1 }, T0), { level: 2, reason: 'used' });
  // oppure passa 1 giorno
  assert.equal(nextUnlock(s, {}, at(2026, 10, 1, 23)), null);
  assert.deepEqual(nextUnlock(s, {}, at(2026, 10, 2, 8)), { level: 2, reason: 'days' });
  // anche dopo molti giorni: un livello alla volta
  assert.equal(nextUnlock(s, {}, T0 + 90 * 86400000).level, 2);
  s = applyUnlock(s, 2, { mood: 1, events: 0 }, T0 + 5000);
  assert.equal(s.level, 2); assert.equal(s.pending, 'lvl-2');
  assert.equal(isUnlocked(s, 'lifetask'), true); assert.equal(isUnlocked(s, 'lifehealth'), false);
  // il livello 3 richiede task/note nuovi rispetto a quando si è sbloccato il 2
  assert.equal(nextUnlock(s, { mood: 5, events: 5, tasks: 0, notes: 0 }, T0 + 6000), null);
  assert.deepEqual(nextUnlock(s, { mood: 1, tasks: 1 }, T0 + 6000), { level: 3, reason: 'used' });
});

test('catena completa fino al livello 7 e poi niente più sblocchi', () => {
  let s = seenWelcome(initialState('guided', T0));
  const sig = { mood: 0, events: 0, tasks: 0, notes: 0, health: 0, finance: 0, trips: 0, drive: 0, network: 0 };
  const use = { 2: 'mood', 3: 'tasks', 4: 'health', 5: 'finance', 6: 'trips', 7: 'network' };
  for (let l = 2; l <= MAX_LEVEL; l++) {
    sig[use[l]] += 1;
    const n = nextUnlock(s, sig, T0 + l * 1000);
    assert.equal(n?.level, l);
    s = applyUnlock(s, l, sig, T0 + l * 1000);
  }
  assert.equal(s.level, MAX_LEVEL); assert.equal(s.allUnlocked, true);
  assert.equal(nextUnlock(s, { mood: 99 }, T0 + 1e10), null);
});

test('"Sblocca ora" non lascia mai prigionieri: fino a un livello, oppure tutto', () => {
  const s = seenWelcome(initialState('demo', T0));
  const a = unlockUpTo(s, 4, {}, T0);
  assert.equal(isUnlocked(a, 'lifefinance'), true); assert.equal(isUnlocked(a, 'lifenetwork'), false);
  assert.equal(a.pending, null);
  const all = unlockAll(s, T0);
  assert.equal(all.allUnlocked, true);
  for (const l of LEVELS) for (const p of l.pages) assert.equal(isUnlocked(all, p), true, p);
  assert.equal(nextUnlock(all, { mood: 9 }, T0 + 1e10), null);
  assert.equal(unlockUpTo(a, 2, {}, T0), a); // non torna indietro
});

test('Home: più blocchi ai livelli alti', () => {
  assert.deepEqual(homeLayout({ mode: 'guided', level: 1, allUnlocked: false }), { showScore: false, showInsights: false, moreOpen: false });
  assert.equal(homeLayout({ mode: 'guided', level: 3, allUnlocked: false }).showScore, true);
  assert.equal(homeLayout({ mode: 'guided', level: 5, allUnlocked: false }).showInsights, true);
  assert.deepEqual(homeLayout({ mode: 'open', level: 7, allUnlocked: true }), { showScore: true, showInsights: true, moreOpen: true });
  assert.equal(homeLayout({ mode: 'guided', level: 1, allUnlocked: true }).moreOpen, true);
});

test('funzione del giorno: rispetta il livello sbloccato', () => {
  for (let i = 0; i < 40; i++) assert.ok(featureOfDay(at(2026, 1, 1 + i), 1).level <= 1);
  assert.ok(allFeatures.every((f) => f.level === featureLevel(f.groupId, f.page)));
  assert.ok(allFeatures.some((f) => f.level >= 4), 'ci sono funzioni avanzate');
  assert.equal(featureOfDay(at(2026, 10, 8, 1), 2).title, featureOfDay(at(2026, 10, 8, 23), 2).title);
  assert.equal(featureOfDay(at(2026, 10, 8)).title, featureOfDay(at(2026, 10, 8), 99).title);
});

test('giorni di calendario locali', () => {
  assert.equal(dayNo(at(2026, 10, 2, 0)) - dayNo(at(2026, 10, 1, 23)), 1);
});

test('prossimo impegno: oggi non ancora iniziato, poi i giorni dopo', () => {
  const now = new Date(2026, 9, 8, 10, 30);
  const ev = {
    '2026-10-08': [{ time: '09:00', title: 'Passato' }, { time: '15:00', title: 'Tardi' }, { time: '11:00', title: 'Presto' }],
    '2026-10-09': [{ time: '08:00', title: 'Domani' }],
  };
  const n = nextEvent(ev, now);
  assert.equal(n.ev.title, 'Presto'); assert.equal(n.daysAhead, 0); assert.equal(n.minutesAway, 30); assert.equal(n.todayLeft, 2);
  const later = nextEvent(ev, new Date(2026, 9, 8, 16, 0));
  assert.equal(later.ev.title, 'Domani'); assert.equal(later.daysAhead, 1); assert.equal(later.minutesAway, null);
  assert.equal(nextEvent({}, now), null);
  assert.equal(nextEvent({ '2027-01-01': [{ time: '10:00', title: 'Lontano' }] }, now), null);
});
