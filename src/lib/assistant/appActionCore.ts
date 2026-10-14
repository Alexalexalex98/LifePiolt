/**
 * Azioni dell'app che Theia sa fare al posto dell'utente (modulo PURO, nessun alias '@/'): riconosce la richiesta, raccoglie ciò che manca
 * una domanda alla volta e, per i pagamenti, chiede conferma. L'esecuzione vera è in appActions.ts. Funziona senza rete: ciò che va online
 * (pubblicare, inviare) parte quando c'è connessione.
 */
export type Slots = Record<string, string>;
export type Ctx = { people: string[] };
export type SlotDef = { key: string; ask: string; optional?: boolean; /** estrae il valore dalla risposta (null = non valido, richiede di nuovo) */ parse?: (text: string, ctx: Ctx) => string | null };
export type ActionDef = {
  id: string; title: string; slots: SlotDef[];
  /** riconosce la richiesta: null = non è questa azione; altrimenti i valori già detti */
  match: (text: string, ctx: Ctx) => Slots | null;
  /** se presente, prima di eseguire chiede conferma con questo testo (pagamenti) */
  confirm?: (s: Slots) => string;
};

export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.,\s:]/g, ' ').replace(/\s+/g, ' ').trim();
export const isCancel = (s: string) => /^(annulla|lascia stare|lascia perdere|basta|stop|no lascia|cancel|abort|niente)\b/.test(norm(s));
export const isYes = (s: string) => /^(si|sì|ok|va bene|certo|confermo|conferma|procedi|yes|yep|esatto|dai)\b/.test(norm(s));
export const isNo = (s: string) => /^(no|non|annulla|ferma|negativo|nope)\b/.test(norm(s));

