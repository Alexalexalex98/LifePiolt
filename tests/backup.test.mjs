import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, serializeBackup, validateBackup, toStorageEntries, backupFileName, BACKUP_FORMAT } from '../src/lib/backupCore.ts';

const raw = {
  'lp2-app': JSON.stringify({ state: { onboarded: true, account: { name: 'Alex' } }, version: 0 }),
  'lp2-life': JSON.stringify({ state: { tasks: [1, 2, 3], notes: [1] }, version: 0 }),
  'altra-chiave': JSON.stringify({ state: { x: 1 } }),
  'lp2-rotto': '{non json',
  'lp2-vuoto': null,
};

test('buildBackup include solo store lp2 validi', () => {
  const b = buildBackup(raw, '1.2.3', new Date('2026-03-04T10:00:00Z'));
  assert.equal(b.app, 'LifePilot');
  assert.equal(b.format, BACKUP_FORMAT);
  assert.deepEqual(Object.keys(b.stores), ['lp2-app', 'lp2-life']);
  assert.equal(b.createdAt, '2026-03-04T10:00:00.000Z');
});

test('round trip: validate restituisce anteprima e dati identici', () => {
  const text = serializeBackup(buildBackup(raw, '1.0.0'));
  const v = validateBackup(text);
  assert.equal(v.ok, true);
  assert.equal(v.preview.storeCount, 2);
  assert.equal(v.preview.items.life, 4);
  assert.equal(v.preview.totalItems, 4);
  assert.equal(v.preview.appVersion, '1.0.0');
  const entries = toStorageEntries(v.backup);
  assert.deepEqual(JSON.parse(entries.find(([k]) => k === 'lp2-life')[1]).state.tasks, [1, 2, 3]);
});

test('rifiuta file non LifePilot, non JSON, versione futura, vuoti o danneggiati', () => {
  assert.equal(validateBackup('ciao').ok, false);
  assert.equal(validateBackup('{"app":"Altro","format":1,"stores":{}}').ok, false);
  assert.equal(validateBackup('null').ok, false);
  const fut = validateBackup(JSON.stringify({ app: 'LifePilot', format: 99, stores: { 'lp2-app': { state: {} } } }));
  assert.equal(fut.ok, false);
  assert.match(fut.error, /più recente/);
  assert.equal(validateBackup(JSON.stringify({ app: 'LifePilot', format: 1, stores: {} })).ok, false);
  assert.equal(validateBackup(JSON.stringify({ app: 'LifePilot', format: 1, stores: { 'lp2-app': 5 } })).ok, false);
  assert.equal(validateBackup(JSON.stringify({ app: 'LifePilot', format: 1, stores: { 'evil': { state: {} } } })).ok, false);
  assert.equal(validateBackup(JSON.stringify({ app: 'LifePilot', format: 1, stores: { 'lp2-life': { state: {} } } })).ok, false);
  assert.equal(validateBackup(JSON.stringify({ app: 'LifePilot', format: 0, stores: { 'lp2-app': { state: {} } } })).ok, false);
});

test('nome file con data', () => {
  assert.equal(backupFileName(new Date(2026, 0, 5)), 'lifepilot-backup-2026-01-05.json');
});
