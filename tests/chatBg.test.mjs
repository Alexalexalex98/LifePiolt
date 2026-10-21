import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWall, presetWall, photoWall, wallLabel } from '../src/lib/chatBg.ts';

test('sfondi chat: colori di prima, modelli e foto', () => {
  assert.deepEqual(parseWall(undefined), { kind: 'color', key: 'default' });
  assert.deepEqual(parseWall('verde'), { kind: 'color', key: 'verde' });
  assert.equal(parseWall(presetWall('tramonto')).kind, 'preset');
  assert.deepEqual(parseWall(photoWall('file:///a b.jpg')), { kind: 'photo', uri: 'file:///a b.jpg' });
});
test('sfondi chat: valori rovinati tornano al normale', () => {
  assert.deepEqual(parseWall('preset:inesistente'), { kind: 'color', key: 'default' });
  assert.deepEqual(parseWall('photo:'), { kind: 'color', key: 'default' });
});
test('sfondi chat: etichette', () => {
  const lab = (k) => ({ verde: 'Verde' }[k]);
  assert.equal(wallLabel('verde', lab), 'Verde');
  assert.equal(wallLabel(presetWall('aurora'), lab), 'Aurora');
  assert.equal(wallLabel(photoWall('x'), lab), 'La tua foto');
  assert.equal(wallLabel(undefined, lab), 'LifePilot');
});
