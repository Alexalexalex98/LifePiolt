/**
 * Proposte di automazioni, in ordine di utilità, calcolate dallo stato dell'utente.
 * Modulo PURO (nessun import '@/'), testato in tests/automationSuggest.test.mjs.
 * Alcune proposte hanno un orario (`notify`) e diventano notifiche locali vere; le altre (condizioni) restano
 * promemoria descrittivi: l'app ti avvisa, l'azione la confermi tu.
 */
import { t } from '../i18n/core.ts';

export type SuggestInput = {
  openTasks: number;
  urgentTasks: number;
  /** ore medie di sonno (ultimi giorni) oppure null se non registrato */
  avgSleep: number | null;
  /** una categoria di spesa ha superato il budget */
  overBudget: boolean;
  budgetSet: boolean;
  /** quanti degli ultimi 7 giorni hanno un umore registrato */
  moodDaysLast7: number;
  /** sessioni "Lavoro su:" passate con il task ancora aperto */
  skippedSessions: number;
  /** obiettivi non completati senza avanzamento da 7 giorni */
  stalledGoals: number;
  hasGoals: boolean;
  /** giorni dall'ultimo allenamento (null = mai registrato) */
  daysSinceWorkout: number | null;
  /** impegni serali (dopo le 19) negli ultimi/prossimi 7 giorni */
  eveningEvents: number;
  /** chiavi delle automazioni già presenti (non vengono riproposte) */
  existingKeys: string[];
};

export type NotifySpec = { kind: 'daily' | 'weekly'; hour: number; minute: number; /** 0 = domenica .. 6 = sabato */ weekday?: number; title: string; body: string };

export type AutoSuggestion = {
  key: string;
  title: string;
  why: string;
  /** testo leggibile della regola: è anche il testo dell'automazione creata */
  rule: string;
  score: number;
  /** se presente, l'automazione pianifica una notifica locale */
  notify?: NotifySpec;
  /** true = solo promemoria descrittivo (nessuna azione automatica) */
  descriptive: boolean;
};

