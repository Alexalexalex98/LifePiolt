/**
 * Cosa vuol dire un task (modulo PURO): «prenotare il dentista» è un servizio da prenotare, «fare la spesa» una lista,
 * «chiamare Marco» una chiamata. Da qui l'app propone le azioni giuste (contatti, professionisti vicino a te, lista, cosa dire al telefono).
 */
import { PLACE_CATEGORIES, type PlaceCategory } from './findPlace.ts';

export type TaskIntent =
  | { kind: 'service'; cat: PlaceCategory; book: boolean }
  | { kind: 'shopping' }
  | { kind: 'call'; person: string }
  | { kind: 'none' };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Servizi dove ha senso prenotare per telefono (non ristoranti da ordinare o negozi). */
const BOOKABLE = new Set(['dentista', 'medico', 'fisio', 'psico', 'farmacia']);
const has = (text: string, w: string) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(text);

export function taskIntent(raw: string): TaskIntent {
  const t = fold(raw);
  if (/\b(fare|faccio|fai|rifare)\s+(la\s+)?spesa\b|\b(comprare|compro|acquistare)\b|\blista della spesa\b|\bsupermercato\b/.test(t)) return { kind: 'shopping' };
  const call = t.match(/\b(chiam\w+|telefon\w+)\s+(?:a\s+|il\s+|la\s+|lo\s+|l'\s*)?([a-z][a-z' ]{1,30})/);
  const cat = PLACE_CATEGORIES.find((c) => c.words.some((w) => has(t, fold(w))));
  if (cat && (BOOKABLE.has(cat.id) || /\b(prenot\w+|fissare|appuntamento|visita|cercare|trovare|chiam\w+)\b/.test(t))) return { kind: 'service', cat, book: /\b(prenot\w+|fissare|appuntamento|visita)\b/.test(t) || BOOKABLE.has(cat.id) };
  if (call) return { kind: 'call', person: call[2].trim().replace(/\s+(domani|oggi|stasera|stamattina|alle?|per|entro).*$/, '') };
  return { kind: 'none' };
}

/** Numero pronto per `tel:` (toglie spazi e simboli, tiene il + iniziale). */
export const dialNumber = (phone: string) => { const p = phone.trim(); return (p.startsWith('+') ? '+' : '') + p.replace(/[^0-9]/g, ''); };
export const validPhone = (phone: string) => dialNumber(phone).replace('+', '').length >= 6;

export type CallBrief = { who: string; service: string; when?: string; name?: string };
/** Cosa dire al telefono: breve, in italiano, con i dati già pronti. */
export function callScript(b: CallBrief): string {
  const me = b.name ? `Sono ${b.name}. ` : '';
  const when = b.when?.trim() ? ` ${b.when.trim().replace(/^per\s+/i, 'per ')}` : '';
  return [
    `Buongiorno${b.who ? `, parlo con ${b.who}?` : '.'} ${me}Vorrei prenotare ${b.service}${when}.`,
    'Avete disponibilità? Se non in quel momento, quali sono i prossimi giorni liberi?',
    'Mi può confermare orario, indirizzo e se serve portare qualcosa (documenti, tessera sanitaria)?',
  ].join('\n');
}
