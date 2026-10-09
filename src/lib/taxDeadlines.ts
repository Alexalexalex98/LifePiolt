/**
 * Scadenze fiscali tipiche per chi vive in Svizzera. Modulo PURO e testabile.
 * ATTENZIONE: sono date INDICATIVE e variano per cantone, comune e situazione personale: verifica sempre sul sito del tuo cantone.
 */
import { t } from '../i18n/core.ts';

/** Testo italiano (chiave del catalogo). Per il testo tradotto usa taxDisclaimer(). */
export const TAX_DISCLAIMER = 'Date indicative: variano per cantone e situazione personale. Verifica sul sito del tuo cantone prima di fare affidamento su di esse.';

/** Disclaimer nella lingua attiva (da chiamare dentro funzioni/componenti, non a livello di modulo). */
export const taxDisclaimer = () => t('Date indicative: variano per cantone e situazione personale. Verifica sul sito del tuo cantone prima di fare affidamento su di esse.');

export type TaxDeadline = { id: string; day: string; title: string; note: string; kind: 'dichiarazione' | 'pagamento' | 'previdenza' | 'assicurazione' | 'preparazione' };
export type PlanEventLike = { time: string; title: string; important?: boolean; reminder?: boolean; dur?: number; ref?: string };

const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;

/** Scadenze di un anno (la dichiarazione dell'anno `year` riguarda l'anno precedente). */
export function deadlinesForYear(year: number): TaxDeadline[] {
  return [
    { id: `docs-${year}`, day: iso(year, 1, 31), kind: 'preparazione', title: t('Raccogli i documenti per la dichiarazione fiscale'), note: t('Certificato di salario, attestati del 3° pilastro, estratti conto e titoli al 31.12.{0}, attestato premi cassa malati.', year - 1) },
    { id: `dichiarazione-${year}`, day: iso(year, 3, 31), kind: 'dichiarazione', title: t('Scadenza dichiarazione fiscale'), note: t('Di regola il 31 marzo {0}; la proroga si chiede online o per iscritto, in genere fino a fine settembre o oltre (a volte con spese). Alcuni cantoni usano date diverse.', year) },
    { id: `proroga-${year}`, day: iso(year, 9, 30), kind: 'dichiarazione', title: t('Fine tipica della proroga della dichiarazione'), note: t('Se hai chiesto una proroga, controlla la data esatta concessa dal tuo cantone: spesso è il 30 settembre, ma può essere diversa.') },
    { id: `acconto-${year}`, day: iso(year, 10, 31), kind: 'pagamento', title: t('Controlla acconti e fatture provvisorie delle imposte'), note: t('Le rate degli acconti (imposta cantonale, comunale e federale) hanno scadenze diverse per cantone: verifica la fattura ricevuta e la data di scadenza per evitare interessi di mora.') },
    { id: `cassa-malati-${year}`, day: iso(year, 11, 30), kind: 'assicurazione', title: t('Ultimo giorno per cambiare cassa malati (assicurazione di base)'), note: t('In genere la disdetta ordinaria deve arrivare alla cassa entro il 30 novembre per cambiare dal 1° gennaio; per i cambi di franchigia di solito vale la stessa data. Confronta i premi sul sito ufficiale della Confederazione.') },
    { id: `3a-${year}`, day: iso(year, 12, 31), kind: 'previdenza', title: t('Ultimo giorno per versare nel pilastro 3a'), note: t('Per dedurre il versamento dalla dichiarazione {0}, l’accredito deve avvenire entro il 31 dicembre {0}. Controlla l’importo massimo deducibile aggiornato e che il bonifico arrivi in tempo.', year) },
    { id: `riscatto-${year}`, day: iso(year, 12, 31), kind: 'previdenza', title: t('Riscatti nella cassa pensione e spese deducibili entro fine anno'), note: t('Eventuali riscatti del 2° pilastro, spese mediche e donazioni vanno pagati entro il 31 dicembre per essere deducibili per l’anno in corso. Informati sulle condizioni con la tua cassa pensione.') },
  ];
}

/** Scadenze da oggi in avanti, per i prossimi `months` mesi (default 12). */
export function upcomingDeadlines(today: string, months = 12): TaxDeadline[] {
  const y = Number(today.slice(0, 4));
  const end = (() => { const d = new Date(today + 'T00:00:00'); d.setMonth(d.getMonth() + months); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); })();
  return [y, y + 1].flatMap(deadlinesForYear).filter((d) => d.day >= today && d.day <= end).sort((a, b) => a.day.localeCompare(b.day));
}

export const taxRef = (id: string) => `tax:${id}`;

/** Eventi per il Plan (con promemoria), senza quelli già presenti con lo stesso ref nello stesso giorno. */
export function taxEventsToAdd(list: TaxDeadline[], existing: Record<string, PlanEventLike[]>): { day: string; ev: PlanEventLike }[] {
  return list
    .filter((d) => !(existing[d.day] ?? []).some((e) => e.ref === taxRef(d.id)))
    .map((d) => ({ day: d.day, ev: { time: '09:00', title: t('Fisco: {0}', d.title), important: d.kind === 'dichiarazione' || d.kind === 'previdenza', reminder: true, dur: 30, ref: taxRef(d.id) } }));
}
