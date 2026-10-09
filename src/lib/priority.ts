/**
 * Quale task conviene fare adesso? Ordinamento PURO e spiegabile (nessuna AI).
 * Conta: segnato urgente, scadenza, e il legame con i prossimi impegni (es. "business plan" prima di "chiamata investitori").
 * Se nulla è urgente o collegato, i task restano nell'ordine scelto dall'utente.
 */
import { t } from '../i18n/core.ts';

export type PTask = { id: string; t: string; done?: boolean; urgent?: boolean; due?: string };
export type PEvent = { day: string; time: string; title: string; important?: boolean };
export type Ranked = { task: PTask; score: number; reasons: string[]; link?: PEvent };

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s: string) => strip(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
const STOP = new Set(['dopo', 'prima', 'fare', 'della', 'delle', 'degli', 'dello', 'nella', 'questo', 'questa', 'sono', 'come', 'sulla', 'alle', 'allo', 'chiamata', 'riunione', 'incontro', 'appuntamento', 'review', 'giornata', 'settimana', 'mese', 'oggi', 'domani']);

/** Gruppi di parole che parlano della stessa cosa: un task e un impegno nello stesso gruppo sono collegati. */
const GROUPS: string[][] = [
  ['business', 'plan', 'pitch', 'investitori', 'investitore', 'presentazione', 'slide', 'fundraising', 'deck'],
  ['tasse', 'fiscale', 'dichiarazione', 'commercialista', 'imposte', 'fattura', 'fatture'],
  ['esame', 'studio', 'ripasso', 'lezione', 'universita', 'tedesco'],
  ['viaggio', 'valigia', 'volo', 'hotel', 'vacanza', 'passaporto'],
  ['colloquio', 'cv', 'curriculum', 'candidatura', 'lavoro'],
  ['medico', 'visita', 'analisi', 'dentista', 'salute'],
  ['cliente', 'clienti', 'offerta', 'preventivo', 'contratto', 'fornitore', 'fornitori'],
];

export function linked(taskTitle: string, eventTitle: string): boolean {
  const a = words(taskTitle), b = words(eventTitle);
  if (a.some((x) => b.some((y) => x === y || (x.length >= 6 && y.length >= 6 && x.slice(0, 5) === y.slice(0, 5))))) return true;
  return GROUPS.some((g) => a.some((x) => g.includes(x)) && b.some((y) => g.includes(y)));
}

const dayDiff = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
export const todayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const when = (day: string, time: string, today: string) => { const d = dayDiff(today, day); return d === 0 ? t('oggi alle {0}', time) : d === 1 ? t('domani alle {0}', time) : d === 2 ? t('dopodomani alle {0}', time) : t('tra {0} giorni alle {1}', d, time); };
/** Unisce i motivi: "a e b e c" nella lingua attiva. */
export const joinReasons = (r: string[]) => r.reduce((a, b) => t('{0} e {1}', a, b));

export function rankTasks(tasks: PTask[], events: PEvent[], now: Date): Ranked[] {
  const today = todayKey(now);
  const upcoming = events.filter((e) => e.day >= today && dayDiff(today, e.day) <= 14).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  return tasks
    .map((task, i) => ({ task, i }))
    .filter(({ task }) => !task.done)
    .map(({ task, i }) => {
      let score = 0; const reasons: string[] = []; let link: PEvent | undefined;
      if (task.urgent) { score += 100; reasons.push(t('l’hai segnato come urgente')); }
      if (task.due) {
        const d = dayDiff(today, task.due);
        if (d < 0) { score += 90; reasons.push(t('è in ritardo')); }
        else if (d === 0) { score += 80; reasons.push(t('scade oggi')); }
        else if (d === 1) { score += 60; reasons.push(t('scade domani')); }
        else if (d <= 3) { score += 40; reasons.push(t('scade tra {0} giorni', d)); }
        else if (d <= 7) { score += 20; reasons.push(t('scade tra {0} giorni', d)); }
      }
      const ev = upcoming.find((e) => linked(task.t, e.title));
      if (ev) {
        const d = dayDiff(today, ev.day);
        score += Math.max(10, 55 - d * 5) + (ev.important ? 15 : 0);
        link = ev; reasons.push(t('serve prima di «{0}» ({1})', ev.title, when(ev.day, ev.time, today)));
      }
      return { task, score, reasons, link, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ i: _i, ...r }) => r);
}

/** Frase pronta da mostrare: cosa fare adesso e perché. */
export function nextActionText(ranked: Ranked[]): string {
  if (!ranked.length) return t('Non hai task aperti: ottimo. Vuoi aggiungerne uno?');
  const top = ranked[0];
  const why = top.reasons.length ? t('Perché {0}.', joinReasons(top.reasons)) : t('Nessuno è urgente: ti propongo il primo della tua lista, nell’ordine che hai scelto.');
  const next = ranked[1] ? ' ' + t('Dopo: «{0}».', ranked[1].task.t) : '';
  return `${t('Adesso: «{0}».', top.task.t)} ${why}${next}`;
}
