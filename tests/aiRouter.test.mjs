import test from 'node:test';
import assert from 'node:assert/strict';

import { classify } from '../src/lib/aiRouter/classify.ts';
import { selectProvider, pickUsable, DEFAULT_PREFS } from '../src/lib/aiRouter/select.ts';
import { checkFidelity, cleanLocal, rewriteFaithfully, parseRewriteResponse, minimalClean } from '../src/lib/aiRouter/rewrite.ts';
import { redact, buildContext, describeOutgoing, needsConsent } from '../src/lib/aiRouter/privacy.ts';
import { canSpend, record, estimateTokens, usageBars, planById, startOfLocalDay } from '../src/lib/aiRouter/quota.ts';
import { localVerdict } from '../src/lib/aiRouter/localFirst.ts';
import { simplifyText } from '../src/lib/aiRouter/postprocess.ts';
import { PROVIDERS } from '../src/lib/aiRouter/registry.ts';

// ---------- classificazione ----------
const IMG = [
  ['it', 'Disegna un gatto rosso con il cappello'], ['it', 'crea un\'immagine di un tramonto sul mare'], ['en', 'draw a red cat wearing a hat'], ['en', 'generate a picture of a sunset'],
  ['es', 'dibuja un gato rojo con sombrero'], ['es', 'genera una imagen de una montaña'], ['fr', 'dessine un chat rouge avec un chapeau'], ['fr', 'crée une image d\'un coucher de soleil'],
  ['de', 'zeichne eine rote Katze mit Hut'], ['de', 'erstelle ein Bild von einem Berg'], ['pt', 'desenha um gato vermelho de chapéu'], ['pt', 'cria uma imagem de um pôr do sol'],
  ['zh', '画一只戴帽子的红猫'], ['zh', '生成一张日落的图片'], ['hi', 'बिल्ली की तस्वीर बनाओ'], ['ar', 'ارسم قطة حمراء'], ['ar', 'أنشئ صورة لغروب الشمس'],
  ['ru', 'нарисуй красного кота в шляпе'], ['ru', 'создай изображение заката'], ['ja', '赤い猫の絵を描いて'], ['ja', '夕焼けの画像を作って'], ['id', 'gambarkan kucing merah memakai topi'], ['id', 'buatkan gambar matahari terbenam'],
];
for (const [lang, text] of IMG) test(`classify immagine [${lang}] ${text}`, () => {
  const c = classify({ text });
  assert.equal(c.kind, 'image_generate', JSON.stringify(c));
  assert.equal(c.needsConfirm, false);
  assert.equal(c.local, false);
});

const SONG = [
  ['it', 'componi una canzone sul mare'], ['en', 'write a song about the sea'], ['es', 'crea una canción sobre el mar'], ['fr', 'crée une chanson sur la mer'], ['de', 'schreibe ein Lied über das Meer'], ['pt', 'cria uma canção sobre o mar'],
  ['zh', '创作一首关于大海的歌曲'], ['hi', 'समुद्र पर एक गाना बनाओ'], ['ar', 'اكتب أغنية عن البحر'], ['ru', 'создай песню про море'], ['ja', '海についての曲を作って'], ['id', 'buatkan lagu tentang laut'],
];
for (const [lang, text] of SONG) test(`classify canzone [${lang}] ${text}`, () => assert.equal(classify({ text }).kind, 'music_generate'));

const DOCS = [
  ['it', 'crea una presentazione sul cambiamento climatico', 'slides'], ['en', 'make a spreadsheet with my monthly budget', 'sheet'], ['es', 'genera un informe en pdf', 'pdf'], ['fr', 'crée un document word de 2 pages', 'docx'],
  ['de', 'erstelle eine Präsentation über Energie', 'slides'], ['pt', 'cria uma planilha de despesas', 'sheet'], ['ru', 'создай презентацию о космосе', 'slides'], ['id', 'buatkan laporan dalam pdf', 'pdf'],
  ['zh', '制作一份幻灯片', 'slides'], ['ja', 'スプレッドシートを作って', 'sheet'], ['ar', 'أنشئ مستند عن الطاقة', 'docx'], ['hi', 'एक रिपोर्ट बनाओ', 'docx'],
];
for (const [lang, text, fmt] of DOCS) test(`classify documento [${lang}] ${text}`, () => { const c = classify({ text }); assert.equal(c.kind, 'document_create', JSON.stringify(c)); assert.equal(c.docFormat, fmt); });

