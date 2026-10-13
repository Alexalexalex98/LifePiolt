/**
 * Trovare dove prenotare (modulo PURO): medico, dentista, pizzeria... Prima si guardano i professionisti già su LifePilot, ordinati per voto;
 * solo se nessuno è abbastanza buono si propone la ricerca fuori dall'app. Da qui non si leggono recensioni esterne: si apre la ricerca sulle mappe.
 */
export type PlaceCategory = { id: string; label: string; /** parole che identificano la categoria nel testo */ words: string[]; /** parole dei ruoli dei professionisti in app */ roles: string[]; /** ricerca fuori app */ query: string };

export const PLACE_CATEGORIES: PlaceCategory[] = [
  { id: 'dentista', label: 'dentista', words: ['dentista', 'dentisti', 'odontoiatra', 'igienista dentale'], roles: ['dentist', 'odontoiat', 'igienista'], query: 'dentista' },
  { id: 'medico', label: 'medico', words: ['medico', 'dottore', 'dottoressa', 'dottori', 'medici', 'pediatra', 'dermatologo', 'ortopedico', 'cardiologo', 'ginecologo', 'oculista', 'visita medica'], roles: ['medic', 'dott', 'pediatr', 'dermatolog', 'ortoped', 'cardiolog', 'ginecolog', 'oculist'], query: 'medico' },
  { id: 'fisio', label: 'fisioterapista', words: ['fisioterapista', 'fisioterapia', 'osteopata', 'massaggiatore'], roles: ['fisioter', 'osteopat', 'massagg'], query: 'fisioterapista' },
  { id: 'psico', label: 'psicologo', words: ['psicologo', 'psicologa', 'psicoterapeuta', 'terapeuta'], roles: ['psicolog', 'psicoterap', 'terapeut'], query: 'psicologo' },
  { id: 'veterinario', label: 'veterinario', words: ['veterinario', 'veterinaria'], roles: ['veterinar'], query: 'veterinario' },
  { id: 'parrucchiere', label: 'parrucchiere', words: ['parrucchiere', 'parrucchiera', 'barbiere', 'taglio di capelli', 'estetista'], roles: ['parrucch', 'barbier', 'estetist'], query: 'parrucchiere' },
  { id: 'pizzeria', label: 'pizzeria', words: ['pizzeria', 'pizza'], roles: ['pizz'], query: 'pizzeria' },
  { id: 'ristorante', label: 'ristorante', words: ['ristorante', 'trattoria', 'osteria', 'cena fuori', 'pranzo fuori', 'tavolo per'], roles: ['ristorant', 'trattor', 'osteri', 'chef'], query: 'ristorante' },
];

/** Una cosa è "abbastanza buona" da non cercare altrove a partire da questo voto. */
export const GOOD_ENOUGH = 4.3;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const hasWord = (text: string, w: string) => (` ${text} `).includes(` ${norm(w)} `) || (w.length > 5 && text.includes(norm(w)));

/** Riconosce «prenota/trova/cerca un dentista…». Non scatta per task o note («ricordami di chiamare il dentista»). */
export function detectPlaceSearch(raw: string): PlaceCategory | null {
  const text = norm(raw);
  if (/\b(task|nota|ricordami|ricordare|promemoria|aggiungi|segna fatto)\b/.test(text)) return null;
  const wantsFind = /\b(prenot\w*|trov\w*|cerc\w*|consigli\w*|miglior\w*|devo andare|voglio andare|vorrei andare|ho bisogno|mi serve|c e un|dove)\b/.test(text);
  if (!wantsFind) return null;
  return PLACE_CATEGORIES.find((c) => c.words.some((w) => hasWord(text, w))) ?? null;
}

export type ProviderLite = { name: string; role: string; rating: number; price?: number; tag?: string };
export type PlaceHit = ProviderLite & { score: number };

/** I professionisti in app per quella categoria, dal migliore. Senza voto un professionista non passa mai per "abbastanza buono". */
export function rankInApp(cat: PlaceCategory, providers: ProviderLite[]): PlaceHit[] {
  return providers
    .filter((p) => { const hay = norm(`${p.role} ${p.tag ?? ''}`); return cat.roles.some((r) => hay.includes(r)); })
    .map((p) => ({ ...p, score: p.rating > 0 ? p.rating : 0 }))
    .sort((a, b) => b.score - a.score || (a.price ?? 0) - (b.price ?? 0) || a.name.localeCompare(b.name));
}

export type PlacePlan =
  | { kind: 'in-app'; cat: PlaceCategory; best: PlaceHit[]; others: PlaceHit[] }
  | { kind: 'external'; cat: PlaceCategory; /** quelli in app non abbastanza buoni (se ce ne sono) */ weak: PlaceHit[]; url: string };

/** Il piano: se in app c'è almeno un professionista sopra la soglia, si propone quello; altrimenti si cerca fuori. */
export function planPlaceSearch(cat: PlaceCategory, providers: ProviderLite[], min = GOOD_ENOUGH): PlacePlan {
  const ranked = rankInApp(cat, providers);
  const good = ranked.filter((p) => p.score >= min);
  if (good.length) return { kind: 'in-app', cat, best: good.slice(0, 3), others: ranked.filter((p) => p.score < min).slice(0, 2) };
  return { kind: 'external', cat, weak: ranked.slice(0, 2), url: externalSearchUrl(cat) };
}

/** Ricerca sulle mappe (vicino alla posizione del telefono), ordinata dall'app di mappe stessa per vicinanza e recensioni. */
export function externalSearchUrl(cat: PlaceCategory): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(cat.query + ' vicino a me')}`;
}
