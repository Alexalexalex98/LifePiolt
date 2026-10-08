import seed from '@/data/network-seed.json';
import { seedMarketplace } from '@/data/marketSeed';
import { demoAutomations, demoBills, demoDoneTasks, demoDrive, demoEvents, demoGoals, demoHealth, demoInsights, demoMonths, demoNotes, demoTasks } from '@/data/seed';
import { shortDate } from '@/lib/format';
import { defaultBudget, defaultCategories, defaultWatchlist, useFin } from './finance';
import { ensureDates, useHealth } from './health';
import { seedJobs } from '@/data/jobsSeed';
import { useChat, type ChatMessage } from './chat';
import { useJobs } from './jobs';
import { useLife } from './life';
import { useNet } from './network';
import { useMod } from './moderation';
import { useTravel } from './travel';
import { demoMoods } from '@/data/moodDemo';
import { demoWeather } from '@/lib/weather';
import { useContext } from './context';
import { useAssistant } from './assistant';
import { usePrefs } from './prefs';

/** Sostituisce il nome del prototipo con quello dell'utente e le date relative con date reali. */
function personalise<T>(data: T, me: string): T {
  return JSON.parse(JSON.stringify(data), (_k, v) => {
    if (v === 'Alex') return me;
    if (typeof v === 'string' && /^@\d+$/.test(v)) return shortDate(Number(v.slice(1)));
    if (typeof v === 'string' && v.startsWith('Alex Club')) return v.replace('Alex', me);
    return v;
  });
}


