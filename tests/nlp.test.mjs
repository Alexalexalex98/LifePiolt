import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, extractTitle, detectIntent, similarity, bestMatch, topicOf, norm, isYes, isNo } from '../src/lib/assistant/nlp.ts';

const NOW = new Date(2026, 9, 7, 10, 0); // mercoledì 7 ottobre 2026

test('giorni', () => {
  assert.equal(parseWhen('domani', NOW).day, '2026-10-08');
  assert.equal(parseWhen('dopodomani alle 9', NOW).day, '2026-10-09');
  assert.equal(parseWhen('oggi', NOW).day, '2026-10-07');
  assert.equal(parseWhen('venerdì', NOW).day, '2026-10-09');
  assert.equal(parseWhen('mercoledì', NOW).day, '2026-10-14'); // lo stesso giorno della settimana = la settimana dopo
  assert.equal(parseWhen('lunedì prossimo', NOW).day, '2026-10-12');
  assert.equal(parseWhen('tra 3 giorni', NOW).day, '2026-10-10');
  assert.equal(parseWhen('fra due settimane', NOW).day, '2026-10-21');
  assert.equal(parseWhen('il 15', NOW).day, '2026-10-15');
  assert.equal(parseWhen('il 3', NOW).day, '2026-11-03'); // già passato: mese dopo
  assert.equal(parseWhen('15 ottobre', NOW).day, '2026-10-15');
  assert.equal(parseWhen('2 ott', NOW).day, '2027-10-02');
  assert.equal(parseWhen('20/10', NOW).day, '2026-10-20');
  assert.equal(parseWhen('settimana prossima', NOW).day, '2026-10-12');
});

test('orari', () => {
  assert.equal(parseWhen('alle 15', NOW).time, '15:00');
  assert.equal(parseWhen('alle 15:30', NOW).time, '15:30');
  assert.equal(parseWhen('alle 15.45', NOW).time, '15:45');
  assert.equal(parseWhen('alle 3 del pomeriggio', NOW).time, '15:00');
  assert.equal(parseWhen('alle 9', NOW).time, '09:00');
  assert.equal(parseWhen('alle 9 di sera', NOW).time, '21:00');
  assert.equal(parseWhen('alle 3', NOW).time, '15:00');
  assert.equal(parseWhen('alle 10 e mezza', NOW).time, '10:30');
  assert.equal(parseWhen('a mezzogiorno', NOW).time, '12:00');
  assert.equal(parseWhen('domani mattina', NOW).hint, 'mattina');
  assert.equal(parseWhen('domani mattina', NOW).time, undefined);
});

test('intervalli e durate', () => {
  const w = parseWhen('dalle 10 alle 12', NOW);
  assert.equal(w.time, '10:00'); assert.equal(w.endTime, '12:00'); assert.equal(w.durationMin, 120);
  assert.equal(parseWhen('alle 15 per 2 ore', NOW).durationMin, 120);
  assert.equal(parseWhen('alle 15 per 30 minuti', NOW).durationMin, 30);
  assert.equal(parseWhen('per mezz\'ora', NOW).durationMin, 30);
});

test('titolo ripulito', () => {
  const t = (s) => { const w = parseWhen(s, NOW); return extractTitle(s, w.spans); };
  assert.equal(t('aggiungi riunione con Marco al piano domani alle 15'), 'Riunione Marco');
  assert.equal(t('metti nel piano la palestra giovedì alle 18'), 'Palestra');
  assert.equal(t('aggiungi chiamata fornitore al mio piano'), 'Chiamata fornitore');
  assert.equal(t('ricordami di comprare il latte'), 'Comprare latte');
});

