/**
 * Modificare ed eliminare ciò che si è pubblicato (modulo PURO, nessun alias '@/'): seminari (anche ripetuti) e servizi.
 * Solo chi li ha pubblicati può cambiarli, dopo e prima della pubblicazione. Cosa non si può fare, e perché, lo dicono i messaggi.
 */
export type Every = 'week' | '2weeks' | 'month';
export const EVERY_LABEL: Record<Every, string> = { week: 'Ogni settimana', '2weeks': 'Ogni due settimane', month: 'Ogni mese' };
export const MAX_OCCURRENCES = 26;

export type SemLike = {
  id: number; title: string; host: string; price: number; promoted: boolean; startsAt?: number; durationMin?: number; mode?: 'online' | 'presenza'; place?: string;
  seats?: number; joined?: number; desc?: string; learn?: string[]; audience?: string; included?: string; language?: string; cancelPolicy?: string;
  /** seminari ripetuti: stessa serie */ series?: string;
};

/** Le date di una serie che si ripete: la prima è `start`. */
export function seriesDates(start: number, every: Every, times: number): number[] {
  const n = Math.max(1, Math.min(MAX_OCCURRENCES, Math.round(times) || 1));
  const out: number[] = [];
  const d0 = new Date(start);
  for (let i = 0; i < n; i++) {
    const d = new Date(d0);
    if (every === 'month') d.setMonth(d0.getMonth() + i); else d.setDate(d0.getDate() + i * (every === 'week' ? 7 : 14));
    out.push(d.getTime());
  }
  return out;
}

export type SemForm = { title: string; desc: string; learn: string; audience: string; startsAt: number; durationMin: number; mode: 'online' | 'presenza'; place: string; language: string; price: string; seats: string };

/** Controlli dei campi; null = tutto a posto. `keepPast`: modificando un seminario già iniziato la data non si controlla. */
export function validateSeminar(f: SemForm, o: { now: number; keepPast?: boolean; joined?: number }): string | null {
  const ti = f.title.trim(), de = f.desc.trim();
  if (ti.length < 8) return 'Inserisci un titolo di almeno 8 caratteri';
  if (de.length < 80) return `La descrizione è troppo breve (${de.length}/80 caratteri): spiega cosa si impara e come si svolge`;
  if (!o.keepPast && f.startsAt <= o.now) return 'La data e l\'ora devono essere nel futuro';
  if (f.place.trim().length < 3) return f.mode === 'online' ? 'Indica il link o come collegarsi' : 'Indica il luogo e l\'indirizzo';
  if (f.price.trim() === '') return 'Inserisci il prezzo in LP (0 per un seminario gratuito)';
  const pr = parseFloat(f.price.replace(',', '.'));
  if (!Number.isFinite(pr) || pr < 0) return 'Inserisci un prezzo valido';
  const se = parseInt(f.seats, 10);
  if (!Number.isFinite(se) || se < 1 || se > 1000) return 'Inserisci il numero di posti (da 1 a 1000)';
  if ((o.joined ?? 0) > se) return `Ci sono già ${o.joined} iscritti: i posti non possono essere meno di così`;
  return null;
}

export type Scope = 'one' | 'following' | 'all';
/** Gli id interessati da una modifica: solo questo, da questo in poi o tutta la serie (le occorrenze già passate non si toccano). */
export function scopeIds(list: SemLike[], id: number, scope: Scope, now: number): number[] {
  const cur = list.find((s) => s.id === id);
  if (!cur) return [];
  if (scope === 'one' || !cur.series) return [id];
  const same = list.filter((s) => s.series === cur.series).sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
  const from = same.findIndex((s) => s.id === id);
  const picked = scope === 'following' ? same.slice(from) : same;
  return picked.filter((s) => s.id === id || (s.startsAt ?? 0) > now).map((s) => s.id);
}

export type SemPatch = Partial<Pick<SemLike, 'title' | 'price' | 'durationMin' | 'mode' | 'place' | 'seats' | 'desc' | 'learn' | 'audience' | 'language' | 'cancelPolicy'>> & { startsAt?: number };

/**
 * Applica la modifica alle occorrenze scelte. Titolo, descrizione, prezzo ecc. valgono per tutte; se cambia l'orario di questo
 * seminario le altre si spostano della stessa distanza (restano alla stessa ora e allo stesso giorno della settimana).
 * Chi era già iscritto resta iscritto e ha già pagato il prezzo vecchio.
 */
export function applySeminarEdit(list: SemLike[], id: number, patch: SemPatch, scope: Scope, now: number): { list: SemLike[]; changed: number[]; moved: number[] } {
  const ids = scopeIds(list, id, scope, now);
  const cur = list.find((s) => s.id === id);
  const delta = cur && patch.startsAt != null && cur.startsAt != null ? patch.startsAt - cur.startsAt : 0;
  const changed: number[] = [], moved: number[] = [];
  const next = list.map((s) => {
    if (!ids.includes(s.id) || s.host !== cur?.host) return s;
    const { startsAt, ...rest } = patch;
    const out: SemLike = { ...s, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) };
    if (startsAt != null && delta !== 0) { out.startsAt = s.id === id ? startsAt : (s.startsAt ?? 0) + delta; moved.push(s.id); }
    changed.push(s.id);
    return out;
  });
  return { list: next, changed, moved };
}

/** Quante persone coinvolge eliminare queste occorrenze (iscritti dai contatori o dall'elenco), e quanti LP vanno rimborsati. */
export function deletionImpact(list: SemLike[], ids: number[], participants: Record<string, { name: string; paid: number }[]>): { people: number; refund: number } {
  let people = 0, refund = 0;
  for (const id of ids) {
    const s = list.find((x) => x.id === id);
    const rows = participants[`seminar:${id}`] ?? [];
    people += Math.max(rows.length, s?.joined ?? 0);
    refund += rows.reduce((a, r) => a + (r.paid || 0), 0);
  }
  return { people, refund: Math.round(refund * 100) / 100 };
}

/* ---------- servizi ---------- */
export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const;
export type ServiceForm = { role: string; tag: string; price: string; durationMin: number; mode: 'online' | 'presenza'; place: string; language: string; desc: string; slots: string[] };

export function validateService(f: ServiceForm): string | null {
  if (f.role.trim().length < 4) return 'Scrivi cosa offri (almeno 4 caratteri), per esempio «Lezione di francese»';
  if (f.desc.trim().length < 40) return `La descrizione è troppo breve (${f.desc.trim().length}/40 caratteri): spiega come si svolge una sessione`;
  if (f.place.trim().length < 3) return f.mode === 'online' ? 'Indica come ci si collega' : 'Indica il luogo';
  const pr = parseFloat(f.price.replace(',', '.'));
  if (!Number.isFinite(pr) || pr < 0) return 'Inserisci un prezzo valido (0 se è gratuito)';
  if (f.slots.length === 0) return 'Scegli almeno un giorno e un orario in cui sei disponibile';
  return null;
}
/** «Lun 16:00» con orari ordinati nella settimana. */
export const slotLabel = (day: string, time: string) => `${day} ${time}`;
export function sortSlots(slots: string[]): string[] {
  const idx = (s: string) => WEEKDAYS.findIndex((d) => s.startsWith(d));
  return [...new Set(slots)].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b));
}
/** Aggiunge o toglie un orario. */
export function toggleSlot(slots: string[], slot: string): string[] { return slots.includes(slot) ? slots.filter((s) => s !== slot) : sortSlots([...slots, slot]); }
