import { t } from '@/i18n/core';
import { balance } from '@/lib/hr';
import { parseIntent } from '@/lib/workIntent';
import { workdays } from '@/lib/hr';
import { serverState } from '@/lib/teams';
import { createTask } from '@/lib/teamTasks';
import { requestAbsence, today } from '@/lib/teamWork';
import { useHr } from '@/store/hr';
import { useLife } from '@/store/life';
import { useTeams } from '@/store/teams';
import { useWork } from '@/store/work';
import { useWorkspaceChat } from '@/store/workspaceChat';
import { usePeople } from '@/store/people';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const label = (d: string) => { const x = new Date(d + 'T12:00:00'); return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; };
const KIND: Record<string, string> = { ferie: 'le ferie', permesso: 'il permesso', malattia: 'la malattia', altro: 'l\'assenza' };

/** Theia Lavoro fa quello che chiedi: ferie, permessi, malattia e task. true = l'ho gestito io, la domanda non va ai file. */
export async function handleWorkIntent(q: string): Promise<boolean> {
  const it = parseIntent(q, today()); if (!it) return false;
  const chat = useWorkspaceChat.getState(); chat.set({ pending: undefined });
  const teams = useTeams.getState().teams; const team = teams.find((x) => x.id === useWork.getState().active) ?? teams[0];
  const server = !!team && (await serverState()) === 'ok' && !team.id.startsWith('demo-');
  if (it.type === 'absence') {
    const days = workdays(it.from, it.to); const range = it.from === it.to ? label(it.from) : `${t('dal')} ${label(it.from)} ${t('al')} ${label(it.to)}`;
    if (server && team) {
      const r = await requestAbsence(team.id, { kind: it.kind, from_day: it.from, to_day: it.to });
      if (!r.ok) { chat.push({ who: 'ai', text: t('Non sono riuscita a inviare la richiesta: {0}', r.message) }); return true; }
      const mine = useHr.getState().data[team.id]; const me = usePeople.getState().me;
      const b = it.kind === 'ferie' && mine ? balance(mine.mine, mine.absences.filter((a) => a.user_id === me), Number(it.from.slice(0, 4))) : null;
      chat.push({ who: 'ai', text: `${t('Fatto: ho richiesto {0} {1} ({2} giorni lavorativi).', t(KIND[it.kind]!), range, days)} ${t('La decide chi gestisce le assenze e la ritrovi nella scheda Piano.')}${b?.left != null ? ` ${t('Dopo questa richiesta ti restano {0} giorni di ferie.', b.left - days)}` : ''}` });
    } else {
      useLife.getState().addVacation({ dest: it.kind === 'ferie' ? t('Ferie') : t(KIND[it.kind]!).replace(/^./, (c) => c.toUpperCase()), month: MONTHS[new Date(it.from + 'T12:00:00').getMonth()]!, hotel: '', price: 0, days: Math.max(1, Math.round((new Date(it.to + 'T12:00:00').getTime() - new Date(it.from + 'T12:00:00').getTime()) / 86400000) + 1), flight: 0, start: it.from, end: it.to });
      chat.push({ who: 'ai', text: t('Fatto: ho segnato {0} {1} nel tuo Plan. Per chiederle al tuo responsabile serve un workspace collegato al server.', t(KIND[it.kind]!), range) });
    }
    return true;
  }
  if (server && team) {
    const r = await createTask({ team: team.id, title: it.title, assignee: usePeople.getState().me, due: it.due });
    chat.push({ who: 'ai', text: r.ok ? t('Fatto: ho creato il task «{0}»{1}. Lo trovi nella scheda Task.', it.title, it.due ? ` ${t('con scadenza')} ${label(it.due)}` : '') : t('Non sono riuscita a creare il task: {0}', r.message) });
  } else {
    useLife.getState().addTask({ t: it.title, ...(it.due ? { due: it.due } : {}) });
    chat.push({ who: 'ai', text: t('Fatto: ho aggiunto il task «{0}»{1} ai tuoi task.', it.title, it.due ? ` ${t('con scadenza')} ${label(it.due)}` : '') });
  }
  return true;
}