test('riconoscimento del comando', () => {
  const cases = [
    ['aggiungi riunione al piano domani alle 15', 'event.add'], ['metti la palestra nel piano giovedì', 'event.add'],
    ['sposta la riunione a venerdì', 'event.move'], ['elimina la riunione dal piano', 'event.delete'],
    ['aggiungi task comprare il latte', 'task.add'], ['devo chiamare il commercialista', 'task.add'], ['ho finito il report', 'task.done'],
    ['elimina il task report', 'task.delete'], ['che task ho?', 'task.list'], ['che impegni ho domani?', 'agenda.show'], ['quando sono libero venerdì', 'agenda.free'],
    ['cambia la foto profilo', 'profile.photo'], ['rendi il mio profilo privato', 'profile.private'], ['rendi il profilo pubblico', 'profile.public'],
    ['voglio un\'analisi dettagliata delle mie finanze', 'finance.report'], ['come sono messo con le spese?', 'finance.report'],
    ['mi sento stressato', 'mood.log'], ['annulla', 'undo'], ['scrivi una nota: idee per AURA', 'note.add'], ['attiva le notifiche', 'notif.on'], ['metti il tema scuro', 'theme.dark'],
    ['imposta orario di lavoro dalle 9 alle 17', 'hours.set'], ['apri finanze', 'open'], ['cosa sai fare', 'help'], ['la pizza è buona', 'unknown'],
    ['condividi la mia agenda con Marco', 'agenda.share'],
  ];
  cases.forEach(([s, i]) => assert.equal(detectIntent(s), i, s));
});

test('somiglianza e abbinamento di titoli', () => {
  const items = [{ t: 'Meeting team' }, { t: 'Chiamata fornitore' }, { t: 'Prova prototipo AURA' }];
  assert.equal(bestMatch('la riunione con il fornitore', items, (x) => x.t).t, 'Chiamata fornitore');
  assert.equal(bestMatch('prototipo', items, (x) => x.t).t, 'Prova prototipo AURA');
  assert.equal(bestMatch('pizza', items, (x) => x.t), null);
  assert.ok(similarity('chiamata fornitore', 'Chiamata fornitore') > 0.9);
});

test('argomenti per cartelle', () => {
  assert.equal(topicOf('come posso risparmiare sul budget delle spese'), 'Finanze');
  assert.equal(topicOf('consigliami una playlist e una canzone con la chitarra'), 'Musica');
  assert.equal(topicOf('vorrei imparare a dipingere un quadro'), 'Arte');
  assert.equal(topicOf('ciao'), null);
});

test('sì / no', () => { assert.ok(isYes('Sì, grazie')); assert.ok(isYes('ok')); assert.ok(isNo('no')); assert.ok(isNo('lascia stare')); assert.equal(norm('È già così'), 'e gia cosi'); });

/* ---------- inglese ---------- */
test('EN giorni, orari, durate', () => {
  const w = (s) => parseWhen(s, NOW);
  assert.equal(w('tomorrow at 3pm').day, '2026-10-08'); assert.equal(w('tomorrow at 3pm').time, '15:00');
  assert.equal(w('day after tomorrow').day, '2026-10-09');
  assert.equal(w('next Monday').day, '2026-10-12');
  assert.equal(w('on friday at 11').day, '2026-10-09'); assert.equal(w('on friday at 11').time, '11:00');
  assert.equal(w('in 3 days').day, '2026-10-10');
  assert.equal(w('in two weeks').day, '2026-10-21');
  assert.equal(w('next week').day, '2026-10-12');
  assert.equal(w('October 15').day, '2026-10-15');
  assert.equal(w('the 15th').day, '2026-10-15');
  assert.equal(w('tomorrow evening').hint, 'sera');
  assert.equal(w('at 3:30 pm').time, '15:30');
  assert.equal(w('at 9am').time, '09:00');
  assert.equal(w('at noon').time, '12:00');
  assert.equal(w('half past ten').time, '10:30');
  assert.equal(w('tonight at 8').time, '20:00');
  assert.equal(w('at 15:00 for 2 hours').durationMin, 120);
  assert.equal(w('for 30 minutes at 4pm').durationMin, 30);
  assert.equal(w('for half an hour').durationMin, 30);
  const r = w('from 10 to 12'); assert.equal(r.time, '10:00'); assert.equal(r.endTime, '12:00'); assert.equal(r.durationMin, 120);
});

