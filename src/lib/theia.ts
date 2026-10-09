import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { collect, computeDashboard } from '@/lib/analyticsData';
import { alertsFor } from '@/lib/budgetState';
import { budgetSuggestions } from '@/lib/budgetAlerts';
import { useFin } from '@/store/finance';
import { busyDay, lateEventSleep } from '@/lib/insightsLocal';
import { skippedWork } from '@/lib/reschedule';
import { useHealth } from '@/store/health';
import { dayKey } from '@/lib/format';
import { totalUnread, useChat } from '@/store/chat';
import { useApp, navCatalog } from '@/store/app';
import { joinReasons, rankTasks } from '@/lib/priority';
import { t, translateText } from '@/i18n/core';
import { useLife } from '@/store/life';

/**
 * Theia: l'assistente di LifePilot.
 *
 * Con un server collegato (EXPO_PUBLIC_API_URL) le richieste vanno a un modello AI vero.
 * Senza server risponde in locale con regole semplici sui dati del telefono: utile, ma NON è
 * un modello linguistico, e non può leggere le immagini. L'app lo dice sempre in chiaro.
 *
 * Contratto del server:  POST {EXPO_PUBLIC_API_URL}/theia
 *   body:     { assistant, question, selection?, image?: { base64, mime }, context?, source }
 *   risposta: { reply: string, tasks?: string[] }
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const theiaOnline = Boolean(API_URL);

export type TheiaSource = 'chat' | 'note' | 'screen' | 'clipboard' | 'home' | 'free';
export type TheiaRequest = { text?: string; imageUri?: string; source: TheiaSource; label?: string; replyToChat?: string; /** domanda da fare subito all'apertura */ ask?: string };
export type TheiaAnswer = { text: string; tasks?: string[]; reply?: string; offline: boolean };

/* ---------- contesto dell'utente ---------- */
const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Riassunto compatto di ciò che l'app sa. `forServer` rispetta i permessi privacy scelti dall'utente. */
const itFill = (src: string, args: (string | number)[]) => src.replace(/\{(\d+)\}/g, (_m, i) => String(args[+i] ?? ''));

/** `loc` = testo per l'utente nella lingua attiva; senza `loc` resta in italiano (è il contesto mandato al server). */
export function buildContext(forServer: boolean, loc = false): string {
  const L = (src: string, ...args: (string | number)[]) => (loc ? t(src, ...args) : itFill(src, args));
  const app = useApp.getState();
  const life = useLife.getState();
  const allowHealth = !forServer || app.privacy['Dati salute'];
  const allowFin = !forServer || app.privacy['Dati finanziari'];
  const none = () => L('nessuno');
  const lines: string[] = [L('Ora: {0} {1}', dayKey(), hhmm()), L('Utente: {0}', app.account.name)];

  const open = life.tasks.filter((t) => !(t.subtasks?.length ? t.subtasks.every((s) => s.done) : t.done));
  lines.push(L('Task aperti ({0}): {1}', open.length, open.slice(0, 8).map((x) => x.t).join('; ') || none()));
  const ev = life.events[dayKey()] ?? [];
  lines.push(L('Eventi oggi: {0}', ev.map((e) => `${e.time} ${e.title}`).join('; ') || none()));
  lines.push(L('Obiettivi: {0}', life.goals.map((g) => `${g.t} ${g.p}%`).join('; ') || none()));

  if (allowHealth || allowFin) {
    try {
      const d = computeDashboard();
      const pick = d.list.filter((a) => (a.def.domain === 'finanza' ? allowFin : allowHealth));
      lines.push(L('Punteggi: {0}', Object.entries(d.scores).map(([k, v]) => `${k} ${v ?? L('n/d')}`).join(', ')));
      lines.push(L('Metriche (media 7 giorni): {0}', pick.slice(0, 12).map((a) => `${a.def.label} ${Math.round((a.def.period === 'day' ? a.avg7 : a.latest.v) * 10) / 10}${a.def.unit}`).join('; ')));
      lines.push(L('Segnali: {0}', d.insights.filter((i) => (i.domain === 'finanza' ? allowFin : allowHealth)).slice(0, 5).map((i) => i.title).join(' | ')));
    } catch { /* senza dati */ }
  }
  const top = Object.entries(app.pageVisits).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p]) => navCatalog[p] ?? p);
  lines.push(L('Sezioni più usate: {0}', top.join(', ') || L('n/d')));
  lines.push(L('Chat non lette: {0}', totalUnread(app.account.name)));
  return lines.join('\n');
}

