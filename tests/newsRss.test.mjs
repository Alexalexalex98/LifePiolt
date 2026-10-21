import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, mergeNews, decode, agoText } from '../src/lib/news/rss.ts';

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>X</title>
<item><title><![CDATA[Governo &amp; sindacati: accordo]]></title><link>https://ex.it/a?x=1&amp;y=2</link><pubDate>Wed, 21 Oct 2026 10:00:00 +0000</pubDate><media:content url="https://ex.it/i.jpg" medium="image"/></item>
<item><title>Senza link</title></item>
<item><title>Con immagine nel testo</title><link>https://ex.it/b</link><pubDate>Wed, 21 Oct 2026 11:30:00 GMT</pubDate><description>&lt;p&gt;&lt;img src="https://ex.it/p.png"/&gt;Testo&lt;/p&gt;</description></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom uno</title><link href="https://at.ch/1"/><updated>2026-10-21T09:00:00Z</updated></entry></feed>`;
const NOW = Date.parse('2026-10-21T12:00:00Z');

test('rss: titoli, link, data e immagini', () => {
  const r = parseFeed(RSS, 'Ex', NOW);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, 'Governo & sindacati: accordo');
  assert.equal(r[0].link, 'https://ex.it/a?x=1&y=2');
  assert.equal(r[0].image, 'https://ex.it/i.jpg');
  assert.equal(r[0].ts, Date.parse('2026-10-21T10:00:00Z'));
  assert.equal(r[1].image, 'https://ex.it/p.png');
});
test('atom: link in href', () => {
  const r = parseFeed(ATOM, 'At', NOW);
  assert.equal(r.length, 1); assert.equal(r[0].link, 'https://at.ch/1');
});
test('feed vuoto o rotto: nessuna notizia, nessun errore', () => {
  assert.deepEqual(parseFeed('', 'x'), []);
  assert.deepEqual(parseFeed('<html>errore 500</html>', 'x'), []);
});
test('unione: recenti prima, senza doppioni', () => {
  const a = parseFeed(RSS, 'Ex', NOW), b = parseFeed(ATOM, 'At', NOW);
  const m = mergeNews([a, b, a]);
  assert.equal(m.length, 3);
  assert.ok(m[0].ts >= m[1].ts && m[1].ts >= m[2].ts);
});
test('testo: entità e tempo trascorso', () => {
  assert.equal(decode('Caff&egrave; &amp; &#8217;'), 'Caff&egrave; & ’');
  assert.equal(agoText(NOW - 5 * 60000, NOW), '5 min fa');
  assert.equal(agoText(NOW - 3 * 3600000, NOW), '3 h fa');
});
