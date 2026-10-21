/**
 * Come parla Theia: come una persona, non come un'AI, e si adatta a chi ha davanti (modulo PURO).
 * `styleHints` guarda come scrive l'utente (lei/tu, lunghezza, tono) e dà le istruzioni al modello; `humanize` toglie dalla risposta
 * i segni da chat-bot (**grassetto**, elenchi con l'asterisco, titoli) che nell'app comparivano così come sono.
 */
const words = (s: string) => (s.match(/\p{L}[\p{L}'’]*/gu) ?? []).length;

export type Style = { formal: boolean; length: 'brevissima' | 'breve' | 'media' | 'lunga'; casual: boolean; warm: boolean; lang?: string };

export function readStyle(userTexts: string[]): Style {
  const t = userTexts.map((x) => x.trim()).filter(Boolean).slice(-8);
  if (!t.length) return { formal: false, length: 'breve', casual: false, warm: false };
  const all = t.join(' ');
  const formal = /\b(lei|la ringrazio|potrebbe|potrebbero|mi pu[oò]|gentilmente|cordiali|distinti|buongiorno,)\b/i.test(all) && !/\b(tu|dimmi|puoi|ciao)\b/i.test(all);
  const avg = t.reduce((s, x) => s + words(x), 0) / t.length;
  const length = avg < 5 ? 'brevissima' : avg < 12 ? 'breve' : avg < 30 ? 'media' : 'lunga';
  const lowerStarts = t.filter((x) => /^[a-zà-ÿ]/.test(x)).length;
  const noPunct = t.filter((x) => !/[.!?]$/.test(x)).length;
  const casual = lowerStarts / t.length > 0.6 && noPunct / t.length > 0.6;
  const warm = /(!{1,}|\b(ahah|haha|grazie mille|grande|top|perfetto|bellissim)\w*)/i.test(all);
  return { formal, length, casual, warm };
}

/** Le istruzioni sul modo di rispondere, dette al modello. */
export function styleHints(userTexts: string[]): string {
  const s = readStyle(userTexts);
  const lines = [
    'Scrivi come una persona che conosce bene l\'utente, non come un assistente AI: niente «Certamente!», niente «Come intelligenza artificiale», niente emoji.',
    'Leggibilità: metti la sostanza in una frase iniziale; poi, se serve, paragrafi brevi (al massimo 3 righe) separati da una riga vuota. Se elenchi 3 o più cose usa un elenco con «• » (al massimo 5 voci, una riga ciascuna). Usa il **grassetto** solo per 1-3 parole chiave o numeri importanti, mai per frasi intere. Niente titoli con #, niente tabelle, niente blocchi di codice. Chiudi con una sola proposta o domanda breve solo se serve davvero.',
    'Frasi naturali, dirette e calde; vai al punto prima e spiega dopo solo se serve.',
    s.formal ? 'L\'utente scrive in modo formale: dagli del «lei» e resta educato e sobrio.' : 'Dagli del «tu» e usa un tono amichevole, come tra conoscenti.',
    s.length === 'brevissima' ? 'L\'utente scrive messaggi brevissimi: rispondi in una o due frasi, al massimo.' : s.length === 'breve' ? 'L\'utente scrive messaggi brevi: rispondi breve (2-4 frasi).' : s.length === 'media' ? 'Rispondi in modo completo ma compatto (un paio di brevi paragrafi).' : 'L\'utente scrive messaggi articolati: puoi rispondere in modo più completo e ragionato, sempre ordinato.',
    s.casual ? 'L\'utente scrive in modo molto colloquiale: usa un registro rilassato e parlato, frasi corte, senza essere sciatto.' : '',
    s.warm ? 'L\'utente è espansivo: rispondi con calore e un po\' di entusiasmo, senza esagerare.' : '',
    'Rispondi nella stessa lingua in cui scrive l\'utente.',
    'Se ti manca un dato, chiedilo con una domanda sola, breve. Non inventare mai informazioni.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Toglie i segni da chat-bot dalla risposta. */
export function humanize(text: string): string {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/```[a-z]*\n?|```/gi, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/^\s*[*•-]\s+/gm, '– ')
    .replace(/^(\s*)–\s+–\s+/gm, '$1– ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Come `humanize`, ma tiene il **grassetto** e rende leggibili gli elenchi: gli asterischi e i trattini diventano «• », i titoli con # diventano una riga in grassetto.
 * Il testo si mostra con il componente RichText (grassetto, elenchi con rientro, paragrafi staccati).
 */
export function tidy(text: string): string {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/```[a-z]*\n?|```/gi, '')
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, '**$1**')
    .replace(/__(.+?)__/gs, '**$1**')
    .replace(/(^|[^*\w])\*(?!\s|\*)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/^(\s*)[*•–-]\s+/gm, '$1• ')
    .replace(/^(\s*)•\s+•\s+/gm, '$1• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Spezza il testo in blocchi per la visualizzazione: paragrafi, elenchi (anche numerati) e righe-titolo che finiscono con «:». */
export type Block = { kind: 'p' | 'li' | 'h'; text: string; n?: string; indent?: number };
export function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { out.push({ kind: 'p', text: '' }); continue; }
    const indent = (line.match(/^\s*/)?.[0].length ?? 0) >= 2 ? 1 : 0;
    const li = line.trim().match(/^•\s+(.*)$/);
    const num = line.trim().match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (li) out.push({ kind: 'li', text: li[1], indent });
    else if (num) out.push({ kind: 'li', text: num[2], n: num[1], indent });
    else if (/^[^.!?]{2,46}:$/.test(line.trim())) out.push({ kind: 'h', text: line.trim().replace(/:$/, '') });
    else out.push({ kind: 'p', text: line.trim() });
  }
  // le righe vuote consecutive e quelle in testa/coda non servono
  return out.filter((b, i, a) => !(b.kind === 'p' && !b.text && (i === 0 || i === a.length - 1 || (a[i - 1].kind === 'p' && !a[i - 1].text))));
}

/** Pezzi di una riga con il **grassetto**. */
export function inlineBold(text: string): { t: string; b: boolean }[] {
  const parts: { t: string; b: boolean }[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((x) => { if (!x) return; const m = x.match(/^\*\*([^*]+)\*\*$/); parts.push(m ? { t: m[1], b: true } : { t: x, b: false }); });
  return parts;
}

/**
 * Regole di onestà per il modello (Theia non deve mai inventare): le tre regole che valgono in ogni risposta.
 */
export const HONESTY = [
  'ONESTÀ (regola assoluta, vale più di tutto il resto): non inventare mai. Se non sai una cosa, non hai il dato o non puoi farla, dillo subito e chiaramente («Non lo so», «Non ho questo dato», «Non posso farlo da qui»), senza giri di parole e senza dare una risposta di ripiego che sembri vera.',
  'Non conosci la posizione, l\'indirizzo di casa, i percorsi, il traffico, gli orari dei locali o il meteo in tempo reale dell\'utente, a meno che compaiano nel contesto che ti viene dato qui sotto. Non descrivere mai strade, incroci, distanze o tempi di viaggio: invece dì che non hai quel dato e suggerisci di usare un\'app di mappe.',
  'Qui puoi solo scrivere una risposta. Non puoi inviare notifiche o messaggi, chiamare, prenotare, salvare, pagare o modificare nulla, e non sai se lo ha fatto l\'app. Non dire mai di aver fatto un\'azione e non proporre azioni che non puoi fare (come «ti mando le indicazioni sul telefono»): se serve un\'azione, spiega cosa può fare l\'utente nell\'app.',
  'Quando dai un\'informazione di cui non sei sicuro, dì quanto sei sicuro. Non indovinare nomi, numeri, date o luoghi.',
].join('\n');

/** Frasi in cui la risposta afferma di aver FATTO un'azione (inviato, prenotato, salvato...): da una chat di sola scrittura non è mai vero. */
const CLAIM = /\b(ti ho (?:mandat|inviat|spedit|salvat|prenotat|creat|aggiunt|impostat|attivat|chiamat|scritt)\w*|ho (?:mandat|inviat|spedit|salvat|prenotat|creat|aggiunt|impostat|attivat|chiamat)\w*|(?:l\'ho|li ho|le ho|lo ho) (?:mandat|inviat|salvat|prenotat|creat|aggiunt|impostat|attivat)\w*|ti sto (?:mandando|inviando)|ti (?:mando|invio) (?:subito|ora))\b/i;

/** Se la risposta dice di aver fatto qualcosa, aggiunge una correzione onesta. Ritorna anche se è scattata, per i test. */
export function guardClaims(text: string): { text: string; flagged: boolean } {
  if (!CLAIM.test(text)) return { text, flagged: false };
  return { text: `${text}\n\n**Attenzione:** in questa chat posso solo scriverti, non ho inviato né eseguito nessuna azione: quello che ho appena detto di aver fatto non è successo. Se ti serve, fallo tu dall'app.`, flagged: true };
}
