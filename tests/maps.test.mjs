import test from 'node:test';
import assert from 'node:assert/strict';
import { mapsUrl } from '../src/lib/maps.ts';

test('luogo nelle mappe: Apple su iPhone, geo su Android, Google sul web', () => {
  assert.equal(mapsUrl(' Parco Ciani, Lugano ', 'ios'), 'https://maps.apple.com/?q=Parco%20Ciani%2C%20Lugano');
  assert.equal(mapsUrl('Lugano', 'android'), 'geo:0,0?q=Lugano');
  assert.match(mapsUrl('Lugano', 'web'), /google\.com\/maps\/search\/\?api=1&query=Lugano/);
});
