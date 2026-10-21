import test from 'node:test';
import assert from 'node:assert/strict';
import { askFreeOffline, guessPlan, askFree, parsePlan, runPlan, looksLikeDataQuestion, planPrompt, answerPrompt, renderFallback, TOOLS } from '../src/lib/theia/free.ts';

const now = new Date(2026, 9, 21, 10, 0).getTime();
const fin = { partial: true, day: 21, daysInMonth: 31, income: 3500, expense: 2400, saved: 0, end: 331, projectionEnd: 600, over: [], topCats: [{ n: 'Ristoranti', v: 310 }, { n: 'Spesa', v: 640 }], label: 'Ottobre 2026', prev: { label: 'Settembre 2026', income: 3500, expense: 2000 }, deltas: [{ n: 'Ristoranti', v: 310, prev: 150 }, { n: 'Spesa', v: 640, prev: 600 }] };
const snap = { now, events: { '2026-10-22': [{ time: '10:00', title: 'Dentista', dur: 60 }] }, shifts: [{ id: 's', name: 'Alba', start: '06:00', end: '14:00', weekdays: [3, 4], dates: [], color: '#fff' }], tasks: [], finance: fin, sleep: [{ day: '2026-10-19', hours: 7 }, { day: '2026-10-20', hours: 5 }], steps: [], water: null, kcal: null, currency: 'CHF' };
const llmFrom = (...replies) => { let i = 0; const calls = []; const f = async (p) => { calls.push(p); return replies[Math.min(i++, replies.length - 1)]; }; f.calls = calls; return f; };