test('classify web, agenti, traduzione, riassunto', () => {
  assert.equal(classify({ text: 'cerca sul web le ultime notizie su Marte' }).kind, 'web_search');
  assert.equal(classify({ text: 'search the web for cheap flights' }).kind, 'web_search');
  assert.equal(classify({ text: 'busca en internet el clima de Madrid' }).kind, 'web_search');
  assert.equal(classify({ text: 'usa un agente per organizzare il mio viaggio' }).kind, 'agent_task');
  assert.equal(classify({ text: 'run an agent to compare these laptops' }).kind, 'agent_task');
  assert.equal(classify({ text: 'traduci questo testo in tedesco: buongiorno' }).kind, 'translate');
  assert.equal(classify({ text: 'riassumi questo articolo' }).kind, 'summarize');
});

test('classify con immagini allegate', () => {
  const images = [{ uri: 'x', mime: 'image/jpeg' }];
  assert.equal(classify({ text: 'cosa c\'è in questa foto?', images }).kind, 'vision_read');
  assert.equal(classify({ text: '', images }).kind, 'vision_read');
  assert.equal(classify({ text: 'togli lo sfondo da questa foto, crea un\'immagine pulita', images }).kind, 'image_edit');
});

test('classify ambiguo: chat con confidenza bassa e conferma, senza spendere', () => {
  for (const text of ['una canzone', 'un\'immagine di un gatto', 'un documento', 'mio cugino fa l\'agente']) {
    const c = classify({ text });
    assert.equal(c.kind, 'chat', text);
    assert.equal(c.needsConfirm, true, text);
    assert.ok(c.confidence < 0.7);
    assert.ok(c.alternatives.length >= 1, text);
  }
});

test('classify: falsi positivi evitati', () => {
  assert.equal(classify({ text: 'metti della musica rilassante' }).kind, 'chat');
  assert.equal(classify({ text: 'scatta una foto' }).needsConfirm || classify({ text: 'scatta una foto' }).kind === 'chat', true);
  assert.equal(classify({ text: 'ciao, come stai?' }).needsConfirm, false);
  assert.equal(classify({ text: 'ciao, come stai?' }).kind, 'chat');
});

test('localFirst: comando semplice resta in locale', () => {
  for (const text of ['aggiungi riunione al piano domani alle 15', 'crea un task per comprare il latte', 'ricordami di chiamare Marco', 'cosa devo fare adesso?', 'pianificami il mese', 'what should I do now?', 'segna umore 4', 'ho speso 12 euro', 'che correlazioni ci sono tra sonno e umore? i miei dati']) {
    const c = classify({ text });
    assert.equal(c.local, true, text);
    assert.equal(c.needsConfirm, false, text);
    assert.equal(localVerdict(text).local, true);
  }
});

test('localFirst: media e documenti battono il locale', () => {
  assert.equal(classify({ text: 'disegna un logo per il mio task manager' }).local, false);
  assert.equal(classify({ text: 'crea una presentazione sui miei obiettivi' }).kind, 'document_create');
});

