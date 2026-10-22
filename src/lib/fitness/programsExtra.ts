/** Schede su misura (modulo PURO): lettura delle schede scritte a mano e «bisogni» con cui si trovano. */
import { PROGRAMS, type Goal, type Level, type Place, type Program, type Session, type Step } from './data.ts';
import { P1 } from './progs/p1.ts';
import { P2 } from './progs/p2.ts';
import { P3 } from './progs/p3.ts';
import { P4 } from './progs/p4.ts';

/** I bisogni che una persona può indicare (e con cui le schede si filtrano e si consigliano). */
export const NEEDS: { id: string; label: string }[] = [
  { id: 'schiena', label: 'Mal di schiena' }, { id: 'collo-spalle', label: 'Collo e spalle' }, { id: 'sedentario', label: 'Lavoro sedentario' }, { id: 'in-piedi', label: 'Sempre in piedi' },
  { id: 'poco-tempo', label: 'Poco tempo' }, { id: 'stress', label: 'Stress' }, { id: 'over60', label: 'Over 60' }, { id: 'equilibrio', label: 'Equilibrio' },
  { id: 'postpartum', label: 'Dopo il parto' }, { id: 'gravidanza', label: 'Gravidanza' }, { id: 'infortunio', label: 'Dopo un infortunio' }, { id: 'peso', label: 'Perdere peso' },
  { id: 'glutei', label: 'Glutei e gambe' }, { id: 'addome', label: 'Addome' }, { id: 'forza', label: 'Forza' }, { id: 'trazione', label: 'Prima trazione' },
  { id: 'corsa', label: 'Corsa' }, { id: 'ciclismo', label: 'Ciclismo' }, { id: 'nuoto', label: 'Nuoto' }, { id: 'squadra', label: 'Sport di squadra' },
  { id: 'racchetta', label: 'Tennis e padel' }, { id: 'montagna', label: 'Montagna e sci' }, { id: 'arrampicata', label: 'Arrampicata' }, { id: 'combattimento', label: 'Boxe e arti marziali' },
  { id: 'viaggio', label: 'In viaggio' }, { id: 'cuore', label: 'Cuore e salute' }, { id: 'donna', label: 'Donna' }, { id: 'uomo', label: 'Uomo' },
];

const GOALS: Goal[] = ['dimagrire', 'tonificare', 'massa', 'forza', 'resistenza', 'mobilità', 'salute'];
const LEVELS: Level[] = ['principiante', 'intermedio', 'avanzato'];
const PLACES: Place[] = ['casa', 'palestra', 'piscina'];
export const PARSE_ERRORS: string[] = [];

function parse(src: string): Program[] {
  const out: Program[] = [];
  let cur: Program | null = null; let ses: Session | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const a = line.split('|');
    if (a[0] === 'P') {
      const [, id, name, tagline, goal, level, place, days, weeks, tags, spec, who, why, caution] = a;
      if (!GOALS.includes(goal as Goal) || !LEVELS.includes(level as Level) || !PLACES.includes(place as Place)) PARSE_ERRORS.push(`${id}: obiettivo/livello/luogo`);
      cur = { id, name, tagline, goal: goal as Goal, level: level as Level, place: place as Place, days: Number(days), weeks: Number(weeks), sessions: [],
        ...(spec && spec !== '~' ? { specialty: spec } : {}), ...(who && who !== '~' ? { who } : {}), ...(why && why !== '~' ? { why } : {}), ...(caution && caution !== '~' ? { caution } : {}), ...(tags ? { tags: tags.split(',').filter(Boolean) } : {}) };
      out.push(cur); ses = null;
    } else if (a[0] === 'S' && cur) { ses = { name: a[1], steps: [] }; cur.sessions.push(ses); }
    else if (a[0] === 'x' && ses) {
      const m = (a[2] ?? '').match(/^(\d+)x(\d+)([sm]?)$/);
      if (!m) { PARSE_ERRORS.push(`${cur?.id}: passo «${line}»`); continue; }
      const step: Step = { ex: a[1], sets: Number(m[1]), rest: Number(a[3] ?? 60) };
      if (m[3] === 's') step.secs = Number(m[2]); else if (m[3] === 'm') step.secs = Number(m[2]) * 60; else step.reps = Number(m[2]);
      ses.steps.push(step);
    }
  }
  return out;
}
export const EXTRA_PROGRAMS: Program[] = [...parse(P1), ...parse(P2), ...parse(P3), ...parse(P4)];
/** Tutte le schede: quelle di base e quelle su misura. */
export const ALL_PROGRAMS: Program[] = [...PROGRAMS, ...EXTRA_PROGRAMS];
export const programById = (id: string | undefined): Program | undefined => (id ? ALL_PROGRAMS.find((p) => p.id === id) : undefined);
/** Cerca per nome, slogan, destinatari e bisogni. */
export function searchPrograms(q: string, need: string | null, list: Program[] = ALL_PROGRAMS): Program[] {
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = norm(q).split(/\s+/).filter(Boolean);
  return list.filter((p) => (!need || p.tags?.includes(need)) && words.every((w) => norm(`${p.name} ${p.tagline} ${p.who ?? ''} ${p.specialty ?? ''} ${p.goal} ${p.place}`).includes(w)));
}
