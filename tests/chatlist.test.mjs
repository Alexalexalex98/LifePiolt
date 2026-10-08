import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, lastMessage, previewParts, previewText, searchText, sortRows, unreadOf } from '../src/lib/chatList.ts';

const now = Date.now();
const m = (from, ts, extra = {}) => ({ from, kind: 'text', text: 'x', ts, ...extra });

test('ultimo messaggio = il più recente per data, anche se non è in fondo all\'array', () => {
  const msgs = [m('a', now - 1000), m('b', now - 5000), m('a', now - 3000)];
  assert.equal(lastMessage(msgs).ts, now - 1000);
  assert.equal(lastMessage([]), undefined);
});

test('ordinamento: fissate sopra, poi più recente', () => {
  const chats = [
    { id: 'old', createdAt: 1, lastRead: 0 },
    { id: 'new', createdAt: 1, lastRead: 0 },
    { id: 'pin', createdAt: 1, lastRead: 0, pinned: true },
  ];
  const messages = { old: [m('x', now - 9000)], new: [m('x', now - 1000), m('x', now - 4000)], pin: [m('x', now - 99999)] };
  const rows = sortRows(buildRows(chats, messages, 'me'));
  assert.deepEqual(rows.map((r) => r.c.id), ['pin', 'new', 'old']);
  assert.equal(rows[1].last.ts, now - 1000);
});

test('chat senza messaggi usa createdAt; i messaggi nascosti non contano', () => {
  const chats = [{ id: 'e', createdAt: now - 500, lastRead: 0 }, { id: 'h', createdAt: 1, lastRead: 0 }];
  const messages = { h: [m('x', now - 10), m('x', now - 20, { hiddenFor: ['me'] })] };
  const rows = buildRows(chats, messages, 'me');
  assert.equal(rows[0].ts, now - 500);
  assert.equal(rows[1].last.ts, now - 10);
  assert.deepEqual(sortRows(rows).map((r) => r.c.id), ['h', 'e']);
});

test('non lette: solo messaggi altrui dopo lastRead, senza sistema', () => {
  const c = { id: 'c', createdAt: 1, lastRead: now - 1000 };
  const msgs = [m('x', now - 2000), m('x', now - 500), m('me', now - 400), m('system', now - 300, { kind: 'system' }), m('x', now - 200, { hiddenFor: ['me'] })];
  assert.equal(unreadOf(c, msgs, 'me'), 1);
});

test('anteprime dei tipi speciali', () => {
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'slots', slots: { title: 'Call' } }), 'Proposta orari: Call');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'agenda', agenda: { mode: 'dettagli' } }), 'Agenda condivisa');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'tasks', taskList: { title: 'Spesa' } }), 'Lista task: Spesa');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'note', noteShare: { title: 'Idee' } }), 'Nota: Idee');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'poll', poll: { q: 'Dove?' } }), 'Sondaggio: Dove?');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'location' }), 'Posizione');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'contact', contact: { name: 'Anna' } }), 'Contatto: Anna');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'image' }), 'Foto');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'audio', media: { durationMs: 12000 } }), 'Vocale 0:12');
  assert.equal(previewText({ from: 'a', ts: 1, kind: 'event', event: { title: 'Cena' } }), 'Invito: Cena');
  assert.equal(previewParts({ from: 'a', ts: 1, kind: 'event', event: { title: 'Cena' } }).icon, 'calendar');
  assert.equal(previewParts({ from: 'a', ts: 1, kind: 'text', text: 'ciao' }).icon, undefined);
});

test('ricerca: trova luogo e opzioni; non cerca nei messaggi eliminati', () => {
  assert.ok(searchText({ from: 'a', ts: 1, kind: 'event', event: { title: 'Cena', place: 'Ristorante Lago' } }).includes('lago'));
  assert.ok(searchText({ from: 'a', ts: 1, kind: 'poll', poll: { q: 'Cosa?', options: [{ t: 'Pizza' }] } }).includes('pizza'));
  assert.equal(searchText({ from: 'a', ts: 1, kind: 'text', text: 'segreto', deletedForAll: true }), '');
});

import { planTitleFor, rsvpSummary } from '../src/lib/chatList.ts';
test('riepilogo risposte e titolo provvisorio', () => {
  const s = rsvpSummary({ Anna: 'yes', Luca: 'maybe', Gio: 'no', Pia: 'yes' });
  assert.deepEqual(s, { yes: ['Anna', 'Pia'], maybe: ['Luca'], no: ['Gio'] });
  assert.deepEqual(rsvpSummary(undefined), { yes: [], maybe: [], no: [] });
  assert.equal(planTitleFor('Cena', 'maybe'), 'Cena (forse)');
  assert.equal(planTitleFor('Cena', 'yes'), 'Cena');
});
