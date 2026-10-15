import test from 'node:test';
import assert from 'node:assert/strict';
import { priceList, buildGymLink, parseGymLink, resolveGymLink, makePurchase, creditsLeft, useCredit, payBlock, totalCredits } from '../src/lib/fitness/gymPay.ts';
import { PARTNER_GYMS } from '../src/lib/fitness/data.ts';

const g = PARTNER_GYMS[0];
test('listino: tre voci per centro, prezzi interi e positivi, diversi da centro a centro', () => {
  for (const x of PARTNER_GYMS) { const l = priceList(x); assert.equal(l.length, 3); for (const i of l) assert.ok(Number.isInteger(i.lp) && i.lp > 0); assert.ok(l.find((i) => i.id === 'pack10').lp < l.find((i) => i.id === 'single').lp * 10); }
  assert.ok(new Set(PARTNER_GYMS.map((x) => priceList(x)[0].lp)).size > 1);
});
test('QR: costruzione e lettura, codici falsi rifiutati', () => {
  const it = priceList(g)[0];
  const link = buildGymLink(g.id, it);
  assert.deepEqual(parseGymLink(link), { gymId: g.id, itemId: 'single', lp: it.lp });
  assert.equal(parseGymLink('lp://pay/Marco'), null); assert.equal(parseGymLink('https://x.it'), null); assert.equal(parseGymLink('lp://gym/'), null);
  assert.equal(parseGymLink('lp://gym/g1?i=single&a=-5').lp, undefined);
});
test('QR con prezzo diverso dal listino non si paga', () => {
  const it = priceList(g)[0];
  assert.equal(resolveGymLink(buildGymLink(g.id, it), PARTNER_GYMS).ok, true);
  const bad = resolveGymLink(`lp://gym/${g.id}?i=single&a=1`, PARTNER_GYMS);
  assert.equal(bad.ok, false); assert.match(bad.reason, /non corrisponde/);
  assert.equal(resolveGymLink('lp://gym/inesistente', PARTNER_GYMS).ok, false);
  assert.equal(resolveGymLink(`lp://gym/${g.id}?i=boh`, PARTNER_GYMS).ok, false);
  const open = resolveGymLink(`lp://gym/${g.id}`, PARTNER_GYMS); assert.equal(open.ok, true); assert.equal(open.item, undefined); assert.equal(open.items.length, 3);
});
test('ingressi: acquisto, uso (prima il più vicino alla scadenza), scadenza, saldo', () => {
  const now = 1_000_000_000_000;
  const [single, , pack] = priceList(g);
  let list = [makePurchase('a', g, pack, now), makePurchase('b', g, single, now)];
  assert.equal(creditsLeft(list, g.id, now), 11); assert.equal(totalCredits(list, now), 11);
  let r = useCredit(list, g.id, now); assert.ok(r.ok); list = r.list;
  assert.equal(list.find((p) => p.id === 'b').left, 0);
  assert.equal(creditsLeft(list, g.id, now + 8 * 86400000), 10);
  assert.equal(creditsLeft(list, 'altro', now), 0);
  assert.equal(useCredit([], g.id, now).ok, false);
  assert.match(payBlock(5, 12), /Servono 12/); assert.equal(payBlock(50, 12), null);
});
