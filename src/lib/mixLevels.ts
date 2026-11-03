/**
 * Volume dei suoni di sottofondo rispetto alla voce, in decibel.
 * Regole usate (la voce è sempre a livello pieno, il sottofondo scende di X dB):
 * - comprensione del parlato: il sottofondo deve stare almeno 15 dB sotto la voce, 20 dB o più per chi è stanco, ansioso o ascolta a basso volume (rapporto voce/rumore, ANSI S3.5 e linee guida sull'intelligibilità);
 * - sonno: rumori e musica per dormire entro ~50 dB(A) e il più bassi possibile (OMS: camera da letto sotto i 30–35 dB(A); AAP: macchine del sonno sotto i 50 dB(A)), quindi il livello più basso;
 * - concentrazione: la musica di sottofondo non deve competere con il compito, ma può stare un po' più alta, a -18 dB.
 * Il telefono non misura i dB reali: lavoriamo sul rapporto (guadagno = 10^(dB/20)) e l'utente regola il volume generale.
 */
export type MixKind = 'respiro' | 'corpo' | 'mente' | 'sonno' | 'cuore' | 'lavoro' | 'focus';
export type MixContext = { kind: MixKind; /** gli esercizi di ansia/stress usano un livello più basso */ topic?: 'ansia' | 'stress' };

/** dB sotto la voce */
export function ambientDb(c: MixContext): number {
  if (c.kind === 'sonno') return -28;
  if (c.topic === 'ansia') return -24;
  if (c.kind === 'respiro' || c.kind === 'corpo') return -22;
  if (c.topic === 'stress' || c.kind === 'mente' || c.kind === 'cuore') return -21;
  if (c.kind === 'lavoro') return -20;
  return -18; // focus
}
export const gainFromDb = (db: number): number => Math.pow(10, db / 20);

/** Livello (0–1) del sottofondo mentre la voce parla. Quando la voce tace per una pausa lunga si può salire di poco. */
export function ambientGain(c: MixContext): number { return Math.round(gainFromDb(ambientDb(c)) * 1000) / 1000; }

/** Dall'id della sessione ricava l'argomento: a1-… ansia, s… stress. */
export function topicOf(id: string, title = ''): MixContext['topic'] {
  if (/ansia|panico|calma/i.test(title) || /^a\d/.test(id)) return 'ansia';
  if (/stress|tension|sovracc/i.test(title) || /^st/.test(id)) return 'stress';
  return undefined;
}
