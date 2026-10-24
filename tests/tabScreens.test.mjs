import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('ogni pagina di (tabs) e dichiarata in tabScreens.ts', () => {
  const files = readdirSync('src/app/(tabs)').filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx').map((f) => f.slice(0, -4));
  const src = readFileSync('src/lib/tabScreens.ts', 'utf8');
  const listed = [...src.matchAll(/'([^']+)',/g)].map((m) => m[1]);
  assert.deepEqual(files.filter((f) => !listed.includes(f)), []);
  assert.deepEqual(listed.filter((f) => !files.includes(f)), []);
});
