import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDoc, monthInName, normName, fileExt, taxDocFolder, fmtBytes } from '../src/lib/docCheck.ts';

const ps = { key: 'ps|Gennaio|Titolare', label: 'Busta paga Gennaio · Titolare', group: 'Buste paga' };
const psC = { key: 'ps|Gennaio|Coniuge', label: 'Busta paga Gennaio · Coniuge', group: 'Buste paga' };
const bank = { key: 'bank|UBS', label: 'Estratto conto al 31.12 · UBS', group: 'Conti bancari' };
const cm = { key: 'doc|cassamalati', label: 'Attestato premi cassa malati', group: 'Altri documenti' };
const K = 150 * 1024;

test('utilita base', () => {
  assert.equal(fileExt('A.B.PDF'), 'pdf');
  assert.equal(fileExt('senza'), '');
  assert.equal(normName('Busta_Paga-Gennaio.2024'), 'busta paga gennaio 2024');
  assert.equal(monthInName('stipendio gennaio'), 0);
  assert.equal(monthInName('payslip dec 2024'), 11);
  assert.equal(monthInName('lohn 2024 03'), 2);
  assert.equal(monthInName('documento qualunque'), -1);
  assert.equal(fmtBytes(2048), '2 KB');
});

test('busta paga corretta', () => {
  const r = checkDoc(ps, { name: 'Busta_paga_Gennaio_titolare.pdf', size: K });
  assert.equal(r.status, 'ok');
  assert.equal(r.title, 'Sembra corretto');
  assert.equal(checkDoc(ps, { name: 'Stipendio gennaio 2025.PDF', size: K }).status, 'ok');
  assert.equal(checkDoc(ps, { name: 'payslip_january.pdf', size: K }).status, 'ok');
});

test('busta paga: mese o persona sbagliati sono dubbi', () => {
  assert.equal(checkDoc(ps, { name: 'busta paga marzo.pdf', size: K }).status, 'dubbio');
  assert.equal(checkDoc(ps, { name: 'busta paga gennaio coniuge.pdf', size: K }).status, 'dubbio');
  assert.equal(checkDoc(psC, { name: 'busta paga gennaio coniuge.pdf', size: K }).status, 'ok');
  assert.equal(checkDoc(psC, { name: 'busta paga gennaio titolare.pdf', size: K }).status, 'dubbio');
});

test('nome generico da fotocamera e' + " dubbio", () => {
  const r = checkDoc(ps, { name: 'IMG_4521.jpg', size: 2 * 1024 * 1024 });
  assert.equal(r.status, 'dubbio');
  assert.match(r.title, /^Non sono sicuro: il nome del file non richiama busta paga Gennaio/);
});

test('estratto conto', () => {
  assert.equal(checkDoc(bank, { name: 'estratto_conto_UBS_2024.pdf', size: K }).status, 'ok');
  assert.equal(checkDoc(bank, { name: 'ubs.pdf', size: K }).status, 'ok');
  assert.equal(checkDoc(bank, { name: 'statement 31.12.pdf', size: K }).status, 'ok');
  assert.equal(checkDoc(bank, { name: 'ricetta.pdf', size: K }).status, 'dubbio');
});

test('altri documenti', () => {
  assert.equal(checkDoc(cm, { name: 'Attestato premi 2024 Helsana.pdf', size: K }).status, 'ok');
  assert.equal(checkDoc(cm, { name: 'vacanze.pdf', size: K }).status, 'dubbio');
  assert.equal(checkDoc({ key: 'doc|ipoteca', label: 'Interessi su mutuo/ipoteca' }, { name: 'mutuo_interessi.pdf', size: K }).status, 'ok');
});

test('file non valido', () => {
  for (const f of [{ name: 'virus.exe', size: K }, { name: 'busta paga gennaio.pdf', size: 0 }, { name: 'senzaestensione', size: K }, { name: 'busta paga gennaio.pdf', size: 80 * 1024 * 1024 }, { name: 'busta paga.zip', size: K }]) {
    const r = checkDoc(ps, f);
    assert.equal(r.status, 'invalido', f.name);
    assert.equal(r.title, 'File non valido');
  }
});

test('size sconosciuta non blocca', () => {
  assert.equal(checkDoc(ps, { name: 'busta paga gennaio.pdf' }).status, 'ok');
});

test('cartelle LifeDrive', () => {
  assert.equal(taxDocFolder('ps|Gennaio|Titolare'), 'Documenti');
  assert.equal(taxDocFolder('doc|cassamalati'), 'Salute');
  assert.equal(taxDocFolder('doc|donazioni'), 'Ricevute');
  assert.equal(taxDocFolder('bank|UBS'), 'Documenti');
});
