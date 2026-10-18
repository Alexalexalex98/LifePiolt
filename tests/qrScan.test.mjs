import test from 'node:test';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';
import { swissQrFrom } from '../src/lib/bills/qrScan.ts';

const lines = ['SPC', '0200', '1', 'CH5800791123000889012', 'S', 'Azienda SA', 'Via Roma', '1', '6900', 'Lugano', 'CH', '', '', '', '', '', '', '', '89.90', 'CHF', '', '', '', '', '', '', '', 'QRR', '210000000003139471430009017', 'Fattura 123', 'EPD'];
test('riconosce il contenuto di un QR-bill svizzero', () => {
  assert.equal(swissQrFrom(lines.join('\n') + '\naltro testo'), lines.join('\n'));
  assert.equal(swissQrFrom('niente qui'), null);
  assert.equal(swissQrFrom(null), null);
  assert.equal(swissQrFrom('SPC\n0200\n1'), null);
});
test('il contenuto entra in un QR di livello M', () => {
  const q = qrcode(0, 'M'); q.addData(lines.join('\n'), 'Byte'); q.make();
  assert.ok(q.getModuleCount() >= 25 && q.getModuleCount() <= 100);
});
