/**
 * Trovare dove prenotare (modulo PURO): medico, dentista, pizzeria... Prima si guardano i professionisti già su LifePilot, ordinati per voto;
 * solo se nessuno è abbastanza buono si propone la ricerca fuori dall'app. Da qui non si leggono recensioni esterne: si apre la ricerca sulle mappe.
 */
import { NOT_A_SEARCH, wantsPlace } from './assistant/dictionary.ts';

export type PlaceCategory = { id: string; label: string; /** parole che identificano la categoria nel testo */ words: string[]; /** parole dei ruoli dei professionisti in app */ roles: string[]; /** ricerca fuori app */ query: string; /** ricerca quando si vuole ORDINARE (consegna a domicilio) */ orderQuery?: string };

const C = (id: string, label: string, words: string[], roles: string[], query: string, order?: string): PlaceCategory => ({ id, label, words, roles, query, ...(order ? { orderQuery: order } : {}) });

export const PLACE_CATEGORIES: PlaceCategory[] = [
  // salute
  C('dentista', 'dentista', ['dentista', 'dentisti', 'odontoiatra', 'igienista dentale', 'mal di denti', 'carie'], ['dentist', 'odontoiat', 'igienista'], 'dentista'),
  C('medico', 'medico', ['medico', 'dottore', 'dottoressa', 'dottori', 'medici', 'pediatra', 'dermatologo', 'ortopedico', 'cardiologo', 'ginecologo', 'oculista', 'visita medica', 'medico di famiglia'], ['medic', 'dott', 'pediatr', 'dermatolog', 'ortoped', 'cardiolog', 'ginecolog', 'oculist'], 'medico'),
  C('fisio', 'fisioterapista', ['fisioterapista', 'fisioterapia', 'osteopata', 'massaggiatore', 'chiropratico'], ['fisioter', 'osteopat', 'massagg'], 'fisioterapista'),
  C('psico', 'psicologo', ['psicologo', 'psicologa', 'psicoterapeuta', 'terapeuta', 'psichiatra'], ['psicolog', 'psicoterap', 'terapeut'], 'psicologo'),
  C('farmacia', 'farmacia', ['farmacia', 'farmacie', 'farmacista', 'medicine', 'medicinali'], ['farmac'], 'farmacia di turno'),
  C('ospedale', 'pronto soccorso', ['ospedale', 'pronto soccorso', 'ambulatorio', 'clinica'], ['ospedal', 'clinic'], 'pronto soccorso'),
  C('veterinario', 'veterinario', ['veterinario', 'veterinaria', 'dal veterinario'], ['veterinar'], 'veterinario'),
  C('ottico', 'ottico', ['ottico', 'occhiali', 'lenti a contatto'], ['ottic'], 'ottico'),
  // bellezza
  C('parrucchiere', 'parrucchiere', ['parrucchiere', 'parrucchiera', 'barbiere', 'taglio di capelli', 'tagliare i capelli', 'taglio capelli', 'colore capelli'], ['parrucch', 'barbier'], 'parrucchiere'),
  C('estetista', 'estetista', ['estetista', 'manicure', 'pedicure', 'unghie', 'ceretta', 'massaggio', 'spa', 'centro benessere'], ['estetist', 'massagg'], 'centro estetico'),
  C('tatuatore', 'tatuatore', ['tatuaggio', 'tatuatore', 'piercing'], ['tatu'], 'studio di tatuaggi'),
  // cibo
  C('pizzeria', 'pizzeria', ['pizzeria', 'pizza', 'pizze', 'margherita'], ['pizz'], 'pizzeria', 'pizza consegna a domicilio'),
  C('sushi', 'ristorante di sushi', ['sushi', 'giapponese', 'ramen', 'poke'], ['sushi', 'giapponese'], 'sushi', 'sushi consegna a domicilio'),
  C('kebab', 'kebab', ['kebab', 'falafel', 'shawarma', 'turco'], ['kebab'], 'kebab', 'kebab consegna a domicilio'),
  C('hamburger', 'hamburgeria', ['hamburger', 'burger', 'panino', 'panini', 'paninoteca', 'fast food'], ['burger', 'hamburg', 'panin'], 'hamburger', 'hamburger consegna a domicilio'),
  C('ristorante', 'ristorante', ['ristorante', 'ristoranti', 'trattoria', 'osteria', 'cena fuori', 'pranzo fuori', 'tavolo per', 'mangiare fuori', 'ho fame', 'mangiare', 'cenare', 'pranzare', 'cena', 'pranzo'], ['ristorant', 'trattor', 'osteri', 'chef'], 'ristorante', 'cibo a domicilio'),
  C('bar', 'bar', ['bar', 'caffe', 'caffetteria', 'colazione', 'cappuccino', 'aperitivo', 'cocktail', 'birra', 'pub', 'enoteca'], ['bar', 'barista', 'caffett'], 'bar'),
  C('gelateria', 'gelateria', ['gelato', 'gelateria', 'gelati', 'dolce', 'pasticceria', 'dolci', 'torta'], ['gelat', 'pasticc'], 'gelateria'),
  C('panetteria', 'panetteria', ['pane', 'panetteria', 'panificio', 'forno', 'focaccia'], ['panet', 'panific'], 'panetteria'),
  C('supermercato', 'supermercato', ['supermercato', 'spesa', 'fare la spesa', 'alimentari', 'macelleria', 'frutta e verdura'], ['supermerc', 'alimentar'], 'supermercato'),
  // casa e servizi
  C('idraulico', 'idraulico', ['idraulico', 'perdita d acqua', 'rubinetto', 'scarico intasato', 'caldaia'], ['idraulic'], 'idraulico urgente'),
  C('elettricista', 'elettricista', ['elettricista', 'corto circuito', 'presa elettrica', 'salvavita'], ['elettricist'], 'elettricista'),
  C('meccanico', 'meccanico', ['meccanico', 'officina', 'gommista', 'revisione auto', 'cambio gomme', 'tagliando', 'carrozziere'], ['meccanic', 'officin', 'gommist'], 'officina meccanica'),
  C('lavanderia', 'lavanderia', ['lavanderia', 'tintoria', 'lavasecco', 'stirare'], ['lavander', 'tintori'], 'lavanderia'),
  C('traslochi', 'traslochi', ['trasloco', 'traslochi', 'facchino'], ['trasloc'], 'traslochi'),
  C('pulizie', 'pulizie', ['pulizie', 'donna delle pulizie', 'impresa di pulizie'], ['puliz'], 'servizio di pulizie'),
  // spostamenti e viaggi
  C('taxi', 'taxi', ['taxi', 'uber', 'passaggio', 'autista'], ['taxi', 'autista'], 'taxi'),
  C('hotel', 'hotel', ['hotel', 'albergo', 'alberghi', 'b&b', 'bed and breakfast', 'pernottamento', 'camera d albergo', 'dormire a', 'alloggio', 'ostello', 'airbnb'], ['hotel', 'alberg'], 'hotel'),
  C('benzinaio', 'distributore di benzina', ['benzina', 'benzinaio', 'distributore', 'fare il pieno', 'colonnina', 'ricarica auto', 'diesel'], ['benzin'], 'distributore di benzina'),
  C('parcheggio', 'parcheggio', ['parcheggio', 'parcheggiare', 'posteggio'], ['parcheggi'], 'parcheggio'),
  C('noleggio', 'noleggio auto', ['noleggio', 'noleggiare', 'affittare un auto', 'noleggio auto'], ['noleggi'], 'noleggio auto'),
  // tempo libero
  C('cinema', 'cinema', ['cinema', 'film', 'spettacolo', 'teatro', 'concerto'], ['cinema', 'teatr'], 'cinema'),
  C('palestra', 'palestra', ['palestra', 'personal trainer', 'allenarmi', 'piscina', 'yoga', 'pilates', 'crossfit', 'corso di danza'], ['palestr', 'personal', 'trainer', 'yoga', 'pilates'], 'palestra'),
  C('museo', 'museo', ['museo', 'mostra', 'galleria d arte', 'visita guidata'], ['muse'], 'museo'),
  // acquisti
  C('negozio', 'negozio', ['negozio', 'negozi', 'abbigliamento', 'scarpe', 'fiori', 'fioraio', 'regalo', 'libreria', 'elettronica', 'ferramenta'], ['negozi', 'fiora'], 'negozio'),
  C('banca', 'banca', ['banca', 'bancomat', 'prelevare', 'sportello'], ['banc'], 'bancomat'),
  C('posta', 'ufficio postale', ['posta', 'ufficio postale', 'spedire un pacco', 'pacco', 'raccomandata'], ['post'], 'ufficio postale'),
];

