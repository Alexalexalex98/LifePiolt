import test from 'node:test';
import assert from 'node:assert/strict';
import { toDoc, fromRemote, pendingUploads, mediaPathFor, docKey } from '../src/lib/club/serverDoc.ts';

const club = () => ({ id: 'c1', owner: 'Ale', name: 'Club', tagline: '', description: '', cover: { c1: '#111', c2: '#222', uri: 'file://x.jpg' }, categories: [], createdAt: 1, published: true, adult: false,
  pricing: { monthly: 9, currency: 'EUR', trialDays: 0, yearlyDiscountPct: 0 }, chat: { write: 'members', chosen: [], slowSec: 0, commentsWhenReadOnly: true }, posts: [],
  courses: [{ id: 'co1', title: 'C', description: '', level: 'base', sections: [], published: true, createdAt: 1, lessons: [
    { id: 'l1', title: 'Video', kind: 'video', sectionId: 's', order: 0, tier: 'premium', preview: false, uri: 'file:///a.mp4', fileName: 'a.mp4' },
    { id: 'l2', title: 'Testo', kind: 'testo', sectionId: 's', order: 1, tier: 'free', preview: true, text: 'ciao' }] }] });

test('il documento non porta mai i file del telefono', () => {
  const d = toDoc(club());
  assert.equal(JSON.stringify(d).includes('file://'), false);
  assert.equal(d.club.pricing.monthly, 9);
});
test('solo le lezioni con un file vero vanno caricate', () => {
  const p = pendingUploads(club());
  assert.deepEqual(p.map((x) => x.lesson.id), ['l1']);
  assert.equal(mediaPathFor('c1', p[0].lesson), 'c1/premium/l1.mp4');
});
test('dal server: lezione Premium bloccata e file con indirizzo firmato', () => {
  const c = fromRemote({ id: 'c1', owner: 'Ale', name: 'Club', pricing: { monthly: 5 }, counts: { followers: 2, free: 3, premium: 1 },
    courses: [{ id: 'co1', lessons: [{ id: 'l1', title: 'x', tier: 'premium', locked: true }, { id: 'l2', title: 'y', tier: 'free', mediaPath: 'c1/free/l2.mp4' }] }] }, { 'c1/free/l2.mp4': 'https://u/1' });
  assert.equal(c.remote, true);
  assert.equal(c.courses[0].lessons[0].locked, true);
  assert.equal(c.courses[0].lessons[1].uri, 'https://u/1');
  assert.equal(c.pricing.monthly, 5);
  assert.equal(c.baseline.free, 3);
});
test('caricare un file non cambia il documento da inviare finché non cambia il percorso', () => {
  const a = club(); const b = club(); b.courses[0].lessons[0].uri = 'file:///altro.mp4';
  assert.equal(docKey(a), docKey(b));
});
