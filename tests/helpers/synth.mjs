// Generatore di stato sintetico "5 anni di vita reale" per misurare l'engine di persistenza. Deterministico (seed fisso).
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const WORDS = 'riunione spesa casa palestra medico dentista bolletta luce gas affitto progetto cliente fattura viaggio treno volo hotel compleanno regalo cena amici famiglia corso studio esame lettura corsa yoga meditazione sonno obiettivo risparmio budget supermercato benzina assicurazione tasse scadenza rinnovo passaporto contratto colloquio idea nota ricetta film libro musica concerto weekend montagna mare'.split(' ');

export function makeSynthStates({ years = 5, seed = 42, scale = 1 } = {}) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const words = (n) => Array.from({ length: n }, () => pick(WORDS)).join(' ');
  const days = Math.round(365 * years);
  const start = Date.UTC(2021, 0, 1);
  const dayKey = (i) => new Date(start + i * 86400000).toISOString().slice(0, 10);
  const id = (p, i) => `${p}${i.toString(36)}${Math.floor(r() * 1e6).toString(36)}`;
  const S = (n) => Math.max(1, Math.round(n * scale));

  const tasks = Array.from({ length: S(days * 4) }, (_, i) => ({ id: id('t', i), t: words(3 + Math.floor(r() * 4)), done: r() > 0.1, doneAt: dayKey(Math.floor(r() * days)), recurring: r() > 0.9 ? 'daily' : 'none' }));
  const notes = Array.from({ length: S(days * 1.5) }, (_, i) => ({ id: id('n', i), text: words(30 + Math.floor(r() * 70)), ts: start + i * 40000000 }));
  const goals = Array.from({ length: S(60) }, (_, i) => ({ id: id('g', i), t: words(4), p: Math.floor(r() * 100), hist: Array.from({ length: 120 }, (_, k) => ({ d: dayKey(k), p: k % 100 })) }));
  const drive = Array.from({ length: S(900) }, (_, i) => ({ id: id('f', i), n: words(2) + '.pdf', size: Math.floor(r() * 5e6), uri: `file:///data/user/0/app/files/${id('u', i)}.pdf` }));
  const events = {};
  for (let i = 0; i < days; i++) { const n = Math.floor(r() * 4); if (n) events[dayKey(i)] = Array.from({ length: n }, () => ({ time: `${String(8 + Math.floor(r() * 10)).padStart(2, '0')}:00`, title: words(3) })); }
  const life = { tasks, goals, automations: [], notes, drive, events, vacRange: null, vacations: [], trash: [], freeBuffer: 30, chat: {}, activeCat: 'General' };

  const chats = {}; const messages = {};
  const nChats = S(60); const perChat = Math.round((days * 25 * scale) / nChats);
  for (let c = 0; c < nChats; c++) {
    const cid = `c${c}`;
    chats[cid] = { id: cid, type: c % 5 === 0 ? 'group' : 'dm', name: words(2), members: ['Alex', words(1)], admins: [], lastRead: Date.now(), createdAt: start };
    messages[cid] = Array.from({ length: perChat }, (_, m) => ({ id: id('m', m), chatId: cid, from: m % 2 ? 'Alex' : 'Marco', kind: 'text', text: words(4 + Math.floor(r() * 18)), ts: start + m * 600000, status: 'read' }));
  }
  const chat = { chats, messages, settings: {}, blocked: [] };

  const months = Array.from({ length: years * 12 }, (_, m) => ({ label: `m${m}`, start: 0, locked: m < years * 12 - 1, movements: Array.from({ length: S(60) }, () => ({ d: Math.floor(r() * 28) + 1, t: words(2), a: -Math.round(r() * 20000) / 100, cat: pick(['Casa', 'Spesa', 'Svago', 'Trasporti']) })) }));
  const finance = { categories: [], insights: [], savingsPct: 12, months, budget: { salary: 6500, saveToEmergency: true, alloc: {} }, bills: Array.from({ length: S(years * 12 * 6) }, (_, i) => ({ id: id('b', i), name: words(2), amount: Math.round(r() * 30000) / 100, due: dayKey(i % days), paid: true })), invoices: Array.from({ length: S(years * 12 * 3) }, (_, i) => ({ id: id('i', i), client: words(2), amount: Math.round(r() * 300000) / 100, date: dayKey(i % days) })), billPrefs: {}, tax: {}, cash: 1234, orders: [], trades: [], plans: {} };

  const posts = Array.from({ length: S(days * 2) }, (_, i) => ({ id: id('p', i), author: words(1), text: words(10 + Math.floor(r() * 30)), ts: start + i * 20000000, likes: Math.floor(r() * 50) }));
  const comments = {}; for (let i = 0; i < Math.min(posts.length, S(4000)); i++) comments[posts[i].id] = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ author: words(1), text: words(8) }));
  const notifications = Array.from({ length: S(days * 3) }, (_, i) => ({ id: id('x', i), title: words(3), body: words(8), ts: start + i * 10000000, read: true }));
  const network = { lifePoints: 5000, ledger: Array.from({ length: S(days) }, (_, i) => ({ type: 'earn', desc: words(2), amount: 5, date: dayKey(i) })), identity: {}, posts, comments, notifications, conversations: {}, following: [], ideas: [], communities: [], providers: [], bookings: [], seminars: [], enrollments: [], groups: [], cards: [], prefs: {}, suggested: [] };

  const metrics = ['steps', 'sleep', 'hr', 'hrv', 'weight', 'kcal'];
  const health = { series: Object.fromEntries(metrics.map((m) => [m, Array.from({ length: days }, () => Math.round(r() * 10000))])), dates: Object.fromEntries(metrics.map((m) => [m, Array.from({ length: days }, (_, i) => dayKey(i))])), sources: {}, lastLog: {}, workouts: Array.from({ length: S(days / 2) }, (_, i) => ({ id: id('w', i), type: 'Corsa', duration: 30, date: dayKey(i % days) })), mindSessions: [], moods: Array.from({ length: days }, (_, i) => ({ d: dayKey(i), mood: pick(['ok', 'bene', 'stanco']) })), wearable: { connected: false, device: null }, lastSync: null, syncError: null };

  const app = { onboarded: true, account: { name: 'Alex', email: 'alex@example.com' }, language: 'it', demo: false };
  const mk = (state) => JSON.stringify({ state, version: 0 });
  return { 'lp2-app': mk(app), 'lp2-life': mk(life), 'lp2-chat': mk(chat), 'lp2-finance': mk(finance), 'lp2-network': mk(network), 'lp2-health': mk(health) };
}

export const totalBytes = (m) => Object.values(m).reduce((a, v) => a + v.length, 0);
