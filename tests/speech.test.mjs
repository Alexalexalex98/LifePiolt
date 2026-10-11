import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPEECH_LOCALES, SPEECH_LANGS, localeFor, langOfLocale, mapSpeechError, speechErrorText, isRetryable,
  speechReducer, initialSpeech, liveText, isActive, cleanTranscript, joinSegments, bestAlternative, shouldAutoSend, noTranscriber,
} from '../src/lib/speechCore.ts';

test('le 12 lingue hanno il locale BCP-47 giusto', () => {
  assert.deepEqual(SPEECH_LOCALES, {
    it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', zh: 'zh-CN', hi: 'hi-IN', ar: 'ar-SA', ru: 'ru-RU', ja: 'ja-JP', id: 'id-ID',
  });
  assert.equal(SPEECH_LANGS.length, 12);
  assert.equal(localeFor('xx'), 'it-IT');
  assert.equal(localeFor('ar'), 'ar-SA');
  assert.equal(langOfLocale('pt-BR'), 'pt');
  assert.equal(langOfLocale('zh_CN'), 'zh');
  assert.equal(langOfLocale('xx-XX'), null);
});

test('errori del riconoscimento: web e nativo -> codici nostri con messaggio', () => {
  assert.equal(mapSpeechError('not-allowed'), 'denied');
  assert.equal(mapSpeechError('service-not-allowed'), 'denied');
  assert.equal(mapSpeechError('language-not-supported'), 'unsupported_lang');
  assert.equal(mapSpeechError('network'), 'offline');
  assert.equal(mapSpeechError('no-speech'), 'no_speech');
  assert.equal(mapSpeechError('audio-capture'), 'no_mic');
  assert.equal(mapSpeechError('boh'), 'unknown');
  assert.equal(mapSpeechError(undefined), 'unknown');
  for (const c of ['denied', 'unsupported_lang', 'offline', 'no_speech', 'no_mic', 'busy', 'unavailable', 'needs_build', 'no_service', 'unknown']) assert.ok(speechErrorText(c).length > 20);
  assert.match(speechErrorText('needs_build'), /build dell'app/);
  assert.match(speechErrorText('no_service'), /servizio di trascrizione non è ancora collegato/);
  assert.equal(isRetryable('denied'), false);
  assert.equal(isRetryable('no_speech'), true);
});

const run = (events, locale = 'it-IT') => events.reduce(speechReducer, { ...initialSpeech, locale });

test('macchina a stati: ascolto, parziale, finale, fine', () => {
  let s = run([{ type: 'start', locale: 'es-ES' }]);
  assert.equal(s.phase, 'starting'); assert.equal(s.locale, 'es-ES'); assert.ok(isActive(s));
  s = [{ type: 'started' }, { type: 'partial', text: 'agrega una reu' }].reduce(speechReducer, s);
  assert.equal(s.phase, 'listening'); assert.equal(liveText(s, 'es'), 'agrega una reu');
  s = [{ type: 'level', value: 0.6 }, { type: 'final', text: 'agrega una reunión' }, { type: 'partial', text: 'mañana' }].reduce(speechReducer, s);
  assert.equal(s.level, 0.6); assert.equal(liveText(s, 'es'), 'agrega una reunión mañana');
  s = speechReducer(s, { type: 'end' });
  assert.equal(s.phase, 'done'); assert.equal(s.result, 'Agrega una reunión mañana'); assert.equal(isActive(s), false);
});

test('macchina a stati: silenzio, errori, annulla, doppio avvio', () => {
  let s = run([{ type: 'start', locale: 'it-IT' }, { type: 'started' }, { type: 'end' }]);
  assert.equal(s.phase, 'error'); assert.equal(s.error, 'no_speech');
  s = run([{ type: 'start', locale: 'it-IT' }, { type: 'error', code: 'denied' }]);
  assert.equal(s.error, 'denied');
  // errore "soft" dopo aver già sentito qualcosa: si tiene il testo
  s = run([{ type: 'start', locale: 'it-IT' }, { type: 'started' }, { type: 'partial', text: 'ciao theia' }, { type: 'error', code: 'no_speech' }]);
  assert.equal(s.phase, 'done'); assert.equal(s.result, 'Ciao theia');
  // annulla: niente risultato
  s = run([{ type: 'start', locale: 'it-IT' }, { type: 'started' }, { type: 'partial', text: 'ciao' }, { type: 'cancel' }]);
  assert.equal(s.phase, 'idle'); assert.equal(s.result, undefined);
  // un secondo "start" mentre si ascolta non riparte
  const a = run([{ type: 'start', locale: 'it-IT' }, { type: 'started' }]);
  assert.equal(speechReducer(a, { type: 'start', locale: 'en-US' }), a);
  // errore a riposo ignorato; livello fuori scala limitato
  assert.equal(speechReducer(initialSpeech, { type: 'error', code: 'denied' }), initialSpeech);
  assert.equal(run([{ type: 'start', locale: 'it-IT' }, { type: 'started' }, { type: 'level', value: 7 }]).level, 1);
  // dopo un errore si può ripartire
  s = run([{ type: 'start', locale: 'it-IT' }, { type: 'error', code: 'no_speech' }, { type: 'start', locale: 'de-DE' }]);
  assert.equal(s.phase, 'starting'); assert.equal(s.error, undefined);
});

test('pulizia della trascrizione', () => {
  assert.equal(cleanTranscript('  aggiungi   riunione \n domani  '), 'Aggiungi riunione domani');
  assert.equal(cleanTranscript('hello , world !', 'en'), 'Hello, world!');
  assert.equal(cleanTranscript('明天 下午 三点 添加 会议', 'zh'), '明天下午三点添加会议');
  assert.equal(cleanTranscript('明日 午後 3時 に 会議', 'ja'), '明日午後3時に会議');
  assert.equal(cleanTranscript('أضف  اجتماع  غدا', 'ar'), 'أضف اجتماع غدا');
  assert.equal(cleanTranscript('कल  मीटिंग जोड़ो', 'hi'), 'कल मीटिंग जोड़ो');
  assert.equal(cleanTranscript('', 'it'), '');
  assert.equal(cleanTranscript('ñandú', 'es'), 'Ñandú');
  // non cambia le parole
  assert.equal(cleanTranscript('buy 3 apples', 'en'), 'Buy 3 apples');
  assert.equal(joinSegments(['明天', '开会'], 'zh'), '明天开会');
  assert.equal(joinSegments(['hello', '', 'world'], 'en'), 'hello world');
  assert.equal(bestAlternative([{ transcript: 'a', confidence: 0.2 }, { transcript: 'b', confidence: 0.9 }]), 'b');
  assert.equal(bestAlternative([]), '');
});

test('invio automatico o conferma', () => {
  assert.equal(shouldAutoSend('auto', 'ciao'), true);
  assert.equal(shouldAutoSend('auto', ' '), false);
  assert.equal(shouldAutoSend('confirm', 'ciao'), false);
});

test('servizio di trascrizione non collegato: onesto', async () => {
  assert.equal(noTranscriber.available, false);
  await assert.rejects(() => noTranscriber.transcribe('file:///x.m4a', 'it-IT'), /no_service/);
});

import { fitSize, roomLeft, MAX_IMAGES, MAX_SIDE, JPEG_QUALITY } from '../src/lib/assistant/imageCore.ts';
test('allegati immagine: max 4, lato lungo 1600 px, qualità 0.8', () => {
  assert.equal(MAX_IMAGES, 4); assert.equal(MAX_SIDE, 1600); assert.equal(JPEG_QUALITY, 0.8);
  assert.deepEqual(fitSize(4000, 3000), { width: 1600, height: 1200, scaled: true });
  assert.deepEqual(fitSize(3000, 4000), { width: 1200, height: 1600, scaled: true });
  assert.deepEqual(fitSize(800, 600), { width: 800, height: 600, scaled: false });
  assert.deepEqual(fitSize(0, 0), { width: 0, height: 0, scaled: false });
  assert.equal(roomLeft(0), 4); assert.equal(roomLeft(3), 1); assert.equal(roomLeft(9), 0);
});