test('EN titolo ripulito', () => {
  const t = (s) => { const w = parseWhen(s, NOW); return extractTitle(s, w.spans); };
  assert.equal(t('add meeting with Marco to my plan tomorrow at 3pm'), 'Meeting with Marco');
  assert.equal(t('put gym in my calendar tomorrow'), 'Gym');
  assert.equal(t('remind me to buy milk'), 'Buy milk');
});

test('EN riconoscimento del comando', () => {
  const cases = [
    ['add meeting to my plan tomorrow at 3pm', 'event.add'], ['schedule dinner with Anna on Saturday at 8pm', 'event.add'], ['I have a meeting at 3', 'event.add'],
    ['move the meeting to Friday', 'event.move'], ['reschedule the dentist to Monday', 'event.move'], ['delete the meeting tomorrow', 'event.delete'],
    ['rename team meeting to Budget review', 'event.rename'], ['add task buy milk', 'task.add'], ['I need to call the accountant', 'task.add'], ['remind me to call mom', 'task.add'],
    ['I finished the report', 'task.done'], ['delete the task report', 'task.delete'], ['what tasks do I have?', 'task.list'],
    ['what do I have tomorrow?', 'agenda.show'], ['when am I free on Friday?', 'agenda.free'], ['plan my month', 'plan.fill'],
    ['what should I do now?', 'task.next'], ['undo', 'undo'], ['every Tuesday at 6pm gym', 'event.recurring'],
    ['mark the business plan as urgent', 'task.urgent'], ['mark investor call as important', 'event.important'], ['the report is due Monday', 'task.due'],
    ['turn on dark mode', 'theme.dark'], ['switch to light theme', 'theme.light'], ['enable notifications', 'notif.on'], ['turn off notifications', 'notif.off'],
    ['set my working hours from 9 to 5', 'hours.set'], ['open finance', 'open'], ['help', 'help'], ['what can you do', 'help'], ['I feel stressed', 'mood.log'],
    ['make my profile private', 'profile.private'], ['make my profile public', 'profile.public'], ['share my agenda with Marco', 'agenda.share'],
    ['how much did I spend this month', 'finance.report'], ['how did I sleep', 'health.report'], ['write a note: ideas for AURA', 'note.add'],
    ['new goal run 10 km', 'goal.add'], ['reschedule the skipped sessions', 'plan.reschedule'], ['what time is the dentist?', 'event.when'],
    ['daily summary', 'briefing'], ['change my profile photo', 'profile.photo'], ['mood analysis', 'mood.analysis'],
  ];
  cases.forEach(([s, i]) => assert.equal(detectIntent(s), i, s));
  assert.ok(cases.length >= 40);
});

test('EN yes / no / argomenti', () => {
  ['yes', 'Yes please', 'apply', 'sure', 'go ahead', 'confirm'].forEach((s) => assert.ok(isYes(s), s));
  ['no thanks', 'nope', 'cancel', "don't"].forEach((s) => assert.ok(isNo(s), s));
  assert.ok(!isYes('right now what'));
  assert.equal(topicOf('how can I save money on my budget'), 'Finanze');
});

test('nucleo minimo es/fr', () => {
  assert.equal(parseWhen('mañana', NOW).day, '2026-10-08');
  assert.equal(parseWhen("aujourd'hui", NOW).day, '2026-10-07');
  assert.equal(parseWhen('demain', NOW).day, '2026-10-08');
  assert.equal(parseWhen('hoy', NOW).day, '2026-10-07');
  assert.ok(isYes('sí') && isYes('oui') && isNo('non'));
  assert.equal(detectIntent('añade reunión mañana'), 'event.add');
  assert.equal(detectIntent('ajoute réunion demain'), 'event.add');
});
