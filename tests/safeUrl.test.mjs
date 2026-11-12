import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, onDomain } from '../src/lib/safeUrl.ts';

test('collegamenti sicuri', () => {
  assert.equal(safeUrl('https://esempio.it/a?b=1'), 'https://esempio.it/a?b=1'); assert.equal(safeUrl(' http://x.ch '), 'http://x.ch'); assert.equal(safeUrl('mailto:a@b.it'), 'mailto:a@b.it'); assert.equal(safeUrl('tel:+41790000000'), 'tel:+41790000000');
  assert.equal(safeUrl('esempio.it/pagina'), 'https://esempio.it/pagina');
});
test('collegamenti rifiutati', () => {
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', 'file:///etc/passwd', 'data:text/html,<script>', 'intent://x#Intent;end', 'lifepilot://settings', 'whatsapp://send?text=x', 'content://x', 'https://banca.it@evil.com/', 'https://', '', '   ', null, 42, 'ciao', 'x'.repeat(3000)]) assert.equal(safeUrl(bad), null, String(bad).slice(0, 40));
});
test('dominio delle pagine dentro l\'app', () => {
  const D = ['jit.si', '8x8.vc'];
  assert.equal(onDomain('https://meet.jit.si/lp-abc#config', D), true); assert.equal(onDomain('https://jit.si', D), true); assert.equal(onDomain('https://a.b.8x8.vc:443/x', D), true);
  for (const bad of ['https://jit.si.evil.com/', 'https://evil.com/jit.si', 'https://meet.jit.si@evil.com/', 'http://meet.jit.si/', 'https://notjit.si/', 'https://evil.com/?u=https://meet.jit.si/']) assert.equal(onDomain(bad, D), false, bad);
});
