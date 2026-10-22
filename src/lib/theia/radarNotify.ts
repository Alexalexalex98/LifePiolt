/**
 * Quando e cosa notificare del radar (modulo PURO). Regole: solo avvisi importanti (attenzione o grave), al massimo un riepilogo al giorno
 * all'ora scelta e, se serve, un ricordo per andare a letto prima di un turno presto. Mai di notte. Acceso solo se lo scegli tu.
 */
import type { Proposal } from './radar.ts';

export type RadarPrefs = { on: boolean; hour: number; minute: number };
export type Planned = { id: string; at: number; title: string; body: string; ref: string };

export const DIGEST_ID = 'lp-radar-digest';
export const BED_ID = 'lp-radar-bed';
export const QUIET_FROM = 22; // ore
export const QUIET_TO = 7;

const quiet = (ms: number) => { const h = new Date(ms).getHours(); return h >= QUIET_FROM || h < QUIET_TO; };

/** La prossima volta in cui sono le `hour:minute` (almeno 5 minuti avanti). */
export function nextAt(now: number, hour: number, minute: number): number {
  const d = new Date(now);
  let t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0).getTime();
  if (t < now + 5 * 60000) t += 86400000;
  return t;
}

export function planRadarNotifications(proposals: Proposal[], now: number, prefs: RadarPrefs): Planned[] {
  if (!prefs.on) return [];
  const important = proposals.filter((p) => p.severity !== 'info');
  const out: Planned[] = [];
  if (important.length) {
    const at = nextAt(now, prefs.hour, prefs.minute);
    if (!quiet(at)) {
      const first = important[0];
      out.push({ id: DIGEST_ID, at, title: 'Theia ha notato', body: important.length === 1 ? first.title : `${first.title} (e altri ${important.length - 1})`, ref: 'reminder:radar' });
    }
  }
  const bed = important.find((p) => p.kind === 'sonno-turno' && p.notifyAt && p.notifyAt > now + 60000);
  if (bed && bed.notifyAt && !quiet(bed.notifyAt)) out.push({ id: BED_ID, at: bed.notifyAt, title: 'Domani il turno inizia presto', body: bed.why, ref: 'reminder:radar' });
  return out;
}
