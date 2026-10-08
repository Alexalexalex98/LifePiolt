import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { computeDashboard } from '@/lib/analyticsData';
import { dayKey } from '@/lib/format';
import { totalUnread, useChat } from '@/store/chat';
import { useApp, navCatalog } from '@/store/app';
import { rankTasks } from '@/lib/priority';
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
export function buildContext(forServer: boolean): string {
  const app = useApp.getState();
  const life = useLife.getState();
  const allowHealth = !forServer || app.privacy['Dati salute'];
  const allowFin = !forServer || app.privacy['Dati finanziari'];
  const lines: string[] = [`Ora: ${dayKey()} ${hhmm()}`, `Utente: ${app.account.name}`];

  const open = life.tasks.filter((t) => !(t.subtasks?.length ? t.subtasks.every((s) => s.done) : t.done));
  lines.push(`Task aperti (${open.length}): ${open.slice(0, 8).map((t) => t.t).join('; ') || 'nessuno'}`);
  const ev = life.events[dayKey()] ?? [];
  lines.push(`Eventi oggi: ${ev.map((e) => `${e.time} ${e.title}`).join('; ') || 'nessuno'}`);
  lines.push(`Obiettivi: ${life.goals.map((g) => `${g.t} ${g.p}%`).join('; ') || 'nessuno'}`);

  if (allowHealth || allowFin) {
    try {
      const d = computeDashboard();
      const pick = d.list.filter((a) => (a.def.domain === 'finanza' ? allowFin : allowHealth));
      lines.push(`Punteggi: ${Object.entries(d.scores).map(([k, v]) => `${k} ${v ?? 'n/d'}`).join(', ')}`);
      lines.push(`Metriche (media 7 giorni): ${pick.slice(0, 12).map((a) => `${a.def.label} ${Math.round((a.def.period === 'day' ? a.avg7 : a.latest.v) * 10) / 10}${a.def.unit}`).join('; ')}`);
      lines.push(`Segnali: ${d.insights.filter((i) => (i.domain === 'finanza' ? allowFin : allowHealth)).slice(0, 5).map((i) => i.title).join(' | ')}`);
    } catch { /* senza dati */ }
  }
  const top = Object.entries(app.pageVisits).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p]) => navCatalog[p] ?? p);
  lines.push(`Sezioni più usate: ${top.join(', ') || 'n/d'}`);
  lines.push(`Chat non lette: ${totalUnread(app.account.name)}`);
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
    if (diff >= 0 && diff <= 90) out.push({ id: `ev${i}`, title: `Tra ${diff} min: ${e.title}`, detail: 'Hai un impegno in arrivo.', why: 'Evento in calendario nelle prossime 90 minuti', page: 'plan', cta: 'Apri il piano', score: 100 - diff / 2 });
  });

  // 2) abitudine: a quest'ora di solito apri una sezione
  const total = (p: string) => (app.visitHours?.[p] ?? []).reduce((s, x) => s + x, 0);
  Object.keys(app.visitHours ?? {}).forEach((p) => {
    if (p === 'home' || p === 'settings') return;
    const arr = app.visitHours[p];
    const near = (arr[(h + 23) % 24] ?? 0) + (arr[h] ?? 0) + (arr[(h + 1) % 24] ?? 0);
    const share = total(p) ? near / total(p) : 0;
    if (total(p) >= 6 && near >= 3 && share >= 0.3) out.push({ id: `hab-${p}`, title: `Di solito a quest'ora apri ${navCatalog[p] ?? p}`, detail: 'Ti porto subito lì.', why: `${near} delle tue ${total(p)} aperture di ${navCatalog[p] ?? p} sono attorno alle ${h}:00`, page: p, cta: `Apri ${navCatalog[p] ?? p}`, score: 40 + share * 40 });
  });

  // 3) task aperti
  const open = life.tasks.filter((t) => !(t.subtasks?.length ? t.subtasks.every((s) => s.done) : t.done));
  if (open.length) {
    // quale fare per primo: urgenza, scadenze e legame con i prossimi appuntamenti; altrimenti l'ordine scelto dall'utente
    const ranked = rankTasks(open.map((t) => ({ id: t.id, t: t.t, urgent: t.urgent, due: t.due })), Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, important: e.important }))), now);
    const top = ranked[0];
    const hot = top && top.score > 0;
    out.push({ id: 'tasks', title: hot ? `Prima: ${top.task.t}` : `${open.length} ${open.length === 1 ? 'task aperto' : 'task aperti'}`, detail: top ? (hot ? `Perché ${top.reasons.join(' e ')}.` : `Nessuno è urgente: parti da “${top.task.t}”, nell’ordine che hai scelto.`) : '', why: hot ? 'Ordinati per urgenza, scadenza e collegamento con i tuoi appuntamenti' : 'Hai task non completati', page: 'lifetask', cta: 'Vai ai task', score: (hot ? 70 : 35) + Math.min(open.length, 6) * 3 });
  }

  // 4) obiettivi fermi da una settimana
  life.goals.forEach((g) => {
    const last = g.hist?.[g.hist.length - 1]?.d;
    if (g.p < 100 && last && (Date.parse(dayKey(now)) - Date.parse(last)) / 86400000 >= 7) out.push({ id: `goal-${g.id}`, title: `Obiettivo fermo: ${g.t}`, detail: `È al ${g.p}% e non si muove da una settimana. Un passo piccolo oggi lo sblocca.`, why: 'Nessun avanzamento negli ultimi 7 giorni', page: 'lifetask', cta: 'Apri obiettivi', score: 45 });
  });

  // 5) messaggi
  const unread = totalUnread(app.account.name);
  if (unread > 0) out.push({ id: 'chat', title: `${unread} ${unread === 1 ? 'chat da leggere' : 'chat da leggere'}`, detail: 'Qualcuno ti ha scritto.', why: 'Messaggi non letti', page: 'messagesPage', cta: 'Apri messaggi', score: 50 });

  // 6) segnali dall'analisi dati (salute, mente, finanze)
  try {
    computeDashboard().insights.filter((i) => i.severity === 'bad' || i.severity === 'warn').slice(0, 3).forEach((i) => {
      out.push({ id: `ins-${i.id}`, title: i.title, detail: i.action ?? i.detail, why: 'Rilevato dall’analisi dei tuoi dati', page: pageForDomain[i.domain], cta: 'Vedi i dettagli', score: (i.severity === 'bad' ? 80 : 60) + i.priority * 0.1 });
    });
  } catch { /* nessun dato */ }

  // 7) sera: prepararsi al sonno
  if (h >= 21 || h < 2) out.push({ id: 'sleep', title: 'È tardi: dormire bene domani ti rende di più', detail: 'Stacca schermi e luci, il sonno è la metrica che muove tutte le altre.', why: `Sono le ${hhmm(now)}`, page: 'lifehealth', cta: 'Vedi il sonno', score: 30 });

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
  const ctx = buildContext(false);
  const note = '\n\n(Risposta locale: senza server non uso un vero modello AI.)';

  if (hasImage && !text) return { offline: true, text: 'Ho salvato lo screenshot, ma leggerlo richiede il modello AI sul server, che non è ancora collegato. Se selezioni e copi il testo, invece, posso lavorarci anche adesso.' };

  if (text) {
    const f = findFacts(text);
    if (/riassum|sintesi|in breve|tl;?dr/.test(q)) {
      const ss = sentences(text);
      const pick = ss.length <= 2 ? ss : [ss[0], ss.reduce((b, s) => (s.length > b.length ? s : b), ss[1])];
      return { offline: true, text: `In breve: ${pick.join(' ')}${note}` };
    }
    if (/task|da fare|azion|cosa devo|compit/.test(q)) {
      const t = extractTasks(text);
      return { offline: true, tasks: t, text: t.length ? `Ho trovato ${t.length} ${t.length === 1 ? 'cosa da fare' : 'cose da fare'}:\n• ${t.join('\n• ')}` : 'Non trovo azioni chiare in questo testo.' };
    }
    if (/quando|data|ora|appuntament|scadenz/.test(q)) {
      const parts = [f.dates.length ? `Date: ${f.dates.join(', ')}` : '', f.times.length ? `Orari: ${f.times.join(', ')}` : ''].filter(Boolean);
      return { offline: true, text: parts.length ? parts.join('\n') : 'Non vedo date o orari nel testo.' };
    }
    if (/quant|import|costo|prezzo|somma|totale|spes/.test(q)) {
      if (!f.amounts.length) return { offline: true, text: 'Non vedo importi nel testo.' };
      const tot = f.amounts.reduce((s, a) => s + a.n, 0);
      return { offline: true, text: `Importi: ${f.amounts.map((a) => a.raw).join(', ')}\nTotale (stessa valuta): ${tot.toFixed(2)}` };
    }
    if (/rispond|scrivi|reply|cosa dico/.test(q)) {
      const asks = /\?/.test(text);
      const reply = asks ? 'Ciao! Sì, mi va bene. Fammi sapere i dettagli e ti confermo.' : 'Ricevuto, grazie! Ti aggiorno a breve.';
      return { offline: true, reply, text: `Una risposta possibile:\n“${reply}”${note}` };
    }
    // analisi generica
    const bits = [`Testo di ${text.split(/\s+/).length} parole.`];
    if (/\?/.test(text)) bits.push('Contiene una domanda: probabilmente si aspetta una risposta.');
    if (f.dates.length || f.times.length) bits.push(`Cita ${[...f.dates, ...f.times].join(', ')}.`);
    if (f.amounts.length) bits.push(`Cita importi: ${f.amounts.map((a) => a.raw).join(', ')}.`);
    const t = extractTasks(text);
    if (t.length) bits.push(`Sembra richiedere ${t.length} ${t.length === 1 ? 'azione' : 'azioni'}.`);
    return { offline: true, tasks: t.length ? t : undefined, text: `${bits.join(' ')}\nChiedimi “riassumi”, “estrai i task”, “quando?”, “quanto?” o “rispondi per me”.${note}` };
  }

  // domande sui dati dell'utente
  const grab = (re: RegExp) => ctx.split('\n').filter((l) => re.test(l)).join('\n');
  if (/task|da fare|compiti/.test(q)) return { offline: true, text: grab(/^Task/) };
  if (/oggi|agenda|calendar|impegn/.test(q)) return { offline: true, text: grab(/^Eventi/) };
  if (/obiettiv/.test(q)) return { offline: true, text: grab(/^Obiettivi/) };
  if (/come sto|punteggi|salute|sonno|stress|spes|soldi|budget/.test(q)) return { offline: true, text: `${grab(/^Punteggi|^Metriche|^Segnali/) || 'Non ho ancora abbastanza dati.'}\n\nI dettagli sono nella Dashboard.` };
  const s = predictNeeds()[0];
  return { offline: true, text: s ? `Adesso ti suggerisco: ${s.title}. ${s.detail}` : 'Nessun suggerimento in particolare: sei in linea. Puoi chiedermi dei tuoi task, dell’agenda o di come stai.' };
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
  return { offline: false, text: data.reply ?? 'Risposta vuota dal server.', tasks: data.tasks };
}

void useChat;
