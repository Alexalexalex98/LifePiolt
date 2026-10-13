import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesDates, validateSeminar, scopeIds, applySeminarEdit, deletionImpact, validateService, toggleSlot, sortSlots } from '../src/lib/offerEdit.ts';

const D = 86400000;
const NOW = Date.UTC(2026, 9, 13, 10, 0);
const mk = (id, off, series) => ({ id, title: 'Budget familiare', host: 'Alex', price: 25, promoted: false, startsAt: NOW + off * D, durationMin: 60, seats: 30, joined: 5, series });
const list = [mk(1, -7, 's'), mk(2, 7, 's'), mk(3, 14, 's'), mk(4, 21, 's'), mk(9, 3), { ...mk(5, 5, 'x'), host: 'Altro' }];
const form = { title: 'Organizzare il budget', desc: 'x'.repeat(80), learn: '', audience: '', startsAt: NOW + D, durationMin: 60, mode: 'online', place: 'Link', language: 'Italiano', price: '25', seats: '30' };

test('serie: date ogni settimana, due settimane, mese; massimo 26', () => {
  assert.deepEqual(seriesDates(NOW, 'week', 3).map((t) => Math.round((t - NOW) / D)), [0, 7, 14]);
  assert.deepEqual(seriesDates(NOW, '2weeks', 3).map((t) => Math.round((t - NOW) / D)), [0, 14, 28]);
  assert.equal(new Date(seriesDates(NOW, 'month', 3)[2]).getMonth(), (new Date(NOW).getMonth() + 2) % 12);
  assert.equal(seriesDates(NOW, 'week', 99).length, 26);
  assert.equal(seriesDates(NOW, 'week', 0).length, 1);
});
test('validazione seminario', () => {
  assert.equal(validateSeminar(form, { now: NOW }), null);
  assert.match(validateSeminar({ ...form, title: 'corto' }, { now: NOW }), /titolo/);
  assert.match(validateSeminar({ ...form, startsAt: NOW - 1 }, { now: NOW }), /futuro/);
  assert.equal(validateSeminar({ ...form, startsAt: NOW - 1 }, { now: NOW, keepPast: true }), null);
  assert.match(validateSeminar({ ...form, seats: '3' }, { now: NOW, joined: 5 }), /5 iscritti/);
  assert.match(validateSeminar({ ...form, price: '' }, { now: NOW }), /prezzo/);
});
test('ambito: solo questo, da qui in poi, tutta la serie (mai le passate)', () => {
  assert.deepEqual(scopeIds(list, 2, 'one', NOW), [2]);
  assert.deepEqual(scopeIds(list, 2, 'following', NOW), [2, 3, 4]);
  assert.deepEqual(scopeIds(list, 3, 'following', NOW), [3, 4]);
  assert.deepEqual(scopeIds(list, 3, 'all', NOW), [2, 3, 4]);
  assert.deepEqual(scopeIds(list, 9, 'all', NOW), [9]);
});
test('modifica: campi per tutta la serie, orario spostato della stessa distanza, altri host intatti', () => {
  const r = applySeminarEdit(list, 2, { title: 'Nuovo titolo', price: 30, startsAt: list[1].startsAt + D }, 'all', NOW);
  const by = (id) => r.list.find((s) => s.id === id);
  assert.equal(by(3).title, 'Nuovo titolo'); assert.equal(by(3).price, 30);
  assert.equal(by(2).startsAt, list[1].startsAt + D); assert.equal(by(3).startsAt, list[2].startsAt + D); assert.equal(by(4).startsAt, list[3].startsAt + D);
  assert.equal(by(1).title, 'Budget familiare'); assert.equal(by(5).title, 'Budget familiare');
  assert.deepEqual(r.changed.sort(), [2, 3, 4]);
  const one = applySeminarEdit(list, 3, { place: 'Sala' }, 'one', NOW);
  assert.equal(one.list.find((s) => s.id === 3).place, 'Sala'); assert.equal(one.list.find((s) => s.id === 4).place, undefined);
});
test('eliminare: quante persone e quanti LP da rimborsare', () => {
  const imp = deletionImpact(list, [2, 3], { 'seminar:2': [{ name: 'A', paid: 25 }, { name: 'B', paid: 25 }] });
  assert.equal(imp.refund, 50); assert.equal(imp.people, 5 + 5);
});
test('servizio: validazione e orari settimanali', () => {
  const f = { role: 'Lezione di francese', tag: 'Lingue', price: '40', durationMin: 60, mode: 'online', place: 'Videochiamata', language: 'Italiano', desc: 'x'.repeat(40), slots: ['Lun 16:00'] };
  assert.equal(validateService(f), null);
  assert.match(validateService({ ...f, slots: [] }), /giorno e un orario/);
  assert.match(validateService({ ...f, role: 'ab' }), /offri/);
  assert.deepEqual(toggleSlot(['Mar 10:00'], 'Lun 16:00'), ['Lun 16:00', 'Mar 10:00']);
  assert.deepEqual(toggleSlot(['Lun 16:00'], 'Lun 16:00'), []);
  assert.deepEqual(sortSlots(['Gio 09:00', 'Lun 18:00', 'Lun 09:00']), ['Lun 09:00', 'Lun 18:00', 'Gio 09:00']);
});
