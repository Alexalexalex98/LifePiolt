import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { EMPTY_INPUT, type Absence, type ReportInput, type TimeRow } from '@/lib/reports';
import { db, q } from '@/lib/teamWork';
import { crmOf, useCrm } from '@/store/crm';
import { useMeetings } from '@/store/meetings';
import { useWTasks } from '@/store/tasks';

/** I dati del workspace per i report: task, ore, vendite, assistenza, assenze, riunioni. Quello che non puoi vedere (per i tuoi permessi) il server non lo manda: nel report resta a zero. */
export async function loadReportInput(team: string): Promise<ReportInput> {
  const safe = async <T,>(table: string): Promise<T[]> => { try { return await q<T[]>((await db()).from(table).select('*').eq('team_id', team)); } catch { return []; } };
  const [time, absences] = await Promise.all([safe<TimeRow>('team_time'), safe<Absence>('team_absences')]);
  const crm = crmOf(team, useCrm.getState().data);
  return { ...EMPTY_INPUT, tasks: useWTasks.getState().tasks[team] ?? [], time, absences, deals: crm.deals, receivables: crm.receivables, tickets: crm.tickets, meetings: useMeetings.getState().items.filter((m) => m.team_id === team && !m.deleted).map((m) => ({ day: m.day, dur: m.dur, status: m.status })) };
}

/** Con l'AI (se collegata e con il tuo consenso): rifinisce un testo o risponde a una domanda sui numeri. Si inviano solo i testi o i numeri riassunti, mai i dati dei clienti. */
export type WriteOp = 'polish' | 'tone-formale' | 'tone-cordiale' | 'tone-diretto' | 'summary' | 'translate-en' | 'translate-de' | 'translate-fr' | 'ask';
const PROMPT: Record<WriteOp, string> = {
  polish: 'Riscrivi in italiano il testo seguente rendendolo più chiaro, corretto e professionale, senza cambiare i fatti, le cifre e le date. Rispondi solo con il testo.',
  'tone-formale': 'Riscrivi in italiano il testo seguente con un tono formale e rispettoso (dare del Lei). Non cambiare fatti, cifre e date. Rispondi solo con il testo.',
  'tone-cordiale': 'Riscrivi in italiano il testo seguente con un tono cordiale e professionale. Non cambiare fatti, cifre e date. Rispondi solo con il testo.',
  'tone-diretto': 'Riscrivi in italiano il testo seguente in modo diretto e breve (dare del tu). Non cambiare fatti, cifre e date. Rispondi solo con il testo.',
  summary: 'Riassumi in italiano, in massimo 5 punti brevi, il testo seguente. Un punto per riga, ognuno inizia con "- ". Nessuna introduzione.',
  'translate-en': 'Traduci in inglese professionale il testo seguente, senza cambiare cifre e date. Rispondi solo con la traduzione.',
  'translate-de': 'Traduci in tedesco professionale il testo seguente (Svizzera: usa la forma di cortesia), senza cambiare cifre e date. Rispondi solo con la traduzione.',
  'translate-fr': 'Traduci in francese professionale il testo seguente, senza cambiare cifre e date. Rispondi solo con la traduzione.',
  ask: 'Rispondi in italiano, in modo breve e chiaro, alla domanda usando SOLO i numeri seguenti. Se i numeri non bastano dillo.',
};
export async function writeAi(op: WriteOp, text: string, question?: string): Promise<{ ok: boolean; text: string }> {
  if (!aiServerConfigured) return { ok: false, text: t('Per questo serve il collegamento con l\'AI: lo attivi in Intelligenza di Theia.') };
  if (!(await askSend('data', t('Solo il testo che stai scrivendo o i numeri riassunti del report. Nessun dato dei clienti e nessun altro dato dell\'app.')))) return { ok: false, text: t('Va bene, non invio niente.') };
  logSend('data', text.length, ['testo di lavoro']);
  try { return { ok: true, text: (await aiChatRaw(`${PROMPT[op]}${question ? `\n\nDomanda: ${question}` : ''}\n\n${text.slice(0, 8000)}`)).trim() }; }
  catch (e) { return { ok: false, text: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }; }
}
