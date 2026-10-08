/**
 * Comprensione dell'italiano senza AI: date, orari, durate, titoli e riconoscimento del comando.
 * Modulo PURO (nessun import dall'app) così si prova con numeri noti. Tutto è regole e espressioni regolari:
 * non "capisce" qualsiasi frase, ma gestisce bene le richieste tipiche e, se non capisce, chiede o suggerisce.
 */
export const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const norm = (s: string) => stripAccents(s.toLowerCase()).replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDaysTo = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const fromKey = (k: string) => new Date(k + 'T00:00:00');

const wdNames = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const wdLabel = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const numWords: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12, quindici: 15, venti: 20, trenta: 30 };
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : numWords[s]);

export const dayLabel = (key: string, now: Date) => {
  const d = fromKey(key), t = dayKeyOf(now);
  if (key === t) return 'oggi';
  if (key === dayKeyOf(addDaysTo(now, 1))) return 'domani';
  if (key === dayKeyOf(addDaysTo(now, 2))) return 'dopodomani';
  return `${wdLabel[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

type Span = [number, number];
export type When = { day?: string; time?: string; endTime?: string; durationMin?: number; hint?: 'mattina' | 'pomeriggio' | 'sera'; spans: Span[] };

/** Cerca giorno, ora, durata e fascia in una frase. `spans` sono le parti del testo (normalizzato) già usate: servono per ripulire il titolo. */
export function parseWhen(raw: string, now: Date): When {
  const s = norm(raw);
  const out: When = { spans: [] };
  const mark = (m: RegExpExecArray | null) => { if (m) out.spans.push([m.index, m.index + m[0].length]); return m; };
  let m: RegExpExecArray | null;

  // ---- giorno ----
  if ((m = mark(/\bdopo ?domani\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, 2));
  else if ((m = mark(/\bdomani( sera| mattina| pomeriggio)?\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, 1));
  else if ((m = mark(/\bieri\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, -1));
  else if ((m = mark(/\b(oggi|stasera|stamattina|stamani|questa sera|questa mattina|questo pomeriggio|stanotte)\b/.exec(s)))) out.day = dayKeyOf(now);
  else if ((m = mark(/\b(?:tra|fra) (\d+|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci) (giorn[oi]|settiman[ae]|mes[ei])\b/.exec(s)))) {
    const n = num(m[1]) ?? 1; const u = m[2];
    out.day = dayKeyOf(addDaysTo(now, u.startsWith('giorn') ? n : u.startsWith('settim') ? n * 7 : n * 30));
  } else if ((m = mark(/\b(?:la )?settimana prossima\b|\bprossima settimana\b/.exec(s)))) {
    const d = (8 - now.getDay()) % 7 || 7; out.day = dayKeyOf(addDaysTo(now, d)); // lunedì prossimo
  } else if ((m = mark(/\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)( prossim[oa])?\b/.exec(s)))) {
    const target = wdNames.indexOf(m[1]);
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    out.day = dayKeyOf(addDaysTo(now, diff));
  } else if ((m = mark(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b(?![:\d])/.exec(s)))) {
    const dd = Number(m[1]), mm = Number(m[2]) - 1; let y = m[3] ? Number(m[3]) : now.getFullYear(); if (y < 100) y += 2000;
    let d = new Date(y, mm, dd);
    if (!m[3] && d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(y + 1, mm, dd);
    if (d.getMonth() === mm) out.day = dayKeyOf(d);
  } else if ((m = mark(new RegExp(`\\b(\\d{1,2}) (${monthNames.join('|')}|${monthNames.map((x) => x.slice(0, 3)).join('|')})\\b`).exec(s)))) {
    const mm = monthNames.findIndex((x) => x === m![2] || x.slice(0, 3) === m![2]); const dd = Number(m[1]);
    let d = new Date(now.getFullYear(), mm, dd);
    if (d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(now.getFullYear() + 1, mm, dd);
    out.day = dayKeyOf(d);
  } else if ((m = mark(/\bil (\d{1,2})\b(?! ?[:.]\d)/.exec(s)))) {
    const dd = Number(m[1]);
    if (dd >= 1 && dd <= 31) {
      let d = new Date(now.getFullYear(), now.getMonth(), dd);
      if (d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(now.getFullYear(), now.getMonth() + 1, dd);
      out.day = dayKeyOf(d);
    }
  }

  // ---- fascia ----
  const hintM = /\b(mattina|mattino|stamattina|stamani)\b/.exec(s) ? 'mattina' : /\b(pomeriggio)\b/.exec(s) ? 'pomeriggio' : /\b(sera|stasera|notte)\b/.exec(s) ? 'sera' : undefined;
  if (hintM) out.hint = hintM;

  // ---- ora o intervallo ----
  const toTime = (h: number, mi: number, extra: string) => {
    let hh = h;
    if (/\bpomeriggio\b|\bsera\b|\bstasera\b|\bnotte\b/.test(extra) && hh < 12) hh += 12;
    else if (!/\bmattina\b|\bmattino\b|\bstamattina\b/.test(extra) && hh >= 1 && hh <= 7) hh += 12;
    if (hh > 23 || mi > 59) return undefined;
    return `${pad(hh)}:${pad(mi)}`;
  };
  const range = /\bdalle? (\d{1,2})(?:[:.h](\d{2}))? (?:alle?|a) (\d{1,2})(?:[:.h](\d{2}))?\b/.exec(s);
  if (range) {
    mark(range);
    out.time = toTime(Number(range[1]), Number(range[2] ?? 0), s);
    out.endTime = toTime(Number(range[3]), Number(range[4] ?? 0), s);
    if (out.time && out.endTime) { const [a, b] = [out.time, out.endTime].map((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3))); if (b > a) out.durationMin = b - a; }
  } else if ((m = mark(/\b(?:alle|alle ore|ore|all'|verso le|per le|h) ?(\d{1,2})(?:(?:[:.h]| e )(\d{2}|mezza|un quarto|quarto))?\b/.exec(s)))) {
    let mi = 0; const frag = m[2];
    if (frag) mi = frag === 'mezza' ? 30 : frag === 'un quarto' || frag === 'quarto' ? 15 : Number(frag);
    out.time = toTime(Number(m[1]), mi, s);
  } else if ((m = mark(/\b(mezzogiorno)\b/.exec(s)))) out.time = '12:00';
  else if ((m = mark(/\b(mezzanotte)\b/.exec(s)))) out.time = '23:59';
  else if ((m = mark(/\b(\d{1,2}):(\d{2})\b/.exec(s)))) out.time = toTime(Number(m[1]), Number(m[2]), s);

  // ---- durata ----
  if (out.durationMin == null) {
    if ((m = mark(/\bper (\d+|un|una|due|tre|quattro|mezza|mezz'|un'?) ?(?:ora e mezza|ore|ora|minuti|min|h)\b/.exec(s)))) {
      const unit = /min/.test(m[0]) ? 1 : 60; const raw = m[1];
      const n = raw.startsWith('mezz') ? 0.5 : num(raw.replace("'", '')) ?? 1;
      out.durationMin = /ora e mezza/.test(m[0]) ? 90 : Math.round(n * unit);
    } else if ((m = mark(/\b(un'ora|mezz'ora|mezzora)\b/.exec(s)))) out.durationMin = /mezz/.test(m[1]) ? 30 : 60;
  }
  return out;
}

/** Rimuove dal testo originale (normalizzato) le parti già interpretate come data/ora. */
export function withoutSpans(raw: string, spans: Span[]): string {
  const s = norm(raw);
  let r = '', last = 0;
  [...spans].sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { if (a >= last) { r += s.slice(last, a) + ' '; last = b; } });
  return (r + s.slice(last)).replace(/\s+/g, ' ').trim();
}

/** Parole da togliere per ottenere il titolo di ciò che si vuole aggiungere. */
const fillers = /\b(per favore|per piacere|gentilmente|potresti|puoi|vorrei|voglio|dovresti|ti chiedo di|mi serve|devo|ricordami di|ricordami|aggiungi|aggiungimi|aggiungere|inserisci|inserire|metti|mettimi|segna|segnami|programma|pianifica|fissa|fissami|prenota|crea|creami|nuovo|nuova|un|una|uno|il|lo|la|l'|i|gli|le|al|alla|allo|ai|nel|nella|nell'|sul|sulla|sull'|piano|nel piano|nel mio piano|al mio piano|al piano|in calendario|nel calendario|sul calendario|calendario|agenda|nell'agenda|nella mia agenda|impegno|evento|appuntamento|promemoria|task|attivita|cosa da fare|nota|appunto|di|da|per|a|ad|in|con|e|che|mio|mia|miei|mie|quando|dove)\b/g;

export function extractTitle(raw: string, spans: Span[], extraStrip?: RegExp): string {
  let s = withoutSpans(raw, spans);
  if (extraStrip) s = s.replace(extraStrip, ' ');
  // tieni il testo originale (con maiuscole e accenti) delle parole rimaste
  const keepWords = s.replace(fillers, ' ').replace(/[?!.,;:"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!keepWords) return '';
  const orig = raw.split(/\s+/);
  const keep = new Set(keepWords.split(' '));
  const out = orig.filter((w) => keep.has(norm(w).replace(/[?!.,;:"]/g, ''))).join(' ').replace(/[?!.,;:"]+$/g, '').trim();
  const t = out || keepWords;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Somiglianza fra una frase e il titolo di un task/impegno (parole in comune, 0..1). */
export function similarity(query: string, title: string): number {
  const stop = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'da', 'a', 'in', 'con', 'per', 'del', 'della', 'e', 'al', 'alla', 'task', 'impegno', 'evento', 'riunione']);
  const toks = (x: string) => norm(x).replace(/[^a-z0-9' ]/g, ' ').split(' ').filter((w) => w.length > 1 && !stop.has(w));
  const q = toks(query), t = toks(title);
  if (!q.length || !t.length) return 0;
  const hit = q.filter((w) => t.some((x) => x === w || (w.length > 3 && x.startsWith(w.slice(0, 4))) || (x.length > 3 && w.startsWith(x.slice(0, 4))))).length;
  return hit / Math.max(q.length, t.length) * 0.5 + hit / q.length * 0.5;
}

export function bestMatch<T>(query: string, items: T[], title: (x: T) => string, min = 0.34): T | null {
  let best: T | null = null, bs = 0;
  items.forEach((x) => { const sc = similarity(query, title(x)); if (sc > bs) { bs = sc; best = x; } });
  return bs >= min ? best : null;
}

export const isYes = (s: string) => /^(si|sì|ok|va bene|certo|confermo|conferma|esatto|perfetto|yes|d'accordo|procedi|fai pure|fallo)\b/.test(norm(s));
export const isNo = (s: string) => /^(no|non|niente|lascia stare|lascia perdere|annulla|stop|basta|cancel)\b/.test(norm(s));

/** "scegli tu", "decidi tu", "quando è più comodo": l'utente lascia la scelta all'algoritmo. */
export const isDelegate = (s: string) => /\b(scegli tu|decidi tu|scegli pure|scegli il momento|quando vuoi|quando preferisci|come preferisci|come vuoi|fai tu|a tua scelta|qualsiasi (ora|giorno|momento)|va bene (qualsiasi|tutto)|il prima possibile|prima possibile|quando (e|è) piu comodo|quando mi e piu comodo|secondo te|l'orario migliore|il momento migliore|dove vuoi)\b/.test(norm(s));

export type Intent =
  | 'undo' | 'event.add' | 'event.move' | 'event.delete' | 'event.rename' | 'agenda.show' | 'agenda.free' | 'agenda.share'
  | 'task.add' | 'task.done' | 'task.delete' | 'task.rename' | 'task.list' | 'note.add' | 'goal.add'
  | 'mood.log' | 'mood.analysis' | 'profile.photo' | 'profile.private' | 'profile.public'
  | 'finance.report' | 'health.report' | 'theme.dark' | 'theme.light' | 'hours.set' | 'notif.on' | 'notif.off' | 'open' | 'help' | 'plan.fill' | 'plan.reschedule' | 'event.recurring' | 'event.when' | 'task.due' | 'briefing' | 'task.next' | 'task.urgent' | 'event.important' | 'unknown';

const R = (s: RegExp) => s;
const rules: { intent: Intent; test: RegExp; w?: number }[] = [
  { intent: 'undo', test: R(/^(annulla|disfa|torna indietro|ripristina|annulla l'ultima|annulla tutto)\b|\bannulla (l'ultim|quello)/), w: 5 },
  { intent: 'profile.photo', test: R(/\b(cambia|modifica|imposta|aggiorna|metti|carica|nuova)\b.*\b(foto|immagine)\b.*\b(profilo|avatar)\b|\b(foto|immagine) (del )?profilo\b/), w: 5 },
  { intent: 'profile.private', test: R(/(?=.*\b(profilo|account)\b)(?=.*\bprivat[oa]\b)\b(rendi|imposta|metti|voglio|fai|settalo)\b|\bprofilo privato\b|\bnascondi (il )?(mio )?profilo\b/), w: 5 },
  { intent: 'profile.public', test: R(/(?=.*\b(profilo|account)\b)(?=.*\bpubblic[oa]\b)\b(rendi|imposta|metti|voglio|fai)\b|\bprofilo pubblico\b/), w: 5 },
  { intent: 'finance.report', test: R(/\b(analisi|situazione|report|riepilogo|resoconto|come sto|come sono messo|come vanno|quanto ho (speso|risparmiato)|dettagli)\b.*\b(finanz|spese|soldi|budget|conto|risparmi)\w*|\b(finanz\w*|spese|budget)\b.*\b(analisi|dettagliat\w*|situazione|riepilogo)\b/), w: 4 },
  { intent: 'health.report', test: R(/\b(come ho dormito|come sto di salute|riepilogo salute|analisi (della )?salute|come vanno i miei dati|come sono i miei dati)\b|\b(sonno|passi|salute)\b.*\b(oggi|ieri|settimana|analisi)\b/), w: 3 },
  { intent: 'mood.analysis', test: R(/\b(analisi|come vanno|come e|com'e|andamento|grafico)\b.*\bumore\b|\bil mio umore\b.*\b(ultimi|settimana|mese|meteo|pioggia)\b/), w: 4 },
  { intent: 'mood.log', test: R(/\b(mi sento|sono|oggi sono|oggi mi sento)\b.*\b(felice|contento|calmo|sereno|neutro|stressato|triste|arrabbiato|nervoso|stanco|giu)\b/), w: 4 },
  { intent: 'plan.reschedule', test: R(/\b(ripianifica|ripianificare|riorganizza|recupera|rimetti)\b.*\b(saltat\w+|persi\w*|non fatt\w+|sessioni|task|impegni|lavoro)\b|^ripianific\w*( tutto)?$/), w: 7 },
  { intent: 'briefing', test: R(/\b(briefing|riepilogo (della giornata|di oggi|serale|del mattino)|com'e la mia giornata|cosa mi aspetta oggi|resoconto della giornata|programma di oggi)\b|^buongiorno$|^buonasera$/), w: 6 },
  { intent: 'event.recurring', test: R(/\b(ogni|tutti i|tutte le)\s+(giorno|giorni|settimana|settimane|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/), w: 7 },
  { intent: 'event.when', test: R(/\ba che ora\b|\bquando (e|ho|c'e)\b.*\b(riunione|call|appuntamento|visita|cena|pranzo|allenamento|meeting|incontro)\b/), w: 4 },
  { intent: 'task.due', test: R(/\b(scadenza|scade|scadra)\b/), w: 4 },
  { intent: 'plan.fill', test: R(/\b(pianifica|pianificami|organizza|organizzami|riempi|riempimi|programma|programmami|sistema|sistemami)\b.*\b(tutto|il mese|questo mese|mese|la settimana|settimana|la giornata|giornata|il piano|oggi|domani)\b|^organizz\w+$|^pianific\w+$/), w: 6 },
  { intent: 'task.next', test: R(/\b(cosa|che cosa|quale|qual e|dimmi)\b.*\b(devo|dovrei|faccio|posso|conviene|fare)\b.*\b(adesso|ora|prima|subito|oggi)\b|\b(quale|prossim[oa]|piu urgente|priorita)\b.*\b(task|compito|cosa|attivita|fare)\b|\bda dove (parto|comincio|inizio)\b|^cosa (devo|faccio) fare\b/), w: 5 },
  { intent: 'task.urgent', test: R(/\b(segna|metti|imposta|rendi|marca)\b.*\b(urgent[ei])\b|\burgent[ei]\b.*\b(task|compito)\b|^urgente:/), w: 5 },
  { intent: 'event.important', test: R(/\b(segna|metti|imposta|rendi|marca)\b.*\b(important[ei])\b/), w: 5 },
  { intent: 'agenda.share', test: R(/\b(condividi|condividimi|manda|invia|mostra)\b.*\b(agenda|impegni|disponibilita|slot|calendario)\b/), w: 4 },
  { intent: 'agenda.free', test: R(/\b(quando sono libero|slot liber\w+|sono libero|ho tempo|buchi|disponibil\w+|quando posso|quando ho tempo)\b/), w: 4 },
  { intent: 'agenda.show', test: R(/\b(che|quali|cosa|quanti|mostra|dimmi|elenco|lista)\b.*\b(impegni|appuntamenti|programma|ho in agenda|agenda|piano|riunioni)\b|\b(il mio|nel) (piano|programma|calendario)\b.*\b(oggi|domani|settimana|dopodomani)\b/), w: 3 },
  { intent: 'event.move', test: R(/\b(sposta|spostare|rimanda|rimandare|anticipa|posticipa|riprogramma)(l[aoei])?\b|\bcambia (l')?(orario|giorno|data|ora)\b/), w: 4 },
  { intent: 'event.delete', test: R(/\b(cancella|elimina|togli|rimuovi|disdici|annulla)\b.*\b(impegno|evento|appuntamento|riunione|dal piano|dal calendario|dall'agenda|meeting|allenamento)\b|\b(cancella|elimina|rimuovi|disdici)(l[aoei])\b(?!.*\b(task|attivita)\b)/), w: 4 },
  { intent: 'event.rename', test: R(/\b(rinomina|cambia (il )?(nome|titolo))\b.*\b(impegno|evento|appuntamento|riunione)\b/), w: 4 },
  { intent: 'task.done', test: R(/\b(ho (fatto|finito|completato|concluso)|completa|completato|segna (come )?(fatto|completat\w+|finit\w+)|spunta|e fatto|fatto il task)\b/), w: 4 },
  { intent: 'task.delete', test: R(/\b(cancella|elimina|togli|rimuovi)\b.*\b(task|attivita|cosa da fare|to-?do)\b/), w: 4 },
  { intent: 'task.rename', test: R(/\b(rinomina|cambia (il )?(nome|titolo))\b.*\b(task|attivita)\b/), w: 4 },
  { intent: 'task.list', test: R(/\b(quali|che|mostra|elenco|lista|dimmi|quanti)\b.*\b(task|attivita|cose da fare|to-?do)\b/), w: 3 },
  { intent: 'task.add', test: R(/\b(aggiungi|aggiungimi|crea|creami|nuovo|nuova|metti|segna|inserisci)\b.*\b(task|attivita|cosa da fare|to-?do)\b|\b(task|attivita)\b.*\b(nuov[oa]|da aggiungere)\b|^(devo|bisogna|ricordami di|ricordati di)\b/), w: 3 },
  { intent: 'note.add', test: R(/\b(scrivi|crea|salva|aggiungi|prendi|annota)\b.*\b(nota|appunto|memo)\b|^nota:/), w: 4 },
  { intent: 'goal.add', test: R(/\b(nuovo obiettivo|aggiungi (un )?obiettivo|crea (un )?obiettivo|imposta (un )?obiettivo)\b/), w: 4 },
  { intent: 'event.add', test: R(/\b(metti|mettimi|inserisci|segna|segnami|fissa|fissami|aggiungi|prenota)\b.*\b(oggi|domani|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b.*\b(alle|ore|a)\b\s*\d|\b(metti|mettimi|inserisci|segna|segnami|fissa|fissami)\b.*\b(alle|ore)\b\s*\d/), w: 3 },
  { intent: 'event.add', test: R(/\b(aggiungi|aggiungimi|metti|mettimi|inserisci|segna|segnami|programma|pianifica|fissa|fissami|prenota|crea|creami|organizza)\b.*\b(piano|calendario|agenda|impegno|evento|appuntamento|riunione|meeting|call|allenamento|visita|cena|pranzo)\b|\b(riunione|meeting|call|appuntamento|visita|cena|pranzo|allenamento)\b.*\b(domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|alle|ore)\b|\bnel mio piano\b|\bal piano\b/), w: 3 },
  { intent: 'theme.dark', test: R(/\b(modalita|tema)\b.*\b(scur[oa]|dark|notte)\b|\bmetti (il )?(tema )?scuro\b/), w: 4 },
  { intent: 'theme.light', test: R(/\b(modalita|tema)\b.*\b(chiar[oa]|light|giorno)\b|\bmetti (il )?(tema )?chiaro\b/), w: 4 },
  { intent: 'hours.set', test: R(/\b(orario|orari) di lavoro\b|\blavoro dalle\b/), w: 4 },
  { intent: 'notif.on', test: R(/\b(attiva|abilita|accendi)\b.*\bnotific\w+/), w: 4 },
  { intent: 'notif.off', test: R(/\b(disattiva|spegni|blocca)\b.*\bnotific\w+/), w: 4 },
  { intent: 'open', test: R(/^(apri|vai a|vai su|portami (a|in|su)|mostrami)\b/), w: 2 },
  { intent: 'help', test: R(/\b(aiuto|cosa sai fare|cosa puoi fare|che cosa fai|comandi|esempi|come funzioni)\b/), w: 2 },
];

/** Sceglie l'intento con il punteggio più alto (a parità vince la regola più specifica, cioè più in alto nell'elenco). */
export function detectIntent(raw: string): Intent {
  const s = norm(raw);
  let best: Intent = 'unknown', bw = 0;
  for (const r of rules) if (r.test.test(s) && (r.w ?? 1) > bw) { best = r.intent; bw = r.w ?? 1; }
  return best;
}

export const pageNames: Record<string, string> = {
  home: 'home', dashboard: 'home', piano: 'plan', plan: 'plan', calendario: 'plan', task: 'lifetask', note: 'lifenotes', drive: 'lifedrive', salute: 'lifehealth', finanze: 'lifefinance', finanza: 'lifefinance',
  viaggi: 'lifetravel', network: 'lifenetwork', lavoro: 'lifenetwork', community: 'lifenetwork', profilo: 'profile', impostazioni: 'settings', umore: 'mood', messaggi: 'messagesPage', notifiche: 'notificationsPage', lifepoints: 'lifepointsPage', azioni: 'stocks', portafoglio: 'portfolio', tasse: 'taxdecl', fiscale: 'taxdecl', previsioni: 'lifeforecast', chat: 'ai',
};

export const topicKeywords: Record<string, string[]> = {
  Finanze: ['soldi', 'budget', 'spese', 'spesa', 'risparmio', 'risparmi', 'banca', 'conto', 'investimento', 'investire', 'bolletta', 'bollette', 'stipendio', 'tasse', 'fiscale', 'finanze', 'finanza', 'azioni', 'mutuo', 'cassa malati', 'entrate', 'uscite'],
  Salute: ['salute', 'medico', 'dottore', 'sonno', 'dormire', 'dormito', 'dolore', 'visita', 'farmaco', 'analisi', 'sintomo', 'battito', 'passi', 'peso', 'dieta', 'hrv'],
  Fitness: ['allenamento', 'palestra', 'corsa', 'correre', 'muscoli', 'workout', 'sport', 'yoga', 'nuoto', 'bici'],
  Mente: ['umore', 'ansia', 'stress', 'meditazione', 'mindfulness', 'emozioni', 'mente', 'triste', 'felice', 'stressato'],
  Lavoro: ['lavoro', 'azienda', 'cliente', 'clienti', 'vendite', 'meeting', 'riunione', 'fatturato', 'investitori', 'marketing', 'startup', 'soci', 'colloquio', 'candidati', 'progetto'],
  Studio: ['studio', 'esame', 'tedesco', 'lezione', 'corso', 'libro', 'universita', 'imparare', 'inglese', 'francese', 'lingua'],
  Viaggi: ['viaggio', 'volo', 'hotel', 'vacanza', 'aeroporto', 'valigia', 'itinerario', 'destinazione'],
  Casa: ['casa', 'affitto', 'trasloco', 'pulizie', 'mobili', 'elettricista', 'bollette'],
  Legale: ['contratto', 'avvocato', 'causa', 'legale', 'diritto', 'firma', 'privacy'],
  Musica: ['musica', 'canzone', 'canzoni', 'chitarra', 'piano', 'concerto', 'album', 'spotify', 'playlist', 'cantare', 'band', 'traccia', 'suonare', 'beat'],
  Arte: ['arte', 'disegno', 'disegnare', 'pittura', 'dipingere', 'museo', 'mostra', 'fotografia', 'scultura', 'design', 'illustrazione', 'quadro'],
  Cucina: ['cucina', 'ricetta', 'ricette', 'cucinare', 'cena', 'pranzo', 'ingredienti', 'dolce', 'pasta', 'forno'],
  Cinema: ['film', 'serie', 'cinema', 'netflix', 'regista', 'attore', 'documentario'],
  Tecnologia: ['codice', 'programmare', 'app', 'software', 'computer', 'telefono', 'internet', 'ai', 'intelligenza artificiale', 'server'],
  Piano: ['piano', 'agenda', 'calendario', 'impegni', 'impegno', 'appuntamento', 'task', 'obiettivo', 'obiettivi', 'scadenza'],
};

/** Argomento di una frase per parole chiave (null se nessuna). */
export function topicOf(raw: string): string | null {
  const s = ' ' + norm(raw).replace(/[^a-z0-9' ]/g, ' ') + ' ';
  let best: string | null = null, bs = 0;
  for (const [t, ws] of Object.entries(topicKeywords)) {
    const sc = ws.reduce((a, w) => a + (s.includes(' ' + norm(w) + ' ') || (w.length > 4 && s.includes(' ' + norm(w))) ? 1 : 0), 0);
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}
