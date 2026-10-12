import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/lib/club/index.ts';

const DAY = 86400000;
const course = (published = true) => ({ published });
const viewer = (tier, user = 'Ugo') => ({ user, owner: 'Laura', tier });

test('accesso ai contenuti per livello', () => {
  const free = { tier: 'free', preview: false }, prem = { tier: 'premium', preview: false }, prev = { tier: 'premium', preview: true };
  assert.equal(C.lessonAccess(viewer('none'), course(), free).ok, false);
  assert.equal(C.lessonAccess(viewer('none'), course(), free).reason, 'iscriviti');
  assert.equal(C.lessonAccess(viewer('follower'), course(), free).ok, true);
  assert.equal(C.lessonAccess(viewer('free'), course(), prem).reason, 'premium');
  assert.equal(C.lessonAccess(viewer('premium'), course(), prem).ok, true);
  assert.equal(C.lessonAccess(viewer('none'), course(), prev).ok, true, 'anteprima gratuita');
  assert.equal(C.lessonAccess(viewer('premium'), course(false), free).reason, 'bozza');
  assert.equal(C.lessonAccess(viewer('none', 'Laura'), course(false), prem).ok, true, 'il creatore vede tutto');
  assert.equal(C.postVisible(viewer('free'), { tier: 'premium' }), false);
  assert.equal(C.postVisible(viewer('premium'), { tier: 'premium' }), true);
});

test('permessi della chat', () => {
  const cfg = (write, extra = {}) => ({ write, chosen: [], slowSec: 0, commentsWhenReadOnly: true, ...extra });
  assert.equal(C.canWriteChat(cfg('creator'), viewer('premium')).reason, 'Solo il creatore può scrivere');
  assert.equal(C.canWriteChat(cfg('creator'), viewer('premium', 'Laura')).ok, true);
  assert.equal(C.canWriteChat(cfg('members'), viewer('free')).ok, true);
  assert.equal(C.canWriteChat(cfg('members'), viewer('follower')).ok, false);
  assert.equal(C.canWriteChat(cfg('members'), viewer('none')).ok, false);
  assert.equal(C.canWriteChat(cfg('premium'), viewer('free')).ok, false);
  assert.equal(C.canWriteChat(cfg('premium'), viewer('premium')).ok, true);
  assert.equal(C.canWriteChat(cfg('chosen', { chosen: ['Ugo'] }), viewer('free')).ok, true);
  assert.equal(C.canWriteChat(cfg('chosen', { chosen: ['Ada'] }), viewer('free')).ok, false);
  assert.equal(C.canWriteChat(cfg('none'), viewer('premium')).ok, false);
  assert.equal(C.canWriteChat(cfg('none'), viewer('premium', 'Laura')).ok, false);
  assert.equal(C.canWriteChat(cfg('members'), { ...viewer('free'), mutedByOwner: true }).ok, false);
  assert.equal(C.canComment(cfg('creator'), viewer('free')), true);
  assert.equal(C.canComment(cfg('creator', { commentsWhenReadOnly: false }), viewer('free')), false);
  assert.equal(C.canComment(cfg('creator'), viewer('none')), false);
});

test('modalita lenta', () => {
  const cfg = { write: 'members', chosen: [], slowSec: 30, commentsWhenReadOnly: true };
  assert.equal(C.slowWait(cfg, false, 1000, 1000 + 10000), 20);
  assert.equal(C.slowWait(cfg, false, 1000, 1000 + 31000), 0);
  assert.equal(C.slowWait(cfg, true, 1000, 1001), 0);
  assert.equal(C.slowWait({ ...cfg, slowSec: 0 }, false, 1000, 1001), 0);
  assert.equal(C.slowWait(cfg, false, undefined, 5), 0);
});

test('prezzi', () => {
  const p = C.sanitizePricing({ monthly: 9, trialDays: 7, yearlyDiscountPct: 20 });
  assert.equal(C.yearlyPrice(p), 86.4);
  assert.equal(C.yearlyPerMonth(p), 7.2);
  assert.equal(C.hasYearly(p), true);
  assert.deepEqual(C.sanitizePricing({ monthly: -4, trialDays: 99, yearlyDiscountPct: 90 }), { monthly: 0, currency: 'LP', trialDays: 0, yearlyDiscountPct: 0 });
  assert.equal(C.sanitizePricing({ monthly: 5000 }).monthly, C.MAX_MONTHLY);
  assert.equal(C.sanitizePricing({ monthly: 9, trialDays: 99, yearlyDiscountPct: 90 }).trialDays, 30);
  assert.equal(C.creatorNet(100), 100 - C.PLATFORM_FEE_PCT);
  assert.equal(C.monthlyRevenue(p, 10).gross, 90);
  assert.equal(C.plainAmount(9), '9');
  assert.equal(C.plainAmount(9.5), '9.50');
});

