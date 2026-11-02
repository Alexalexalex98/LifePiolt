import test from 'node:test';
import assert from 'node:assert/strict';
import { planTotals, leftAfter, pastUnpaid } from '../src/lib/bills/installments.ts';
const inv = { installments: [{ dueDate: '2026-10-31', amount: 100 }, { dueDate: '2026-11-30', amount: 100 }, { dueDate: '2026-12-31', amount: 100.5, paidAt: '2026-12-31' }, { dueDate: '2027-01-31', amount: 100 }] };
test('totali del piano', () => { assert.deepEqual(planTotals(inv), { total: 400.5, paid: 100.5, left: 300, count: 4, paidCount: 1 }); });
test('quanto resta dopo una rata', () => { assert.equal(leftAfter(inv, 0), 200); assert.equal(leftAfter(inv, 1), 100); assert.equal(leftAfter(inv, 3), 0); });
test('rate passate non segnate', () => { assert.deepEqual(pastUnpaid(inv, '2026-12-05'), [0, 1]); assert.deepEqual(pastUnpaid(inv, '2026-10-01'), []); });