/* ---------- suggerimenti proattivi ---------- */
export type Suggestion = { id: string; title: string; detail: string; why: string; page?: string; params?: Record<string, string>; cta: string; score: number };

const pageForDomain: Record<string, string> = { salute: 'lifehealth', mente: 'lifehealth', finanza: 'lifefinance', crescita: 'lifetask' };

/**
 * Cerca cosa ti servirà adesso, usando solo dati sul telefono: orario e abitudini d'uso,
 * calendario, task, obiettivi, salute, finanze e messaggi. Ogni suggerimento dice PERCHÉ compare.
 */
export function predictNeeds(now = new Date()): Suggestion[] {
  const app = useApp.getState();
  const life = useLife.getState();
  const out: Suggestion[] = [];
  const h = now.getHours();
  const nowMin = h * 60 + now.getMinutes();

  // 1) calendario imminente
  (life.events[dayKey(now)] ?? []).forEach((e, i) => {
    const [eh, em] = e.time.split(':').map(Number);
    const diff = eh * 60 + em - nowMin;
    if (diff >= 0 && diff <= 90) out.push({ id: `ev${i}`, title: t('Tra {0} min: {1}', diff, e.title), detail: t('Hai un impegno in arrivo.'), why: t('Evento in calendario nelle prossime 90 minuti'), page: 'plan', cta: t('Apri il piano'), score: 100 - diff / 2 });
  });

  // 2) abitudine: a quest'ora di solito apri una sezione
  const total = (p: string) => (app.visitHours?.[p] ?? []).reduce((s, x) => s + x, 0);
  Object.keys(app.visitHours ?? {}).forEach((p) => {
    if (p === 'home' || p === 'settings') return;
    const arr = app.visitHours[p];
    const near = (arr[(h + 23) % 24] ?? 0) + (arr[h] ?? 0) + (arr[(h + 1) % 24] ?? 0);
    const share = total(p) ? near / total(p) : 0;
    if (total(p) >= 6 && near >= 3 && share >= 0.3) out.push({ id: `hab-${p}`, title: t('Di solito a quest\'ora apri {0}', translateText(navCatalog[p] ?? p)), detail: t('Ti porto subito lì.'), why: t('{0} delle tue {1} aperture di {2} sono attorno alle {3}:00', near, total(p), translateText(navCatalog[p] ?? p), h), page: p, cta: t('Apri {0}', translateText(navCatalog[p] ?? p)), score: 40 + share * 40 });
  });

  // 3) task aperti
  const open = life.tasks.filter((t) => !(t.subtasks?.length ? t.subtasks.every((s) => s.done) : t.done));
  if (open.length) {
    // quale fare per primo: urgenza, scadenze e legame con i prossimi appuntamenti; altrimenti l'ordine scelto dall'utente
    const ranked = rankTasks(open.map((t) => ({ id: t.id, t: t.t, urgent: t.urgent, due: t.due })), Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, important: e.important }))), now);
    const top = ranked[0];
    const hot = top && top.score > 0;
    out.push({ id: 'tasks', title: hot ? t('Prima: {0}', top.task.t) : open.length === 1 ? t('1 task aperto') : t('{0} task aperti', open.length), detail: top ? (hot ? t('Perché {0}.', joinReasons(top.reasons)) : t('Nessuno è urgente: parti da “{0}”, nell’ordine che hai scelto.', top.task.t)) : '', why: hot ? t('Ordinati per urgenza, scadenza e collegamento con i tuoi appuntamenti') : t('Hai task non completati'), page: 'lifetask', cta: t('Vai ai task'), score: (hot ? 70 : 35) + Math.min(open.length, 6) * 3 });
  }

  // 4) obiettivi fermi da una settimana
  life.goals.forEach((g) => {
    const last = g.hist?.[g.hist.length - 1]?.d;
    if (g.p < 100 && last && (Date.parse(dayKey(now)) - Date.parse(last)) / 86400000 >= 7) out.push({ id: `goal-${g.id}`, title: t('Obiettivo fermo: {0}', g.t), detail: t('È al {0}% e non si muove da una settimana. Un passo piccolo oggi lo sblocca.', g.p), why: t('Nessun avanzamento negli ultimi 7 giorni'), page: 'lifetask', cta: t('Apri obiettivi'), score: 45 });
  });

  // 5) messaggi
  const unread = totalUnread(app.account.name);
  if (unread > 0) out.push({ id: 'chat', title: unread === 1 ? t('1 chat da leggere') : t('{0} chat da leggere', unread), detail: t('Qualcuno ti ha scritto.'), why: t('Messaggi non letti'), page: 'messagesPage', cta: t('Apri messaggi'), score: 50 });

  // 6) segnali dall'analisi dati (salute, mente, finanze)
  try {
    computeDashboard().insights.filter((i) => i.severity === 'bad' || i.severity === 'warn').slice(0, 3).forEach((i) => {
      out.push({ id: `ins-${i.id}`, title: i.title, detail: i.action ?? i.detail, why: t('Rilevato dall’analisi dei tuoi dati'), page: pageForDomain[i.domain], cta: t('Vedi i dettagli'), score: (i.severity === 'bad' ? 80 : 60) + i.priority * 0.1 });
    });
  } catch { /* nessun dato */ }

  // 7) sera: prepararsi al sonno
  if (h >= 21 || h < 2) out.push({ id: 'sleep', title: t('È tardi: dormire bene domani ti rende di più'), detail: t('Stacca schermi e luci, il sonno è la metrica che muove tutte le altre.'), why: t('Sono le {0}', hhmm(now)), page: 'lifehealth', cta: t('Vedi il sonno'), score: 30 });

  // 7b) budget: categorie vicine o oltre il limite
  try {
    budgetSuggestions(alertsFor(useFin.getState())).forEach((b) => out.push({ id: `bud-${b.id}`, title: b.title, detail: b.detail, why: t('Confronto tra le tue spese e il budget o le linee guida'), page: 'lifefinance', cta: t('Apri Finanze'), score: 55 + b.priority * 0.1 }));
  } catch { /* niente */ }

  // 8) sessioni di lavoro saltate: le ripianifico io
  try {
    const flat = Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, dur: e.dur })));
    const sk = skippedWork(flat, life.tasks.map((t) => ({ id: t.id, t: t.t, done: t.done })), now);
    if (sk.length) out.push({ id: 'skipped', title: sk.length === 1 ? t('1 sessione di lavoro saltata') : t('{0} sessioni di lavoro saltate', sk.length), detail: t('Il task è ancora aperto: te le rimetto nei prossimi slot liberi.'), why: t('Impegni «Lavoro su…» passati con il task non completato'), page: 'ai', params: { ask: 'ripianifica le sessioni saltate' }, cta: t('Ripianifica'), score: 75 });
  } catch { /* niente */ }

  // 9) domani è una giornata piena
  try {
    const tm = new Date(now); tm.setDate(tm.getDate() + 1);
    const n = busyDay(Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title }))), dayKey(tm));
    if (n && h >= 15) out.push({ id: 'busytm', title: t('Domani hai {0} impegni', n), detail: t('Giornata piena: controlla che ci sia una pausa e preparati stasera.'), why: t('Cinque o più impegni in agenda per domani'), page: 'plan', cta: t('Apri il piano'), score: 55 });
  } catch { /* niente */ }

  // 10) dopo gli impegni serali dormi meno?
  try {
    const ser = collect(dayKey(now)).find((x) => x.def.id === 'sleep');
    if (ser) {
      const r = lateEventSleep(Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title }))), ser.pts);
      if (r && r.diffMin < 0) out.push({ id: 'late-sleep', title: t('Dopo gli impegni serali dormi {0} min in meno', Math.abs(r.diffMin)), detail: t('Provare a spostarli prima delle 18 o a staccare presto dopo.'), why: t('Confronto di {0} notti dopo una sera impegnata con {1} notti normali (è una correlazione, non una prova)', r.nWith, r.nWithout), page: 'lifehealth', cta: t('Vedi il sonno'), score: 50 });
    }
  } catch { /* niente */ }

  // 11) sera senza check-in dell'umore
  try {
    if (h >= 19 && !useHealth.getState().moods.some((m) => m.day === dayKey(now))) out.push({ id: 'mood-eve', title: t('Come ti sei sentito oggi?'), detail: t('Il check-in dell’umore ti prende 5 secondi e rende più precise le analisi.'), why: t('Oggi non hai ancora registrato il tuo umore'), page: 'mood', cta: t('Registra l’umore'), score: 45 });
  } catch { /* niente */ }

  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/* ---------- risposte locali (senza server) ---------- */
