/** Regole del LifeClub, contenuti per adulti (18+) e segnalazioni (modulo PURO, nessun alias '@/'). */
export const CLUB_RULES_VERSION = 1;
export type Rule = { id: string; title: string; text: string };
export const CLUB_RULES: Rule[] = [
  { id: 'lecito', title: 'Solo contenuti leciti e tuoi', text: 'Pubblica solo ciò che è legale e che hai il diritto di usare: testi, foto, video e file tuoi, o con il permesso di chi li ha fatti.' },
  { id: 'minori', title: 'Mai minorenni in contenuti sessuali o di nudo', text: 'È vietato in assoluto e viene segnalato alle autorità. Vale per foto, video, testi e disegni.' },
  { id: 'consenso', title: 'Niente contenuti intimi senza consenso', text: 'Non si pubblicano immagini o video intimi di una persona senza il suo consenso, né dati personali di altri.' },
  { id: 'esplicito', title: 'Niente pornografia o contenuti sessuali espliciti', text: 'I temi per adulti (sessualità, relazioni, corpo, salute, nudo artistico o educativo) sono ammessi se non espliciti. Pornografia e scene sessuali esplicite sono vietate.' },
  { id: 'violenza', title: 'Niente violenza gratuita o odio', text: 'Vietati violenza gratuita, minacce, istigazione all\'odio e contenuti che incoraggiano a farsi del male.' },
  { id: 'diritti', title: 'Diritto d\'autore', text: 'Non caricare materiale protetto di altri. Chi paga per il tuo club non può rivendere o ripubblicare i contenuti, e tu non puoi farlo con quelli degli altri.' },
  { id: 'onesta', title: 'Promesse vere e prezzi chiari', text: 'Descrivi il club per quello che è: niente promesse false, niente guadagni garantiti, niente consigli medici o finanziari spacciati per certezze.' },
  { id: 'adulti', title: 'Se è per adulti, segnalalo', text: 'Se il club tratta temi per adulti, attiva «Contenuti per adulti (18+)»: chi entra deve confermare di essere maggiorenne.' },
];
export const RULES_CONSEQUENCES = 'Chi viola queste regole può vedere i contenuti rimossi, il club sospeso e l\'account chiuso. Le segnalazioni sono esaminate, e i casi più gravi vengono comunicati alle autorità.';

export type RulesAck = { version: number; at: number };
/** Il club si può pubblicare solo dopo aver accettato le regole attuali. */
export function canPublish(ack: RulesAck | undefined): { ok: boolean; why?: string } {
  if (!ack) return { ok: false, why: 'Prima leggi e accetta le regole del LifeClub' };
  if (ack.version !== CLUB_RULES_VERSION) return { ok: false, why: 'Le regole sono cambiate: leggile e accettale di nuovo' };
  return { ok: true };
}

/** Maggiorenni: ok; minorenni: bloccato; età ignota: serve la conferma («ho almeno 18 anni»), che si dà una volta sola. */
export const ADULT_AGE = 18;
export type Gate = 'ok' | 'ask' | 'blocked';
export function adultGate(opts: { adultClub: boolean | undefined; birthYear: number | string | null | undefined; ack: boolean; year: number }): Gate {
  if (!opts.adultClub) return 'ok';
  const by = Number(opts.birthYear);
  if (Number.isFinite(by) && by > 1900 && by <= opts.year) {
    // dell'anno di nascita non si sa il compleanno: chi compie 18 anni in quest'anno si tratta da maggiorenne
    if (opts.year - by < ADULT_AGE) return 'blocked';
  }
  return opts.ack ? 'ok' : 'ask';
}

/** Motivi di segnalazione che nascondono subito il contenuto a chi segnala e vanno guardati per primi. */
export const URGENT_REASONS = ['minori', 'illegale'] as const;
export const isUrgent = (reason: string): boolean => (URGENT_REASONS as readonly string[]).includes(reason);
