/** Legale e conformità (modulo PURO, nessun alias '@/'): lettura di un contratto (clausole, scadenze, rinnovi, penali, rischi), scadenziario di adempimenti,
 *  conservazione dei dati e modelli di lettera. Non è consulenza legale: dà un primo controllo in parole semplici. */
export type Country = 'IT' | 'CH';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s: string, n: number) => { const d = new Date(s + 'T12:00:00'); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);

const MONTHS: Record<string, number> = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12, januar: 1, februar: 2, marz: 3, mai: 5, juni: 6, juli: 7, oktober: 10, dezember: 12 };
export function datesOf(text: string): { iso: string; at: number }[] {
  const out: { iso: string; at: number }[] = []; const t = norm(text);
  const ok = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?!\d)/g)) if (ok(+m[3]!, +m[2]!, +m[1]!)) out.push({ iso: `${m[3]}-${pad(+m[2]!)}-${pad(+m[1]!)}`, at: m.index! });
  for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) if (ok(+m[1]!, +m[2]!, +m[3]!)) out.push({ iso: m[0], at: m.index! });
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})(?:\.|º|°)?\s+(?:di\s+)?([a-z]+)\s+(\d{4})(?!\d)/g)) { const mo = MONTHS[m[2]!]; if (mo && ok(+m[3]!, mo, +m[1]!)) out.push({ iso: `${m[3]}-${pad(mo)}-${pad(+m[1]!)}`, at: m.index! }); }
  return out.sort((a, b) => a.at - b.at);
}
const dateNear = (text: string, re: RegExp): string | undefined => {
  const t = norm(text); const m = re.exec(t); if (!m) return undefined;
  const from = m.index; const ds = datesOf(text).filter((d) => d.at >= from - 4 && d.at <= from + m[0].length + 60);
  return ds[0]?.iso;
};
const num = (s: string) => parseInt(s, 10);
const WORDS: Record<string, number> = { uno: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12, quindici: 15, venti: 20, trenta: 30, quaranta: 40, sessanta: 60, novanta: 90 };
const qty = (s: string) => (/^\d+$/.test(s) ? num(s) : WORDS[s] ?? NaN);
const spanDays = (n: number, unit: string) => (/^giorn|^day|^tag/.test(unit) ? n : /^settiman|^week|^woche/.test(unit) ? n * 7 : /^mes|^month|^monat/.test(unit) ? n * 30 : n * 365);

export type Risk = { level: 'alto' | 'medio' | 'info'; title: string; why: string };
export type ContractRead = { title: string; start?: string; end?: string; months?: number; autoRenew: boolean; noticeDays?: number; cancelBy?: string; paymentDays?: number; penalties: string[]; clauses: string[]; risks: Risk[]; amount?: number };

const CLAUSES: [RegExp, string][] = [
  [/esclusiv/, 'Esclusiva'], [/non concorrenza|patto di non concorrenza|konkurrenzverbot/, 'Non concorrenza'], [/riservatezza|confidenzialit|segreto|geheimhaltung|vertraulich/, 'Riservatezza'],
  [/foro competente|foro esclusivo|gerichtsstand/, 'Foro competente'], [/limitazione di responsabilita|esclusione di responsabilita|haftungsausschluss/, 'Limite di responsabilità'],
  [/recesso|recedere|kundigung/, 'Recesso'], [/subappalt|sub-?appalto|subcontract/, 'Subappalto'], [/cessione del contratto|cessione dei crediti|cedere il contratto/, 'Cessione'],
  [/proprieta intellettuale|diritti d'autore|diritto d'autore|urheberrecht/, 'Proprietà intellettuale'], [/trattamento dei dati|protezione dei dati|gdpr|privacy|datenschutz|\blpd\b/, 'Dati personali'],
  [/clausola risolutiva|risoluzione di diritto|risoluzione del contratto/, 'Risoluzione'], [/fideiussione|garanzia bancaria|caparra/, 'Garanzie e caparra'],
];

