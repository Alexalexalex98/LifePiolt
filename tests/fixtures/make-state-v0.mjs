// Rigenera le fixture CONGELATE di "stato versione 0" (formato AsyncStorage {chiave: '{"state":..,"version":0}'}).
//   node --experimental-strip-types tests/fixtures/make-state-v0.mjs
// ATTENZIONE: una volta committate, state-v0.json e backup-v1.json NON vanno rigenerate: servono proprio a garantire
// che i dati salvati dalle versioni passate si aprano ancora con il codice futuro. Rigenera solo per aggiungere store NUOVI.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeSynthStates } from '../helpers/synth.mjs';
import { buildBackup, serializeBackup } from '../../src/lib/backupCore.ts';

const here = dirname(fileURLToPath(import.meta.url));
const enc = (state) => JSON.stringify({ state, version: 0 });
const base = makeSynthStates({ years: 1, scale: 0.02, seed: 7 });

// store che il generatore sintetico non produce: forma ridotta ma realistica
const extra = {
  'lp2-club': { seeded: true, clubs: { c1: { id: 'c1', name: 'Corsa mattutina', free: true } }, memberships: { c1: { role: 'member', since: 1700000000000 } }, progress: { c1: { done: ['l1'] } }, notes: {}, comments: [{ id: 'cm1', clubId: 'c1', text: 'Ottimo!' }], votes: [], ratings: {} },
  'lp2-identity': { identity: { name: 'Alex', handle: 'alex' }, businesses: [], design: null, role: 'person', cardBusinessId: null, declared: [{ id: 'd1', skill: 'Cucina' }], requests: [], qaVotes: [], profileVoted: [], since: 1700000000000 },
  'lp2-jobs': { jobs: [{ id: 'j1', title: 'Barista' }], applications: [{ id: 'a1', jobId: 'j1', status: 'sent' }], practice: [], practicals: [], library: [] },
  'lp2-prefs': { theme: 'auto', textScale: 1, haptics: true },
  'lp2-theia': { voiceAuto: false, dismissed: ['tip1'] },
  'lp2-sharing': { choices: { calendar: 'private' } },
  'lp2-tour': { done: true, step: 5 },
  'lp2-calprefs': { weekStart: 1, view: 'week' },
  'lp2-interests': { picked: ['salute', 'finanza'] },
  'lp2-travel': { trips: [{ id: 'tr1', dest: 'Lisbona', from: '2026-05-01', to: '2026-05-05' }] },
  'lp2-assistant': { log: [{ id: 'l1', role: 'user', text: 'ciao' }] },
};
const storage = { ...base };
for (const [k, s] of Object.entries(extra)) storage[k] = enc(s);
// campi che le versioni precedenti scrivevano e che NON devono andare persi (non nello schema => passano invariati)
const app = JSON.parse(storage['lp2-app']);
app.state.legacyFlag = 'conservami';
app.state.language = 'it';
storage['lp2-app'] = JSON.stringify(app);

const sorted = Object.fromEntries(Object.keys(storage).sort().map((k) => [k, storage[k]]));
writeFileSync(join(here, 'state-v0.json'), JSON.stringify({ _meta: { description: 'Stato AsyncStorage versione 0 (prima dell\'engine SQLite), congelato', schemaVersion: 0, generator: 'tests/fixtures/make-state-v0.mjs' }, storage: sorted }, null, 1));
const backup = serializeBackup(buildBackup(sorted, '0.1.0', new Date('2026-01-15T10:00:00Z')));
writeFileSync(join(here, 'backup-v1.json'), backup);
console.log('scritti state-v0.json e backup-v1.json:', Object.keys(sorted).length, 'store,', (backup.length / 1024).toFixed(0), 'KB');