/** La persona (tra quelle conosciute) nominata nel testo: nome intero oppure nome di battesimo, il più lungo vince. */
export function findPerson(text: string, people: string[]): string | null {
  const t = ` ${norm(text).replace(/[:,]/g, ' ')} `;
  let best: { name: string; len: number } | null = null;
  for (const p of people) {
    const full = norm(p), first = full.split(' ')[0];
    const hit = t.includes(` ${full} `) ? full.length : first.length >= 3 && t.includes(` ${first} `) ? first.length : 0;
    if (hit && (!best || hit > best.len)) best = { name: p, len: hit };
  }
  return best?.name ?? null;
}
export function findAmount(text: string): number | null {
  const m = norm(text).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
const after = (text: string, re: RegExp): string => { const m = text.match(re); return m ? (m[m.length - 1] ?? '').trim() : ''; };
const clean = (s: string) => s.replace(/^[:,\-–\s«"“]+|[»"”\s]+$/g, '').trim();
const person: SlotDef['parse'] = (t, c) => findPerson(t, c.people);
const textSlot = (min = 1): SlotDef['parse'] => (t) => (clean(t).length >= min ? clean(t) : null);

/** Pagine che si possono aprire a voce: parola chiave -> pagina e nome da mostrare. */
export const PAGES: { words: string[]; page: string; label: string }[] = [
  { words: ['finanze', 'finanza', 'lifefinance', 'soldi', 'budget'], page: 'lifefinance', label: 'Finanze' },
  { words: ['salute', 'lifehealth'], page: 'lifehealth', label: 'Salute' },
  { words: ['lifefitness', 'fitness', 'allenamento', 'allenamenti', 'palestra', 'personal trainer', 'calorie'], page: 'lifefitness', label: 'LifeFitness' },
  { words: ['piano', 'agenda', 'calendario', 'plan'], page: 'plan', label: 'Piano' },
  { words: ['task', 'lifetask', 'cose da fare'], page: 'lifetask', label: 'Task' },
  { words: ['note', 'lifenotes', 'appunti'], page: 'lifenotes', label: 'Note' },
  { words: ['drive', 'lifedrive', 'documenti', 'file'], page: 'lifedrive', label: 'LifeDrive' },
  { words: ['viaggi', 'lifetravel', 'viaggio'], page: 'lifetravel', label: 'Viaggi' },
  { words: ['lifenetwork', 'network', 'rete', 'social'], page: 'lifenetwork', label: 'LifeNetwork' },
  { words: ['lifepoints', 'lifepoint', 'saldo', 'portafoglio'], page: 'lifepointsPage', label: 'LifePoints' },
  { words: ['pagamenti', 'paga con qr', 'qr'], page: 'payments', label: 'Pagamenti' },
  { words: ['i miei servizi', 'i tuoi servizi', 'servizi prenotati', 'servizi'], page: 'myServices', label: 'I tuoi servizi' },
  { words: ['i miei lifeclub', 'i tuoi lifeclub', 'miei club', 'lifeclub'], page: 'myClubs', label: 'I tuoi LifeClub' },
  { words: ['notifiche'], page: 'notifications', label: 'Notifiche' },
  { words: ['umore', 'mood'], page: 'mood', label: 'Umore' },
  { words: ['impostazioni', 'settings'], page: 'settings', label: 'Impostazioni' },
  { words: ['aiuto', 'guida', 'help'], page: 'help', label: 'Aiuto e domande' },
];
export function findPage(text: string): { page: string; label: string } | null {
  const t = ` ${norm(text)} `;
  let best: { page: string; label: string; len: number } | null = null;
  for (const p of PAGES) for (const w of p.words) { const nw = norm(w); if (t.includes(` ${nw} `) && (!best || nw.length > best.len)) best = { page: p.page, label: p.label, len: nw.length }; }
  return best ? { page: best.page, label: best.label } : null;
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'post', title: 'Pubblica un post', slots: [{ key: 'text', ask: 'Cosa vuoi scrivere nel post?', parse: textSlot(2) }],
    match: (raw) => {
      const t = norm(raw);
      if (!/^(pubblica|scrivi|crea|fai|voglio (?:fare|pubblicare|scrivere))\s+(?:ancora\s+)?(?:un|uno|il)?\s*(?:nuovo\s+)?post\b/.test(t)) return null;
      const body = clean(raw.replace(/^.*?\bpost\b(\s+(?:sul|nel|sulla)\s+(?:mio\s+)?(?:profilo|lifenetwork|rete))?/i, ''));
      return body.length >= 2 ? { text: body } : ({} as Slots);
    },
  },
  {
    id: 'community', title: 'Crea una community',
    slots: [
      { key: 'name', ask: 'Come si chiama la community?', parse: textSlot(2) },
      { key: 'desc', ask: 'Descrivila in almeno 30 caratteri: di cosa parla e per chi è.', parse: textSlot(30) },
    ],
    match: (raw) => {
      const t = norm(raw);
      if (!/^(crea|apri|fai|voglio creare|vorrei creare|nuova)\s+(?:una\s+)?(?:nuova\s+)?community\b/.test(t)) return null;
      const name = clean(after(raw, /community\s+(?:chiamata|che si chiama|di nome|dal nome|sul|su|per)?\s*(.*)$/i));
      return name.length >= 2 ? { name } : ({} as Slots);
    },
  },
  {
    id: 'lifeclub', title: 'Crea un LifeClub',
    slots: [
      { key: 'name', ask: 'Come si chiama il tuo LifeClub?', parse: textSlot(2) },
      { key: 'tagline', ask: 'Una frase che lo presenti (di cosa si occupa)?', optional: true, parse: textSlot(2) },
    ],
    match: (raw) => {
      const t = norm(raw);
      if (!/^(crea|apri|fai|voglio creare|vorrei creare|nuovo)\s+(?:un\s+)?(?:nuovo\s+)?(?:life\s?club|club)\b/.test(t)) return null;
      const name = clean(after(raw, /(?:life\s?club|club)\s+(?:chiamato|che si chiama|di nome|dal nome|sul|su|per|di)?\s*(.*)$/i));
      return name.length >= 2 ? { name } : ({} as Slots);
    },
  },
  {
    id: 'sendlp', title: 'Invia LifePoints',
    slots: [
      { key: 'to', ask: 'A chi li invio?', parse: person },
      { key: 'amount', ask: 'Quanti LifePoints?', parse: (t) => { const n = findAmount(t); return n && n >= 1 ? String(n) : null; } },
      { key: 'note', ask: 'Vuoi aggiungere una nota?', optional: true, parse: textSlot(1) },
    ],
    confirm: (s) => `Confermi? Invio ${s.amount} LP a ${s.to}. Li paghi tu per intero.`,
    match: (raw, ctx) => {
      const t = norm(raw);
      if (!/\b(invia|inviare|manda|mandare|dai|dare|dona|donare|paga|pagare|trasferisci|send|pay)\b/.test(t) || !/\b(lp|lifepoints?|life points?)\b/.test(t)) return null;
      const out: Slots = {};
      const to = findPerson(raw, ctx.people); if (to) out.to = to;
      const amt = findAmount(raw); if (amt && amt >= 1) out.amount = String(amt);
      return out;
    },
  },
  {
    id: 'follow', title: 'Segui una persona', slots: [{ key: 'to', ask: 'Chi vuoi seguire?', parse: person }],
    match: (raw, ctx) => {
      const t = norm(raw);
      if (!/^(segui|seguire|inizia a seguire|voglio seguire)\b/.test(t)) return null;
      const to = findPerson(raw, ctx.people);
      return to ? { to } : ({} as Slots);
    },
  },
  {
    id: 'message', title: 'Scrivi a una persona',
    slots: [{ key: 'to', ask: 'A chi scrivo?', parse: person }, { key: 'text', ask: 'Cosa le scrivo?', parse: textSlot(1) }],
    match: (raw, ctx) => {
      const t = norm(raw);
      if (!/^(scrivi|manda|invia|mandale|scrivigli)\s+(?:un\s+)?(?:messaggio\s+)?(?:a\s+)?/.test(t) || /\b(post|nota|task|lp|lifepoints?)\b/.test(t.split(':')[0] ?? t)) return null;
      const to = findPerson(raw, ctx.people);
      if (!to && !/messaggio/.test(t)) return null;
      const out: Slots = {};
      if (to) {
        out.to = to;
        const body = clean(raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw.replace(new RegExp(`^.*?\\b${to.split(' ')[0]}\\b[^\\s]*`, 'i'), '').replace(/^\s*(che|di dirle|di dirgli)\s+/i, ''));
        if (body.length >= 1) out.text = body;
      }
      return out;
    },
  },
  {
    id: 'open', title: 'Apri una pagina', slots: [{ key: 'page', ask: 'Quale pagina vuoi aprire?', parse: (t) => findPage(t)?.page ?? null }],
    match: (raw) => {
      if (!/^(apri|aprimi|vai a|vai su|vai in|portami a|portami in|mostrami|open|go to)\b/.test(norm(raw))) return null;
      const p = findPage(raw);
      return p ? { page: p.page } : null;
    },
  },
];

export type Started = { action: ActionDef; slots: Slots };
/** Riconosce una richiesta tra le azioni (la prima che combacia). */
export function startAction(text: string, ctx: Ctx): Started | null {
  for (const a of ACTIONS) { const s = a.match(text, ctx); if (s) return { action: a, slots: s }; }
  return null;
}
/** Il prossimo dato obbligatorio che manca. */
export const missing = (a: ActionDef, s: Slots): SlotDef | null => a.slots.find((d) => !d.optional && !s[d.key]) ?? null;
/** Dato facoltativo ancora da chiedere (una volta sola). */
export const optionalLeft = (a: ActionDef, s: Slots, asked: string[]): SlotDef | null => a.slots.find((d) => d.optional && !s[d.key] && !asked.includes(d.key)) ?? null;