const sentences = (t: string) => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

function extractTasks(text: string): string[] {
  const out = new Set<string>();
  text.split(/\n|(?<=[.;!?])\s+/).forEach((raw) => {
    const s = raw.replace(/^[-•*\d.)\s]+/, '').trim();
    if (s.length < 6) return;
    const m = s.match(/\b(devo|devi|deve|dovete|dobbiamo|dovresti|ricordati di|ricorda di|bisogna|da fare:?|non dimenticare di|puoi)\s+(.+)/i);
    if (m) out.add(m[2].replace(/[.!?]+$/, ''));
    else if (/^(chiama|scrivi|invia|manda|prenota|compra|paga|prepara|controlla|porta|ritira|fissa)\b/i.test(s)) out.add(s.replace(/[.!?]+$/, ''));
  });
  return [...out].map((x) => x.charAt(0).toUpperCase() + x.slice(1)).slice(0, 8);
}

function findFacts(text: string) {
  const dates = text.match(/\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b|\b(?:lun|mar|mer|gio|ven|sab|dom)\w*\b|\b(?:oggi|domani|dopodomani|stasera|stamattina)\b/gi) ?? [];
  const times = text.match(/\b\d{1,2}[:.]\d{2}\b|\balle \d{1,2}\b/gi) ?? [];
  const amounts = [...text.matchAll(/(?:CHF|EUR|€|\$|Fr\.)\s?(\d+(?:[.,']\d+)*)|(\d+(?:[.,']\d+)*)\s?(?:CHF|EUR|€|\$|franchi|euro)/gi)].map((m) => ({ raw: m[0], n: Number((m[1] ?? m[2]).replace(/'/g, '').replace(',', '.')) }));
  const links = text.match(/https?:\/\/\S+/g) ?? [];
  return { dates: [...new Set(dates)], times: [...new Set(times)], amounts, links };
}

export function localAnswer(question: string, selection: string | undefined, hasImage: boolean): TheiaAnswer {
  const q = question.toLowerCase();
  const text = (selection ?? '').trim();
  const ctx = buildContext(false, true);
  const note = '\n\n' + t('(Risposta locale: senza server non uso un vero modello AI.)');

  if (hasImage && !text) return { offline: true, text: t('Ho salvato lo screenshot, ma leggerlo richiede il modello AI sul server, che non è ancora collegato. Se selezioni e copi il testo, invece, posso lavorarci anche adesso.') };

  if (text) {
    const f = findFacts(text);
    if (/riassum|sintesi|in breve|tl;?dr|summari[sz]e|summary|sum up|in short/.test(q)) {
      const ss = sentences(text);
      const pick = ss.length <= 2 ? ss : [ss[0], ss.reduce((b, s) => (s.length > b.length ? s : b), ss[1])];
      return { offline: true, text: `${t('In breve: {0}', pick.join(' '))}${note}` };
    }
    if (/task|da fare|azion|cosa devo|compit|to-?do|action|what (do )?i (need|have) to/.test(q)) {
      const tk = extractTasks(text);
      return { offline: true, tasks: tk, text: tk.length ? (tk.length === 1 ? t('Ho trovato 1 cosa da fare:\n• {0}', tk.join('\n• ')) : t('Ho trovato {0} cose da fare:\n• {1}', tk.length, tk.join('\n• '))) : t('Non trovo azioni chiare in questo testo.') };
    }
    if (/quando|data|ora|appuntament|scadenz|\bwhen\b|\bdate\b|\btime\b|deadline/.test(q)) {
      const parts = [f.dates.length ? t('Date: {0}', f.dates.join(', ')) : '', f.times.length ? t('Orari: {0}', f.times.join(', ')) : ''].filter(Boolean);
      return { offline: true, text: parts.length ? parts.join('\n') : t('Non vedo date o orari nel testo.') };
    }
    if (/quant|import|costo|prezzo|somma|totale|spes|how much|amount|cost|price|total/.test(q)) {
      if (!f.amounts.length) return { offline: true, text: t('Non vedo importi nel testo.') };
      const tot = f.amounts.reduce((s, a) => s + a.n, 0);
      return { offline: true, text: `${t('Importi: {0}', f.amounts.map((a) => a.raw).join(', '))}\n${t('Totale (stessa valuta): {0}', tot.toFixed(2))}` };
    }
    if (/rispond|scrivi|reply|cosa dico|respond|write back|what (do )?i say/.test(q)) {
      const asks = /\?/.test(text);
      const reply = asks ? t('Ciao! Sì, mi va bene. Fammi sapere i dettagli e ti confermo.') : t('Ricevuto, grazie! Ti aggiorno a breve.');
      return { offline: true, reply, text: `${t('Una risposta possibile:')}\n“${reply}”${note}` };
    }
    // analisi generica
    const bits = [t('Testo di {0} parole.', text.split(/\s+/).length)];
    if (/\?/.test(text)) bits.push(t('Contiene una domanda: probabilmente si aspetta una risposta.'));
    if (f.dates.length || f.times.length) bits.push(t('Cita {0}.', [...f.dates, ...f.times].join(', ')));
    if (f.amounts.length) bits.push(t('Cita importi: {0}.', f.amounts.map((a) => a.raw).join(', ')));
    const tk = extractTasks(text);
    if (tk.length) bits.push(tk.length === 1 ? t('Sembra richiedere 1 azione.') : t('Sembra richiedere {0} azioni.', tk.length));
    return { offline: true, tasks: tk.length ? tk : undefined, text: `${bits.join(' ')}\n${t('Chiedimi “riassumi”, “estrai i task”, “quando?”, “quanto?” o “rispondi per me”.')}${note}` };
  }

  // domande sui dati dell'utente (righe del contesto già nella lingua attiva, per posizione: 2 task, 3 eventi, 4 obiettivi, 5+ dati)
  const lines = ctx.split('\n');
  if (/task|da fare|compiti|to-?do/.test(q)) return { offline: true, text: lines[2] };
  if (/oggi|agenda|calendar|impegn|today|schedule|events?/.test(q)) return { offline: true, text: lines[3] };
  if (/obiettiv|goals?/.test(q)) return { offline: true, text: lines[4] };
  if (/come sto|punteggi|salute|sonno|stress|spes|soldi|budget|health|sleep|money|scores|how am i/.test(q)) {
    const g = lines.slice(5, 8).join('\n');
    return { offline: true, text: `${g || t('Non ho ancora abbastanza dati.')}\n\n${t('I dettagli sono nella Dashboard.')}` };
  }
  const s = predictNeeds()[0];
  return { offline: true, text: s ? t('Adesso ti suggerisco: {0}. {1}', s.title, s.detail) : t('Nessun suggerimento in particolare: sei in linea. Puoi chiedermi dei tuoi task, dell’agenda o di come stai.') };
}

/* ---------- richiesta ---------- */
async function toBase64(uri: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      return await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(String(r.result).split(',')[1] ?? null); r.readAsDataURL(blob); });
    }
    return await new File(uri).base64();
  } catch { return null; }
}

export async function askTheia(question: string, req: TheiaRequest): Promise<TheiaAnswer> {
  if (!API_URL) return localAnswer(question, req.text, !!req.imageUri);
  const app = useApp.getState();
  const image = req.imageUri ? await toBase64(req.imageUri) : null;
  const res = await fetch(`${API_URL}/theia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assistant: app.assistantName, question, selection: req.text, source: req.source,
      image: image ? { base64: image, mime: 'image/jpeg' } : undefined,
      context: app.privacy['AI Memory'] ? buildContext(true) : undefined,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { reply?: string; tasks?: string[] };
  return { offline: false, text: data.reply ?? t('Risposta vuota dal server.'), tasks: data.tasks };
}

void useChat;
