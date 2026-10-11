import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayName, createInvite, validateSlots, settle, accept, propose, acceptCounter, decline, reinvite, canCall, startCall, declineCall, cancelCall,
  answerCall, setShare, setKeep, finish, contactVisible, companyView, visibilityOf, candidateStatus, candidateStatusLabel, companyStatusLabel, canInvite,
  candidateTimeline, respondCheck, mergedScores, asksForPersonalDocs, buildContact, callWindow, slotEnd, retryUntil,
  MIN, HOUR, RING_MS, RETRY_MIN, CALL_EARLY_MIN, INVITE_TTL_H, NO_SHARE,
} from '../src/lib/interview.ts';

const T0 = Date.UTC(2026, 9, 10, 8, 0, 0);
const slot = (h, dur = 30) => ({ start: T0 + h * HOUR, durationMin: dur });
const invite = (slots = [slot(24), slot(48)]) => createInvite({ slots, tz: 'Europe/Zurich', lang: 'it', message: 'Ciao', now: T0 });
const FULL = 'Alex Stefanovic';
const SHARE = { fullName: true, email: 'alex@esempio.it', phone: '' };

/** porta l'invito fino alla chiamata in arrivo */
function toCalling(share = SHARE) {
  let iv = accept(invite(), 0, share, T0 + HOUR);
  const now = iv.chosen.start - 5 * MIN;
  iv = startCall(iv, now);
  return { iv, now };
}

test('nome: solo nome + iniziale del cognome', () => {
  assert.equal(displayName('Alex Stefanovic'), 'Alex S.');
  assert.equal(displayName('Giulia M.'), 'Giulia M.');
  assert.equal(displayName('Maria De Luca'), 'Maria L.');
  assert.equal(displayName('Alex'), 'Alex');
  assert.equal(displayName('  '), '');
});

test('fasce: da 1 a 3, nel futuro, durata valida, niente duplicati', () => {
  assert.ok(validateSlots([], T0));
  assert.ok(validateSlots([slot(1), slot(2), slot(3), slot(4)], T0));
  assert.ok(validateSlots([slot(-1)], T0));
  assert.ok(validateSlots([{ start: T0 + HOUR, durationMin: 5 }], T0));
  assert.ok(validateSlots([slot(1), slot(1)], T0));
  assert.equal(validateSlots([slot(1), slot(2), slot(3)], T0), null);
  assert.equal(createInvite({ slots: [], tz: 'x', lang: 'it', now: T0 }), null);
});

test('invito: nessun dato del candidato rivelato, stato iniziale, scadenza', () => {
  const iv = invite();
  assert.equal(iv.stage, 'invited_interview');
  assert.deepEqual(iv.share, NO_SHARE);
  assert.equal(iv.keep, null);
  assert.equal(iv.unlockedAt, undefined);
  assert.equal(contactVisible(iv), false);
  assert.equal(iv.expiresAt, T0 + 24 * HOUR + 0 > T0 + INVITE_TTL_H * HOUR ? T0 + INVITE_TTL_H * HOUR : iv.slots[1].start);
  assert.deepEqual(companyView(FULL, iv), { name: 'Alex S.', contact: null, fullNameVisible: false });
  assert.deepEqual(visibilityOf(iv), { name: true, scores: true, answers: true, photo: false, city: false, social: false, contact: false });
});

test('il candidato non puo\' essere chiamato prima dell\'accettazione', () => {
  const iv = invite();
  const when = iv.slots[0].start - 5 * MIN;
  assert.equal(canCall(iv, when).ok, false);
  assert.equal(canCall(iv, when).reason, 'not_accepted');
  assert.equal(startCall(iv, when), null);
  // nemmeno se ha proposto un'altra fascia, rifiutato o scaduto
  const prop = propose(iv, slot(30), T0 + HOUR);
  assert.equal(startCall(prop, when), null);
  const dec = decline(iv, '', T0 + HOUR);
  assert.equal(startCall(dec, when), null);
  assert.equal(startCall(iv, iv.expiresAt + 1), null);
});

test('chiamata: solo dalla finestra (10 min prima) fino alla fine; mai il candidato', () => {
  const acc = accept(invite(), 1, NO_SHARE, T0 + HOUR);
  const s = acc.chosen;
  assert.equal(s.start, T0 + 48 * HOUR);
  assert.equal(canCall(acc, s.start - CALL_EARLY_MIN * MIN - 1).reason, 'too_early');
  assert.equal(canCall(acc, s.start - CALL_EARLY_MIN * MIN).ok, true);
  assert.equal(canCall(acc, s.start + 10 * MIN).ok, true);
  assert.equal(canCall(acc, slotEnd(s) + 1).ok, false);
  assert.deepEqual(callWindow(s), { opens: s.start - 10 * MIN, closes: slotEnd(s) });
  const c = startCall(acc, s.start);
  assert.equal(c.stage, 'calling');
  assert.equal(c.attempts, 1);
  assert.equal(c.ringUntil, s.start + RING_MS);
  assert.equal(canCall(c, s.start + 1000).reason, 'ringing');
});