test('abbonamenti: iscrizione, annullamento a fine periodo, rinnovi', () => {
  const now = 1_000_000_000_000;
  const pr = C.sanitizePricing({ monthly: 9, trialDays: 0 });
  let m = C.startPremium(undefined, 'Ugo', 'c1', pr, 'mensile', now);
  assert.equal(C.effectiveTier(m, now), 'premium');
  assert.equal(m.nextChargeAt, now + 30 * DAY);
  assert.equal(C.subState(m, now), 'premium');
  // rinnovo dimostrativo dopo 65 giorni: due addebiti avanzati
  const adv = C.advance(m, now + 65 * DAY);
  assert.equal(adv.nextChargeAt, now + 90 * DAY);
  // annullamento: accesso fino a fine periodo
  const c = C.cancelPremium(m, now + 5 * DAY);
  assert.equal(c.status, 'annullata'); assert.equal(c.renews, false);
  assert.equal(C.effectiveTier(c, now + 10 * DAY), 'premium');
  assert.equal(C.subState(c, now + 10 * DAY), 'in_scadenza');
  assert.equal(C.effectiveTier(c, now + 31 * DAY), 'none');
  // riprendere prima della fine
  assert.equal(C.resumePremium(c, now + 10 * DAY).status, 'attiva');
  assert.equal(C.resumePremium(c, now + 40 * DAY).status, 'annullata');
  // free: annullamento immediato
  const f = C.cancelFree(C.joinFree(undefined, 'Ugo', 'c1', now));
  assert.equal(C.effectiveTier(f, now), 'none');
  assert.equal(C.effectiveTier(C.follow(undefined, 'Ugo', 'c1', now), now), 'follower');
});

test('periodo di prova', () => {
  const now = 5_000_000_000_000;
  const pr = C.sanitizePricing({ monthly: 12, trialDays: 14 });
  const m = C.startPremium(undefined, 'Ugo', 'c1', pr, 'mensile', now);
  assert.equal(m.trialEndsAt, now + 14 * DAY);
  assert.equal(m.nextChargeAt, now + 14 * DAY);
  assert.equal(C.subState(m, now + DAY), 'prova');
  assert.equal(C.subState(m, now + 15 * DAY), 'premium');
  // una seconda prova non si ripete
  const again = C.startPremium(C.cancelPremium(m, now + 20 * DAY), 'Ugo', 'c1', pr, 'mensile', now + 20 * DAY);
  assert.equal(again.nextChargeAt, now + 20 * DAY + 30 * DAY);
});

test('votare solo dopo essersi iscritti', () => {
  assert.equal(C.canRate(undefined), false);
  assert.equal(C.canRate(C.follow(undefined, 'U', 'c')), false);
  assert.equal(C.canRate(C.cancelFree(C.joinFree(undefined, 'U', 'c'))), true, 'si e\' iscritto almeno una volta');
});

test('progresso del corso e riprendi', () => {
  const lessons = [1, 2, 3, 4].map((i) => ({ id: `l${i}`, title: `L${i}`, kind: 'video', sectionId: 's', order: i, tier: 'free', preview: false, durationSec: 100 }));
  const co = { id: 'c', title: 'C', description: '', level: 'base', sections: [{ id: 's', title: 'S', order: 0 }], lessons, published: true, createdAt: 0 };
  const prog = { l1: { done: true, ts: 1 }, l2: { posSec: 40, ts: 5 } };
  assert.deepEqual(C.courseProgress(co, prog), { done: 1, total: 4, pct: 25 });
  assert.equal(C.courseProgress(co, prog, (l) => l.id !== 'l4').pct, 33);
  const r = C.resumeLesson(co, prog);
  assert.equal(r.lesson.id, 'l2'); assert.equal(r.posSec, 40);
  assert.equal(C.resumeLesson(co, { l1: { done: true, ts: 1 } }).lesson.id, 'l2');
  assert.equal(C.resumeLesson(co, Object.fromEntries(lessons.map((l) => [l.id, { done: true, ts: 1 }]))), null);
  assert.equal(C.nextLesson(co, 'l2').id, 'l3'); assert.equal(C.nextLesson(co, 'l4'), null);
  assert.equal(C.countsAsWatched(91, 100), true); assert.equal(C.countsAsWatched(50, 100), false); assert.equal(C.countsAsWatched(50, undefined), false);
});

test('ancore: orologio, etichette, bolle e ordinamento', () => {
  assert.equal(C.fmtClock(222), '3:42'); assert.equal(C.fmtClock(3787), '1:03:07'); assert.equal(C.fmtClock(-4), '0:00');
  assert.equal(C.parseClock('3:42'), 222); assert.equal(C.parseClock('1:03:07'), 3787); assert.equal(C.parseClock('3:99'), null); assert.equal(C.parseClock('x'), null);
  assert.equal(C.questionLabel('Lezione 3', { kind: 'time', sec: 222 }), 'Lezione 3 · 3:42');
  assert.equal(C.questionLabel('Lezione 3'), 'Lezione 3');
  assert.equal(C.anchorLabel({ kind: 'page', page: 4 }), 'pag. 4');
  const list = [{ anchor: { kind: 'time', sec: 100 }, ts: 1 }, { anchor: { kind: 'time', sec: 10 }, ts: 2 }, { ts: 0 }];
  assert.deepEqual(C.sortByAnchor(list).map((x) => x.anchor?.sec), [10, 100, undefined]);
  assert.equal(C.bubblesAt(list, 12).length, 1);
  assert.equal(C.bubblesAt(list, 30).length, 0);
});

test('limiti dimensione file', () => {
  assert.equal(C.checkSize('video', 100 * 1048576), null);
  assert.match(C.checkSize('video', 300 * 1048576), /limite/);
  assert.match(C.checkSize('pdf', 51 * 1048576), /50 MB/);
  assert.equal(C.checkSize('pdf', undefined), null);
  assert.equal(C.kindFromFile('lezione.MP4'), 'video'); assert.equal(C.kindFromFile('a.pdf'), 'pdf'); assert.equal(C.kindFromFile('x.bin'), 'file'); assert.equal(C.kindFromFile('v', 'audio/mpeg'), 'audio');
});