test('il pianificatore vede il catalogo ma nessun dato tuo', () => {
  const p = planPrompt('quanto ho speso?');
  assert.ok(TOOLS.every((t) => p.includes(t.name)));
  assert.ok(!p.includes('Ristoranti') && !p.includes('2400'));
});
test('piano: tollera testo attorno, scarta calcolatori inventati', () => {
  const plan = parsePlan('Ecco:\n```json\n{"scope":"dati","calls":[{"tool":"mese","args":{}},{"tool":"hackera","args":{}}]}\n```');
  assert.deepEqual(plan.calls.map((c) => c.tool), ['mese']);
  assert.equal(parsePlan('boh'), null);
  assert.equal(parsePlan('{"scope":"x"}'), null);
});
test('calcolatori: «e se spendo» è aritmetica del codice', () => {
  const r = runPlan({ scope: 'dati', calls: [{ tool: 'se_spendo', args: { importo: 250 } }] }, snap);
  assert.ok(r.facts.some((f) => f.value === 350));
});
test('calcolatori: confronto con il mese scorso', () => {
  const r = runPlan({ scope: 'dati', calls: [{ tool: 'confronto_mese', args: {} }] }, snap);
  const get = (l) => r.facts.find((f) => f.label === l)?.value;
  assert.equal(get('differenza uscite'), 400);
  assert.equal(get('variazione uscite'), 20);
  assert.equal(get('differenza in Ristoranti rispetto al mese scorso'), 160);
});
test('calcolatori: sonno, turni e dati mancanti', () => {
  const sleep = runPlan({ scope: 'dati', calls: [{ tool: 'sonno', args: { giorni: 7 } }] }, snap).facts;
  assert.equal(sleep.find((f) => f.label === 'ore di sonno mancanti rispetto a 8 per notte').value, 4);
  assert.equal(sleep.find((f) => f.label === 'ore dormite in media').value, 6);
  const miss = runPlan({ scope: 'dati', calls: [{ tool: 'passi', args: {} }, { tool: 'categoria', args: { nome: 'viaggi' } }] }, snap);
  assert.equal(miss.facts.length, 0);
  assert.equal(miss.missing.length, 2);
  assert.match(miss.missing[1], /Ristoranti, Spesa/);
});
test('filtro: solo le domande sui dati chiamano l\'AI', () => {
  assert.ok(looksLikeDataQuestion('Posso permettermi una cena da 80 franchi questo mese?'));
  assert.ok(looksLikeDataQuestion('perché ho speso di più a ottobre?'));
  assert.ok(looksLikeDataQuestion('sono libero giovedì pomeriggio?'));
  assert.ok(!looksLikeDataQuestion('ciao theia come stai'));
  assert.ok(!looksLikeDataQuestion('raccontami una storia'));
  assert.ok(!looksLikeDataQuestion('grazie'));
});
test('giro completo: risposta corretta, verificata', async () => {
  const llm = llmFrom('{"scope":"dati","calls":[{"tool":"confronto_mese","args":{}}]}', 'Hai speso 400 CHF in più rispetto al mese scorso, cioè il 20%. La categoria cresciuta di più è Ristoranti (160 CHF in più).');
  const r = await askFree('perché ho speso di più questo mese?', snap, llm);
  assert.equal(r.kind, 'answer');
  assert.ok(r.sources.length);
  assert.equal(llm.calls.length, 2);
  assert.ok(llm.calls[1].includes('differenza uscite: 400 CHF'));
});
test('giro completo: un numero inventato fa rifare la risposta', async () => {
  const llm = llmFrom('{"scope":"dati","calls":[{"tool":"confronto_mese","args":{}}]}', 'Hai speso 450 CHF in più.', 'Hai speso 400 CHF in più.');
  const r = await askFree('perché ho speso di più questo mese?', snap, llm);
  assert.equal(r.kind, 'answer');
  assert.equal(r.text, 'Hai speso 400 CHF in più.');
  assert.match(llm.calls[2], /450/);
});
test('giro completo: se continua a inventare, si mostrano i fatti senza testo dell\'AI', async () => {
  const llm = llmFrom('{"scope":"dati","calls":[{"tool":"mese","args":{}}]}', 'Ti restano 999 CHF.', 'Ti restano 998 CHF.');
  const r = await askFree('quanto mi resta a fine mese?', snap, llm);
  assert.equal(r.kind, 'fallback');
  assert.doesNotMatch(r.text, /99[89]/);
  assert.match(r.text, /saldo stimato a fine mese: 600 CHF/);
});
test('giro completo: domanda generica, chiarimento e dati mancanti', async () => {
  assert.equal((await askFree('chi ha vinto i mondiali?', snap, llmFrom('{"scope":"altro","calls":[]}'))).kind, 'outside');
  assert.deepEqual(await askFree('quanto posso spendere?', snap, llmFrom('{"scope":"dati","calls":[],"ask":"Quale importo vuoi spendere?"}')), { kind: 'clarify', text: 'Quale importo vuoi spendere?' });
  const r = await askFree('quanti passi faccio in media?', snap, llmFrom('{"scope":"dati","calls":[{"tool":"passi","args":{}}]}'));
  assert.equal(r.kind, 'fallback');
  assert.match(r.text, /Non ho dati sui passi/);
  assert.equal((await askFree('boh', snap, llmFrom('non è json'))).kind, 'outside');
});
test('prompt di risposta: regole e fatti', () => {
  const p = answerPrompt('q', [{ label: 'x', value: 5, unit: 'h', source: 's' }], ['manca y']);
  assert.match(p, /SOLO i fatti/); assert.match(p, /x: 5 h/); assert.match(p, /manca y/);
  assert.match(renderFallback([], []), /Non ho dati/);
});

test('senza AI: piano a parole chiave e fatti mostrati così come sono', () => {
  assert.deepEqual(guessPlan('quanto ho speso in ristoranti rispetto al mese scorso', snap).calls.map((c) => c.tool), ['categoria', 'confronto_mese']);
  assert.deepEqual(guessPlan('posso spendere 250 franchi?', snap).calls, [{ tool: 'se_spendo', args: { importo: 250 } }]);
  assert.equal(guessPlan('raccontami una storia', snap), null);
  const r = askFreeOffline('quanti turni ho questa settimana', snap);
  assert.equal(r.kind, 'fallback');
  assert.match(r.text, /Ecco cosa risulta/);
  assert.equal(askFreeOffline('ciao come va', snap).kind, 'outside');
});
