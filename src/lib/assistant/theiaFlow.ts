import { Linking } from 'react-native';
import { handleAppAction } from './appActions';
import { GOOD_ENOUGH, PLACE_CATEGORIES, detectPlace, planPlaceSearch, type PlaceRequest } from '@/lib/findPlace';
import { matchPhrase } from './phrases';
import { PAGES, findAmount, findPerson, norm } from './appActionCore';
import { NOT_A_SEARCH } from './dictionary';
import { peoplePool } from '@/lib/network';
import { useApp } from '@/store/app';
import { domainsIn } from './dictionary';
import { useNet } from '@/store/network';
import { helpAnswer, looksLikeHelp, searchHelp } from '@/lib/helpKb';
import { routeRequest, type RouteResult } from '@/lib/aiRouter';
import { needsAnalysis, textPayload, type Att } from '@/lib/attachments';
import { t } from '@/i18n/core';
import { understand } from '@/lib/langLexicon';
import { go } from '@/lib/nav';
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
    const files = atts.filter(needsAnalysis).length;
    if (!text && !images.length) {
      pushAi(files > 1
        ? t('Ho salvato i {0} file sul tuo telefono. Non so ancora leggerne il contenuto (PDF, Word, Excel): serve il servizio di analisi dei documenti, non ancora collegato. Se sono bollette o fatture puoi usare «Analizza come bolletta/fattura».', files)
        : t('Ho salvato il file sul tuo telefono. Non so ancora leggerne il contenuto (PDF, Word, Excel): serve il servizio di analisi dei documenti, non ancora collegato. Se è una bolletta o una fattura puoi usare «Analizza come bolletta/fattura».'));
      return;
    }
    await delegate({ text: [text, payload].filter(Boolean).join('\n\n'), lang: i.lang, source: i.source, images: images.length ? images : undefined, files: images.length ? 0 : files });
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

  // funzioni dell'app (pubblica un post, crea un LifeClub, invia LifePoints...): le svolge Theia, anche a più domande
  if (handleAppAction(command ?? text, (m, x) => { pushAi(m, x); })) return;

  if (u.status === 'confirm') {
    pushAi(t('Non sono sicura di aver capito. Vuoi dire: «{0}»?', u.text), {
      ext: { lang: u.lang, actions: [{ kind: 'run', label: t('Sì, fallo'), command: u.text }, { kind: 'dismiss', label: t('No') }] },
    });
    return;
  }

  // «devo prenotare un dentista»: prima i professionisti di LifePilot, poi (solo se nessuno è abbastanza buono) la ricerca fuori dall'app
  // frasi intere (livello più preciso): «voglio ordinare una pizza», «mi serve un dentista», «quanto ho speso questo mese»…
  if (!pending && (await handlePhrase(command ?? text))) return;
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
  clarify(text, u.lang, i.source, [text, payload].filter(Boolean).join('\n\n'));
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
    case 'ask-ai': case 'retry':
      await delegate({ text: action.text, lang: action.lang, source: action.source, images: action.kind === 'retry' ? action.images : undefined });
  }
}
