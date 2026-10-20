/**
 * Prova da terminale dell'analisi del piatto, con LO STESSO testo di richiesta dell'app.
 * Uso: node --experimental-strip-types scripts/meal-test.mjs /tmp/foto.jpg
 * Legge EXPO_PUBLIC_AI_URL ed EXPO_PUBLIC_AI_TOKEN dall'ambiente (set -a; source .env.local; set +a).
 */
import { readFileSync } from 'node:fs';
import { MEAL_PROMPT, parseMealReply, resolveItems } from '../src/lib/fitness/mealPhoto.ts';
import { macrosFor, sumMacros } from '../src/lib/fitness/nutrition.ts';

const file = process.argv[2];
const url = (process.env.EXPO_PUBLIC_AI_URL ?? '').replace(/\/+$/, '');
const token = process.env.EXPO_PUBLIC_AI_TOKEN ?? '';
if (!file || !url || !token) { console.error('Servono: il file della foto e le variabili EXPO_PUBLIC_AI_URL / EXPO_PUBLIC_AI_TOKEN.'); process.exit(1); }

const image = readFileSync(file).toString('base64');
const t0 = Date.now();
const r = await fetch(`${url}/vision`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ image, mime: 'image/jpeg', prompt: MEAL_PROMPT }), signal: AbortSignal.timeout(90000) });
const j = await r.json().catch(() => ({}));
console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s  Stato: ${r.status}`);
if (!r.ok) { console.log('Errore:', j.error ?? j); process.exit(0); }
console.log('\nRisposta grezza del server:\n' + j.reply + '\n');
const found = resolveItems(parseMealReply(j.reply));
if (!found.length) { console.log('L\'app non riconosce nessun alimento in questa risposta.'); process.exit(0); }
for (const x of found) console.log(`- ${x.name}: ${x.grams} g${x.food ? ` (${x.source === 'ai' ? 'stima AI' : 'database'})` : ' (non trovato)'}`);
const tot = sumMacros(found.flatMap((x) => (x.food ? [macrosFor(x.food, x.grams)] : [])));
console.log(`\nTotale: ${tot.kcal} kcal · P ${tot.p} g · C ${tot.c} g · G ${tot.f} g · zuccheri ${tot.sug ?? 0} g · saturi ${tot.sat ?? 0} g · fibre ${tot.fib ?? 0} g · sale ${tot.salt ?? 0} g`);