test('SBLOCCO: l\'azienda non vede il contatto prima della risposta', () => {
  const { iv, now } = toCalling();
  assert.equal(iv.stage, 'calling');
  assert.equal(contactVisible(iv), false);
  assert.equal(companyView(FULL, iv).contact, null);
  assert.equal(companyView(FULL, iv).name, 'Alex S.');
  assert.equal(iv.contact, undefined);
  assert.equal(iv.unlockedAt, undefined);
  // anche accettato, in attesa, chiamata squillante: niente contatto
  for (const x of [invite(), accept(invite(), 0, SHARE, T0 + HOUR), iv]) assert.equal(contactVisible(x), false);
  assert.ok(now > 0);
});

test('SBLOCCO alla risposta: solo cio\' che il candidato ha scelto', () => {
  const { iv, now } = toCalling();
  const c = answerCall(iv, FULL, now + 10000);
  assert.equal(c.stage, 'connected');
  assert.equal(c.unlockedAt, now + 10000);
  assert.deepEqual(c.contact, { fullName: FULL, email: 'alex@esempio.it' }); // il telefono non e' stato scelto
  assert.equal(contactVisible(c), true);
  const v = companyView(FULL, c);
  assert.equal(v.name, FULL);
  assert.equal(v.fullNameVisible, true);
  assert.equal(v.contact.phone, undefined);
  assert.equal(visibilityOf(c).contact, true);
  assert.equal(c.log.at(-1).ev, 'unlock');
});

test('default: nessun contatto extra, ma lo sblocco e\' registrato', () => {
  const { iv, now } = toCalling(NO_SHARE);
  const c = answerCall(iv, FULL, now + 1000);
  assert.deepEqual(c.contact, {});
  assert.equal(c.unlockedAt, now + 1000);
  assert.equal(companyView(FULL, c).name, 'Alex S.');
  assert.deepEqual(buildContact(NO_SHARE, FULL), {});
});

test('si puo\' cambiare idea sui contatti fino alla chiamata, non dopo', () => {
  let iv = accept(invite(), 0, NO_SHARE, T0 + HOUR);
  iv = setShare(iv, { fullName: false, email: ' a@b.it ', phone: '+41790000000' }, T0 + 2 * HOUR);
  assert.deepEqual(iv.share, { fullName: false, email: 'a@b.it', phone: '+41790000000' });
  const now = iv.chosen.start;
  iv = startCall(iv, now);
  iv = setShare(iv, { fullName: false, email: '', phone: '' }, now + 1000); // ancora ammesso mentre squilla
  const c = answerCall(iv, FULL, now + 2000);
  assert.deepEqual(c.contact, {});
  assert.equal(setShare(c, SHARE, now + 3000), null);
});

test('rifiuto o scadenza dell\'invito non sbloccano nulla', () => {
  const dec = decline(invite(), 'Non sono interessato', T0 + HOUR);
  assert.equal(dec.stage, 'declined');
  assert.equal(dec.declineReason, 'Non sono interessato');
  assert.equal(contactVisible(dec), false);
  assert.equal(accept(dec, 0, SHARE, T0 + 2 * HOUR), null);
  const exp = settle(invite(), T0 + 100 * HOUR);
  assert.equal(exp.stage, 'expired');
  assert.equal(contactVisible(exp), false);
  assert.equal(accept(exp, 0, SHARE, T0 + 100 * HOUR), null);
  assert.equal(candidateStatus('submitted', exp), 'expired');
});

test('l\'invito scade dopo 72 ore o all\'ultima fascia', () => {
  const iv = createInvite({ slots: [slot(10)], tz: 'x', lang: 'it', now: T0 });
  assert.equal(iv.expiresAt, T0 + 10 * HOUR);
  const iv2 = createInvite({ slots: [slot(200)], tz: 'x', lang: 'it', now: T0 });
  assert.equal(iv2.expiresAt, T0 + 72 * HOUR);
  assert.equal(settle(iv2, T0 + 72 * HOUR).stage, 'invited_interview');
  assert.equal(settle(iv2, T0 + 72 * HOUR + 1).stage, 'expired');
});

