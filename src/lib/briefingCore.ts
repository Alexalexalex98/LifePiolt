/** Testi del briefing del mattino e del riepilogo serale. Funzioni pure: i dati arrivano già pronti. */
export type MorningIn = {
  name: string; events: { time: string; title: string }[]; topTask?: { t: string; why: string }; freeMin: number;
  moodLogged: boolean; rainMm?: number; tmax?: number; skipped?: number; hour: number;
};
export type EveningIn = {
  name: string; doneToday: number; openCount: number; tomorrow: { time: string; title: string }[]; topTask?: { t: string; why: string };
  moodLogged: boolean; skipped?: number;
};
export type Brief = { title: string; body: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hm = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;

export function morningText(i: MorningIn): Brief {
  const greet = i.hour < 12 ? 'Buongiorno' : i.hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const lines: string[] = [];
  const evs = i.events.slice().sort((a, b) => a.time.localeCompare(b.time));
  lines.push(evs.length ? `Oggi hai ${plural(evs.length, 'impegno', 'impegni')}: si parte alle ${evs[0].time} con «${evs[0].title}».` : 'Oggi non hai impegni in agenda: giornata libera.');
  if (i.freeMin >= 60) lines.push(`Hai circa ${hm(i.freeMin)} liberi nel tuo orario di lavoro.`);
  if (i.topTask) lines.push(`Da fare per primo: «${i.topTask.t}»${i.topTask.why ? ` (${i.topTask.why})` : ''}.`);
  if (i.skipped) lines.push(`${plural(i.skipped, 'sessione di lavoro saltata', 'sessioni di lavoro saltate')}: posso ripianificarle.`);
  if ((i.rainMm ?? 0) >= 2) lines.push('Oggi è prevista pioggia: porta l’ombrello.');
  if (!i.moodLogged) lines.push('Come ti senti? Il check-in dell’umore ti prende 5 secondi.');
  return { title: `${greet}${i.name ? ', ' + i.name : ''}`, body: lines.join(' ') };
}

export function eveningText(i: EveningIn): Brief {
  const lines: string[] = [];
  lines.push(i.doneToday ? `Oggi hai completato ${plural(i.doneToday, 'task', 'task')}.` : 'Oggi non hai completato task.');
  if (i.openCount) lines.push(`Restano ${plural(i.openCount, 'task aperto', 'task aperti')}.`);
  if (i.tomorrow.length) { const e = i.tomorrow.slice().sort((a, b) => a.time.localeCompare(b.time))[0]; lines.push(`Domani hai ${plural(i.tomorrow.length, 'impegno', 'impegni')}, il primo alle ${e.time}: «${e.title}».`); }
  else lines.push('Domani non hai impegni in agenda.');
  if (i.topTask) lines.push(`Per domani parti da «${i.topTask.t}»${i.topTask.why ? ` (${i.topTask.why})` : ''}.`);
  if (i.skipped) lines.push(`${plural(i.skipped, 'sessione saltata', 'sessioni saltate')}: chiedimi di ripianificare.`);
  if (!i.moodLogged) lines.push('Non hai ancora registrato come ti senti oggi.');
  return { title: `Riepilogo della giornata${i.name ? ', ' + i.name : ''}`, body: lines.join(' ') };
}
