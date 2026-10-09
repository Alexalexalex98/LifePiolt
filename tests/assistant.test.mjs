import test from 'node:test';
import assert from 'node:assert/strict';
import { Assistant } from '../src/lib/assistant/engine.ts';
import { registerCatalog, setActive } from '../src/i18n/core.ts';

function mkEnv() {
  const st = { events: { '2026-10-08': [{ time: '15:00', title: 'Dentista' }] }, tasks: [], priv: false };
  const env = {
    now: () => new Date(2026, 9, 7, 10, 0),
    events: () => st.events,
    addEvent: (d, e) => { (st.events[d] ??= []).push({ ...e }); },
    delEvent: (d, e) => { st.events[d] = (st.events[d] ?? []).filter((x) => !(x.time === e.time && x.title === e.title)); },
    tasks: () => st.tasks,
    addTask: (t) => { const id = String(st.tasks.length + 1); st.tasks.push({ id, t }); return id; },
    setTaskDone: (id, v) => { st.tasks.find((t) => t.id === id).done = v; },
    delTask: (id) => { const t = st.tasks.find((x) => x.id === id) ?? null; st.tasks = st.tasks.filter((x) => x.id !== id); return t; },
    restoreTask: (t) => { st.tasks.push(t); },
    renameTask: (id, t) => { st.tasks.find((x) => x.id === id).t = t; },
    addNote() {}, addGoal() {}, logMood() {},
    workHours: () => ({ start: '09:00', end: '18:00' }), setWorkHours() {}, setDark() {}, setNotifications() {},
    setPrivateProfile: (on) => { st.priv = on; }, isPrivateProfile: () => st.priv,
    pickProfilePhoto: async () => true,
    financeReport: () => 'fin', healthReport: () => 'sal', moodReport: () => 'umore',
    shareAgenda: (p) => (p === 'Marco' ? 'Inviata a Marco' : null), people: () => ['Marco T.', 'Giulia M.'],
    setTaskDue: (id, d) => { st.tasks.find((t) => t.id === id).due = d; },
    addRecurring: (day, ev, until, kind) => { const ref = 'rec:' + (st.n = (st.n || 0) + 1); const d = new Date(day + 'T00:00:00'); const end = new Date(until + 'T00:00:00'); const step = kind === 'weekly' ? 7 : 1; while (d <= end) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (st.events[k] ??= []).push({ ...ev, ref }); d.setDate(d.getDate() + step); } return ref; },
    delByRef: (ref) => { for (const k of Object.keys(st.events)) st.events[k] = st.events[k].filter((e) => e.ref !== ref); },
    briefing: () => ({ title: 'Buongiorno, Alex', body: 'Oggi hai 1 impegno.' }),
    setTaskUrgent: (id, v) => { st.tasks.find((t) => t.id === id).urgent = v; }, setEventImportant: () => {}, userName: () => 'Alex',
  };
  return { env, st };
}

test('aggiungere al piano: chiede quando', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r1 = await a.handle('aggiungi riunione al piano');
  assert.ok(r1.handled && /quando|giorno/i.test(r1.text));
  await a.handle('domani alle 17');
  assert.ok(st.events['2026-10-08'].some((e) => e.title.toLowerCase().includes('riunione') && e.time === '17:00'));
});

test('conflitto: propone di cambiare o spostare, poi annulla', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('aggiungi riunione al piano domani alle 15');
  assert.ok(/Dentista/.test(r.text));
  assert.ok(r.chips?.some((c) => /Cambia giorno/i.test(c)));
  assert.ok(r.chips?.some((c) => /Sposta/i.test(c)));
  await a.handle('Tieni entrambi');
  assert.equal(st.events['2026-10-08'].length, 2);
  const u = await a.handle('annulla');
  assert.ok(u.handled);
  assert.equal(st.events['2026-10-08'].length, 1);
});

test('task, privacy', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task comprare il latte');
  assert.equal(st.tasks.length, 1);
  await a.handle('rendi il mio profilo privato');
  assert.equal(st.priv, true);
  const r = await a.handle('blabla qwerty');
  assert.equal(r.handled, false);
});