test('non si accetta una fascia gia\' passata o inesistente', () => {
  assert.equal(accept(invite(), 5, SHARE, T0 + HOUR), null);
  assert.equal(accept(invite(), 0, SHARE, T0 + 30 * HOUR), null); // la prima fascia e' passata (e l'invito scadrebbe alla seconda)
});

test('rifiuto o mancata risposta alla chiamata: niente sblocco, si puo\' riprovare', () => {
  const { iv, now } = toCalling();
  const rej = declineCall(iv, now + 5000);
  assert.equal(rej.stage, 'missed');
  assert.equal(contactVisible(rej), false);
  assert.equal(rej.contact, undefined);
  assert.equal(answerCall(rej, FULL, now + 6000), null); // non puo' rispondere a una chiamata chiusa
  // squilla 45 s senza risposta -> missed
  const late = settle(iv, now + RING_MS + 1);
  assert.equal(late.stage, 'missed');
  assert.equal(answerCall(iv, FULL, now + RING_MS + 1), null); // rispondere dopo la fine dello squillo non sblocca
  // riprova entro 15 minuti
  const again = startCall(rej, now + 2 * MIN);
  assert.equal(again.stage, 'calling');
  assert.equal(again.attempts, 2);
  const ok = answerCall(again, FULL, now + 2 * MIN + 3000);
  assert.equal(ok.stage, 'connected');
});

test('colloquio non avvenuto: dopo i tentativi o a fine fascia, e si puo\' riproporre', () => {
  const { iv, now } = toCalling();
  const missed = declineCall(iv, now + 1000);
  const until = retryUntil(missed);
  assert.equal(until, Math.min(slotEnd(missed.chosen), now + RETRY_MIN * MIN));
  assert.equal(startCall(missed, until + 1), null);
  const nh = settle(missed, until + 1);
  assert.equal(nh.stage, 'not_held');
  assert.equal(contactVisible(nh), false);
  assert.equal(companyStatusLabel('submitted', nh), 'Colloquio non avvenuto');
  assert.equal(candidateStatus('submitted', nh), 'not_held');
  assert.equal(canInvite('submitted', nh), true);
  const re = reinvite(nh, { slots: [{ start: until + 24 * HOUR, durationMin: 30 }], tz: 'Europe/Zurich', lang: 'it' }, until + 2 * MIN);
  assert.equal(re.stage, 'invited_interview');
  assert.equal(re.round, 2);
  assert.deepEqual(re.share, nh.share);
  assert.ok(re.log.length > nh.log.length);
  // nessuna chiamata: a fine fascia il colloquio risulta non avvenuto
  const acc = accept(invite(), 0, SHARE, T0 + HOUR);
  assert.equal(settle(acc, slotEnd(acc.chosen) + 1).stage, 'not_held');
});

test('reinvito non ammesso da stati attivi', () => {
  const acc = accept(invite(), 0, SHARE, T0 + HOUR);
  assert.equal(reinvite(acc, { slots: [slot(100)], tz: 'x', lang: 'it' }, T0 + 2 * HOUR), null);
  assert.equal(canInvite('submitted', acc), false);
  assert.equal(canInvite('submitted', null), true);
  assert.equal(canInvite('rejected', null), false);
});

test('proposta di un\'altra fascia e accettazione da parte dell\'azienda', () => {
  const p = propose(invite(), slot(30, 45), T0 + HOUR);
  assert.equal(p.stage, 'proposed_other');
  assert.equal(candidateStatus('submitted', p), 'proposed');
  assert.equal(propose(invite(), slot(-5), T0 + HOUR), null);
  assert.equal(canCall(p, p.counter.start).ok, false);
  const ok = acceptCounter(p, T0 + 2 * HOUR);
  assert.equal(ok.stage, 'accepted');
  assert.deepEqual(ok.chosen, slot(30, 45));
  assert.equal(acceptCounter(invite(), T0), null);
  assert.equal(canInvite('submitted', p), true);
});