// ---------- selezione ----------
test('selezione: immagine -> fornitore di immagini, non Claude', () => {
  const s = selectProvider({ kind: 'image_generate', prefs: DEFAULT_PREFS });
  assert.ok(s.ok);
  assert.ok(['gpt_image', 'imagen', 'midjourney'].includes(s.chosen.provider.id));
  assert.ok(!s.ranking.some((c) => c.provider.id === 'claude'));
  const q = selectProvider({ kind: 'image_generate', prefs: { ...DEFAULT_PREFS, mode: 'qualita' } });
  assert.match(q.explanation, /migliore per le immagini nel tuo piano/);
  assert.equal(s.chosen.provider.id, 'gpt_image', 'in modalita bilanciata GPT per le immagini');
});
test('selezione: canzone -> Suno', () => { const s = selectProvider({ kind: 'music_generate', prefs: DEFAULT_PREFS }); assert.equal(s.chosen.provider.id, 'suno'); });
test('selezione: documento -> miglior punteggio documenti (qualita)', () => {
  const s = selectProvider({ kind: 'document_create', docFormat: 'slides', prefs: { ...DEFAULT_PREFS, mode: 'qualita' } });
  const best = PROVIDERS.filter((p) => p.caps.document_create?.formats?.includes('slides')).sort((a, b) => b.caps.document_create.quality - a.caps.document_create.quality)[0];
  assert.equal(s.chosen.provider.id, best.id);
  assert.ok(!s.ranking.some((c) => c.provider.id === 'mistral'), 'Mistral non fa slide');
});
test('selezione: economica sceglie costo, qualita sceglie il migliore', () => {
  const eco = selectProvider({ kind: 'chat', prefs: { ...DEFAULT_PREFS, mode: 'economica' } });
  const top = selectProvider({ kind: 'reasoning', prefs: { ...DEFAULT_PREFS, mode: 'qualita' } });
  assert.equal(eco.chosen.provider.id, 'mistral');
  assert.equal(top.chosen.provider.id, 'claude');
});
test('selezione: vincoli duri (bloccato, UE, mai, fisso, niente immagini)', () => {
  assert.ok(!selectProvider({ kind: 'chat', prefs: { ...DEFAULT_PREFS, blockedProviders: ['claude', 'gpt', 'gemini'] } }).chosen.provider.id.match(/claude|gpt|gemini/));
  const eu = selectProvider({ kind: 'image_generate', prefs: { ...DEFAULT_PREFS, euOnly: true } });
  assert.equal(eu.chosen.provider.id, 'imagen');
  const nomatch = selectProvider({ kind: 'music_generate', prefs: { ...DEFAULT_PREFS, euOnly: true } });
  assert.equal(nomatch.ok, false);
  assert.equal(selectProvider({ kind: 'music_generate', prefs: { ...DEFAULT_PREFS, taskPref: { music: 'never' } } }).reason, 'never');
  const fixed = selectProvider({ kind: 'image_generate', prefs: { ...DEFAULT_PREFS, taskPref: { image: 'midjourney' } } });
  assert.equal(fixed.chosen.provider.id, 'midjourney');
  assert.equal(fixed.fixed, true);
  assert.equal(selectProvider({ kind: 'vision_read', hasImages: true, prefs: { ...DEFAULT_PREFS, noImages: true } }).reason, 'privacy');
});
test('selezione: fallback ordinato sui collegati', () => {
  const s = selectProvider({ kind: 'image_generate', prefs: DEFAULT_PREFS });
  const first = s.ranking[0].provider.id, second = s.ranking[1].provider.id;
  assert.equal(pickUsable(s, (id) => id !== first).candidate.provider.id, second);
  assert.equal(pickUsable(s, (id) => id !== first).fallback, true);
  assert.equal(pickUsable(s, () => false), null);
});
test('oggi nessun fornitore e collegato (registry)', () => assert.ok(PROVIDERS.length > 5));