/** Chat di esempio (solo modalità demo). */
function seedChats(me: string) {
  const DAY = 86400000;
  const chats: Record<string, import('./chat').Chat> = {};
  const messages: Record<string, ChatMessage[]> = {};
  const add = (id: string, from: string, text: string, ago: number, extra: Partial<ChatMessage> = {}) => {
    const m: ChatMessage = { id: `demo-${id}-${(messages[id] ??= []).length}`, chatId: id, from, kind: 'text', text, ts: Date.now() - ago, status: 'read', ...extra };
    messages[id].push(m);
  };
  const dm = (name: string, lastRead: number) => { const id = `dm:${name}`; chats[id] = { id, type: 'dm', name, members: [me, name], admins: [], lastRead, createdAt: Date.now() - 6 * DAY }; return id; };
  const a = dm('Marco T.', Date.now() - 2 * DAY);
  add(a, 'Marco T.', 'Ciao! Ho visto la tua idea AURA, fantastica.', 3 * DAY);
  add(a, me, 'Grazie mille! Sto lavorando al prototipo hardware in questi giorni.', 3 * DAY - 600000);
  add(a, 'Marco T.', 'Fammi sapere se cerchi beta tester, mi piacerebbe provarlo.', 2 * DAY + 3600000);
  // Marco condivide cose utili per lavorare insieme (agenda, task, proposta di orari)
  const dk = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  add(a, 'Marco T.', '', 5 * 3600000, { kind: 'agenda', agenda: { title: 'I miei impegni di domani', range: 'domani', items: [{ day: dk(1), time: '09:30', title: 'Riunione con il fornitore' }, { day: dk(1), time: '14:00', title: 'Prova prototipo AURA' }, { day: dk(1), time: '17:30', title: 'Chiamata investitori' }] } });
  add(a, 'Marco T.', '', 4 * 3600000, { kind: 'agenda', agenda: { title: 'Quando sono libero questa settimana', range: '7 giorni', mode: 'liberi', items: [], free: [{ day: dk(1), from: '11:00', to: '13:00' }, { day: dk(2), from: '09:00', to: '12:00' }, { day: dk(2), from: '16:00', to: '18:00' }, { day: dk(3), from: '14:00', to: '17:30' }], hours: { from: '09:00', to: '18:00', minSlot: 30 } } });
  add(a, 'Marco T.', '', 3 * 3600000, { kind: 'tasks', taskList: { title: 'Da preparare per i beta tester', items: [{ t: 'Scrivere le istruzioni d’uso', done: true }, { t: 'Preparare il modulo di feedback', done: false }, { t: 'Spedire i 5 prototipi', done: false }] } });
  add(a, 'Marco T.', '', 2 * 3600000, { kind: 'slots', slots: { title: 'Call su AURA', durationMin: 30, options: [{ id: 's1', day: dk(2), time: '10:00', votes: ['Marco T.'] }, { id: 's2', day: dk(2), time: '15:30', votes: ['Marco T.'] }, { id: 's3', day: dk(3), time: '11:00', votes: [] }] } });
  const b = dm('Giulia M.', Date.now() - 5 * DAY);
  add(b, 'Giulia M.', 'Ci vediamo per la corsa di domenica?', 3 * 3600000);
  const g = 'g:demo-run';
  chats[g] = { id: g, type: 'group', name: 'Corsa della domenica', members: [me, 'Giulia M.', 'Tommaso V.', 'Federica L.'], admins: [me], lastRead: Date.now() - DAY, createdAt: Date.now() - 9 * DAY, pinned: true };
  add(g, 'system', `${me} ha creato il gruppo "Corsa della domenica"`, 9 * DAY, { kind: 'system', from: 'system' });
  add(g, 'Tommaso V.', 'Ritrovo alle 8:00 al lago?', 26 * 3600000);
  add(g, me, 'Per me va benissimo', 25 * 3600000, { status: 'read', reactions: { 'Tommaso V.': 'like' } });
  add(g, 'Federica L.', 'Io porto le barrette energetiche', 2 * 3600000);
  // più persone che condividono con te cose diverse: ogni scelta finisce nel tuo calendario
  add(b, 'Giulia M.', '', 2 * 3600000, { kind: 'agenda', agenda: { title: 'Quando sono libera questa settimana', range: '7 giorni', mode: 'liberi', items: [], free: [{ day: dk(1), from: '10:00', to: '12:00' }, { day: dk(1), from: '15:00', to: '17:00' }, { day: dk(2), from: '13:30', to: '16:00' }, { day: dk(4), from: '09:00', to: '11:30' }], hours: { from: '09:00', to: '18:00', minSlot: 30 } } });
  add(b, 'Giulia M.', 'Se ti va un caffè per parlare del progetto, scegli tu l’orario.', 110 * 60000);
  add(b, 'Giulia M.', '', 100 * 60000, { kind: 'slots', slots: { title: 'Caffè e progetto', durationMin: 45, options: [{ id: 'g1', day: dk(1), time: '15:00', votes: ['Giulia M.'] }, { id: 'g2', day: dk(2), time: '14:00', votes: ['Giulia M.'] }, { id: 'g3', day: dk(4), time: '10:00', votes: [] }] } });

  const f = dm('Federica L.', Date.now() - 4 * DAY);
  add(f, 'Federica L.', 'Ciao! Ti mando la mia agenda senza i dettagli, vedi solo quando sono occupata.', 5 * 3600000);
  add(f, 'Federica L.', '', 5 * 3600000 - 60000, { kind: 'agenda', agenda: { title: 'La mia disponibilità della settimana', range: '7 giorni', mode: 'occupato', items: [], busy: [{ day: dk(1), from: '09:00', to: '12:00' }, { day: dk(2), from: '10:00', to: '11:00' }, { day: dk(3), from: '14:00', to: '17:00' }], free: [{ day: dk(1), from: '14:00', to: '17:30' }, { day: dk(2), from: '11:00', to: '13:00' }, { day: dk(3), from: '09:00', to: '12:00' }], hours: { from: '09:00', to: '18:00', minSlot: 30 } } });
  add(f, 'Federica L.', '', 4 * 3600000, { kind: 'note', noteShare: { title: 'Idee per il lancio', text: 'Idee per il lancio\n- Video di 30 secondi del prototipo\n- Pagina di iscrizione con lista d’attesa\n- 3 beta tester per settimana' } });
  add(f, 'Federica L.', '', 3 * 3600000, { kind: 'poll', poll: { q: 'Quale giorno è meglio per il test del prototipo?', multi: true, options: [{ id: 'f1', t: 'Martedì mattina', votes: ['Federica L.'] }, { id: 'f2', t: 'Mercoledì pomeriggio', votes: [] }, { id: 'f3', t: 'Giovedì tutto il giorno', votes: ['Federica L.'] }] } });
  add(f, 'Federica L.', '', 2.5 * 3600000, { kind: 'location', location: { lat: 46.0101, lng: 8.9606, label: 'Spazio coworking, Lugano' } });

  const tm = dm('Tommaso V.', Date.now() - 3 * DAY);
  add(tm, 'Tommaso V.', 'Ho preparato la lista per il trasloco del laboratorio: prendi quello che puoi.', 6 * 3600000);
  add(tm, 'Tommaso V.', '', 6 * 3600000 - 60000, { kind: 'tasks', taskList: { title: 'Trasloco laboratorio', items: [{ t: 'Imballare gli strumenti', done: false }, { t: 'Prenotare il furgone', done: false }, { t: 'Cambiare l’indirizzo sul sito', done: false }, { t: 'Ritirare le chiavi nuove', done: true }] } });
  add(tm, 'Tommaso V.', '', 5 * 3600000, { kind: 'slots', slots: { title: 'Allenamento in coppia', durationMin: 60, options: [{ id: 't1', day: dk(1), time: '12:00', votes: ['Tommaso V.'] }, { id: 't2', day: dk(3), time: '17:00', votes: ['Tommaso V.'] }, { id: 't3', day: dk(5), time: '09:00', votes: [] }] } });
  add(tm, 'Tommaso V.', '', 4 * 3600000, { kind: 'contact', contact: { name: 'Marta Bianchi (trasportatrice)', phone: '+41 79 555 01 22' } });

  const el = dm('Elena Rossi', Date.now() - 2 * DAY);
  add(el, 'Elena Rossi', 'Buongiorno, per la dichiarazione dei redditi proponiamo questi orari di consulenza.', 8 * 3600000);
  add(el, 'Elena Rossi', '', 8 * 3600000 - 60000, { kind: 'slots', slots: { title: 'Consulenza fiscale', durationMin: 60, options: [{ id: 'e1', day: dk(2), time: '09:30', votes: [] }, { id: 'e2', day: dk(3), time: '14:00', votes: [] }, { id: 'e3', day: dk(6), time: '11:00', votes: [] }] } });
  add(el, 'Elena Rossi', '', 7 * 3600000, { kind: 'tasks', taskList: { title: 'Documenti da portare', items: [{ t: 'Certificato di salario', done: false }, { t: 'Estratti conto bancari', done: false }, { t: 'Ricevute della cassa malati', done: false }] } });

  const cena = 'g:demo-cena';
  chats[cena] = { id: cena, type: 'group', name: 'Cena di sabato', members: [me, 'Giulia M.', 'Tommaso V.', 'Federica L.'], admins: ['Giulia M.'], lastRead: Date.now() - 5 * DAY, createdAt: Date.now() - 4 * DAY };
  add(cena, 'system', 'Giulia M. ha creato il gruppo "Cena di sabato"', 4 * DAY, { kind: 'system', from: 'system' });
  add(cena, 'Giulia M.', 'Organizziamo la cena! Votate gli orari: quello che scegliete va nel vostro calendario.', 3 * 3600000);
  add(cena, 'Giulia M.', '', 3 * 3600000 - 60000, { kind: 'slots', slots: { title: 'Cena di sabato', durationMin: 120, options: [{ id: 'c1', day: dk(((6 - new Date().getDay() + 7) % 7) || 7), time: '19:30', votes: ['Giulia M.', 'Tommaso V.'] }, { id: 'c2', day: dk(((6 - new Date().getDay() + 7) % 7) || 7), time: '20:30', votes: ['Federica L.'] }] } });
  add(cena, 'Tommaso V.', '', 2 * 3600000, { kind: 'poll', poll: { q: 'Cosa mangiamo?', multi: false, options: [{ id: 'm1', t: 'Pizza', votes: ['Tommaso V.'] }, { id: 'm2', t: 'Sushi', votes: ['Federica L.', 'Giulia M.'] }, { id: 'm3', t: 'Cucina ticinese', votes: [] }] } });
  add(cena, 'Federica L.', '', 90 * 60000, { kind: 'location', location: { lat: 46.0048, lng: 8.9523, label: 'Ristorante sul lago, Lugano' } });

  // gruppo di lavoro con TUTTI gli strumenti, da provare uno per uno
  const w = 'g:demo-aura';
  chats[w] = { id: w, type: 'group', name: 'Team AURA', members: [me, 'Marco T.', 'Giulia M.', 'Federica L.'], admins: [me], description: 'Lavoro sul prototipo AURA: agenda, task, note, sondaggi e orari', lastRead: Date.now() - 4 * 3600000, createdAt: Date.now() - 12 * DAY, pinned: true };
  add(w, 'system', `${me} ha creato il gruppo "Team AURA"`, 12 * DAY, { kind: 'system', from: 'system' });
  add(w, 'Giulia M.', 'Ciao a tutti! Qui proviamo tutti gli strumenti: agenda, task, note, sondaggi, orari, posizione, contatti e file.', 6 * 3600000);
  add(w, 'Giulia M.', '', 5.5 * 3600000, { kind: 'agenda', agenda: { title: 'Quando sono libera questa settimana', range: '7 giorni', mode: 'liberi', items: [], free: [{ day: dk(1), from: '09:00', to: '10:30' }, { day: dk(2), from: '13:00', to: '15:00' }, { day: dk(3), from: '09:00', to: '12:00' }, { day: dk(4), from: '15:00', to: '17:00' }], hours: { from: '09:00', to: '18:00', minSlot: 30 } } });
  add(w, 'Federica L.', '', 5 * 3600000, { kind: 'agenda', agenda: { title: 'Disponibilità di Federica (occupato / libero)', range: '7 giorni', mode: 'occupato', items: [], busy: [{ day: dk(1), from: '10:00', to: '12:00' }, { day: dk(2), from: '09:00', to: '13:00' }], free: [{ day: dk(1), from: '13:00', to: '17:00' }, { day: dk(2), from: '14:00', to: '17:00' }], hours: { from: '09:00', to: '18:00', minSlot: 30 } } });
  add(w, 'Marco T.', '', 4.5 * 3600000, { kind: 'tasks', taskList: { title: 'Da fare prima del test', items: [{ t: 'Calibrare il sensore', done: false }, { t: 'Aggiornare il firmware', done: false }, { t: 'Stampare le istruzioni', done: true }] } });
  add(w, 'Giulia M.', '', 4 * 3600000, { kind: 'note', noteShare: { title: 'Appunti riunione fornitore', text: 'Appunti riunione fornitore\n- Consegna prototipi entro il 30\n- Costo unitario 42 CHF con ordine minimo di 50\n- Garanzia 24 mesi' } });
  add(w, 'Federica L.', '', 3.5 * 3600000, { kind: 'poll', poll: { q: 'Dove facciamo la riunione di venerdì?', multi: false, options: [{ id: 'p1', t: 'In ufficio', votes: ['Marco T.'] }, { id: 'p2', t: 'Online', votes: ['Giulia M.'] }, { id: 'p3', t: 'Al bar vicino', votes: [] }] } });
  add(w, 'Marco T.', '', 3 * 3600000, { kind: 'location', location: { lat: 46.0037, lng: 8.9511, label: 'Laboratorio AURA, Lugano' } });
  add(w, 'Giulia M.', '', 2.5 * 3600000, { kind: 'contact', contact: { name: 'Elena Rossi (fornitore sensori)', phone: '+41 79 123 45 67' } });
  add(w, 'Federica L.', '', 2 * 3600000, { kind: 'slots', slots: { title: 'Riunione di allineamento', durationMin: 45, options: [{ id: 'w1', day: dk(2), time: '10:00', votes: ['Giulia M.', 'Federica L.'] }, { id: 'w2', day: dk(2), time: '14:00', votes: ['Marco T.'] }, { id: 'w3', day: dk(3), time: '09:30', votes: ['Giulia M.'] }] } });
  add(w, 'Marco T.', 'Se vi va bene scelgo io un orario: tocca a chi ha creato il gruppo confermare quello giusto.', 1.5 * 3600000);
  // inviti a eventi (alcuni si sovrappongono a impegni demo del Plan: "Pranzo con Marco T." domani 12:00, "Cena con Giulia" dopodomani 20:30)
  const sunday = dk(((7 - new Date().getDay()) % 7) || 7);
  add(a, 'Marco T.', '', 40 * 60000, { kind: 'event', event: { title: 'Pranzo di lavoro AURA', day: dk(1), time: '12:30', durationMin: 60, place: 'Bar del laboratorio, Lugano', description: 'Passiamo in rassegna il piano dei beta tester.', rsvp: {} } });
  add(b, 'Giulia M.', '', 45 * 60000, { kind: 'event', event: { title: 'Cena da Luigi', day: dk(2), time: '20:00', durationMin: 120, place: 'Trattoria da Luigi', rsvp: {} } });
  add(g, 'Federica L.', '', 50 * 60000, { kind: 'event', event: { title: 'Brunch dopo la corsa', day: sunday, time: '10:30', durationMin: 90, place: 'Caffè del lago', description: 'Chi vuole fermarsi dopo l’allenamento.', rsvp: { 'Tommaso V.': 'yes', 'Giulia M.': 'maybe' } } });
  add(w, me, '', 55 * 60000, { kind: 'event', status: 'read', event: { title: 'Prova generale prototipo AURA', day: dk(3), time: '15:00', durationMin: 90, place: 'Laboratorio AURA, Lugano', rsvp: { 'Marco T.': 'yes', 'Giulia M.': 'maybe', 'Federica L.': 'no' } } });
  // ordine coerente: dentro ogni chat i messaggi sono in ordine di data e nessuno è nel futuro
  const now = Date.now();
  Object.keys(messages).forEach((k) => { messages[k] = messages[k].map((m) => ({ ...m, ts: Math.min(m.ts, now) })).sort((x, y) => x.ts - y.ts); });
  useChat.setState({ chats, messages });
}

