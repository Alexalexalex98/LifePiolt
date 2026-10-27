import test from 'node:test';
import assert from 'node:assert/strict';
import { statementRelation } from '../src/lib/statementRelation.ts';

const days = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10));
test('novembre dopo ottobre: continua', () => assert.equal(statementRelation(days('2026-10-01', 31), days('2026-11-01', 30), 0), 'continues'));
test('stesso estratto ricaricato: continua', () => assert.equal(statementRelation(days('2026-10-01', 31), days('2026-10-01', 31), 31), 'continues'));
test('stesso periodo ma movimenti diversi: non c\'entra', () => assert.equal(statementRelation(days('2026-10-01', 31), days('2026-10-01', 31), 0), 'unrelated'));
test('un anno prima: non c\'entra', () => assert.equal(statementRelation(days('2026-10-01', 31), days('2025-03-01', 31), 0), 'unrelated'));
test('niente da confrontare: continua', () => assert.equal(statementRelation([], days('2026-10-01', 5), 0), 'continues'));
