import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapNativeError, speechErrorText, speechActions, formatRaw, diagLines, diagText, speechServicePackage, speechReducer, initialSpeech,
} from '../src/lib/speechCore.ts';

test('service-not-allowed: su Android manca il servizio, su iOS è il permesso', () => {
  assert.equal(mapNativeError('service-not-allowed', 'android'), 'service_missing');
  assert.equal(mapNativeError('service-not-allowed', 'ios'), 'denied');
  assert.equal(mapNativeError('client', 'android'), 'service_missing');
  assert.equal(mapNativeError('not-allowed', 'android'), 'denied');
  assert.equal(mapNativeError('language-not-supported', 'android'), 'unsupported_lang');
  assert.equal(mapNativeError('network', 'android'), 'offline');
  assert.equal(mapNativeError('audio-capture', 'ios'), 'no_mic');
  assert.equal(mapNativeError(undefined, 'android'), 'unknown');
});
test('ogni codice ha un messaggio chiaro e azioni coerenti', () => {
  const all = ['denied', 'unsupported_lang', 'offline', 'no_speech', 'no_mic', 'busy', 'unavailable', 'needs_build', 'no_service', 'denied_forever', 'service_missing', 'start_timeout', 'unknown'];
  for (const c of all) assert.ok(speechErrorText(c).length > 30, c);
  assert.match(speechErrorText('service_missing'), /servizio vocale di Google/);
  assert.match(speechErrorText('denied_forever'), /impostazioni/);
  assert.deepEqual(speechActions('denied_forever'), ['settings']);
  assert.ok(speechActions('service_missing').includes('install_service'));
  assert.ok(speechActions('needs_build').includes('record_note'));
  assert.ok(speechActions('denied').includes('settings'));
  assert.deepEqual(speechActions('no_mic'), []);
});
test('dettaglio grezzo leggibile', () => {
  assert.equal(formatRaw({ stage: 'event', error: 'service-not-allowed', nativeCode: 5, message: 'x' }), 'stage=event; error=service-not-allowed; code=5; message=x');
  assert.equal(formatRaw({ stage: 'start' }), 'stage=start');
});
test('l\'errore con dettaglio finisce nello stato, senza dettaglio resta com\'era', () => {
  let s = speechReducer(initialSpeech, { type: 'start', locale: 'it-IT' });
  s = speechReducer(s, { type: 'error', code: 'service_missing', raw: 'error=service-not-allowed' });
  assert.equal(s.phase, 'error'); assert.equal(s.error, 'service_missing'); assert.equal(s.rawError, 'error=service-not-allowed');
  let s2 = speechReducer(initialSpeech, { type: 'start', locale: 'it-IT' });
  s2 = speechReducer(s2, { type: 'error', code: 'busy' });
  assert.equal('rawError' in s2, false);
});
test('diagnostica: righe e testo da copiare', () => {
  const d = { platform: 'android', expoGo: false, moduleLoaded: true, available: false, onDevice: null, micGranted: false, micCanAskAgain: false, speechGranted: null, services: [], defaultService: '', locale: 'it-IT', localeSupported: null, lastError: 'error=service-not-allowed' };
  const lines = diagLines(d);
  assert.equal(lines.find((l) => l.label === 'Servizio di riconoscimento disponibile').value, 'no');
  assert.equal(lines.find((l) => l.label === 'Servizio di riconoscimento disponibile').ok, false);
  assert.match(lines.find((l) => l.label === 'Permesso microfono').value, /solo dalle impostazioni/);
  assert.equal(lines.find((l) => l.label === 'Riconoscimento sul telefono (offline)').value, 'non verificabile');
  const txt = diagText(d);
  assert.match(txt, /Ultimo errore: error=service-not-allowed/);
  assert.equal(txt.split('\n').length, lines.length);
  assert.equal(diagLines({ ...d, expoGo: true })[0].value, 'android (Expo Go)');
});
test('pacchetto Google da installare in base alla versione di Android', () => {
  assert.equal(speechServicePackage(34), 'com.google.android.tts');
  assert.equal(speechServicePackage(33), 'com.google.android.tts');
  assert.equal(speechServicePackage(31), 'com.google.android.googlequicksearchbox');
  assert.equal(speechServicePackage(undefined), 'com.google.android.googlequicksearchbox');
});
