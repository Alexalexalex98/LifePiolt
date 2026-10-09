import test from 'node:test';
import assert from 'node:assert/strict';
import { setActive } from '../src/i18n/core.ts';
import { fmtDate, fmtNumber, fmtTime, formatMoney, monthName, weekdayShort, localizeMonths, setFormatPrefs, currentLocale } from '../src/i18n/format.ts';

test('formatMoney per lingua e valuta', () => {
  setActive('en'); setFormatPrefs({ currency: 'USD', timeFormat: '24h' });
  assert.equal(formatMoney(1234.5), 'US$1,235');
  assert.equal(formatMoney(1234.5, { decimals: 2 }), 'US$1,234.50');
  assert.equal(formatMoney(5000, { currency: 'JPY' }), 'JP¥5,000');
  assert.match(formatMoney(5000.7, { currency: 'IDR', decimals: 2 }), /5[.,]001/);
  setActive('de'); assert.match(formatMoney(1234, { currency: 'EUR' }), /1\.234\s€/);
  setActive('ar'); assert.match(formatMoney(12, { currency: 'USD' }), /12/);
  assert.equal(formatMoney(12, { currency: 'USD', sign: true }).includes('+'), true);
});
test('fmtNumber / fmtDate / ora 12h-24h', () => {
  setActive('it'); setFormatPrefs({ timeFormat: '24h' });
  assert.equal(fmtNumber(1234567), '1.234.567');
  const d = new Date(2026, 9, 9, 14, 30);
  assert.equal(fmtTime(d), '14:30');
  setActive('en'); setFormatPrefs({ timeFormat: '12h' });
  assert.match(fmtTime(d), /2:30/); assert.match(fmtTime(d), /pm/i);
  assert.match(fmtDate(d, { day: 'numeric', month: 'long' }), /October/);
  assert.equal(currentLocale(), 'en-GB');
});
test('mesi, giorni e localizeMonths', () => {
  setActive('fr'); assert.equal(monthName(9), 'octobre'); assert.match(weekdayShort(1), /lun/);
  assert.equal(localizeMonths('Ottobre 2026'), 'Octobre 2026');
  setActive('it'); assert.equal(localizeMonths('Ottobre 2026'), 'Ottobre 2026');
});