/** Una cosa è "abbastanza buona" da non cercare altrove a partire da questo voto. */
export const GOOD_ENOUGH = 4.3;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const hasWord = (text: string, w: string) => (` ${text} `).includes(` ${norm(w)} `) || (w.length > 5 && text.includes(norm(w)));

export type PlaceRequest = { cat: PlaceCategory; /** vuole ORDINARE (consegna a domicilio) invece di andarci */ order: boolean; book: boolean };

/**
 * Riconosce richieste come «prenota un dentista», «voglio ordinare una pizza», «ho fame», «cerco un idraulico».
 * Serve un verbo di desiderio/ricerca/prenotazione/ordine (dizionario) E una categoria di posto. Non scatta per task, note,
 * promemoria, chiamate o discorsi sui soldi («ricordami di chiamare il dentista», «voglio vedere le spese»).
 */
export function detectPlace(raw: string): PlaceRequest | null {
  const text = norm(raw);
  if (NOT_A_SEARCH.test(text) || /\b(chiam\w*|telefon\w*|scriv\w*|spes[ae]|budget|stipendio|saldo|conto)\b/.test(text.replace('fare la spesa', ''))) return null;
  const w = wantsPlace(raw);
  const cat = PLACE_CATEGORIES.find((c) => c.words.some((x) => hasWord(text, x)));
  if (!cat || !w.find) return null;
  // «ho fame», «mangiare»: senza altro vale come ristorante; con un verbo d'ordine si cerca la consegna
  return { cat, order: w.order && !!cat.orderQuery, book: w.book };
}
/** Compatibilità: solo la categoria. */
export const detectPlaceSearch = (raw: string): PlaceCategory | null => detectPlace(raw)?.cat ?? null;

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
export function planPlaceSearch(cat: PlaceCategory, providers: ProviderLite[], min = GOOD_ENOUGH, order = false): PlacePlan {
  const ranked = rankInApp(cat, providers);
  const good = ranked.filter((p) => p.score >= min);
  if (good.length) return { kind: 'in-app', cat, best: good.slice(0, 3), others: ranked.filter((p) => p.score < min).slice(0, 2) };
  return { kind: 'external', cat, weak: ranked.slice(0, 2), url: externalSearchUrl(cat, order) };
}

/** Ricerca sulle mappe (vicino alla posizione del telefono), ordinata dall'app di mappe stessa per vicinanza e recensioni. */
export function externalSearchUrl(cat: PlaceCategory, order = false): string {
  const q = order && cat.orderQuery ? cat.orderQuery : cat.query;
  return `https://www.google.com/maps/search/${encodeURIComponent(q + ' vicino a me')}`;
}
