/**
 * Questionari brevi riconosciuti (WHO-5 e PHQ-9), con il punteggio calcolato SUL TELEFONO. Servono a dare un riferimento comprensibile e a calibrare gli altri segnali:
 * non sono una diagnosi. Modulo PURO.
 */
export type QKind = 'who5' | 'phq9';
export type QOption = { v: number; label: string };
export type Questionnaire = { kind: QKind; title: string; intro: string; items: string[]; options: QOption[]; /** ogni quanti giorni proporlo */ everyDays: number };

export const WHO5: Questionnaire = {
  kind: 'who5', title: 'WHO-5: come stai', everyDays: 14,
  intro: 'Cinque domande sulle ultime due settimane. Non ci sono risposte giuste o sbagliate.',
  items: [
    'Mi sono sentito/a allegro/a e di buon umore',
    'Mi sono sentito/a calmo/a e rilassato/a',
    'Mi sono sentito/a attivo/a e vigoroso/a',
    'Mi sono svegliato/a sentendomi fresco/a e riposato/a',
    'La mia vita quotidiana è stata piena di cose che mi interessano',
  ],
  options: [{ v: 5, label: 'Sempre' }, { v: 4, label: 'Quasi sempre' }, { v: 3, label: 'Più della metà del tempo' }, { v: 2, label: 'Meno della metà del tempo' }, { v: 1, label: 'Ogni tanto' }, { v: 0, label: 'Mai' }],
};

export const PHQ9: Questionnaire = {
  kind: 'phq9', title: 'PHQ-9: umore', everyDays: 14,
  intro: 'Nelle ultime due settimane, quanto spesso ti hanno dato fastidio questi problemi?',
  items: [
    'Scarso interesse o piacere nel fare le cose',
    'Sentirsi giù, depresso/a o senza speranza',
    'Difficoltà ad addormentarsi o a dormire, oppure dormire troppo',
    'Sentirsi stanco/a o avere poca energia',
    'Scarso appetito oppure mangiare troppo',
    'Avere una scarsa opinione di sé, sentirsi un fallimento o aver deluso sé stessi o la famiglia',
    'Difficoltà a concentrarsi, per esempio nel leggere o guardare la televisione',
    'Muoversi o parlare così lentamente che gli altri se ne accorgono; oppure essere così agitato/a da muoversi molto più del solito',
    'Pensare che sarebbe meglio morire o farsi del male in qualche modo',
  ],
  options: [{ v: 0, label: 'Mai' }, { v: 1, label: 'Per diversi giorni' }, { v: 2, label: 'Per più della metà dei giorni' }, { v: 3, label: 'Quasi ogni giorno' }],
};

export const QUESTIONNAIRES: Record<QKind, Questionnaire> = { who5: WHO5, phq9: PHQ9 };

export type Band = 'ok' | 'attenzione' | 'alto';
export type QResult = { kind: QKind; score: number; max: number; band: Band; label: string; /** PHQ-9: risposta alla domanda 9 diversa da zero */ selfHarm: boolean };

/** WHO-5: somma × 4 (0-100). Sotto 50 vale la pena parlarne con il medico; 28 o meno è un punteggio molto basso. PHQ-9: 0-27, soglie 5/10/15/20. */
export function scoreQuestionnaire(kind: QKind, answers: number[]): QResult {
  const q = QUESTIONNAIRES[kind];
  const a = q.items.map((_, i) => Math.max(0, Math.min(q.options[0]!.v === 5 ? 5 : 3, Math.round(answers[i] ?? 0))));
  const sum = a.reduce((s, x) => s + x, 0);
  if (kind === 'who5') {
    const score = sum * 4;
    return { kind, score, max: 100, band: score <= 28 ? 'alto' : score < 50 ? 'attenzione' : 'ok', label: score <= 28 ? 'molto basso' : score < 50 ? 'basso' : 'nella norma', selfHarm: false };
  }
  const label = sum < 5 ? 'minimo' : sum < 10 ? 'lieve' : sum < 15 ? 'moderato' : sum < 20 ? 'moderatamente grave' : 'grave';
  return { kind, score: sum, max: 27, band: sum >= 15 ? 'alto' : sum >= 5 ? 'attenzione' : 'ok', label, selfHarm: (a[8] ?? 0) > 0 };
}

/** Quanti giorni sono passati dall'ultima volta (Infinity se mai): serve a proporlo ogni due settimane. */
export const daysSince = (ts: number | undefined, now: number): number => (ts ? Math.floor((now - ts) / 86400000) : Infinity);
export const isDue = (kind: QKind, lastTs: number | undefined, now: number): boolean => daysSince(lastTs, now) >= QUESTIONNAIRES[kind].everyDays;
