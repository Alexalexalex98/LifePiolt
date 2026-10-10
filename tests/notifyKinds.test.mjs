import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, KIND_ORDER, kindOf, kindEnabled, decidePush, buildPush, groupNotifs, groupSummary, unreadByKind, actorOf } from '../src/lib/notifyKinds.ts';

test('mappatura type -> categoria, sconosciuti su sistema', () => {
  const m = { booking: 'servizio', like: 'sociale', comment: 'sociale', follow: 'sociale', vote: 'sociale', donation: 'lifepoints', contribution: 'lifepoints', goal: 'lifepoints', reminder: 'promemoria', seminar: 'seminario', message: 'messaggio', job: 'lavoro', xyz: 'sistema', '': 'sistema' };
  for (const [type, kind] of Object.entries(m)) assert.equal(kindOf({ type }), kind, type);
  assert.equal(kindOf({ type: 'like', kind: 'servizio' }), 'servizio');
  assert.equal(kindOf({ type: 'like', kind: 'boh' }), 'sociale');
});

test('ogni categoria ha identità, canale e icone distinti', () => {
  assert.equal(KIND_ORDER.length, Object.keys(KINDS).length);
  const ids = new Set(KIND_ORDER.map((k) => KINDS[k].channel.id));
  assert.equal(ids.size, KIND_ORDER.length);
  assert.equal(KINDS.servizio.channel.importance, 'HIGH');
  assert.equal(KINDS.sociale.channel.sound, false);
  assert.equal(KINDS.lifepoints.channel.importance, 'LOW');
  assert.ok(KINDS.servizio.channel.vibration.length > KINDS.promemoria.channel.vibration.length);
  assert.notEqual(KINDS.servizio.color, KINDS.sociale.color);
});

test('preferenze per categoria (mancanti = attive)', () => {
  assert.equal(kindEnabled(undefined, 'sociale'), true);
  assert.equal(kindEnabled({ sociale: false }, 'sociale'), false);
  assert.equal(kindEnabled({ sociale: false }, 'servizio'), true);
});

test('push immediata: solo tipi importanti e abilitati', () => {
  assert.equal(decidePush({ type: 'booking' }).push, true);
  assert.equal(decidePush({ type: 'seminar' }).push, true);
  assert.equal(decidePush({ type: 'message' }).push, true);
  assert.equal(decidePush({ type: 'job' }).push, true);
  assert.equal(decidePush({ type: 'donation' }).push, true);
  assert.equal(decidePush({ type: 'like' }).push, false);
  assert.equal(decidePush({ type: 'follow' }).push, false);
  assert.equal(decidePush({ type: 'contribution' }).push, false);
  assert.equal(decidePush({ type: 'xyz' }).push, false);
  assert.equal(decidePush({ type: 'booking' }, { servizio: false }).push, false);
  assert.equal(decidePush({ type: 'booking' }, { sociale: false }).push, true);
});

test('titolo e canale della notifica push', () => {
  const p = buildPush({ type: 'booking', text: 'Marco T. ha prenotato una consulenza con te' });
  assert.equal(p.title, 'Servizio · Nuova richiesta di Marco T.');
  assert.equal(p.channelId, 'lp-servizio');
  assert.equal(p.sound, true);
  const d = buildPush({ type: 'donation', text: 'Sophie M. ti ha donato il suo LifePoint di oggi' });
  assert.equal(d.channelId, 'lp-lifepoints');
  assert.equal(d.passive, true);
  assert.match(d.title, /^LifePoints · /);
});

test('raggruppamento di mi piace e commenti', () => {
  assert.equal(actorOf('Giulia M. ha messo mi piace al tuo post'), 'Giulia M.');
  const list = [
    { id: 1, type: 'like', text: 'Anna R. ha messo mi piace al tuo post', read: false },
    { id: 2, type: 'booking', text: 'Marco T. ha prenotato una consulenza con te', read: false },
    { id: 3, type: 'like', text: 'Luca F. ha messo mi piace al tuo post', read: true },
    { id: 4, type: 'like', text: 'Sara B. ha messo mi piace al tuo post', read: false },
    { id: 5, type: 'like', text: 'Anna R. ha messo mi piace al tuo post', read: false },
    { id: 6, type: 'comment', text: 'Tom V. ha commentato il tuo post', read: false },
    { id: 7, type: 'donation', text: 'Sophie M. ti ha donato il suo LifePoint di oggi', read: true },
  ];
  const g = groupNotifs(list);
  assert.equal(g.length, 4);
  const likes = g.find((x) => x.type === 'like');
  assert.deepEqual(likes.ids, [1, 3, 4, 5]);
  assert.equal(likes.unread, 3);
  assert.equal(likes.text, 'Anna R. e altre 2 persone hanno messo mi piace');
  assert.equal(g.find((x) => x.type === 'booking').items.length, 1);
  assert.equal(g.find((x) => x.type === 'comment').text, 'Tom V. ha commentato il tuo post');
  assert.equal(g[0].type, 'like'); // ordine di prima comparsa
  assert.equal(groupSummary('like', ['A', 'B'], 2, 'x'), 'A e B hanno messo mi piace');
});

test('non lette per categoria', () => {
  const r = unreadByKind([{ type: 'like', read: false }, { type: 'like', read: false }, { type: 'booking', read: false }, { type: 'vote', read: true }]);
  assert.equal(r.sociale, 2); assert.equal(r.servizio, 1); assert.equal(r.sistema, 0);
});
