import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AVATAR_IDS, avatarFor, isAvatarId } from '../src/lib/theiaAvatarIds.ts';

test('le 20 facce esistono come immagini', () => {
  assert.equal(AVATAR_IDS.length, 20);
  const files = fs.readdirSync(new URL('../assets/theia/avatars/', import.meta.url));
  for (const [i, id] of AVATAR_IDS.entries()) assert.ok(files.includes(`${String(i + 1).padStart(2, '0')}-${id}.png`), id);
});
test('la faccia segue il campo dell\'esperta, poi la sezione', () => {
  assert.equal(avatarFor('Generale', 'salute'), 'salute');
  assert.equal(avatarFor('Finanze', undefined), 'finanza');
  assert.equal(avatarFor('Finanze', 'fisco'), 'fisco');
  assert.equal(avatarFor('Musica', undefined), null);
  assert.equal(avatarFor(undefined, 'boh'), null);
  assert.ok(isAvatarId('viaggi') && !isAvatarId('x'));
});