// ---------- fedelta ----------
test('fedelta: conserva entita', () => {
  assert.ok(checkFidelity('disegna 3 gatti rossi con un capello blu a Roma', 'Draw 3 red cats wearing a blue hat in Rome').ok);
  assert.ok(checkFidelity('Disegna un gato rosso con "Ciao Mondo" scritto sopra', 'Draw a red cat with the text "Ciao Mondo" written on top').ok);
  assert.ok(checkFidelity('crea una canzone su Marco e Anna, 2 strofe', 'Write a song about Marco and Anna, 2 verses').ok);
  assert.ok(checkFidelity('dibuja cinco perros negros', 'Draw 5 black dogs').ok);
});
test('fedelta: rifiuta numero perso, colore perso, oggetto inventato, stile aggiunto, nome perso', () => {
  const lost = checkFidelity('disegna 3 gatti rossi', 'Draw red cats'); assert.equal(lost.ok, false); assert.ok(lost.missing.some((m) => m.includes('3')));
  assert.equal(checkFidelity('disegna un gatto rosso', 'Draw a cat').ok, false);
  const inv = checkFidelity('disegna un gatto', 'Draw a cat next to a dog'); assert.equal(inv.ok, false); assert.ok(inv.invented.some((m) => m.includes('dog')));
  assert.equal(checkFidelity('disegna un gatto', 'Draw a cat, photorealistic, 4k, highly detailed').ok, false);
  assert.equal(checkFidelity('disegna un gatto', 'Draw a cat in blue').ok, false);
  assert.equal(checkFidelity('disegna Marco al mare', 'Draw a man at the sea').ok, false);
  assert.equal(checkFidelity('scrivi "Buon compleanno Luca" su una torta', 'Write a birthday message on a cake').ok, false);
  assert.equal(checkFidelity('disegna un gatto', '').ok, false);
  assert.equal(checkFidelity('disegna un gatto', 'Draw a cat '.repeat(20)).ok, false);
});
test('fedelta: stile gia presente nell originale e ammesso', () => {
  assert.ok(checkFidelity('disegna un gatto fotorealistico', 'Draw a photorealistic cat').ok);
  assert.ok(checkFidelity('un paesaggio ad acquerello', 'A landscape in watercolor').ok);
});
test('rewriteFaithfully: modello fedele / infedele / assente', () => {
  const o = 'disegna  un gato rosso   con un capello blue';
  const good = rewriteFaithfully(o, JSON.stringify({ prompt: 'Draw a red cat wearing a blue hat', language: 'en', ambiguities: [] }));
  assert.equal(good.source, 'model');
  const bad = rewriteFaithfully(o, '```json\n{"prompt":"Draw a cat, cinematic, 4k","ambiguities":[]}\n```');
  assert.equal(bad.source, 'fallback');
  assert.equal(bad.text, minimalClean(o));
  assert.match(bad.note, /non era fedele/);
  const none = rewriteFaithfully(o, null);
  assert.equal(none.source, 'local');
  assert.equal(parseRewriteResponse('solo testo').prompt, 'solo testo');
});
test('cleanLocal: spazi, riempitivi, ripetizioni, punteggiatura', () => {
  assert.equal(cleanLocal('  ehm   disegna  un un gatto   rosso!!!  '), 'Disegna un gatto rosso!');
  assert.equal(cleanLocal('ciao,mondo ,ok'), 'Ciao, mondo, ok');
  assert.ok(cleanLocal('disegna 3 gatti').includes('3'));
});

