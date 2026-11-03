import { t } from '@/i18n/core';
import { dueNoteDay, trialDay, trialDaysLeft } from '@/lib/trial';
import { journeyItems } from '@/lib/trialJourney';
import { lifeScoreAnswer } from './lifeScoreTalk';
import { useAssistant } from '@/store/assistant';
import { useTrial } from '@/store/trial';

/** Nei 14 giorni di prova Theia fa il punto in alcuni giorni (1, 3, 7, 10, 12, 14): cosa ha capito, cosa manca, un passo concreto. Una sola volta per tappa. */
export function trialNote(now = Date.now()): boolean {
  const s = useTrial.getState();
  if (!s.startedAt) return false;
  const day = trialDay(s.startedAt, now);
  const due = dueNoteDay(day, s.lastNoteDay);
  if (due == null) return false;
  const items = journeyItems();
  const todo = items.filter((i) => !i.done);
  const left = trialDaysLeft(s.startedAt, now);
  const parts: string[] = [];
  if (due === 1) parts.push(t('Benvenuto! Ho {0} giorni per conoscerti e mostrarti quanto può esserti utile LifePilot. Partiamo da poco: ogni dato che aggiungi rende i miei consigli più giusti.', left));
  else {
    const score = lifeScoreAnswer('life score');
    if (score && !/mi servono ancora/.test(score)) parts.push(score);
    else parts.push(t('Sono al giorno {0} e ti conosco ancora poco: con qualche dato in più posso darti feedback molto più precisi.', due));
  }
  if (todo.length) parts.push(t('Per migliorare i feedback, la cosa più utile adesso: {0}.', todo[0]!.label.charAt(0).toLowerCase() + todo[0]!.label.slice(1)));
  if (due >= 12) parts.push(left > 0 ? t('Mancano {0} giorni alla fine della prova: dopo resta la versione gratuita, con i tuoi dati al loro posto.', left) : t('La prova è finita: continui con la versione gratuita e i tuoi dati restano al loro posto.'));
  useAssistant.getState().push({ who: 'ai', text: parts.join('\n\n'), source: 'chat', ext: { actions: [{ kind: 'open', label: t('Apri i tuoi 14 giorni'), page: 'trial' }, { kind: 'dismiss', label: t('Più tardi') }] } });
  useTrial.getState().set({ lastNoteDay: due });
  return true;
}