test('un comando diverso interrompe la domanda in sospeso', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione al piano');
  assert.ok(a.pending);
  const r = await a.handle('rendi privato il mio profilo');
  assert.ok(r.handled && st.priv === true && !a.pending);
});

test('scegli tu: sceglie l\'algoritmo', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione al piano');
  const r = await a.handle('scegli tu secondo quando mi è più comodo');
  assert.ok(/L’ho scelto io/.test(r.text), r.text);
  const all = Object.values(st.events).flat();
  assert.ok(all.some((e) => e.title.toLowerCase().includes('riunione')));
  assert.ok(!a.pending);
});

test('pianificami il mese: anteprima, applica, annulla', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task completare business plan');
  const before = Object.values(st.events).flat().length;
  const r = await a.handle('pianificami tutto il mese');
  assert.ok(r.chips?.includes('Applica'), r.text);
  assert.equal(Object.values(st.events).flat().length, before);
  await a.handle('Applica');
  assert.ok(Object.values(st.events).flat().length > before + 10);
  await a.handle('annulla');
  assert.equal(Object.values(st.events).flat().length, before);
});

test('cosa devo fare adesso: urgente e collegamenti', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  st.events['2026-10-08'].push({ time: '17:30', title: 'Chiamata investitori' });
  await a.handle('aggiungi task comprare il latte');
  await a.handle('aggiungi task completare business plan');
  const r = await a.handle('cosa devo fare adesso?');
  assert.match(r.text, /business plan/i);
  assert.match(r.text, /investitori/i);
  await a.handle('segna comprare il latte come urgente');
  const r2 = await a.handle('quale task faccio prima?');
  assert.match(r2.text, /latte/i);
});

test('frase all\'infinito: propone task', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('Chiamare commercialista');
  assert.ok(r.handled && r.chips?.includes('Aggiungi come task'));
  await a.handle('Aggiungi come task');
  assert.equal(st.tasks.length, 1);
});

test('condividi agenda: chiede a chi', async () => {
  const { env } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('Condividi la mia agenda');
  assert.ok(/A chi/.test(r.text) && r.chips?.includes('Marco T.'));
});

test('non resta bloccato in un giro', async () => {
  const { env } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione al piano domani');
  await a.handle('boh'); await a.handle('mah'); await a.handle('uffa');
  assert.ok(!a.pending);
});

test('i chip delle anteprime non vengono scambiati per nuovi comandi', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('pianificami il mese');
  const r = await a.handle('Più slot liberi');
  assert.ok(r.chips?.includes('Applica'), r.text);
  await a.handle('Applica');
  assert.ok(Object.values(st.events).flat().length > 10);
  await a.handle('Chiamare commercialista');
  await a.handle('Aggiungi come task');
  assert.equal(st.tasks[0].t, 'Chiamare commercialista');
});

test('impegno ricorrente da chat e annulla', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('ogni martedì alle 18 palestra');
  assert.ok(/ogni/.test(r.text), r.text);
  const n = Object.values(st.events).flat().filter((e) => e.ref).length;
  assert.ok(n >= 12, String(n));
  await a.handle('annulla');
  assert.equal(Object.values(st.events).flat().filter((e) => e.ref).length, 0);
});

test('luogo e avviso di spostamento', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione a Lugano domani alle 10');
  assert.equal(st.events['2026-10-08'].find((e) => e.title.includes('Riunione')).place, 'Lugano');
  const r = await a.handle('aggiungi call con cliente a Zurigo domani alle 11');
  assert.ok(/ne servono circa 150/.test(r.text), r.text);
});

test('scadenza del task e riferimento "quello"', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task preparare relazione entro venerdì');
  assert.equal(st.tasks[0].due, '2026-10-09');
  await a.handle('aggiungi task comprare latte');
  await a.handle('il task relazione scade lunedì');
  assert.equal(st.tasks[0].due, '2026-10-12');
});

test('riferimenti agli impegni: "spostala", "a che ora?"', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const q = await a.handle('a che ora è il dentista?');
  assert.match(q.text, /15:00/);
  await a.handle('sposta il dentista a venerdì alle 11');
  assert.ok(st.events['2026-10-09'].some((e) => e.title === 'Dentista'));
  const r = await a.handle('spostala a lunedì alle 9');
  assert.ok(st.events['2026-10-12']?.some((e) => e.title === 'Dentista'), r.text);
});

