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
import { aiServerConfigured } from '@/lib/aiServer';
import { askSend, askSendRouted, logSend } from '@/lib/aiConsent';
import { askTheiaChat, askTheiaFiles } from '@/lib/theia';
import { describeAnalysis, isBillType } from '@/lib/docAnalysis';
import { statementSummary } from '@/lib/statementReport';
import { useFin } from '@/store/finance';
import { refreshBillReminders } from '@/lib/bills/schedule';
import { openBillReview } from '@/components/theia/billRoute';
import { BILL_FOLDER } from '@/lib/bills/files';
import { useLife } from '@/store/life';
import { useAiRouter } from '@/store/aiRouter';
import { weekdayShortDate } from '@/lib/format';
import { fmtBytes, needsAnalysis, textPayload, type Att } from '@/lib/attachments';
import { isCancel, isNo, isYes } from './appActionCore';
import { t } from '@/i18n/core';
import { understand } from '@/lib/langLexicon';
import { go } from '@/lib/nav';
import { formatMoney } from '@/i18n/format';
import { fillTarget, generalize, looksLikeCommand, matchLearned } from './learned';
import { findFixed, parseFixedEdit } from './financeEdit';
import { useLearned } from '@/store/learned';
import { shareLearned, voteSharedCommand } from '@/social/sharedCommands';
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

const store = () => useAssistant.getState();
const pushAi = (text: string, extra: { chips?: string[]; ext?: TheiaExt } = {}): AMsg => store().push({ who: 'ai', text, source: 'chat', chips: extra.chips, ext: extra.ext });
const clean = (s: string) => s.replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim();

/** Il server AI e' collegato e l'utente non ha scelto "Solo sul telefono". */
const aiOn = () => aiServerConfigured && !useAiRouter.getState().prefs.phoneOnly;

/** Saluti, ringraziamenti, si/no senza domanda in sospeso e frasi libere: risponde l'AI come una persona. */
const SMALLTALK = /^(ciao|salve|hey|ehi|buongiorno|buonasera|buon pomeriggio|buonanotte|hi|hello|grazie|thanks|thank you)\b/;

async function aiChatReply(text: string): Promise<void> {
  try {
    pushAi(await askTheiaChat(text) || t('Risposta vuota dal server.'));
  } catch (e) {
    pushAi(`${e instanceof Error ? e.message : t('Errore del server AI.')}\n\n${t('I comandi sul tuo piano, i task e i report funzionano comunque.')}`);
  }
}

/** Il documento ricevuto in chat finisce SEMPRE in LifeDrive (resta sul telefono): niente invio, nessun consenso necessario. */
function saveToDrive(atts: Att[]) {
  const life = useLife.getState();
  for (const a of atts) {
    if (a.kind !== 'document' || !a.uri || life.drive.some((d) => d.uri === a.uri)) continue;
    life.addFile({ n: a.name, s: fmtBytes(a.size) || '—', folder: a.billish ? BILL_FOLDER : 'Chat con Theia', date: weekdayShortDate(), uri: a.uri });
  }
}

/** «aggiungi / carica / inserisci una bolletta o fattura» */
const BILL_ADD = /\b(aggiung|carica|caricare|inserisc|registr|nuov|metti|mettere|salva|salvare)\w*\b.*\b(bolletta|bollette|fattura|fatture)\b/;

const TIPO = /^\s*TIPO:\s*(\w+)\s*$/im;
const FILE_SUFFIX = '\n\nSe nel file riconosci una bolletta o una fattura da pagare, chiudi la risposta con una riga a parte: TIPO: bolletta';

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
    const { reply, result } = await askTheiaFiles(`${question || t('Dimmi di cosa si tratta e cosa mi consigli di farne.')}${FILE_SUFFIX}`, files);
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
    pushAi(text || t('Risposta vuota dal server.'), bill && first ? { ext: { actions: [{ kind: 'bill', label: t('Aggiungi alle bollette'), uri: first.uri, mime: first.mime, name: first.name ?? t('Bolletta') }, { kind: 'dismiss', label: t('No, grazie') }] } } : undefined);
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
  const eng = getAssistant();
  const payload = textPayload(atts);
  const withAtts = atts.length ? { attachments: atts } : {};

  // immagini o documenti che il telefono non sa leggere (PDF, Word, Excel): restano salvati e, se serve l'analisi, risponde il router (oggi non collegato)
  if (images.length || atts.some(needsAnalysis)) {
    store().push({ who: 'me', text, source: 'chat', topic: i.topic, ext: { images: images.length ? images.map((x) => x.uri) : undefined, ...withAtts, lang: i.lang, voice: i.source === 'voice' } });
    saveToDrive(atts);
    if (aiOn()) {
      const list = [...images.map((x) => ({ uri: x.uri, mime: x.mime })), ...atts.filter((a) => a.kind === 'document' && a.uri && !a.text).map((a) => ({ uri: a.uri!, mime: a.mime ?? 'application/pdf', name: a.name }))];
      if (list.length) { await readFilesWithAi([text, payload].filter(Boolean).join('\n\n'), list); return; }
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

  // sto imparando un comando: questa frase è la dimostrazione (una pagina o un comando che già so)
  if (useLearned.getState().teaching) { await teachStep(text, command); return; }

  // con l'AI collegata, saluti e frasi senza una domanda in sospeso le gestisce l'AI come una persona
  if (aiOn() && !pending && !eng.pending) {
    const n = norm(text);
    const loneAnswer = (isYes(text) || isNo(text)) && n.split(' ').length > 3;
    if ((SMALLTALK.test(n) && n.split(' ').length <= 8) || loneAnswer) { await aiChatReply([text, payload].filter(Boolean).join('\n\n')); return; }
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
      pushAi(styleText(r.text, usePrefs.getState().answerStyle), { chips: r.chips });
      if (r.navigate) go(r.navigate);
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
      const label = PAGES.find((p) => p.page === set.target)?.label ?? '';
      go(set.target);
      pushAi(label ? t('Ecco {0}.', label) : t('Ecco la pagina.'));
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
    pushAi(styleText(r.text, usePrefs.getState().answerStyle), { chips: r.chips });
    if (r.navigate) go(r.navigate);
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
    if (aiServerConfigured) pushAi(await askTheiaChat(q) || t('Risposta vuota dal server.'));
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
    case 'bill': openBillReview({ uri: action.uri, mime: action.mime, name: action.name }); return;
    case 'read-files': store().push({ who: 'me', text: action.label, source: 'chat' }); await readFilesWithAi(action.text, action.files); return;
    case 'ask-ai': case 'retry':
      await delegate({ text: action.text, lang: action.lang, source: action.source, images: action.kind === 'retry' ? action.images : undefined });
  }
}
