/** Testi del briefing del mattino e del riepilogo serale. Funzioni pure: i dati arrivano già pronti. */
import { t } from '../i18n/core.ts';

export type MorningIn = {
  name: string; events: { time: string; title: string }[]; topTask?: { t: string; why: string }; freeMin: number;
  moodLogged: boolean; rainMm?: number; tmax?: number; skipped?: number; hour: number;
};
export type EveningIn = {
  name: string; doneToday: number; openCount: number; tomorrow: { time: string; title: string }[]; topTask?: { t: string; why: string };
  moodLogged: boolean; skipped?: number;
};
export type Brief = { title: string; body: string };

const hm = (min: number) => (min % 60 ? t('{0} h {1} min', Math.floor(min / 60), min % 60) : t('{0} h', Math.floor(min / 60)));

export function morningText(i: MorningIn): Brief {
  const greet = i.hour < 12 ? t('Buongiorno') : i.hour < 18 ? t('Buon pomeriggio') : t('Buonasera');
  const lines: string[] = [];
  const evs = i.events.slice().sort((a, b) => a.time.localeCompare(b.time));
  lines.push(evs.length ? (evs.length === 1 ? t('Oggi hai 1 impegno: si parte alle {0} con «{1}».', evs[0].time, evs[0].title) : t('Oggi hai {0} impegni: si parte alle {1} con «{2}».', evs.length, evs[0].time, evs[0].title)) : t('Oggi non hai impegni in agenda: giornata libera.'));
  if (i.freeMin >= 60) lines.push(t('Hai circa {0} liberi nel tuo orario di lavoro.', hm(i.freeMin)));
  if (i.topTask) lines.push(i.topTask.why ? t('Da fare per primo: «{0}» ({1}).', i.topTask.t, i.topTask.why) : t('Da fare per primo: «{0}».', i.topTask.t));
  if (i.skipped) lines.push(i.skipped === 1 ? t('1 sessione di lavoro saltata: posso ripianificarle.') : t('{0} sessioni di lavoro saltate: posso ripianificarle.', i.skipped));
  if ((i.rainMm ?? 0) >= 2) lines.push(t('Oggi è prevista pioggia: porta l’ombrello.'));
  if (!i.moodLogged) lines.push(t('Come ti senti? Il check-in dell’umore ti prende 5 secondi.'));
  return { title: i.name ? t('{0}, {1}', greet, i.name) : greet, body: lines.join(' ') };
}

export function eveningText(i: EveningIn): Brief {
  const lines: string[] = [];
  lines.push(i.doneToday ? (i.doneToday === 1 ? t('Oggi hai completato 1 task.') : t('Oggi hai completato {0} task.', i.doneToday)) : t('Oggi non hai completato task.'));
  if (i.openCount) lines.push(i.openCount === 1 ? t('Resta 1 task aperto.') : t('Restano {0} task aperti.', i.openCount));
  if (i.tomorrow.length) { const e = i.tomorrow.slice().sort((a, b) => a.time.localeCompare(b.time))[0]; lines.push(i.tomorrow.length === 1 ? t('Domani hai 1 impegno, alle {0}: «{1}».', e.time, e.title) : t('Domani hai {0} impegni, il primo alle {1}: «{2}».', i.tomorrow.length, e.time, e.title)); }
  else lines.push(t('Domani non hai impegni in agenda.'));
  if (i.topTask) lines.push(i.topTask.why ? t('Per domani parti da «{0}» ({1}).', i.topTask.t, i.topTask.why) : t('Per domani parti da «{0}».', i.topTask.t));
  if (i.skipped) lines.push(i.skipped === 1 ? t('1 sessione saltata: chiedimi di ripianificare.') : t('{0} sessioni saltate: chiedimi di ripianificare.', i.skipped));
  if (!i.moodLogged) lines.push(t('Non hai ancora registrato come ti senti oggi.'));
  return { title: i.name ? t('Riepilogo della giornata, {0}', i.name) : t('Riepilogo della giornata'), body: lines.join(' ') };
}
