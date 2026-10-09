/** Consigli d'arrivo: quando partire e come usare l'attesa se si arriva molto prima. Parte pura, testabile. */
import { t } from '../i18n/core.ts';

export type Interest = 'caffe' | 'architettura' | 'storia' | 'musei' | 'citta' | 'natura' | 'cucina' | 'shopping' | 'libri' | 'sport' | 'musica' | 'relax';

const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
export const fmtClock = (min: number) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** Attesa minima (minuti) oltre la quale vale la pena proporre qualcosa. */
export const MIN_WAIT = 25;
/** Margine di sicurezza sul tragitto. */
export const BUFFER = 10;

export type Arrival = {
  travel: number;
  leaveBy: string;
  /** minuti di anticipo se si parte subito dall'ora indicata */
  wait: number;
  arriveAt: string;
  suggest: boolean;
  late: boolean;
};

/** `nowMin`: minuti dall'inizio della giornata in cui l'utente parte (di solito adesso o la fine dell'impegno precedente). */
export function arrivalPlan(eventTime: string, travel: number, nowMin: number): Arrival {
  const start = toMin(eventTime);
  const leave = start - travel - BUFFER;
  const departNow = Math.max(nowMin, 0);
  const arrive = departNow + travel;
  const wait = start - arrive;
  return { travel, leaveBy: fmtClock(leave), wait, arriveAt: fmtClock(arrive), suggest: wait >= MIN_WAIT, late: wait < 0 };
}

export type Kind = 'caffe' | 'visita' | 'passeggiata' | 'libreria' | 'pasto';
/** Che cosa proporre in base a interessi e tempo libero. */
export function pickKinds(interests: Interest[], wait: number): Kind[] {
  const out: Kind[] = [];
  const has = (...x: Interest[]) => x.some((i) => interests.includes(i));
  if (has('caffe', 'relax')) out.push('caffe');
  if (wait >= 40 && has('architettura', 'storia', 'musei')) out.push('visita');
  if (wait >= 30 && has('citta', 'natura')) out.push('passeggiata');
  if (has('libri', 'shopping')) out.push('libreria');
  if (wait >= 50 && has('cucina')) out.push('pasto');
  if (!out.length) out.push(wait >= 45 ? 'passeggiata' : 'caffe');
  return out;
}

export function adviceText(place: string, a: Arrival, kinds: Kind[]): string[] {
  const lines: string[] = [];
  if (a.late) { lines.push(t('Con circa {0} min di viaggio verso {1} rischi di arrivare in ritardo: parti subito.', a.travel, place)); return lines; }
  lines.push(t('Per {0} servono circa {1} min: parti entro le {2}.', place, a.travel, a.leaveBy));
  if (a.suggest) {
    lines.push(t('Se parti ora arrivi con circa {0} min di anticipo.', a.wait));
    const m: Record<Kind, string> = {
      caffe: t('Ti va un caffè nei dintorni nell’attesa?'),
      visita: t('Hai tempo per vedere un edificio storico o d’architettura nella zona.'),
      passeggiata: t('Hai tempo per una passeggiata in zona.'),
      libreria: t('Hai tempo per una libreria o un negozio vicino.'),
      pasto: t('Hai tempo per uno spuntino di cucina locale.'),
    };
    kinds.forEach((k) => lines.push(m[k]));
  }
  return lines;
}