export const DESCRIPTIVE_NOTE = 'Questa automazione ti avvisa; l\'azione la confermi tu.';
const oneDec = (n: number) => n.toFixed(1).replace('.', ',');
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function suggestAutomations(i: SuggestInput, max = 8): AutoSuggestion[] {
  const c: AutoSuggestion[] = [];
  const add = (s: Omit<AutoSuggestion, 'descriptive'>) => c.push({ ...s, descriptive: !s.notify });

  add({
    key: 'weekly-review', score: 58 + (i.hasGoals ? 6 : 0) + (i.openTasks > 4 ? 6 : 0),
    title: t('Revisione della settimana'),
    why: i.openTasks > 0 ? t('Hai {0} task aperti: una revisione settimanale ti aiuta a chiuderli o spostarli.', i.openTasks) : t('Un momento fisso a settimana per capire cosa è andato bene e preparare la prossima.'),
    rule: t('Ogni domenica sera: revisione della settimana'),
    notify: { kind: 'weekly', weekday: 0, hour: 19, minute: 0, title: t('Revisione della settimana'), body: t('Apri LifePilot: com\'è andata la settimana e cosa preparare per la prossima?') },
  });
  add({
    key: 'morning-briefing', score: 52 + clamp(i.urgentTasks, 0, 3) * 8 + (i.openTasks > 5 ? 8 : 0),
    title: t('Briefing del mattino'),
    why: i.urgentTasks > 0 ? t('Hai {0} task urgenti: parti la mattina sapendo qual è il primo.', i.urgentTasks) : t('Parti la giornata con il piano di oggi e il task più importante.'),
    rule: t('Ogni giorno alle 07:45: briefing e task più urgente'),
    notify: { kind: 'daily', hour: 7, minute: 45, title: t('Buongiorno'), body: t('Apri LifePilot per il piano di oggi e il task più urgente.') },
  });
  add({
    key: 'mood-checkin', score: 38 + (7 - clamp(i.moodDaysLast7, 0, 7)) * 6,
    title: t('Check-in dell\'umore'),
    why: i.moodDaysLast7 < 4 ? t('Negli ultimi 7 giorni hai registrato l\'umore solo {0} volte: 5 secondi la sera bastano.', i.moodDaysLast7) : t('Registrare l\'umore ogni sera rende più precise le analisi.'),
    rule: t('Ogni sera alle 21:00: check-in umore'),
    notify: { kind: 'daily', hour: 21, minute: 0, title: t('Come ti sei sentito oggi?'), body: t('Registra il tuo umore: ti prende 5 secondi.') },
  });
  add({
    key: 'budget-friday', score: i.budgetSet ? 44 + (i.overBudget ? 32 : 0) : 30,
    title: t('Controllo del budget'),
    why: i.overBudget ? t('Una categoria ha già superato il budget: un controllo a settimana evita sorprese a fine mese.') : i.budgetSet ? t('Una occhiata a settimana alle spese tiene il budget sotto controllo.') : t('Non hai ancora un budget: il venerdì è un buon momento per guardare le spese.'),
    rule: t('Ogni venerdì alle 18:00: controllo del budget'),
    notify: { kind: 'weekly', weekday: 5, hour: 18, minute: 0, title: t('Controllo del budget'), body: t('Dai un\'occhiata alle spese della settimana in LifeFinance.') },
  });
  const poorSleep = i.avgSleep != null && i.avgSleep < 6.5;
  add({
    key: 'bedtime', score: i.avgSleep == null ? 18 : poorSleep ? 72 + clamp(Math.round((6.5 - (i.avgSleep ?? 6.5)) * 10), 0, 15) : 22,
    title: t('Promemoria per andare a letto'),
    why: i.avgSleep == null ? t('Non hai ancora dati sul sonno: un orario fisso la sera aiuta comunque.') : poorSleep ? t('Dormi in media {0} h: andare a letto presto è la leva più semplice.', oneDec(i.avgSleep)) : t('Dormi in media {0} h: un orario fisso aiuta a mantenerlo.', oneDec(i.avgSleep)),
    rule: t('Ogni sera alle 22:30: promemoria di andare a letto'),
    notify: { kind: 'daily', hour: 22, minute: 30, title: t('È ora di prepararsi a dormire'), body: t('Stacca schermi e luci: domani ti ringrazierai.') },
  });
  add({
    key: 'replan-skipped', score: i.skippedSessions >= 3 ? 86 : i.skippedSessions > 0 ? 58 : 20,
    title: t('Ripianifica le sessioni saltate'),
    why: i.skippedSessions > 0 ? t('Hai {0} sessioni di lavoro saltate con il task ancora aperto.', i.skippedSessions) : t('Se salti delle sessioni di lavoro, te le rimetto nei prossimi slot liberi.'),
    rule: t('Dopo 3 sessioni saltate: ripianifica da sola'),
  });
  const noWorkout = i.daysSinceWorkout == null ? 12 : i.daysSinceWorkout;
  add({
    key: 'workout-nudge', score: i.daysSinceWorkout == null ? 30 : i.daysSinceWorkout >= 3 ? 56 + clamp(noWorkout, 0, 10) * 2 : 20,
    title: t('Muoviti dopo qualche giorno fermo'),
    why: i.daysSinceWorkout == null ? t('Non risultano allenamenti registrati: un promemoria ti aiuta a ripartire.') : i.daysSinceWorkout >= 3 ? t('Sono {0} giorni senza allenamento.', i.daysSinceWorkout) : t('Ti ricordo di muoverti se salti qualche giorno.'),
    rule: t('Se passano 3 giorni senza allenamento: ti ricordo di muoverti'),
  });
  add({
    key: 'stalled-goals', score: i.stalledGoals > 0 ? 54 + clamp(i.stalledGoals, 0, 3) * 4 : i.hasGoals ? 26 : 0,
    title: t('Obiettivi fermi'),
    why: i.stalledGoals > 0 ? t('{0} obiettivi non avanzano da una settimana.', i.stalledGoals) : t('Ogni lunedì ti ricordo di dare un passo piccolo ai tuoi obiettivi.'),
    rule: t('Ogni lunedì alle 09:00: obiettivi fermi da una settimana'),
    notify: { kind: 'weekly', weekday: 1, hour: 9, minute: 0, title: t('Obiettivi'), body: t('C\'è qualche obiettivo fermo? Un passo piccolo oggi lo sblocca.') },
  });
  add({
    key: 'urgent-tasks', score: i.urgentTasks >= 3 ? 70 : i.urgentTasks > 0 ? 40 : 15,
    title: t('Troppi task urgenti'),
    why: i.urgentTasks > 0 ? t('Hai {0} task segnati urgenti.', i.urgentTasks) : t('Se i task urgenti si accumulano, te lo segnalo.'),
    rule: t('Se hai più di 3 task urgenti: avviso per rivedere le priorità'),
  });
  add({
    key: 'evening-free', score: i.eveningEvents >= 3 ? 60 : i.eveningEvents >= 2 ? 48 : 16,
    title: t('Proteggi le sere libere'),
    why: i.eveningEvents >= 2 ? t('Hai {0} impegni serali questa settimana.', i.eveningEvents) : t('Se riempi troppo le sere, ti propongo di tenerne una libera.'),
    rule: t('Se hai più di 2 impegni serali a settimana: tengo libera una sera'),
  });

  const have = new Set(i.existingKeys);
  return c.filter((s) => !have.has(s.key) && s.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, max));
}

/** Giorno della settimana JS (0 = domenica) -> numero di Expo (1 = domenica .. 7 = sabato). */
export const expoWeekday = (jsDay: number) => ((jsDay % 7) + 7) % 7 + 1;