/** Carica i dati d'esempio del prototipo in tutti gli store. */
export function applyDemo(me: string, email = '') {
  useLife.setState({ tasks: [...demoTasks(), ...demoDoneTasks()], goals: demoGoals(), automations: demoAutomations(), notes: demoNotes(), drive: demoDrive(), events: demoEvents() });
  const h = demoHealth();
  const series = { ...useHealth.getState().series, ...h.series };
  const dates = { ...useHealth.getState().dates };
  (Object.keys(h.series) as (keyof typeof h.series)[]).forEach((k) => { dates[k] = ensureDates(h.series[k], undefined); });
  useHealth.setState({ series, dates, sources: Object.fromEntries(Object.keys(h.series).map((k) => [k, 'demo'])), workouts: h.workouts, mindSessions: h.mindSessions, moods: h.moods });
  seedChats(me);
  useHealth.setState({ moods: demoMoods() });
  useContext.getState().set({ days: demoWeather(), source: 'demo', fetchedAt: Date.now(), city: useContext.getState().city || 'Lugano', error: null });
  { const j = seedJobs(me); useJobs.setState({ jobs: j.jobs, applications: j.applications, practice: j.practice, practicals: j.practicals }); useNet.setState((st) => ({ votes: { ...st.votes, ...j.votes } })); }
  const months = demoMonths();
  useFin.setState({
    months, insights: demoInsights(), savingsPct: 6.5, bills: demoBills(), cash: 5000, stocks: defaultWatchlist(true),
    tax: { married: false, children: false, banks: ['UBS'], docs: {} },
    budget: defaultBudget(6500, true, defaultCategories, months),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = personalise(seed as any, me);
  useNet.setState({
    lifePoints: 2840, ledger: n.ledger, identity: { verified: true, country: 'Svizzera', birthYear: 1998 }, following: n.following, suggested: n.suggested,
    posts: n.posts, communities: n.communities, providers: n.providers, ideas: n.ideas, seminars: n.seminars,
    notifications: n.notifications, dailyHistory: n.dailyHistory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cards: n.cards.map((c: any) => ({ ...c, holder: me })), defaultCard: n.cards[0]?.id ?? null,
    bio: 'Founder di Life SA · costruisco LifePilot', myCard: { ...n.myCard, email: email || n.myCard.email },
  });
  seedMarketplace(me); // seminari, iscrizioni, descrizioni e date di pubblicazione
}

export function resetAllData() {
  useNet.getState().reset();
  useMod.getState().reset();
  useChat.getState().reset();
  useContext.getState().reset();
  useAssistant.getState().reset();
  useJobs.getState().reset();
  useLife.getState().reset();
  useHealth.getState().reset();
  useFin.getState().reset();
  useTravel.getState().reset();
  usePrefs.getState().reset();
}