test('ripianifica le sessioni saltate', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task business plan');
  st.events['2026-10-06'] = [{ time: '10:30', title: 'Lavoro su: Business plan', dur: 60 }];
  const r = await a.handle('ripianifica le sessioni saltate');
  assert.ok(r.chips?.includes('Applica'), r.text);
  await a.handle('Applica');
  assert.equal((st.events['2026-10-06'] ?? []).length, 0);
  assert.ok(Object.values(st.events).flat().some((e) => e.title === 'Lavoro su: Business plan'));
});

test('briefing', async () => {
  const { env } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('riepilogo della giornata');
  assert.match(r.text, /Buongiorno, Alex/);
});

/* ---------- inglese ---------- */
test('EN: aggiungere, conflitto, annullare', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r1 = await a.handle('add meeting to my plan');
  assert.ok(r1.handled && /giorno/i.test(r1.text));
  await a.handle('tomorrow at 5pm');
  assert.ok(st.events['2026-10-08'].some((e) => e.title === 'Meeting' && e.time === '17:00'), JSON.stringify(st.events));
  const c = await a.handle('add call with Anna to my calendar tomorrow at 3pm');
  assert.ok(/Dentista/.test(c.text));
  await a.handle('keep both');
  assert.ok(st.events['2026-10-08'].some((e) => e.title.startsWith('Call')));
  await a.handle('undo');
  assert.ok(!st.events['2026-10-08'].some((e) => e.title.startsWith('Call')));
});

test('EN: task, sposta, elimina, ricorrenza, scegli tu', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('add task buy milk');
  assert.equal(st.tasks[0].t, 'Buy milk');
  await a.handle('I finished buy milk');
  assert.equal(st.tasks[0].done, true);
  await a.handle('add task prepare report by Friday');
  assert.equal(st.tasks[1].due, '2026-10-09');
  await a.handle('move the dentist to Friday at 11');
  assert.ok(st.events['2026-10-09'].some((e) => e.title === 'Dentista' && e.time === '11:00'));
  await a.handle('delete the dentist');
  assert.ok(!Object.values(st.events).flat().some((e) => e.title === 'Dentista'));
  await a.handle('every Tuesday at 6pm gym');
  assert.ok(Object.values(st.events).flat().filter((e) => e.ref).length >= 12);
  await a.handle('undo');
  const { env: e2, st: s2 } = mkEnv(); const b = new Assistant(e2);
  await b.handle('add meeting to my plan');
  const r = await b.handle('you choose');
  assert.ok(/L’ho scelto io/.test(r.text));
  assert.ok(Object.values(s2.events).flat().some((e) => e.title === 'Meeting'));
});

test('EN: profilo, saluti, aiuto, pianificazione', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('make my profile private'); assert.equal(st.priv, true);
  await a.handle('make my profile public'); assert.equal(st.priv, false);
  const h = await a.handle('hello'); assert.ok(h.handled && /Ciao/.test(h.text));
  const hp = await a.handle('help'); assert.ok(hp.chips?.length);
  const o = await a.handle('open finance'); assert.equal(o.navigate, 'lifefinance');
  await a.handle('add task finish business plan');
  const p = await a.handle('plan my month'); assert.ok(p.chips?.includes('Applica'), p.text);
  const before = Object.values(st.events).flat().length;
  await a.handle('apply');
  assert.ok(Object.values(st.events).flat().length > before + 10);
  const q = await a.handle('what do I have tomorrow?'); assert.match(q.text, /Dentista/);
  const f = await a.handle('when am I free tomorrow?'); assert.match(f.text, /Slot liberi/);
  const n = await a.handle('what should I do now?'); assert.match(n.text, /Adesso/);
  const y = await a.handle('yes'); assert.ok(/nulla in sospeso/.test(y.text));
});