test('esito: solo dopo il colloquio; revoca del consenso nasconde di nuovo', () => {
  const { iv, now } = toCalling();
  assert.equal(finish(iv, 'next', [], '', now + 1000), null); // non si chiude un colloquio mai avvenuto
  const c = answerCall(iv, FULL, now + 2000);
  assert.equal(setKeep(invite(), true, now), null);
  const done = finish(c, 'next', ['Ottima comunicazione', 'a', 'b', 'c'], 'Bravo', now + 30 * MIN);
  assert.equal(done.stage, 'done');
  assert.equal(done.outcome.reasons.length, 3);
  // dopo la fine: senza consenso esplicito il contatto NON resta visibile
  assert.equal(done.keep, null);
  assert.equal(contactVisible(done), false);
  assert.equal(companyView(FULL, done).contact, null);
  assert.equal(companyView(FULL, done).name, 'Alex S.');
  // consenso si -> visibile; revoca -> nascosto di nuovo
  const kept = setKeep(done, true, now + 31 * MIN);
  assert.equal(contactVisible(kept), true);
  assert.equal(companyView(FULL, kept).contact.email, 'alex@esempio.it');
  const revoked = setKeep(kept, false, now + 32 * MIN);
  assert.equal(contactVisible(revoked), false);
  assert.equal(companyView(FULL, revoked).contact, null);
  assert.equal(revoked.log.at(-1).ev, 'keep_off');
  // revoca gia' durante il colloquio
  const mid = setKeep(c, false, now + 3000);
  assert.equal(contactVisible(mid), false);
  assert.equal(candidateStatus('submitted', c), 'shared');
  assert.equal(candidateStatus('submitted', mid), 'scheduled');
  assert.equal(candidateStatus('submitted', done), 'concluded');
});

test('annullare la chiamata mentre squilla non sblocca', () => {
  const { iv, now } = toCalling();
  const x = cancelCall(iv, now + 1000);
  assert.equal(x.stage, 'missed');
  assert.equal(contactVisible(x), false);
  assert.equal(cancelCall(x, now + 2000), null);
});

test('il candidato puo\' ritirarsi dall\'accettazione ma non dopo lo sblocco', () => {
  const acc = accept(invite(), 0, SHARE, T0 + HOUR);
  assert.equal(decline(acc, '', T0 + 2 * HOUR).stage, 'declined');
  const { iv, now } = toCalling();
  const c = answerCall(iv, FULL, now + 1000);
  assert.equal(decline(c, '', now + 2000), null);
});

test('etichette di stato e cronologia "cosa ha visto l\'azienda"', () => {
  assert.equal(candidateStatusLabel(candidateStatus('submitted', null)), 'In valutazione');
  assert.equal(candidateStatusLabel(candidateStatus('shortlist', null)), 'In valutazione · nei preferiti');
  assert.equal(candidateStatusLabel(candidateStatus('submitted', invite())), 'Invitato al colloquio');
  assert.equal(candidateStatusLabel(candidateStatus('rejected', null)), 'Non selezionato');
  const { iv, now } = toCalling();
  assert.equal(candidateStatusLabel(candidateStatus('submitted', iv)), 'Chiamata in arrivo');
  assert.equal(companyStatusLabel('submitted', iv), 'Chiamata in corso');
  const c = answerCall(iv, FULL, now + 1000);
  assert.equal(candidateStatusLabel(candidateStatus('submitted', c)), 'Contatto condiviso');
  const tl = candidateTimeline({ submittedAt: T0 - HOUR, candidateFull: FULL, iv: c, fmt: (ts) => String(ts) });
  assert.equal(tl[0].title, 'Candidatura inviata');
  assert.match(tl[0].sees, /Alex S\./);
  assert.ok(!tl[0].sees.includes('Stefanovic'));
  assert.ok(tl.some((x) => x.title === 'Contatto sbloccato durante il colloquio' && /alex@esempio\.it/.test(x.sees)));
  // ordine cronologico
  assert.deepEqual(tl.map((x) => x.ts), [...tl.map((x) => x.ts)].sort((a, b) => a - b));
});

test('ulteriori verifiche: accetta o rifiuta, rifiutare non penalizza ma e\' visibile', () => {
  const c = { id: 'c1', kind: 'test', title: 'Excel', skill: 'analisi', askedAt: T0, status: 'requested', questionIds: [], custom: [], timeLimitMin: 20, liveQuestions: [], privateNotes: '', answers: [], openScores: {} };
  const no = respondCheck(c, false, T0 + 1);
  assert.equal(no.status, 'declined');
  assert.equal(respondCheck(no, true, T0 + 2), null);
  const p = respondCheck({ ...c, kind: 'practical' }, true, T0 + 5);
  assert.equal(p.status, 'accepted');
  assert.equal(p.startedAt, T0 + 5);
  assert.deepEqual(mergedScores([{ a: 80, b: null }, { a: 60 }, undefined]), { a: 70, b: null });
});

test('nessuna richiesta di documenti personali', () => {
  for (const s of ['Mandaci il tuo CV', 'allega il curriculum', 'una tua foto', 'il diploma', 'Carta d’identità', 'la tua età']) assert.equal(asksForPersonalDocs(s), true, s);
  for (const s of ['Prepara un piano commerciale', 'Calcola il margine', '']) assert.equal(asksForPersonalDocs(s), false, s);
});
