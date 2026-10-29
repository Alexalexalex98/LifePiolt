import { askLocal } from '@/lib/theia/ask';
import { askFree, askFreeOffline, looksLikeDataQuestion, type FreeResult } from '@/lib/theia/free';
import { collectSnap } from '@/lib/theia/collect';
import { Linking } from 'react-native';
import { handleAppAction } from './appActions';
import { GOOD_ENOUGH, PLACE_CATEGORIES, detectPlace, planPlaceSearch, type PlaceRequest } from '@/lib/findPlace';
import { matchPhrase } from './phrases';
import { matchFaq, type Faq } from '@/lib/helpFaq';
import { PAGES, findAmount, findPerson, norm } from './appActionCore';
import { NOT_A_SEARCH } from './dictionary';
import { peoplePool } from '@/lib/network';
import { useApp } from '@/store/app';
import { domainsIn } from './dictionary';
import { useNet } from '@/store/network';
import { helpAnswer, looksLikeHelp, searchHelp } from '@/lib/helpKb';
import { routeRequest, type RouteResult } from '@/lib/aiRouter';
import { aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import * as aiServer from '@/lib/aiServer';
import { askSend, askSendRouted, logSend } from '@/lib/aiConsent';
import { askTheiaChat, askTheiaChatStream, askTheiaFiles } from '@/lib/theia';
import { filterActions, liveParts, parseAiActions, splitReply } from './aiActionsCore';
import { pdfToText } from '@/lib/pdfText';
import { readUriBytes } from '@/lib/readUri';
import { cleanAiOutline, fallbackOutline, parseProjectRequest, projectPrompt, withRoot } from '@/lib/assistant/projectCore';
import { parseOutline, buildTree } from '@/lib/projectTree';
import { useProjects } from '@/store/projects';
import { CRISIS_RESOURCES, CRISIS_TEXT, detectCrisis } from '@/lib/safety';
import { runWb, startQuestionnaire } from './wellbeingFlow';
import { looksLikeMemo, parseMemo, dayStr, timeStr } from '@/lib/memo';
import { isLearnable, recall } from '@/lib/theiaMemory';
import { useTheiaMemory } from '@/store/theiaMemory';
import { applyAiAction, describe } from './aiActions';
import { describeAnalysis, isBillType } from '@/lib/docAnalysis';
import { statementSummary } from '@/lib/statementReport';
import { useFin } from '@/store/finance';
import { refreshBillReminders } from '@/lib/bills/schedule';
import { openBillReview } from '@/components/theia/billRoute';
import { BILL_FOLDER } from '@/lib/bills/files';
import { useLife } from '@/store/life';
import { useAiRouter } from '@/store/aiRouter';
import { saveMediaToDrive } from '@/lib/driveSave';
import { weekdayShortDate } from '@/lib/format';
import { fmtBytes, needsAnalysis, textPayload, type Att } from '@/lib/attachments';
import { isCancel, isNo, isYes } from './appActionCore';
import { t } from '@/i18n/core';
import { understand } from '@/lib/langLexicon';
import { go } from '@/lib/nav';
import { formatMoney } from '@/i18n/format';
import { fillTarget, generalize, looksLikeCommand, matchLearned } from './learned';
import { findFixed, parseFixedEdit } from './financeEdit';
import { friendlyAiError, isAddFollowUp, taskCommand, todoSubject } from './followup';
import { useLearned } from '@/store/learned';
import { shareLearned, voteSharedCommand } from '@/social/sharedCommands';
import { handleFood } from '@/lib/assistant/foodTheia';
import { deliverPlans, takePlans } from '@/lib/assistant/planDelivery';
import { NUTRITIONIST_TALK, looksLikeDietPlan } from '@/lib/fitness/planPdf';
import { mealPlanTalk } from '@/lib/fitness/aiPlan';
import { SHIFT_TALK, shiftsSummary } from '@/lib/shiftsImport';
import { readShiftsFile } from '@/lib/shiftsImportRun';
import { useShifts } from '@/store/shifts';
import { workoutTalk } from '@/lib/fitness/aiWorkout';
import { importPlanPdf } from '@/lib/fitness/planPdfRun';
import { offerFor, routeAs, routePhotos } from '@/lib/assistant/photoRouting';
import { usePantry } from '@/store/pantry';
import { useFitness } from '@/store/fitness';
import { FOOD, macrosFor, sumMacros } from '@/lib/fitness/nutrition';
import { mealTitle } from '@/lib/fitness/mealInsights';
import { useAssistant, type AMsg } from '@/store/assistant';
import { usePrefs } from '@/store/prefs';
import { topicOf } from './nlp';
import { getAssistant } from './run';
import { styleText } from './style';
import type { ExtImage, TheiaAction, TheiaExt } from './theiaExt';

/**
 * Ingresso unico di Theia (testo, voce, immagini, 12 lingue). Ordine di elaborazione:
 *  1) lessico locale (understand) -> assistente locale: comandi semplici, analisi, tutto offline
 *  2) se non capisce: chiede un chiarimento con 2-4 opzioni cliccabili (nessuna AI esterna)
 *  3) solo se serve davvero (immagini, testo libero) e l'utente conferma -> routeRequest (che applica "Solo sul telefono", limiti e consenso privacy)
 */
export type SendInput = {
  text: string;
  /** lingua del messaggio (scelta al volo o lingua dell'app) */
  lang: string;
  appLang: string;
  /** l'utente ha scelto la lingua del messaggio: non si rileva */
  forced: boolean;
  source: 'typed' | 'voice';
  images?: ExtImage[];
  /** allegati non-immagine (documenti, testo, posizione, contatto, nota, impegno) */
  attachments?: Att[];
  topic?: string;
  /** audio registrato che non si può trascrivere: compare comunque nella chat */
  voiceNote?: { uri: string; durationMs: number };
};

/** «fammi il questionario sul benessere», «WHO-5», «PHQ-9», «test dell'umore» */
const WB_ASK = /\b(who-?5|phq-?9|questionario (del |sul |di |sullo )?(benessere|umore|stato d'animo)|test (del |dell'|sull')?\s?(umore|depressione|benessere))\b/i;

/** Comandi sul cibo che restano locali (lista della spesa, frigo, avvisi): non vanno all'AI. */
const ACTIONS_LOCAL = /\b(lista della spesa|lista spesa|cosa devo comprare|svuota\w*|cancella\w*|avvis\w*|notific\w*|promemoria)\b/;

/** Di cosa si sta parlando: serve a capire «mettila nei task» detto subito dopo «devo fare la spesa». */
let lastSubject: { text: string; ts: number; added: boolean } | null = null;
const store = () => useAssistant.getState();
const pushAi = (text: string, extra: { chips?: string[]; ext?: TheiaExt } = {}): AMsg => store().push({ who: 'ai', text, source: 'chat', chips: extra.chips, ext: extra.ext });
const clean = (s: string) => s.replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim();

/** Il server AI e' collegato e l'utente non ha scelto "Solo sul telefono". */
const aiOn = () => aiServerConfigured && !useAiRouter.getState().prefs.phoneOnly;

/** Saluti, ringraziamenti, si/no senza domanda in sospeso e frasi libere: risponde l'AI come una persona. */
const SMALLTALK = /^(ciao|salve|hey|ehi|buongiorno|buonasera|buon pomeriggio|buonanotte|hi|hello|grazie|thanks|thank you)\b/;

/** Annullamenti delle azioni appena eseguite da Theia (restano finche' l'app e' aperta). */
const undos = new Map<string, Array<() => void>>();
/** Risposta dell'AI: le azioni controllate dall'app vengono eseguite subito; l'app scrive il risultato e offre «Annulla». «Apri» resta un pulsante. */
function parsedContent(text: string, actions: ReturnType<typeof parseAiActions>['actions']): { text: string; ext?: TheiaExt } {
  if (!actions.length) return { text };
  const lines: string[] = []; const fns: Array<() => void> = []; const buttons: TheiaAction[] = [];
  for (const a of actions) {
    if (a.type === 'open') { buttons.push({ kind: 'ai-do', label: describe(a), act: a }); continue; }
    let r: ReturnType<typeof applyAiAction>;
    try { r = applyAiAction(a); } catch { r = { ok: false, message: t('Non sono riuscita a farlo: riprova o dimmi meglio cosa cambiare.') }; }
    if (r.message) lines.push(r.message);
    if (r.undo) fns.push(r.undo);
  }
  const body = [text, lines.join('\n')].filter(Boolean).join('\n\n');
  if (fns.length) { const id = Math.random().toString(36).slice(2); undos.set(id, fns); buttons.push({ kind: 'ai-undo', label: t('Annulla'), id }); }
  return { text: body, ...(buttons.length ? { ext: { actions: buttons } } : {}) };
}
function pushParsed(text: string, actions: ReturnType<typeof parseAiActions>['actions']): AMsg {
  const c = parsedContent(text, actions);
  return pushAi(c.text, c.ext ? { ext: c.ext } : {});
}
function pushWithActions(reply: string): AMsg {
  const { text, actions } = parseAiActions(reply);
  return pushParsed(text, actions);
}
/** Theia scrive come in una chat: piu' messaggi brevi, uno dopo l'altro (i pulsanti stanno sull'ultimo). */
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function pushReply(reply: string, userText?: string): Promise<void> {
  const parsed = parseAiActions(reply);
  const { text } = parsed;
  const actions = userText === undefined ? parsed.actions : filterActions(userText, parsed.actions);
  const parts = splitReply(text);
  if (parts.length <= 1) { pushParsed(parts[0] ?? text, actions); return; }
  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) { pushAi(parts[i]); await pause(Math.min(1500, 500 + parts[i + 1].length * 9)); }
    else pushParsed(parts[i], actions);
  }
}

/** Se Theia ha risposto da esperta di un campo (salute, diritto, fisco…), sotto la risposta compare «Approfondisci»: stessa domanda, più fonti e risposta completa. */
const DOMAIN_TOPIC: Record<string, string> = { salute: 'Salute', alimentazione: 'Salute', mente: 'Mente', fitness: 'Fitness', finanza: 'Finanze', fisco: 'Finanze', diritto: 'Legale', lavoro: 'Lavoro', business: 'Lavoro', casa: 'Casa', viaggi: 'Viaggi', studio: 'Studio', tecnologia: 'Tecnologia' };
/** Quando Theia risponde da esperta di un campo (per esempio la salute), la domanda e le risposte vanno nella cartella di quell'argomento. */
function tagByDomain(): void {
  const dom = aiServer.lastAiDomain; const topic = dom ? DOMAIN_TOPIC[dom.id] : undefined;
  if (!dom || !topic) return;
  const log = store().log;
  let i = log.length - 1;
  while (i >= 0 && log[i].who !== 'me') i--;
  if (i < 0) return;
  for (let k = i; k < log.length; k++) {
    if (log[k].topic !== topic) store().patchMsg(log[k].id, { topic });
    if (log[k].who === 'ai') store().patchMsg(log[k].id, { ext: { ...(log[k].ext ?? {}), avatar: dom.id } });
  }
  useAssistant.setState({ current: topic });
}

function addDeepAction(question: string): void {
  const dom = aiServer.lastAiDomain;
  if (!dom || /^\s*approfondisci/i.test(question)) return;
  const log = store().log;
  const last = [...log].reverse().find((m) => m.who === 'ai');
  if (!last || last.ext?.actions?.some((a) => a.kind === 'ai-do')) return;
  const actions = [...(last.ext?.actions ?? []), { kind: 'say', label: t('Approfondisci'), text: `Approfondisci: ${question.replace(/\s+/g, ' ').slice(0, 160)}` } as TheiaAction];
  store().patchMsg(last.id, { ext: { ...(last.ext ?? {}), actions } });
}

async function aiChatReply(text: string): Promise<void> {
  const plain = !text.includes('\n\n'); // solo una domanda scritta (senza allegati): l'unico caso in cui si impara o si ricorda
  const kb = useTheiaMemory.getState();
  const hit = plain ? recall(kb.entries, text) : null;
  if (hit) {
    kb.used(hit.id);
    pushAi(`${hit.a}\n\n${t('Risposta dalla mia memoria (l\'ho imparata il {0}): non ho usato l\'AI esterna.', new Date(hit.ts).toLocaleDateString())}`, { ext: { actions: [{ kind: 'kb-forget', label: t('Non è giusta'), id: hit.id }, { kind: 'kb-redo', label: t('Chiedi di nuovo all\'AI'), id: hit.id, text }] } });
    return;
  }
  try {
    /* Theia scrive nel messaggio mentre il server genera: i pezzi separati da ||| diventano messaggi distinti */
    const live: string[] = []; const shown: string[] = []; let last = 0;
    const paint = (acc: string) => {
      const now = Date.now(); if (now - last < 120) return; last = now;
      liveParts(acc).forEach((p, i) => {
        if (!live[i]) { live[i] = pushAi(p).id; shown[i] = p; }
        else if (shown[i] !== p) { shown[i] = p; store().patchMsg(live[i], { text: p }); }
      });
    };
    let reply = '';
    try { reply = await askTheiaChatStream(text, paint); }
    catch { live.splice(0).forEach((id) => store().delMsg(id)); reply = await askTheiaChat(text); }
    reply = reply || t('Risposta vuota dal server.');
    /* il piano alimentare o l'allenamento scritti da Theia: si tolgono dal testo e si consegnano come file */
    const held = takePlans(reply); reply = held.text || t('Ecco fatto.');
    if (live.length) {
      /* il testo finale (con i link alle fonti e le azioni) sostituisce quello provvisorio */
      const parsed = parseAiActions(reply);
      const actions = filterActions(text, parsed.actions);
      const parts = splitReply(parsed.text);
      if (!parts.length) parts.push(parsed.text);
      parts.forEach((p, i) => {
        const c = i === parts.length - 1 ? parsedContent(p, actions) : { text: p };
        if (live[i]) store().patchMsg(live[i], c); else pushAi(c.text, c.ext ? { ext: c.ext } : {});
      });
      live.slice(parts.length).forEach((id) => store().delMsg(id));
    } else await pushReply(reply, text);
    deliverPlans(held, (txt, extra) => pushAi(txt, extra));
    tagByDomain();
    addDeepAction(text);
    if (plain) { const { text: parsed, actions } = parseAiActions(reply); const clean = splitReply(parsed).join('\n\n'); if (!actions.length && isLearnable(text, clean)) kb.learn(text, clean); }
  } catch (e) {
    pushAi(`${t(friendlyAiError(e instanceof Error ? e.message : 'Errore del server AI.'))}\n\n${t('I comandi sul tuo piano, i task e i report funzionano comunque.')}`, { ext: { actions: [{ kind: 'say', label: t('Riprova'), text }, { kind: 'dismiss', label: t('Lascia stare') }] } });
  }
}

/** Il documento ricevuto in chat finisce SEMPRE in LifeDrive (resta sul telefono): niente invio, nessun consenso necessario. */
function saveToDrive(atts: Att[]) {
  const life = useLife.getState();
  for (const a of atts) {
    if (a.kind !== 'document' || !a.uri || life.drive.some((d) => d.uri === a.uri)) continue;
    life.addFile({ n: a.name, s: fmtBytes(a.size) || '—', folder: a.billish ? BILL_FOLDER : 'Chat con Theia', date: weekdayShortDate(), uri: a.uri, src: a.billish ? 'Bolletta' : 'Theia', tag: a.billish ? 'Bollette' : 'Caricate da Theia' });
  }
}

/** «aggiungi / carica / inserisci una bolletta o fattura» */
/** «dove abito», «da casa mia», «il percorso da casa», «quanto ci vuole a piedi da qui»: dati che Theia non ha. */
const HOME_OR_ROUTE = /\b(dove abito|dove vivo|casa mia|il mio indirizzo|dov e casa)\b|\b(percorso|indicazioni|strada|quanto ci vuole|come ci arrivo|come arrivo)\b.*\b(da casa|da qui|a piedi|in bici|in auto|in macchina)\b|\b(da casa|da qui)\b.*\b(percorso|indicazioni|a piedi|in bici|quanto ci vuole)\b/;
const BILL_ADD = /\b(aggiung|carica|caricare|inserisc|registr|nuov|metti|mettere|salva|salvare)\w*\b.*\b(bolletta|bollette|fattura|fatture)\b/;

const TIPO = /^\s*TIPO:\s*(\w+)\s*$/im;
const FILE_SUFFIX = '\n\nSe nel file riconosci una bolletta o una fattura da pagare, chiudi la risposta con una riga a parte: TIPO: bolletta';
/** La riga sulle bollette si aggiunge solo se l'utente parla di bollette o fatture: per una foto qualsiasi non se ne deve nemmeno parlare. */
const BILL_TALK = /\b(bollett\w*|fattur\w*|pagare|scadenz\w*|importo|ricevut\w*|bill|invoice|receipt)\b/i;

/** Legge file e foto con l'AI, solo dopo il consenso. Se e' una bolletta propone di aggiungerla; non inserisce nulla senza conferma. */
export async function readFilesWithAi(question: string, files: { uri: string; mime: string; name?: string }[]): Promise<void> {
  const what = files.map((f) => f.name ?? t('Foto')).slice(0, 4).join(', ');
  if (!(await askSend('files', what))) {
    pushAi(t('Va bene, non invio nulla: il file resta sul tuo telefono. Senza il permesso non posso capire file, foto e documenti.'), {
      ext: { actions: [{ kind: 'read-files', label: t('Fammi leggere il file'), text: question, files }, { kind: 'dismiss', label: t('No, grazie') }] },
    });
    return;
  }
  logSend('files', 0, files.map((f) => f.mime));
  try {
    const { reply, result } = await askTheiaFiles(`${question || t('Dimmi di cosa si tratta.')}${BILL_TALK.test(`${question} ${files.map((f) => f.name ?? '').join(' ')}`) ? FILE_SUFFIX : ''}`, files);
    const first = files[0];
    const d = describeAnalysis(result);
    if (d) {
      const actions: TheiaAction[] = [];
      if (d.invoices.length && first) actions.push({ kind: 'add-invoices', label: d.invoices.length > 1 ? t('Aggiungi le {0} fatture alle bollette', d.invoices.length) : t('Aggiungi la fattura alle bollette'), invoices: d.invoices, fileUri: first.uri, fileName: first.name, fileMime: first.mime });
      else if (isBillType(d.tipo) && first) actions.push({ kind: 'bill', label: t('Aggiungi alle bollette'), uri: first.uri, mime: first.mime, name: first.name ?? t('Bolletta') });
      if (actions.length) actions.push({ kind: 'dismiss', label: t('No, grazie') });
      pushAi(d.text || t('Risposta vuota dal server.'), actions.length ? { ext: { actions } } : undefined);
      return;
    }
    const kind = TIPO.exec(reply)?.[1] ?? '';
    const bill = /^bollett|fattur/i.test(kind);
    const text = reply.replace(TIPO, '').trim();
    if (bill && first) {
      pushAi(splitReply(text).join('\n\n') || t('Risposta vuota dal server.'), { ext: { actions: [{ kind: 'bill', label: t('Aggiungi alle bollette'), uri: first.uri, mime: first.mime, name: first.name ?? t('Bolletta') }, { kind: 'dismiss', label: t('No, grazie') }] } });
      return;
    }
    await pushReply(text || t('Risposta vuota dal server.'), question);
  } catch (e) {
    pushAi(e instanceof Error ? e.message : t('Errore del server AI.'));
  }
}

/** Fatture lette da un documento: entrano nelle bollette solo dopo il tocco dell'utente, collegate al file in LifeDrive. */
function addInvoicesFromChat(a: Extract<TheiaAction, { kind: 'add-invoices' }>) {
  const fin = useFin.getState();
  const drive = useLife.getState().drive.find((d) => d.uri === a.fileUri);
  let added = 0;
  for (const inv of a.invoices) {
    if (fin.invoices.some((x) => x.number === inv.number && x.issuer === inv.issuer && Math.abs(x.amount - inv.amount) < 0.01)) continue;
    fin.addInvoice({
      issuer: inv.issuer, kind: 'altro', amount: inv.amount, currency: inv.currency, ...(inv.number ? { number: inv.number } : {}), ...(inv.dueDate ? { dueDate: inv.dueDate } : {}),
      ...(a.fileUri ? { fileUri: a.fileUri, fileName: a.fileName, fileMime: a.fileMime, ...(drive ? { fileId: drive.id } : {}) } : {}),
      remind: true, calendar: false,
    }, 'Aggiunta da Theia (documento in chat)');
    added++;
  }
  void refreshBillReminders().catch(() => {});
  pushAi(added ? (added > 1 ? t('Fatto: ho aggiunto {0} fatture alle bollette, con il file collegato.', added) : t('Fatto: ho aggiunto la fattura alle bollette, con il file collegato.')) : t('Queste fatture ci sono già nelle bollette: non le ho duplicate.'), { ext: { actions: [{ kind: 'open', label: t('Apri Finanze'), page: 'lifefinance' }] } });
}


/** «Crea queste task» con un file allegato: se il testo si legge sul telefono, diventa un progetto ad albero (senza AI e senza inviare nulla). */
const MAKE_TASKS = /\b(crea|creami|creare|aggiung\w*|import\w*|trasform\w*|fai|fammi|metti|inserisc\w*)\b.*\b(task|attivit\w*|compiti|to-?do|progett\w*|voci|lista|elenco)\b/i;
async function importDocsAsProject(atts: Att[]): Promise<boolean> {
  let roots = 0; let count = 0; let name = '';
  for (const a of atts) {
    if (a.kind !== 'document' || !a.uri) continue;
    try {
      const bytes = await readUriBytes(a.uri);
      const isPdf = a.mime === 'application/pdf' || /\.pdf$/i.test(a.name ?? '') || (bytes[0] === 0x25 && bytes[1] === 0x50);
      const txt = isPdf ? pdfToText(bytes) : new TextDecoder().decode(bytes);
      if (!txt.trim()) continue;
      const r = useProjects.getState().importText(txt);
      if (r.count) { roots += r.roots; count += r.count; name = name || (a.name ?? ''); }
    } catch { /* si prova con gli altri file, poi con l'AI */ }
  }
  if (!count) return false;
  pushAi(t('Fatto: dal file {0} ho creato {1} voci ({2} progetti principali) in Progetti, con le sotto-attività a più livelli. Il file resta in LifeDrive e non ho inviato nulla.', name ? `«${name}»` : '', count, roots), { ext: { actions: [{ kind: 'open', label: t('Apri Progetti'), page: 'projects' }, { kind: 'dismiss', label: t('Ok') }] } });
  return true;
}

export async function sendTheia(i: SendInput): Promise<void> {
  const text = i.text.trim();
  if (i.voiceNote) {
    const s = Math.round(i.voiceNote.durationMs / 1000);
    store().push({ who: 'me', text: `${t('Messaggio vocale')} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, source: 'chat', topic: i.topic, ext: { lang: i.lang, voice: true } });
    pushAi(t('Ho ricevuto il tuo vocale e l\'ho salvato sul telefono. Qui non riesco ancora a trascriverlo: scrivimi il testo, oppure detta dall\'app installata.'));
    return;
  }
  const images = i.images ?? [];
  const atts = i.attachments ?? [];
  if (!text && !images.length && !atts.length) return;
  // messaggi di rischio (farsi del male, morire): risposta fissa e prudente con aiuto umano, mai affidata all'AI
  if (text && detectCrisis(text)) {
    store().push({ who: 'me', text, source: 'chat', topic: i.topic, ext: { lang: i.lang, voice: i.source === 'voice' } });
    pushAi(t(CRISIS_TEXT), { ext: { actions: [...CRISIS_RESOURCES.map((r): TheiaAction => ({ kind: 'open', label: t(r.label), url: `tel:${r.tel}` })), { kind: 'dismiss', label: t('Per ora sto bene, grazie') }] } });
    return;
  }
  /* «ricordami di…»: si legge qui, subito, senza AI; se manca l'ora si chiede */
  if (text && !atts.length && !images.length && looksLikeMemo(text)) {
    store().push({ who: 'me', text, source: 'chat', topic: i.topic, ext: { lang: i.lang, voice: i.source === 'voice' } });
    const r = parseMemo(text, Date.now());
    if (!r) { pushAi(t('Cosa devo ricordarti, e quando?')); return; }
    if ('missing' in r) { pushAi(t('Certo: «{0}». A che ora e in che giorno?', r.text)); return; }
    const d = new Date(r.at);
    const res = applyAiAction({ type: 'reminder_add', text: r.text, date: dayStr(d), time: timeStr(d), repeat: r.repeat === 'none' ? undefined : r.repeat });
    pushAi(res.message, { ext: { actions: [{ kind: 'open', label: t('Apri i promemoria'), page: 'reminders' }] } });
    return;
  }
  /* i questionari brevi sul benessere (WHO-5, PHQ-9): domande e risposte in chat, dopo il consenso */
  if (text && !atts.length && !images.length && WB_ASK.test(text)) {
    store().push({ who: 'me', text, source: 'chat', topic: i.topic, ext: { lang: i.lang, voice: i.source === 'voice' } });
    startQuestionnaire(/phq/i.test(text) || /depressione/i.test(text) ? 'phq9' : 'who5');
    return;
  }
  const eng = getAssistant();
  const payload = textPayload(atts);
  const withAtts = atts.length ? { attachments: atts } : {};

  /* file e foto che sono piani (turni di lavoro, piano del nutrizionista): si leggono qui e finiscono nella loro sezione */
  if (atts.length || images.length) {
    const pushMine = () => store().push({ who: 'me', text, source: 'chat', topic: i.topic, ext: { images: images.length ? images.map((x) => x.uri) : undefined, ...withAtts, lang: i.lang, voice: i.source === 'voice' } });
    const handled = await (async () => {
    /* un file o una foto con i turni di lavoro: li leggo e chiedo conferma prima di cambiare quelli attuali */
    const shiftFile = atts.find((a) => a.kind === 'document' && a.uri && SHIFT_TALK.test(`${text} ${a.name}`)) ?? (images.length && SHIFT_TALK.test(text) ? { uri: images[0].uri, name: t('Foto'), mime: images[0].mime, size: undefined as number | undefined } : undefined);
    if (shiftFile) {
      pushMine(); pushAi(t('Leggo i turni dal file: ci vuole un minuto.'));
      const r = await readShiftsFile({ uri: shiftFile.uri!, name: shiftFile.name, mime: (shiftFile as { mime?: string }).mime, size: (shiftFile as { size?: number }).size });
      if (!r.ok) { pushAi(r.error); return; }
      const have = useShifts.getState().shifts.length;
      const total = r.shifts.reduce((n, s) => n + s.dates.length, 0);
      pushAi(`${t('Ho trovato {0} giorni di lavoro:', total)}\n\n${shiftsSummary(r.shifts)}\n\n${have ? t('Ora hai {0} turni salvati. Li sostituisco con questi?', have) : t('Li aggiungo ai tuoi turni?')}`, {
        ext: { actions: have ? [{ kind: 'shifts-apply', label: t('Sì, sostituisci'), replace: true, shifts: r.shifts }, { kind: 'shifts-apply', label: t('Aggiungili agli altri'), replace: false, shifts: r.shifts }, { kind: 'dismiss', label: t('No, lascia i miei') }] : [{ kind: 'shifts-apply', label: t('Sì, aggiungili'), replace: false, shifts: r.shifts }, { kind: 'dismiss', label: t('No, grazie') }] },
      });
      return true;
    }
    /* il PDF del nutrizionista: i pasti e gli alimenti diventano il piano alimentare nella sua sezione */
    const dietPdf = !images.length ? atts.find((a) => a.kind === 'document' && a.uri && (a.docType === 'pdf' || /\.pdf$/i.test(a.name)) && (NUTRITIONIST_TALK.test(`${text} ${a.name}`) || (a.text ? looksLikeDietPlan(a.text) : false))) : undefined;
    if (dietPdf) {
      pushMine(); pushAi(t('Leggo il piano del nutrizionista e lo metto nella sezione Piano alimentare: ci vuole un minuto.'));
      const r = await importPlanPdf({ uri: dietPdf.uri!, name: dietPdf.name, mime: dietPdf.mime, size: dietPdf.size });
      if (r.ok) { pushAi(t('Fatto: ho messo nel piano «{0}», circa {1} kcal al giorno. Se qualcosa non torna dimmelo e lo sistemo.', r.title, r.avg), { ext: { actions: [{ kind: 'open', label: t('Apri il piano'), page: 'fitnessMealPlan' }, { kind: 'say', label: t('Lista della spesa'), text: 'preparami la lista della spesa del piano' }] } }); go('fitnessMealPlan'); }
      else pushAi(r.error);
      return true;
    }
      return false;
    })();
    if (handled === true) return;
  }

  // immagini o documenti che il telefono non sa leggere (PDF, Word, Excel): restano salvati e, se serve l'analisi, risponde il router (oggi non collegato)
  if (images.length || atts.some(needsAnalysis)) {
    store().push({ who: 'me', text, source: 'chat', topic: i.topic, ext: { images: images.length ? images.map((x) => x.uri) : undefined, ...withAtts, lang: i.lang, voice: i.source === 'voice' } });
    saveToDrive(atts);
    /* foto senza contesto: Theia ipotizza dove vanno (corpo, frigo, piatto, scontrino) e le sposta lì; con un discorso in corso al massimo lo propone dopo */
    let offer: import('@/lib/assistant/photoRouteCore').PhotoKind | undefined;
    if (images.length && !atts.some(needsAnalysis)) {
      const recent = store().log.slice(-9, -1).map((m) => m.text);
      const routed = await routePhotos(images, text, recent, (txt, extra) => pushAi(txt, extra));
      if (routed.handled) return;
      offer = routed.offer;
    }
    for (const x of images) saveMediaToDrive({ uri: x.uri, media: 'photo', from: 'Theia' });
    if (!images.length && MAKE_TASKS.test(text) && (await importDocsAsProject(atts))) return;

    if (aiOn()) {
      const list = [...images.map((x) => ({ uri: x.uri, mime: x.mime })), ...atts.filter((a) => a.kind === 'document' && a.uri && !a.text).map((a) => ({ uri: a.uri!, mime: a.mime ?? 'application/pdf', name: a.name }))];
      if (list.length) {
        await readFilesWithAi([text, payload].filter(Boolean).join('\n\n'), list);
        if (offer && images.length) { const acts = offerFor(offer, images.map((x) => x.uri)); if (acts.length) pushAi(t('Se vuoi, metto la foto anche nella sezione giusta.'), { ext: { actions: acts } }); }
        return;
      }
    }
    const files = atts.filter(needsAnalysis).length;
    if (!text && !images.length) {
      pushAi(files > 1
        ? t('Ho salvato i {0} file sul tuo telefono. Non so ancora leggerne il contenuto (PDF, Word, Excel): serve il servizio di analisi dei documenti, non ancora collegato. Se sono bollette o fatture puoi usare «Analizza come bolletta/fattura».', files)
        : t('Ho salvato il file sul tuo telefono. Non so ancora leggerne il contenuto (PDF, Word, Excel): serve il servizio di analisi dei documenti, non ancora collegato. Se è una bolletta o una fattura puoi usare «Analizza come bolletta/fattura».'));
      return;
    }
    const what = [...images.map(() => t('Foto')), ...atts.filter(needsAnalysis).map((a) => a.name)].slice(0, 4).join(', ');
    const gate = await askSendRouted('files', what);
    if (!gate.ok) {
      pushAi(t('Va bene, non invio nulla: il file resta sul tuo telefono. Senza il permesso non posso capire file, foto e documenti.'));
      return;
    }
    try { await delegate({ text: [text, payload].filter(Boolean).join('\n\n'), lang: i.lang, source: i.source, images: images.length ? images : undefined, files: images.length ? 0 : files }); } finally { gate.restore(); }
    return;
  }

  // solo allegati leggeri (testo, nota, impegno, contatto, posizione, file di testo letto qui) e nessuna domanda: chiedo cosa farne
  if (!text && atts.length) {
    store().push({ who: 'me', text: '', source: 'chat', topic: i.topic, ext: { ...withAtts, lang: i.lang, voice: false } });
    const first = (payload.split('\n').find((l) => l && !l.startsWith('---')) ?? '').slice(0, 80);
    const actions: TheiaAction[] = [];
    if (first) actions.push({ kind: 'run', label: t('Crea un task da questo testo'), command: `add task "${clean(first)}"` });
    if (payload) actions.push({ kind: 'ask-ai', label: t('Chiedi a un\'AI esterna'), text: payload, lang: i.lang, source: i.source });
    actions.push({ kind: 'dismiss', label: t('Niente, grazie') });
    pushAi(atts.length > 1 ? t('Ho ricevuto {0} allegati. Cosa vuoi che ne faccia?', atts.length) : t('Ho ricevuto l\'allegato. Cosa vuoi che ne faccia?'), { ext: { actions } });
    return;
  }

  const pending = !!eng.pending;
  const u = understand(text, i.lang, { forced: i.forced, appLang: i.appLang });
  const command = u.status === 'passthrough' || u.status === 'translated' ? u.text : undefined;
  const topic = i.topic ?? (command ? topicOf(command) ?? undefined : undefined);
  store().push({ who: 'me', text, source: 'chat', topic, ext: { ...withAtts, lang: u.lang, voice: i.source === 'voice' } });

  // «pianifica la mia settimana»: proposta con anteprima e conferma (allenamenti, task e sonno nei momenti liberi, con turni e impegni sempre occupati)
  if (!pending && !useLearned.getState().teaching && (u.status === 'passthrough' || u.status === 'translated') && (/(pianific|organizz|prepar)\w*\s+(la\s+|il\s+)?(mia\s+|mio\s+)?settiman/i.test(u.text) || /\b(plan|organi[sz]e|prepare)\s+(my|the|this|next)\s+week\b/i.test(text))) {
    pushAi(t('Ho preparato una proposta per la tua settimana con allenamenti, task e sonno nei momenti liberi. I turni e gli impegni restano occupati. La guardi, togli quello che non vuoi e confermi: non cambio niente da sola.'), { ext: { actions: [{ kind: 'open', label: t('Vedi la proposta'), page: 'weekPlan' }, { kind: 'dismiss', label: t('Non ora') }] } });
    return;
  }

  // «creami un progetto chiamato business plan e dividilo in tutte le task»: lo creo ad albero (sotto-progetti e task), di qualsiasi tipo
  if (!pending && !useLearned.getState().teaching && (u.status === 'passthrough' || u.status === 'translated')) {
    const pr = parseProjectRequest(u.text) ?? parseProjectRequest(text);
    if (pr) { await createProjectFromRequest(pr); return; }
  }

  // domande sui tuoi dati (soldi, agenda, turni, task, sonno, passi, acqua, calorie): risposta calcolata dal codice, con le fonti; se il dato manca lo dico
  if (!pending && !useLearned.getState().teaching && (u.status === 'passthrough' || u.status === 'translated')) {
    try {
      const g = askLocal(u.text, collectSnap());
      if (g) { pushAi(`${g.text}${g.sources.length ? `\n\n${t('Fonte')}: ${g.sources.join(', ')}.` : ''}`); return; }
    } catch { /* si prosegue con la via normale */ }
  }

  // domande libere sui tuoi dati: l'AI sceglie i calcolatori, il telefono calcola, ogni numero della risposta viene verificato. Senza AI o senza consenso: i fatti, così come sono
  if (!pending && !useLearned.getState().teaching && (u.status === 'passthrough' || u.status === 'translated') && !aiOn() && looksLikeDataQuestion(u.text)) {
    try {
      const snap = collectSnap();
      let r: FreeResult = { kind: 'outside' };
      if (aiOn() && (await askSend('summary', t('La tua domanda e i numeri che servono a rispondere, calcolati sul telefono. Niente file, foto o contatti.')))) {
        logSend('summary', 0, ['domanda', 'numeri calcolati']);
        try { r = await askFree(u.text, snap, (p) => aiChatRaw(p)); } catch { r = askFreeOffline(u.text, snap); }
      } else r = askFreeOffline(u.text, snap);
      if (r.kind === 'clarify') { pushAi(r.text); return; }
      if (r.kind === 'answer' || r.kind === 'fallback') {
        pushAi(`${r.text}${r.sources.length ? `\n\n${t('Fonte')}: ${r.sources.join(', ')}. ${t('I numeri sono calcolati sul telefono.')}` : ''}`);
        return;
      }
    } catch { /* si prosegue con la via normale */ }
  }

  // sto imparando un comando: questa frase è la dimostrazione (una pagina o un comando che già so)
  if (useLearned.getState().teaching) { await teachStep(text, command); return; }

  // con l'AI collegata, saluti e frasi senza una domanda in sospeso le gestisce l'AI come una persona
  if (aiOn() && !pending && !eng.pending) {
    const n = norm(text);
    /* un «sì»/«no» dopo una domanda che ho fatto io con l'AI («Vuoi che ti aiuti a inserirli?») è la risposta a quella domanda: passa all'AI, che ha la conversazione */
    const lastAi = [...store().log].reverse().find((m) => m.who === 'ai');
    /* l'ultima cosa che ho detto era una domanda (anche con le «Fonti» in coda) o è recente: un «sì» o «no» risponde a quella */
    const lastTxt = (lastAi?.text ?? '').replace(/\n*\s*Fonti:[\s\S]*$/i, '').trim();
    const answersMyQuestion = !!lastAi && (/\?[^?]{0,160}$/.test(lastTxt) || Date.now() - (lastAi.ts ?? 0) < 15 * 60000);
    const loneAnswer = (isYes(text) || isNo(text)) && (n.split(' ').length > 3 || answersMyQuestion);
    if ((SMALLTALK.test(n) && n.split(' ').length <= 8) || loneAnswer) { await aiChatReply([text, payload].filter(Boolean).join('\n\n')); return; }
  }
  /* piano alimentare e allenamento: ne parla Theia con l'AI (domande, piano, modifiche) prima di qualsiasi scorciatoia locale («devo creare un piano alimentare» non è un task) */
  if (aiOn() && !pending && !eng.pending && !atts.length && !images.length && !ACTIONS_LOCAL.test(norm(text))) {
    const recentMine = store().log.filter((m) => m.who === 'me').slice(-6, -1).map((m) => m.text);
    if (mealPlanTalk(text, recentMine, !!usePantry.getState().plan) || workoutTalk(text, recentMine, !!useFitness.getState().aiPrograms[0])) { await aiChatReply([text, payload].filter(Boolean).join('\n\n')); return; }
  }
  // «devo fare la spesa»: è una cosa da fare, la metto nei task (con «Annulla»); «mettila nei task» subito dopo si riferisce a quella
  if (!pending) {
    const tc = taskCommand(text);
    if (tc) { lastSubject = { text: tc, ts: Date.now(), added: false }; if (await runLocal(`add task "${tc.replace(/"/g, '')}"`)) { if (lastSubject) lastSubject.added = true; return; } }
    /* con l'AI collegata una frase lunga o una domanda non è un promemoria: la capisce l'AI */
    const subj = aiOn() && (text.includes('?') || text.trim().split(/\s+/).length > 7) ? null : todoSubject(text);
    if (subj) {
      lastSubject = { text: subj, ts: Date.now(), added: false };
      if (await runLocal(`add task "${subj.replace(/"/g, '')}"`)) { if (lastSubject) lastSubject.added = true; return; }
    }
    if (isAddFollowUp(text)) {
      const fresh = lastSubject && Date.now() - lastSubject.ts < 20 * 60000 ? lastSubject : null;
      if (fresh?.added) {
        pushAi(t('«{0}» è già nei tuoi task: lo trovi in LifeTask. Se vuoi lo metto anche nel piano di oggi.', fresh.text), { ext: { actions: [{ kind: 'open', label: t('Apri LifeTask'), page: 'lifetask' }, { kind: 'run', label: t('Metti nel piano'), command: `add "${fresh.text.replace(/"/g, '')}" to my plan` }, { kind: 'dismiss', label: t('Va bene così') }] } });
        return;
      }
      if (fresh) { fresh.added = true; if (await runLocal(`add task "${fresh.text.replace(/"/g, '')}"`)) return; }
      pushAi(t('Cosa vuoi che scriva nel task? Dimmelo e lo aggiungo.'));
      return;
    }
  }
  // funzioni dell'app (pubblica un post, crea un LifeClub, invia LifePoints...): le svolge Theia, anche a più domande
  if (handleAppAction(command ?? text, (m, x) => { pushAi(m, x); })) return;
  // ritocchi alle finanze («imposta l'affitto a 1430») e comandi che l'utente mi ha insegnato: tutto in locale, senza AI esterna
  if (!pending && (await handleLocalEdits(text))) return;

  if (u.status === 'confirm') {
    pushAi(t('Non sono sicura di aver capito. Vuoi dire: «{0}»?', u.text), {
      ext: { lang: u.lang, actions: [{ kind: 'run', label: t('Sì, fallo'), command: u.text }, { kind: 'dismiss', label: t('No') }] },
    });
    return;
  }

  // «devo prenotare un dentista»: prima i professionisti di LifePilot, poi (solo se nessuno è abbastanza buono) la ricerca fuori dall'app
  // frasi intere (livello più preciso): «voglio ordinare una pizza», «mi serve un dentista», «quanto ho speso questo mese»…
  // «aggiungi una bolletta»: si fa subito, senza rimandare alla guida
  if (!pending && BILL_ADD.test(norm(text))) {
    pushAi(t('Certo. Allega con la graffetta il PDF o la foto della bolletta: la leggo e ti propongo di aggiungerla. Oppure aprila qui e la compili a mano o da file.'), {
      ext: { actions: [{ kind: 'open', label: t('Aggiungi una bolletta'), page: 'billReview' }, { kind: 'dismiss', label: t('No, grazie') }] },
    });
    return;
  }
  // cibo e acqua: storico, analisi di come mangi, acqua bevuta e promemoria (tutto sul telefono)
  if (!pending && (await handleFood(text, (m, actions) => { pushAi(m, actions ? { ext: { actions } } : {}); }, (page, params) => go(page, params ?? {})))) return;
  // domande sul dove abiti o su percorsi da casa: Theia NON lo sa e lo dice, senza inventare strade
  if (!pending && HOME_OR_ROUTE.test(norm(text))) {
    pushAi(t('Non so dove abiti: non conosco il tuo indirizzo né la tua posizione, e non calcolo percorsi né tempi di viaggio. Se te li inventassi ti manderei nel posto sbagliato. Apri le mappe, cerca il posto e usa «Indicazioni»: lì partono dalla tua posizione vera.'), {
      ext: { actions: [{ kind: 'open', label: t('Apri le mappe'), url: 'https://www.google.com/maps' }, { kind: 'dismiss', label: t('Ok, grazie') }] },
    });
    return;
  }
  if (!pending && (await handlePhrase(command ?? text))) return;
  // dove si trova / come si fa: risposta precisa dalla guida, con il pulsante per aprire la pagina
  if (!pending && looksLikeHelp(text)) {
    const faq = matchFaq(text);
    if (faq) { answerFaq(faq.faq); return; }
  }
  const place = detectPlace(command ?? text);
  if (place && !pending) { answerPlace(place); return; }

  // una risposta a una domanda in sospeso ("come lo chiamo?") che il lessico non riconosce passa com'è all'assistente
  const toEngine = command ?? (pending ? text : undefined);
  if (toEngine != null) {
    const handled = await runLocal(toEngine);
    if (handled) return;
  }
  // domande su come funziona l'app: rispondo dalla guida (a cosa serve e come si usa), senza AI esterna
  if (looksLikeHelp(text)) {
    const hit = searchHelp(text, 2)[0];
    if (hit && hit.score >= 3) {
      pushAi(`${helpAnswer(hit.topic)}\n\n${t('Altri dettagli in «Aiuto e domande», dal menu.')}`);
      return;
    }
  }
  // un ordine che non conosco: non lo mando a un'AI, mi faccio insegnare
  if (!pending && looksLikeCommand(text) && text.trim().split(/\s+/).length <= 9) { offerTeach(text, u.lang, i.source); return; }
  if (aiOn() && !pending) { await aiChatReply([text, payload].filter(Boolean).join('\n\n')); return; }
  clarify(text, u.lang, i.source, [text, payload].filter(Boolean).join('\n\n'));
}

/** Crea il progetto chiesto in chat. Con l'AI collegata (e il tuo consenso) lo scompone su misura; altrimenti usa un modello adatto al tipo. */
async function createProjectFromRequest(pr: { name: string; split: boolean; original: string }): Promise<void> {
  let body: string | null = null;
  let viaAi = false;
  if (aiOn() && (await askSend('summary', t('Il titolo del progetto e la tua richiesta, per scomporlo in sotto-progetti e task. Niente file, foto o dati personali.')))) {
    try {
      logSend('summary', 0, ['titolo del progetto']);
      body = cleanAiOutline(await aiChatRaw(projectPrompt(pr)));
      viaAi = !!body;
    } catch { body = null; }
  }
  if (!body) body = fallbackOutline(pr.name);
  const { items } = parseOutline(withRoot(pr.name, body));
  const { nodes: parsed } = buildTree(items);
  if (parsed.length < 2) { pushAi(t('Non sono riuscita a creare il progetto: riprova con un altro nome.')); return; }
  const r = useProjects.getState().importText(withRoot(pr.name, body));
  const subs = parsed.filter((n) => n.parentIndex === 0).length;
  pushAi(
    t('Fatto: ho creato il progetto «{0}» con {1} sotto-progetti e {2} task in tutto{3}. Lo trovi in Progetti: spunta le task man mano e la percentuale si aggiorna da sola.', pr.name, subs, r.count - 1 - subs, viaAi ? '' : t(' (modello adatto al tipo di progetto: collega l\'AI per averlo su misura)')),
    { ext: { actions: [{ kind: 'open', label: t('Apri Progetti'), page: 'projects' }, { kind: 'dismiss', label: t('Ok, grazie') }] } },
  );
}

/** Modifiche alle finanze e comandi imparati. true = gestita. */
async function handleLocalEdits(text: string): Promise<boolean> {
  const ed = parseFixedEdit(text);
  if (ed) {
    const fin = useFin.getState();
    const hit = findFixed(ed.word, fin.statementInfo?.fixed ?? []);
    if (hit) {
      if (ed.undo) {
        fin.setFixedOverride(hit.key, null);
        pushAi(t('Fatto: «{0}» torna al calcolo dall’estratto.', hit.name));
        return true;
      }
      const before = hit.overridden?.calculated ?? hit.monthly;
      fin.setFixedOverride(hit.key, ed.amount);
      pushAi(t('Fatto: {0} ora è {1} al mese (dall’estratto risultava {2}). Lo trovi in Finanze > Budget, segnato come impostato da te.', hit.name, formatMoney(ed.amount), formatMoney(before)), {
        ext: { actions: [{ kind: 'open', label: t('Apri il Budget'), page: 'lifefinance' }, { kind: 'say', label: t('Ripristina il calcolo'), text: `ripristina ${ed.word}` }, { kind: 'dismiss', label: t('Va bene') }] },
      });
      return true;
    }
    if (/\b(affitto|cassa malati|mutuo|assicurazion|leasing|telefono|abbonament)/i.test(ed.word)) {
      pushAi(t('Non trovo «{0}» tra le tue spese fisse: compaiono quando carichi l’estratto conto della banca (Finanze > Carica un file).', ed.word), { ext: { actions: [{ kind: 'open', label: t('Apri Finanze'), page: 'lifefinance' }, { kind: 'dismiss', label: t('Va bene') }] } });
      return true;
    }
  }
  const L = useLearned.getState();
  const sharedItems = (L.shared ?? []).filter((c) => !(L.blocked ?? []).includes(c.id)).map((c) => ({ id: `shared:${c.id}`, pattern: c.pattern, kind: c.kind, target: c.target, uses: 0, ts: 0 }));
  const hit = matchLearned(text, [...L.items, ...sharedItems]);
  if (!hit) return false;
  if (hit.item.id.startsWith('shared:')) void voteSharedCommand(hit.item.id.slice(7), 1); else L.use(hit.item.id);
  const forget: TheiaAction = { kind: 'forget', label: t('Non era questo: dimentica'), id: hit.item.id };
  if (hit.item.kind === 'page') {
    go(hit.item.target);
    pushAi(t('Fatto, come mi avevi insegnato.'), { ext: { actions: [forget, { kind: 'dismiss', label: t('Va bene') }] } });
    return true;
  }
  const done = await runLocal(fillTarget(hit.item.target, hit.nums));
  if (done) pushAi(t('Lo so fare perché me l’hai insegnato.'), { ext: { actions: [forget, { kind: 'dismiss', label: t('Va bene') }] } });
  return done;
}

/** Comando sconosciuto: propongo di insegnarmelo (nessun invio fuori dal telefono). */
function offerTeach(text: string, lang: string, source: 'typed' | 'voice') {
  const actions: TheiaAction[] = [{ kind: 'teach', label: t('Insegnami'), phrase: text }];
  if (aiOn()) actions.push({ kind: 'ask-ai', label: t('Chiedi a un\'AI esterna'), text, lang, source });
  actions.push({ kind: 'dismiss', label: t('Lascia stare') });
  pushAi(t('Questo comando non lo conosco ancora. Posso impararlo: mi mostri una volta cosa fare e dalla prossima volta lo faccio da sola, senza AI esterne.'), { ext: { lang, actions } });
}

/** Il passo dell'insegnamento: l'utente indica una pagina o scrive un comando che già conosco. */
async function teachStep(text: string, command?: string): Promise<void> {
  const L = useLearned.getState();
  const phrase = L.teaching;
  if (!phrase) return;
  if (isCancel(text)) { L.stopTeach(); pushAi(t('Va bene, lascio stare.')); return; }
  const done = (kind: 'page' | 'cmd', target: string, what: string) => {
    const item = useLearned.getState().learn(phrase, kind, target);
    pushAi(t('Imparato: quando mi dici «{0}» {1}. Vale anche con altri numeri.', phrase, what), { ext: { actions: [{ kind: 'share', label: t('Condividi con tutti'), id: item.id }, { kind: 'forget', label: t('Dimentica'), id: item.id }, { kind: 'dismiss', label: t('Perfetto') }] } });
  };
  const tryPage = (): boolean => {
    const n = norm(text);
    const page = PAGES.find((p) => p.words.some((w) => n.includes(w)));
    const target = page?.page ?? matchFaq(text)?.faq.page;
    if (!target) return false;
    const label = page?.label ?? PAGES.find((p) => p.page === target)?.label ?? t('quella pagina');
    go(target);
    done('page', target, t('ti porto a {0}', label));
    return true;
  };
  const tryCommand = async (): Promise<boolean> => {
    try {
      const cmd = command ?? text;
      const r = await getAssistant().handle(cmd);
      if (!r.handled) return false;
      if (r.navigate) go(r.navigate); // «apri …»: si apre la pagina, senza scrivere in chat
      else pushAi(styleText(r.text, usePrefs.getState().answerStyle), { chips: r.chips });
      done('cmd', generalize(phrase, cmd), t('faccio «{0}»', cmd));
      return true;
    } catch { return false; }
  };
  if (looksLikeCommand(text)) { if (await tryCommand()) return; if (tryPage()) return; }
  else { if (tryPage()) return; if (await tryCommand()) return; }
  pushAi(t('Non lo riconosco nemmeno così. Dimmi il nome di una pagina (per esempio «Budget» o «Palestre») oppure scrivi un comando che già so, come «aggiungi task comprare latte». Oppure scrivi «annulla».'));
}

/** Azioni che l'assistente locale sa già eseguire dal testo dell'utente (impegni, task, note, salute, spese). */
const ENGINE_ACTS = new Set(['plan-add', 'plan-move', 'plan-vac', 'task-add', 'task-done', 'note-add', 'health-sleep', 'finance-add']);
const STARTER: Record<string, string> = { post: 'Pubblica un post', community: 'Crea una community', lifeclub: 'Crea un LifeClub' };

/** Una frase riconosciuta: la porta a ciò che Theia sa fare. true = gestita. */
async function handlePhrase(text: string): Promise<boolean> {
  const me = useApp.getState().account.name;
  const people = peoplePool(me);
  const hit = matchPhrase(text, people);
  if (!hit) return false;
  const { set } = hit;
  switch (set.kind) {
    case 'place': {
      if (NOT_A_SEARCH.test(norm(text))) return false;
      const cat = PLACE_CATEGORIES.find((c) => c.id === set.target);
      if (!cat) return false;
      answerPlace({ cat, order: !!set.order && !!cat.orderQuery, book: false });
      return true;
    }
    case 'cmd': return runLocal(set.target);
    case 'page': {
      go(set.target); // si apre la pagina e basta: niente messaggio in chat
      return true;
    }
    case 'act': {
      if (ENGINE_ACTS.has(set.target)) return runLocal(text);
      const who = findPerson(text, people), amt = findAmount(text);
      const starter = set.target === 'sendlp' ? `Invia ${amt && amt >= 1 ? amt : ''} LifePoints ${who ? `a ${who}` : ''}`
        : set.target === 'follow' ? `Segui ${who ?? ''}`
        : set.target === 'message' ? `Scrivi a ${who ?? ''}${text.includes(':') ? `: ${text.slice(text.indexOf(':') + 1).trim()}` : ''}`
        : STARTER[set.target];
      return starter ? handleAppAction(starter.replace(/\s+/g, ' ').trim(), (m, x) => { pushAi(m, x); }) : false;
    }
  }
}

/** Risposta della guida (dove sta una cosa, come si fa) con il pulsante per andarci. */
function answerFaq(f: Faq) {
  const label = f.page ? PAGES.find((p) => p.page === f.page)?.label ?? t('Aprila') : '';
  pushAi(`${f.answer}\n\n${t('Altri dettagli in «Aiuto e domande», dal menu.')}`, {
    ext: f.page ? { actions: [{ kind: 'open', label: label && label !== t('Aprila') ? t('Apri {0}', label) : t('Apri la pagina'), page: f.page, ...(f.params ? { params: f.params } : {}) }] } : undefined,
  });
}

/** Cerca dove prenotare: in app per voto; fuori dall'app solo se non ce n'è uno abbastanza buono. */
function answerPlace(req: PlaceRequest) {
  const { cat } = req;
  const providers = useNet.getState().providers.map((p) => ({ name: p.name, role: p.role, rating: p.rating, price: p.price, tag: p.tag }));
  const plan = planPlaceSearch(cat, providers, GOOD_ENOUGH, req.order);
  const stars = (n: number) => n.toFixed(1).replace('.', ',');
  if (plan.kind === 'in-app') {
    const lines = plan.best.map((p, i) => `${i + 1}. ${p.name} · ${p.role} · ${stars(p.score)}/5${p.price ? ` · ${p.price} LP` : ''}`);
    pushAi(`${t('Ho guardato prima i professionisti di LifePilot ({0}). Questi sono i migliori, dal voto più alto:', cat.label)}\n\n${lines.join('\n')}\n\n${t('Apri la scheda per scegliere data e ora: paghi in LifePoints solo al momento della prenotazione.')}`, {
      ext: { actions: [...plan.best.map((p): TheiaAction => ({ kind: 'open', label: p.name, page: 'servicePage', params: { name: p.name } })), { kind: 'dismiss', label: t('No, grazie') }] },
    });
    return;
  }
  const weak = plan.weak.length ? `\n\n${t('In LifePilot ho trovato solo: {0}. Il voto non è abbastanza alto per consigliartelo con sicurezza.', plan.weak.map((p) => `${p.name}${p.score ? ` (${stars(p.score)}/5)` : ''}`).join(', '))}` : '';
  pushAi(`${t('Su LifePilot non c\'è ancora un {0} abbastanza buono (cerco da {1}/5 in su).', cat.label, stars(GOOD_ENOUGH))}${weak}\n\n${t('Da qui non posso leggere le recensioni dei posti fuori dall\'app: ti apro la ricerca sulle mappe, già ordinata per vicinanza e recensioni.')}`, {
    ext: { actions: [...plan.weak.map((p): TheiaAction => ({ kind: 'open', label: p.name, page: 'servicePage', params: { name: p.name } })), { kind: 'open', label: req.order ? t('Ordina {0} a domicilio', cat.label) : t('Cerca {0} vicino a me', cat.label), url: plan.url }, { kind: 'dismiss', label: t('No, grazie') }] },
  });
}

/** Esegue un comando con l'assistente locale. false = non l'ha capito. */
async function runLocal(command: string): Promise<boolean> {
  const eng = getAssistant();
  try {
    const r = await eng.handle(command);
    if (!r.handled) return false;
    if (r.navigate) go(r.navigate);
    else pushAi(styleText(r.text, usePrefs.getState().answerStyle), { chips: r.chips });
    return true;
  } catch {
    pushAi(t('Qualcosa è andato storto. Riprova tra un attimo.'));
    return true;
  }
}

/** Non capito in locale: prima chiedo cosa intendeva, senza consumare AI e senza mandare nulla fuori dal telefono. */
function clarify(text: string, lang: string, source: 'typed' | 'voice', aiText = text) {
  const q = clean(text);
  const actions: TheiaAction[] = [];
  if (q) {
    actions.push({ kind: 'run', label: t('Crea un task'), command: `add task "${q}"` });
    actions.push({ kind: 'run', label: t('Aggiungi un impegno'), command: `add "${q}" to my plan` });
  }
  actions.push({ kind: 'run', label: t('Cosa sai fare?'), command: 'help' });
  // capisco almeno il contesto: se nomina soldi, salute, viaggi... propongo la pagina giusta e qualche comando
  const dom = domainsIn(text)[0];
  if (dom) {
    pushAi(t('Mi sembra che tu stia parlando di {0}. {1} Se vuoi, prova così:', dom.label, dom.hint), {
      chips: dom.examples.map((x) => t(x)),
      ext: { lang, actions: [{ kind: 'open', label: t('Apri {0}', dom.label), page: dom.page }] },
    });
    return;
  }
  pushAi(t('Non l\'ho riconosciuto tra le funzioni dell\'app. Cosa intendevi?'), {
    ext: {
      lang,
      detail: t('Io svolgo le funzioni di LifePilot e spiego come funzionano, ma non rispondo a domande aperte: così consumo pochissimo e rispetto l\'ambiente. Prova con un comando, per esempio «pubblica un post» o «invia 10 LifePoints a Giulia».'),
      actions,
    },
  });
}

/** Chiede al router AI (che applica "Solo sul telefono", limiti e consenso) e mostra l'esito con onestà. */
export async function delegate(req: { text: string; lang: string; source: 'typed' | 'voice'; images?: ExtImage[]; files?: number }): Promise<void> {
  let r: RouteResult;
  try {
    r = await routeRequest({ text: req.text, lang: req.lang, source: req.source, images: req.images });
  } catch (e) {
    r = { status: 'error', kind: 'chat', message: t('Non sono riuscita a contattare il router: {0}', e instanceof Error ? e.message : String(e)) };
  }
  showRoute(r, req);
}

function showRoute(r: RouteResult, req: { text: string; lang: string; source: 'typed' | 'voice'; images?: ExtImage[]; files?: number }) {
  const n = req.images?.length ?? 0;
  const files = req.files ?? 0;
  const retry: TheiaAction = { kind: 'retry', label: t('Riprova quando sarà collegata'), text: req.text, lang: req.lang, source: req.source, images: req.images };
  if (r.status === 'answered') {
    if (r.kind === 'clarify') {
      const options = (r.text ?? '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 4);
      pushAi(r.message, { chips: options });
      return;
    }
    if (r.kind === 'local') { pushAi(r.message); return; }
    pushAi(r.text || r.message, { ext: { images: r.images?.map((x) => x.uri), provider: r.provider } });
    return;
  }
  if (r.status === 'not_connected') {
    const head = n > 1
      ? t('Ho ricevuto le {0} immagini, ma l\'AI per leggere le immagini non è ancora collegata: restano salvate sul tuo telefono.', n)
      : n === 1
        ? t('Ho ricevuto l\'immagine, ma l\'AI per leggere le immagini non è ancora collegata: resta salvata sul tuo telefono.')
        : files > 0
          ? t('Ho salvato i file sul tuo telefono, ma l\'AI per leggere documenti (PDF, Word, Excel) non è ancora collegata: non ne leggo il contenuto e non invento nulla.')
          : t('Questa richiesta ha bisogno di un\'AI esterna e non è ancora collegata. Per ora faccio solo i comandi sul telefono: impegni, task, note, report.');
    pushAi(head, { ext: { detail: r.message, actions: [retry] } });
    return;
  }
  // limite raggiunto o errore: il messaggio del router dice anche quando si azzera
  pushAi(r.message, { ext: { actions: [retry], provider: r.provider } });
}

/** Approfondimento dell'estratto conto con l'AI: dopo il consenso, manda solo un riepilogo (totali), mai i singoli movimenti. */
async function deepStatementAnalysis(): Promise<void> {
  store().push({ who: 'me', text: t('Approfondisci con l’AI'), source: 'chat' });
  const summary = statementSummary();
  const gate = aiOn() ? { ok: await askSend('files', t('Riepilogo dei tuoi mesi (totali e categorie, senza i singoli movimenti)')), restore: () => {} } : await askSendRouted('files', t('Riepilogo dei tuoi mesi (totali e categorie, senza i singoli movimenti)'));
  if (!gate.ok) { pushAi(t('Va bene, non invio nulla. Quello che vedi qui sopra l’ho calcolato sul telefono.')); return; }
  try {
    logSend('files', summary.length, ['riepilogo']);
    const q = `Questo è il riepilogo delle mie finanze degli ultimi mesi (non sono consigli finanziari, spiegami solo in modo semplice):\n\n${summary}\n\nCosa noti? Dove spendo di più, come va il risparmio e cosa potrei controllare? Rispondi in modo breve e concreto, in italiano.`;
    if (aiServerConfigured) await pushReply(await askTheiaChat(q) || t('Risposta vuota dal server.'));
    else await delegate({ text: q, lang: 'it', source: 'typed' });
  } catch (e) {
    pushAi(e instanceof Error ? e.message : t('Errore del server AI.'));
  } finally { gate.restore(); }
}

/** Tocco su un pulsante di azione di un messaggio. */
export async function runAction(msgId: string, action: TheiaAction): Promise<void> {
  const msg = store().log.find((m) => m.id === msgId);
  if (msg?.ext) store().patchMsg(msgId, { ext: { ...msg.ext, actions: undefined } });
  switch (action.kind) {
    case 'dismiss': return;
    case 'open': {
      if (action.url) { try { await Linking.openURL(action.url); } catch { pushAi(t('Non riesco ad aprire il collegamento da qui.')); } }
      else if (action.page) go(action.page, action.params);
      return;
    }
    case 'run': {
      store().push({ who: 'me', text: action.label, source: 'chat' });
      if (!(await runLocal(action.command))) pushAi(t('Non l\'ho capito neanche così. Prova a scrivermelo in un altro modo.'));
      return;
    }
    case 'teach': {
      store().push({ who: 'me', text: action.label, source: 'chat' });
      useLearned.getState().startTeach(action.phrase);
      pushAi(t('Va bene, insegnami. Per «{0}» dimmi dove andare (per esempio «Budget», «Palestre», «Bollette») oppure scrivi un comando che già conosco, come «aggiungi task comprare latte». Lo faccio subito e me lo ricordo.', action.phrase));
      return;
    }
    case 'share': pushAi(t(await shareLearned(action.id))); return;
    case 'forget': {
      if (action.id.startsWith('shared:')) { useLearned.getState().block(action.id.slice(7)); void voteSharedCommand(action.id.slice(7), -1); }
      else useLearned.getState().forget(action.id);
      pushAi(t('Fatto, l’ho dimenticato.'));
      return;
    }
    case 'say': await sendTheia({ text: action.text, lang: useApp.getState().language, appLang: useApp.getState().language, forced: false, source: 'typed' }); return;
    case 'ai-analysis': await deepStatementAnalysis(); return;
    case 'add-invoices': addInvoicesFromChat(action); return;
    case 'ai-undo': { const f = undos.get(action.id); undos.delete(action.id); if (f) { f.slice().reverse().forEach((u) => u()); pushAi(t('Annullato.')); } else pushAi(t('Non posso più annullare quella modifica.')); return; }
    case 'wb': runWb(action); return;
    case 'kb-forget': useTheiaMemory.getState().forget(action.id); pushAi(t('Fatto: ho dimenticato quella risposta.')); return;
    case 'kb-redo': useTheiaMemory.getState().forget(action.id); await aiChatReply(action.text); return;
    case 'ai-do': { const r = applyAiAction(action.act); if (r.message) pushAi(r.message); return; }
    case 'shifts-apply': {
      const st = useShifts.getState();
      if (action.replace) st.shifts.slice().forEach((x) => st.remove(x.id));
      action.shifts.forEach((x) => useShifts.getState().save(x));
      pushAi(action.replace ? t('Fatto: i turni di prima sono stati sostituiti con quelli del file.') : t('Fatto: ho aggiunto i turni del file.'), { ext: { actions: [{ kind: 'open', label: t('Apri i turni'), page: 'shifts' }] } });
      return;
    }
    case 'pantry-add': { const n = usePantry.getState().addLines(action.lines.filter((l) => l.name.trim() && l.qty > 0)); pushAi(t('Fatto: ho aggiunto {0} prodotti al frigo.', n), { ext: { actions: [{ kind: 'open', label: t('Apri Frigo e spesa'), page: 'fitnessFridge' }] } }); return; }
    case 'meal-save': {
      const fit = useFitness.getState();
      if (action.foods.length) fit.set({ aiFoods: [...action.foods, ...fit.aiFoods.filter((f) => !action.foods.some((u) => u.id === f.id))].slice(0, 300) });
      const total = action.items.reduce((s, x) => s + x.grams, 0);
      const macros = sumMacros(action.items.map((x) => { const f = FOOD(x.foodId); return f ? macrosFor(f, x.grams) : { kcal: 0, p: 0, c: 0, f: 0 }; }));
      const id = fit.addMeal({ ts: Date.now(), name: mealTitle(action.items.map((x) => x.name)), grams: Math.round(total), macros, photo: action.photo, items: action.items });
      pushAi(t('Salvato nel diario: circa {0} kcal.', Math.round(macros.kcal)), { ext: { actions: [{ kind: 'open', label: t('Apri il pasto'), page: 'fitnessMealCard', params: { id } }] } });
      return;
    }
    case 'photo-route': store().push({ who: 'me', text: action.label, source: 'chat' }); await routeAs(action.to, action.uris, (txt, extra) => pushAi(txt, extra)); return;
    case 'bill': openBillReview({ uri: action.uri, mime: action.mime, name: action.name }); return;
    case 'read-files': store().push({ who: 'me', text: action.label, source: 'chat' }); await readFilesWithAi(action.text, action.files); return;
    case 'ask-ai': case 'retry':
      await delegate({ text: action.text, lang: action.lang, source: action.source, images: action.kind === 'retry' ? action.images : undefined });
  }
}