export function readContract(name: string, text: string, today: string): ContractRead {
  const t = norm(text); const risks: Risk[] = []; const clauses = CLAUSES.filter(([re]) => re.test(t)).map(([, l]) => l);
  const title = (name || '').replace(/\.[a-z0-9]{2,4}$/i, '').trim() || (text.split(/\n/).find((l) => l.trim().length > 3) ?? 'Contratto').trim().slice(0, 80);
  let start = dateNear(text, /decorrenza|a decorrere dal|a partire dal|data di inizio|ha inizio|inizia il|entra in vigore|vigore dal|beginn|ab dem/);
  let end = dateNear(text, /scadenza (?:il|del|:)|scade il|termina il|fino al|sino al|avra termine|valido fino|gultig bis|befristet bis|bis zum/);
  const dm = /(?:durata|per un periodo|periodo di|dauer|laufzeit)[^.\n]{0,40}?(\d+|un|due|tre|sei|dodici)\s*(mesi|mese|anni|anno|monat\w*|jahr\w*|months?|years?)/.exec(t);
  let months: number | undefined;
  if (dm) { const n = qty(dm[1]!); if (!Number.isNaN(n)) months = /^(mes|monat|month)/.test(dm[2]!) ? n : n * 12; }
  if (!end && start && months) end = addMonths(start, months);
  if (!months && start && end) months = Math.round(daysBetween(start, end) / 30.4);
  const autoRenew = /tacit\w* rinnov|rinnov\w* (?:tacit|automatic)|si rinnova (?:automaticamente|tacitamente)|rinnovo automatico|stillschweigend|verlangert sich automatisch|auto-?renew/.test(t);
  let noticeDays: number | undefined;
  const nm = /(?:preavviso|disdetta|recesso|kundigungsfrist|notice)[^.\n]{0,60}?(?:di|entro|of|von)?\s*(\d+|un|uno|due|tre|sei|quindici|trenta|sessanta|novanta)\s*(giorni|giorno|settimane|settimana|mesi|mese|anni|anno|tage\w*|wochen?|monat\w*|days?|weeks?|months?)/.exec(t);
  if (nm) { const n = qty(nm[1]!); if (!Number.isNaN(n)) noticeDays = spanDays(n, nm[2]!); }
  let paymentDays: number | undefined;
  const pm = /(?:pagamento|pagare|pagabil\w*|fatture?|zahlbar|payment)[^.\n]{0,60}?(?:entro|a|within|innerhalb)\s*(\d+|trenta|sessanta|novanta)\s*(?:giorni|gg|days|tage)/.exec(t);
  if (pm) { const n = qty(pm[1]!); if (!Number.isNaN(n)) paymentDays = n; }
  const amount = (() => { const m = /(?:corrispettivo|compenso|canone|importo|prezzo|honorar|betrag)[^.\n]{0,40}?(?:chf|eur|euro|€|fr\.)?\s*(\d[\d.' ]*(?:,\d{2})?)\s*(?:chf|eur|euro|€|fr\.)?/.exec(t); if (!m) return undefined; const v = parseFloat(m[1]!.replace(/[.' ]/g, '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : undefined; })();
  const penalties = text.split(/(?<=[.;])\s+|\n/).map((s) => s.trim()).filter((s) => /penal[ei]|risarcimento|interessi di mora|konventionalstrafe|vertragsstrafe|penalty/.test(norm(s))).map((s) => s.slice(0, 220)).slice(0, 5);
  const cancelBy = end && noticeDays != null ? addDays(end, -noticeDays) : undefined;

  if (autoRenew) risks.push(noticeDays != null
    ? { level: 'alto', title: 'Si rinnova da solo', why: `Se non disdici in tempo il contratto riparte${cancelBy ? `: l'ultimo giorno utile per scrivere è ${cancelBy}` : ''}.` }
    : { level: 'alto', title: 'Si rinnova da solo e non trovo il preavviso', why: 'Controlla entro quanti giorni devi disdire: se lo perdi, il contratto riparte.' });
  if (noticeDays != null && noticeDays >= 90) risks.push({ level: 'medio', title: 'Preavviso lungo', why: `Devi avvisare ${Math.round(noticeDays / 30)} mesi prima: segnati la data.` });
  if (penalties.length) risks.push({ level: 'alto', title: 'Ci sono penali o risarcimenti', why: 'Se non rispetti le condizioni puoi dover pagare. Leggi bene quando scattano e quanto costano.' });
  if (/esclusiv/.test(t)) risks.push({ level: 'medio', title: 'Esclusiva', why: 'Potresti non poter lavorare con altri su questo tema o in questa zona.' });
  if (/non concorrenza|konkurrenzverbot/.test(t)) risks.push({ level: 'medio', title: 'Non concorrenza', why: 'Dopo la fine potresti non poter fare certe attività: controlla durata e zona.' });
  if (/modific\w* unilateral|unilateralmente|a proprio insindacabile giudizio|einseitig/.test(t)) risks.push({ level: 'alto', title: 'Una parte può cambiare le condizioni da sola', why: 'L\'altra parte potrebbe modificare prezzo o condizioni senza il tuo consenso.' });
  if (/limitazione di responsabilita|esclusione di responsabilita|haftungsausschluss/.test(t)) risks.push({ level: 'medio', title: 'Limite di responsabilità', why: 'Se qualcosa va storto, il risarcimento può essere limitato.' });
  if (/foro competente|foro esclusivo|gerichtsstand/.test(t)) risks.push({ level: 'info', title: 'Foro competente', why: 'Controlla in quale città si farebbe una causa: può essere lontana o all\'estero.' });
  if (paymentDays != null && paymentDays > 60) risks.push({ level: 'medio', title: 'Pagamento a tempi lunghi', why: `Si paga a ${paymentDays} giorni: controlla che la cassa regga.` });
  if (!end && !months && !autoRenew) risks.push({ level: 'info', title: 'Non trovo la scadenza', why: 'Non vedo una data di fine né una durata: controlla se è a tempo indeterminato.' });
  if (end && end < today) risks.push({ level: 'medio', title: 'È già scaduto', why: `La data di fine (${end}) è passata${autoRenew ? ', ma potrebbe essersi rinnovato' : ''}.` });
  const order = { alto: 0, medio: 1, info: 2 };
  risks.sort((a, b) => order[a.level] - order[b.level]);
  return { title, start, end, months, autoRenew, noticeDays, cancelBy, paymentDays, penalties, clauses, risks, amount };
}

/** Le date da mettere nel Plan: l'ultimo giorno per disdire (con un promemoria 14 giorni prima) e la fine del contratto. */
export function contractDeadlines(c: Pick<ContractRead, 'title' | 'end' | 'cancelBy' | 'autoRenew'>, today: string): { day: string; title: string }[] {
  const out: { day: string; title: string }[] = [];
  if (c.cancelBy) { const warn = addDays(c.cancelBy, -14); if (warn >= today) out.push({ day: warn, title: `Tra 14 giorni scade il termine per disdire: ${c.title}` }); if (c.cancelBy >= today) out.push({ day: c.cancelBy, title: `Ultimo giorno per disdire: ${c.title}` }); }
  if (c.end && c.end >= today) out.push({ day: c.end, title: `${c.autoRenew ? 'Rinnovo' : 'Scade'}: ${c.title}` });
  return out;
}
export const contractState = (c: { end?: string | null; cancelBy?: string | null }, today: string): 'scaduto' | 'disdetta vicina' | 'in scadenza' | 'ok' => {
  if (c.end && c.end < today) return 'scaduto';
  if (c.cancelBy && c.cancelBy >= today && daysBetween(today, c.cancelBy) <= 30) return 'disdetta vicina';
  if (c.end && daysBetween(today, c.end) <= 60) return 'in scadenza';
  return 'ok';
};

/* ---------- scadenziario degli adempimenti ---------- */
export type Obligation = { id: string; title: string; why: string; everyMonths: number; country: Country | 'ALL'; area: 'sicurezza' | 'privacy' | 'contratti' | 'lavoro' | 'fisco' };
/** Promemoria indicativi: le frequenze reali dipendono dall'azienda e dalla legge in vigore, da far confermare a un professionista. */
export const OBLIGATIONS: Obligation[] = [
  { id: 'ropa', title: 'Registro dei trattamenti: revisione', why: 'Il registro dei trattamenti dei dati personali va tenuto aggiornato (GDPR in Italia, LPD in Svizzera).', everyMonths: 12, country: 'ALL', area: 'privacy' },
  { id: 'privacy-info', title: 'Informativa privacy: controllo', why: 'Controlla che l\'informativa dica ancora la verità su cosa raccogli e per quanto.', everyMonths: 12, country: 'ALL', area: 'privacy' },
  { id: 'breach', title: 'Prova della procedura di violazione dati', why: 'Sapere chi avvisa chi, e in quanto tempo, se si perdono dati personali.', everyMonths: 12, country: 'ALL', area: 'privacy' },
  { id: 'dvr', title: 'Valutazione dei rischi sul lavoro: revisione', why: 'Il documento sui rischi va rivisto quando cambia l\'organizzazione e periodicamente.', everyMonths: 12, country: 'IT', area: 'sicurezza' },
  { id: 'estintori', title: 'Controllo estintori e uscite di sicurezza', why: 'Verifica periodica di estintori, luci di emergenza e vie di fuga.', everyMonths: 6, country: 'ALL', area: 'sicurezza' },
  { id: 'primo-soccorso', title: 'Cassetta di primo soccorso: controllo', why: 'Controlla contenuto e scadenze dei materiali.', everyMonths: 6, country: 'ALL', area: 'sicurezza' },
  { id: 'formazione', title: 'Formazione sicurezza: aggiornamento', why: 'La formazione sulla sicurezza si aggiorna ogni qualche anno: controlla chi è in scadenza.', everyMonths: 60, country: 'IT', area: 'sicurezza' },
  { id: 'suva', title: 'Sicurezza sul lavoro: controllo con la tua assicurazione infortuni', why: 'In Svizzera la sicurezza si segue con l\'assicuratore infortuni (es. SUVA): verifica i requisiti.', everyMonths: 12, country: 'CH', area: 'sicurezza' },
  { id: 'contratti', title: 'Revisione dei contratti in corso', why: 'Guarda quali contratti si rinnovano da soli e quali conviene rinegoziare.', everyMonths: 6, country: 'ALL', area: 'contratti' },
  { id: 'assicurazioni', title: 'Polizze assicurative: controllo', why: 'Controlla scadenze e massimali delle polizze dell\'azienda.', everyMonths: 12, country: 'ALL', area: 'contratti' },
  { id: 'durc', title: 'DURC e regolarità contributiva', why: 'Serve per appalti e pagamenti pubblici: controlla la validità.', everyMonths: 4, country: 'IT', area: 'lavoro' },
  { id: 'ferie', title: 'Ferie residue del personale', why: 'Controlla che le ferie maturate vengano godute nei tempi previsti.', everyMonths: 12, country: 'ALL', area: 'lavoro' },
  { id: 'fisco', title: 'Scadenze fiscali dell\'anno', why: 'Rivedi con il commercialista le scadenze fiscali e contributive.', everyMonths: 12, country: 'ALL', area: 'fisco' },
];
export type Check = { obl: string; last: string | null; team?: string };
export const nextDue = (last: string | null, everyMonths: number, today: string): string => (last ? addMonths(last, everyMonths) : today);
export function dueRows(list: Obligation[], done: Record<string, string>, today: string, country: Country | null) {
  return list.filter((o) => o.country === 'ALL' || !country || o.country === country).map((o) => {
    const last = done[o.id] ?? null; const due = nextDue(last, o.everyMonths, today);
    const state: 'scaduto' | 'presto' | 'ok' | 'da fare' = !last ? 'da fare' : due < today ? 'scaduto' : daysBetween(today, due) <= 30 ? 'presto' : 'ok';
    return { o, last, due, state };
  }).sort((a, b) => ({ scaduto: 0, 'da fare': 1, presto: 2, ok: 3 }[a.state] - { scaduto: 0, 'da fare': 1, presto: 2, ok: 3 }[b.state]) || a.due.localeCompare(b.due));
}

/* ---------- cosa conservo e per quanto ---------- */
export type Processing = { id: string; what: string; why: string; where: string; years: number; who: string; country: Country | 'ALL' };
/** Esempi di partenza, con tempi indicativi: da confermare con un professionista. */
export const PROCESSING_STARTERS: Processing[] = [
  { id: 'fatture', what: 'Fatture e contabilità', why: 'Obblighi contabili e fiscali', where: 'Documenti · Pagamenti', years: 10, who: 'Amministrazione', country: 'ALL' },
  { id: 'contratti', what: 'Contratti con clienti e fornitori', why: 'Esecuzione del contratto e prove', where: 'Documenti · Contratti', years: 10, who: 'Legale', country: 'ALL' },
  { id: 'buste', what: 'Buste paga e dati del personale', why: 'Gestione del rapporto di lavoro', where: 'Documenti · Buste paga', years: 10, who: 'Risorse umane', country: 'ALL' },
  { id: 'cv', what: 'Curriculum dei candidati non assunti', why: 'Selezione del personale', where: 'Candidati', years: 1, who: 'Risorse umane', country: 'ALL' },
  { id: 'clienti', what: 'Contatti dei clienti (CRM)', why: 'Rapporto commerciale', where: 'Clienti', years: 5, who: 'Commerciale', country: 'ALL' },
  { id: 'riunioni', what: 'Trascrizioni delle riunioni', why: 'Verbali e cose da fare', where: 'Riunioni', years: 1, who: 'Tutti', country: 'ALL' },
];
export const keepUntil = (created: string, years: number) => addMonths(created, Math.round(years * 12));
export const retentionDue = (p: { years: number }, created: string, today: string) => keepUntil(created, p.years) <= today;

/* ---------- modelli di lettera ---------- */
export type Letter = { id: string; name: string; fields: { k: string; label: string; ph?: string }[]; body: string };
export const LETTERS: Letter[] = [
  { id: 'sollecito', name: 'Sollecito di pagamento', fields: [{ k: 'cliente', label: 'Cliente' }, { k: 'fattura', label: 'Fattura n.' }, { k: 'importo', label: 'Importo' }, { k: 'scadenza', label: 'Scaduta il', ph: 'gg/mm/aaaa' }, { k: 'entro', label: 'Pagare entro', ph: 'gg/mm/aaaa' }, { k: 'firma', label: 'Firma' }],
    body: 'Gentile {cliente},\n\nci risulta ancora aperta la fattura n. {fattura} di {importo}, scaduta il {scadenza}.\n\nLa preghiamo di provvedere al pagamento entro il {entro}. Se ha già pagato, ci scusi e consideri valida questa lettera solo come promemoria.\n\nCordiali saluti,\n{firma}' },
  { id: 'disdetta', name: 'Disdetta di un contratto', fields: [{ k: 'controparte', label: 'Controparte' }, { k: 'contratto', label: 'Contratto' }, { k: 'data', label: 'Data del contratto', ph: 'gg/mm/aaaa' }, { k: 'fine', label: 'Da quando vale', ph: 'gg/mm/aaaa' }, { k: 'firma', label: 'Firma' }],
    body: 'Spett.le {controparte},\n\ncon la presente comunichiamo la disdetta del contratto «{contratto}» del {data}, con effetto dal {fine}, nel rispetto del preavviso previsto.\n\nVi chiediamo di confermarne la ricezione.\n\nDistinti saluti,\n{firma}\n\n(Consigliato l\'invio con raccomandata o PEC.)' },
  { id: 'accesso', name: 'Risposta a una richiesta di accesso ai dati', fields: [{ k: 'nome', label: 'Nome di chi chiede' }, { k: 'data', label: 'Data della richiesta', ph: 'gg/mm/aaaa' }, { k: 'firma', label: 'Firma' }],
    body: 'Gentile {nome},\n\nabbiamo ricevuto il {data} la sua richiesta di accesso ai dati personali che la riguardano. Le alleghiamo copia dei dati che trattiamo, le finalità, i tempi di conservazione e i destinatari.\n\nPuò chiederci in ogni momento di correggerli o cancellarli, se non c\'è un obbligo di legge che ce lo impedisce.\n\nCordiali saluti,\n{firma}' },
  { id: 'cancellazione', name: 'Conferma di cancellazione dei dati', fields: [{ k: 'nome', label: 'Nome di chi chiede' }, { k: 'data', label: 'Data della richiesta', ph: 'gg/mm/aaaa' }, { k: 'firma', label: 'Firma' }],
    body: 'Gentile {nome},\n\nin risposta alla sua richiesta del {data}, abbiamo cancellato i suoi dati personali dai nostri sistemi. Restano solo quelli che dobbiamo conservare per legge (ad esempio fatture), per il tempo previsto.\n\nCordiali saluti,\n{firma}' },
  { id: 'recesso-fornitore', name: 'Richiesta di preventivo o chiarimenti', fields: [{ k: 'destinatario', label: 'Destinatario' }, { k: 'oggetto', label: 'Oggetto' }, { k: 'entro', label: 'Risposta entro', ph: 'gg/mm/aaaa' }, { k: 'firma', label: 'Firma' }],
    body: 'Gentile {destinatario},\n\nvorremmo ricevere chiarimenti e un preventivo scritto riguardo a: {oggetto}.\n\nLe saremmo grati di una risposta entro il {entro}.\n\nCordiali saluti,\n{firma}' },
];
export const fillLetter = (l: Letter, v: Record<string, string>) => l.body.replace(/\{(\w+)\}/g, (_, k: string) => (v[k] ?? '').trim() || `[${l.fields.find((f) => f.k === k)?.label ?? k}]`);
export const missingFields = (l: Letter, v: Record<string, string>) => l.fields.filter((f) => !(v[f.k] ?? '').trim()).map((f) => f.label);