// ---------- privacy ----------
test('redaction: carta, IBAN, email, telefono, indirizzo; date e numeri normali restano', () => {
  const r = redact('Pago con 4111 1111 1111 1111, IBAN CH93 0076 2011 6238 5295 7, scrivi a mario.rossi@mail.com o chiama +41 79 123 45 67. Abito in via Roma 12. Il 12/03/2024 ho 3 gatti.');
  assert.ok(r.text.includes('[CARTA]') && r.text.includes('[IBAN]') && r.text.includes('[EMAIL]') && r.text.includes('[TELEFONO]') && r.text.includes('[INDIRIZZO]'), r.text);
  assert.ok(r.text.includes('12/03/2024') && r.text.includes('3 gatti'));
  assert.equal(r.total, 5);
  assert.equal(redact('4111 1111 1111 1111', false).total, 0);
  assert.ok(redact('ordine 2024-03-12 pronto').text.includes('2024-03-12'));
});
const SHARE = { memory: true, health: false, finance: false };
const DATA = { tasks: ['Chiamare il dentista', 'Pagare 4111 1111 1111 1111', 'Spesa'], goals: ['Correre 10 km'], notes: ['segreto'], health: 'dormito 6h', finance: 'budget 500' };
const S = (over = {}) => ({ lang: 'it', answerStyle: 'diretto', share: SHARE, data: DATA, ...over });
test('contesto: immagine = nessun dato personale', () => {
  const c = buildContext('image_generate', 'disegna un gatto, cosa devo fare oggi', S());
  assert.equal(c.items.length, 0);
});
test('contesto: "cosa devo fare adesso" include solo i task condivisi, ripuliti', () => {
  const c = buildContext('chat', 'cosa devo fare adesso?', S());
  const t = c.items.find((i) => i.key === 'tasks');
  assert.equal(t.count, 3);
  assert.ok(t.value.includes('[CARTA]'));
  assert.ok(!c.items.some((i) => ['health', 'finance', 'notes'].includes(i.key)));
  const none = buildContext('chat', 'cosa devo fare adesso?', S({ share: { ...SHARE, memory: false } }));
  assert.ok(!none.items.some((i) => i.key === 'tasks'));
  assert.ok(none.excluded.length >= 1);
});
test('contesto: salute e finanze solo se condivise; mai dati critici', () => {
  assert.ok(!buildContext('chat', 'come ho dormito? sonno', S()).items.some((i) => i.key === 'health'));
  const c = buildContext('chat', 'come ho dormito? sonno e budget', S({ share: { memory: true, health: true, finance: true } }));
  assert.ok(c.items.some((i) => i.key === 'health') && c.items.some((i) => i.key === 'finance'));
  const keys = c.items.map((i) => i.key);
  for (const k of keys) assert.ok(['lang', 'style', 'tasks', 'goals', 'notes', 'health', 'finance'].includes(k));
});
test('anteprima: cosa esce e cosa no', () => {
  const ctx = buildContext('chat', 'cosa devo fare adesso?', S());
  const d = describeOutgoing({ providerShort: 'GPT', images: 0, context: ctx, redactions: [] });
  assert.match(d.headline, /Sto per inviare a GPT: il tuo testo e 3 task/);
  assert.match(d.notSent, /finanze, salute/);
  assert.match(d.notSent, /posizione/);
  assert.equal(d.sensitive, false);
  assert.equal(describeOutgoing({ providerShort: 'GPT', images: 2, context: ctx, redactions: [] }).sensitive, true);
});
test('consenso: fornitore nuovo o dati sensibili', () => {
  assert.equal(needsConsent('gpt', {}, false).needed, true);
  assert.equal(needsConsent('gpt', { gpt: { always: true, at: 1 } }, false).needed, false);
  assert.equal(needsConsent('gpt', { gpt: { always: true, at: 1 } }, true).needed, true);
});