test('lingua attiva en (catalogo finto): risposte in inglese e chip tradotti riconosciuti', async () => {
  registerCatalog('en', {
    'Fatto: «{0}» {1} dalle {2} alle {3}. Lo trovi nel Plan.': 'Done: "{0}" {1} from {2} to {3}. You can find it in Plan.',
    '{0} alle {1} hai già «{2}». Cosa preferisci?': '{0} at {1} you already have "{2}". What do you prefer?',
    'Cambia giorno': 'Change day', 'Cambia ora': 'Change time', 'Tieni entrambi': 'Keep both', 'Annulla': 'Undo', 'Sposta «{0}»': 'Move "{0}"', 'Apri il piano': 'Open the plan',
    'Annullato: {0}.': 'Undone: {0}.', 'aggiunta al piano': 'added to plan', 'domani': 'tomorrow', 'oggi': 'today',
    'Applica': 'Apply', 'Più slot liberi': 'More free slots', 'Cosa devo fare adesso?': 'What should I do now?', 'Aiuto': 'Help', 'Pianificami il mese': 'Plan my month', 'Che impegni ho domani?': 'What do I have tomorrow?',
    'Non ho capito del tutto. Prova con una frase come "aggiungi riunione al piano domani alle 15", "pianificami il mese", "cosa devo fare adesso?" oppure scrivi "aiuto" per vedere tutto.': 'I did not quite get that.',
    'Ti propongo {0} impegni per {1}, dentro il tuo orario di lavoro ({2}–{3}): {4} sui tuoi task (i più urgenti per primi, quelli collegati ai tuoi appuntamenti prima della data) e le abitudini (pausa pranzo, lavoro profondo, pausa movimento, revisione della settimana). In ogni giornata lascio liberi almeno {5}.': 'I suggest {0} items for {1}.',
    'il mese': 'the month', '{0} h': '{0} h', '{0} min': '{0} min', '{0} h {1} min': '{0} h {1} min',
    'Fatto: ho aggiunto {0} impegni al Plan. Gli slot liberi restano tuoi. Puoi cambiare o togliere ogni impegno quando vuoi, oppure dire "annulla" per toglierli tutti.': 'Done: added {0} items to Plan.',
  });
  setActive('en');
  try {
    const { env, st } = mkEnv(); const a = new Assistant(env);
    const r = await a.handle('add meeting to my plan tomorrow at 3pm');
    assert.match(r.text, /you already have "Dentista"/);
    assert.ok(r.chips.includes('Keep both') && r.chips.includes('Change day') && r.chips.includes('Move "Dentista"'), r.chips.join('|'));
    // si tocca l'etichetta tradotta: il motore la riconosce
    const k = await a.handle('Keep both');
    assert.match(k.text, /Done: "Meeting" tomorrow from 15:00 to 16:00/);
    assert.equal(st.events['2026-10-08'].length, 2);
    assert.ok(k.chips.includes('Undo'));
    const u = await a.handle('Undo');
    assert.match(u.text, /Undone: added to plan/);
    assert.equal(st.events['2026-10-08'].length, 1);
    // piano: chip "Apply" tradotto
    await a.handle('add task finish business plan');
    const p = await a.handle('plan my month');
    assert.match(p.text, /I suggest/); assert.ok(p.chips.includes('Apply'));
    const before = Object.values(st.events).flat().length;
    const ap = await a.handle('Apply');
    assert.match(ap.text, /Done: added/);
    assert.ok(Object.values(st.events).flat().length > before);
    // lingua non supportata dai comandi: avviso gentile + chip tradotti
    setActive('en');
    const f = await a.handle('qwerty zzz');
    assert.equal(f.handled, false); assert.match(f.text, /did not quite get/);
    assert.ok(f.chips.includes('Help'));
    const h = await a.handle('Help'); assert.ok(h.handled && h.chips.length);
  } finally { setActive('it'); }
});

test('lingua attiva senza comandi (es. pt): avviso e chip canonici', async () => {
  registerCatalog('pt', { 'Aiuto': 'Ajuda', 'Per ora capisco i comandi scritti in italiano e in inglese: puoi usare i pulsanti qui sotto.': 'Por agora entendo comandos em italiano e inglês.' });
  setActive('pt');
  try {
    const { env } = mkEnv(); const a = new Assistant(env);
    const f = await a.handle('zzz qqq');
    assert.match(f.text, /Por agora entendo/);
    assert.ok(f.chips.includes('Ajuda'));
    const h = await a.handle('Ajuda'); assert.ok(h.handled && /Posso fare/.test(h.text));
  } finally { setActive('it'); }
});