// ---------- quote ----------
const H = 3600000;
const free = planById('free');
const T0 = Date.UTC(2026, 9, 10, 12, 0, 0);
const u = (ts, kind, units = 1, tokens = 0, cost = 0) => ({ ts, kind, units, tokens, cost });
test('quota: 2 canzoni al giorno, messaggio chiaro e reset a mezzanotte locale', () => {
  const log = [u(T0 - 3 * H, 'music_generate'), u(T0 - H, 'music_generate')];
  const r = canSpend(log, free, { kind: 'music_generate' }, T0, 0);
  assert.equal(r.ok, false);
  assert.equal(r.resetAt, Date.UTC(2026, 9, 11, 0, 0, 0));
  assert.equal(r.reason, 'Hai usato 2 canzoni su 2 oggi. Si azzera domani alle 00:00.');
  assert.equal(canSpend([u(T0 - H, 'music_generate')], free, { kind: 'music_generate' }, T0, 0).ok, true);
});
test('quota: mezzanotte locale e fuso orario', () => {
  // 23:30 locale (UTC+2) = 21:30 UTC del 10; una canzone alle 00:10 locale dell'11 e di un altro giorno
  const now = Date.UTC(2026, 9, 10, 21, 30);
  const off = 120;
  assert.equal(startOfLocalDay(now, off), Date.UTC(2026, 9, 9, 22, 0));
  const log = [u(Date.UTC(2026, 9, 9, 21, 59), 'music_generate'), u(Date.UTC(2026, 9, 9, 22, 1), 'music_generate')];
  assert.equal(canSpend(log, free, { kind: 'music_generate' }, now, off).ok, true, 'ieri locale non conta');
  const log2 = [...log, u(Date.UTC(2026, 9, 10, 8, 0), 'music_generate')];
  const r = canSpend(log2, free, { kind: 'music_generate' }, now, off);
  assert.equal(r.ok, false);
  assert.equal(r.resetAt, Date.UTC(2026, 9, 10, 22, 0));
  // stesso istante, fuso diverso: in UTC il 10 e' appena iniziato 21h fa
  assert.equal(canSpend(log2, free, { kind: 'music_generate' }, now, 0).ok, true);
});
test('quota: finestra mobile 5h, confine esatto', () => {
  const full = u(T0 - 5 * H, 'chat', 0, 30000);
  assert.equal(canSpend([full], free, { kind: 'chat', tokens: 1000 }, T0, 0).ok, true, 'esattamente 5h fa: fuori');
  const inside = u(T0 - 5 * H + 1, 'chat', 0, 30000);
  const r = canSpend([inside], free, { kind: 'chat', tokens: 1000 }, T0, 0);
  assert.equal(r.ok, false);
  assert.equal(r.resetAt, T0 + 1);
  assert.match(r.reason, /ultime 5 ore/);
  const two = [u(T0 - 4 * H, 'chat', 0, 20000), u(T0 - 1 * H, 'chat', 0, 10000)];
  const r2 = canSpend(two, free, { kind: 'chat', tokens: 5000 }, T0, 0);
  assert.equal(r2.resetAt, T0 - 4 * H + 5 * H, 'si libera quando scade il primo uso');
});
test('quota: immagini, budget di costo, record e pulizia', () => {
  const log = Array.from({ length: 5 }, (_, i) => u(T0 - i * 60000, 'image_generate'));
  assert.equal(canSpend(log, free, { kind: 'image_generate' }, T0, 0).ok, false);
  assert.equal(canSpend([u(T0 - 1000, 'chat', 0, 10, 0.49)], free, { kind: 'chat', tokens: 10, cost: 0.05 }, T0, 0).ok, false);
  const l = record([u(T0 - 60 * 24 * H, 'chat')], u(T0, 'chat'), T0);
  assert.equal(l.length, 1);
});
test('stima token: dichiarata approssimata, CJK diverso', () => {
  assert.ok(estimateTokens('hello world this is a test') > 4);
  assert.ok(estimateTokens('日本語のテキストです') > estimateTokens('abcdefghij'));
  assert.equal(estimateTokens(''), 0);
});
test('barre d uso', () => {
  const bars = usageBars([u(T0 - H, 'music_generate')], free, T0, 0);
  const songs = bars.find((b) => b.id === 'songs_day');
  assert.equal(songs.used, 1); assert.equal(songs.max, 2);
  assert.equal(songs.resetText, 'Si azzera domani alle 00:00');
});

// ---------- post-elaborazione ----------
test('postprocess: stile breve accorcia, evidenzia azioni', () => {
  const long = '**Ecco** il piano. Prima cosa: ti spiego il contesto. Poi altro. Ancora altro. Controlla il calendario di domani. Fine.';
  const b = simplifyText(long, { answerStyle: 'breve' });
  assert.ok(!b.text.includes('**'));
  assert.ok(b.text.length < long.length);
  assert.equal(b.shortened, true);
  const d = simplifyText('- Fai una pausa\n- Bevi acqua\nGrazie.', { answerStyle: 'diretto' });
  assert.ok(d.actions[0].startsWith('Fai'));
});
