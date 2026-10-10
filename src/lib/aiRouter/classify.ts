import { AGENT_NOUN, AGENT_VERB, DOC_DOCX, DOC_PDF, DOC_SHEET, DOC_SLIDES, DRAW, EDIT, IMG, LANGS, MAKE, PLAY, REASON, SONG, STT, SUMMARIZE, TAKE_PHOTO, TRANSLATE, TTS, WEB, type KW } from './keywords.ts';
import { indexOfWord, normalize } from './match.ts';
import { localVerdict } from './localFirst.ts';
import { tx } from './tx.ts';
import { KIND_LABEL_SHORT } from './labels.ts';
import type { DocFormat, RouteImage, TaskKind } from './types.ts';

/** Classificazione deterministica del compito. Se il segnale e' debole NON si spende: kind 'chat', confidenza bassa, needsConfirm. */
export type Classification = {
  kind: TaskKind;
  docFormat?: DocFormat;
  confidence: number;
  /** vero se serve chiedere conferma all'utente prima di fare qualunque cosa a pagamento */
  needsConfirm: boolean;
  reason: string;
  /** gestibile in locale, senza alcuna AI esterna */
  local: boolean;
  localReason?: string;
  /** compiti possibili da proporre quando la richiesta e' ambigua */
  alternatives: TaskKind[];
};

export const CONFIRM_BELOW = 0.7;

export { normalize };

const cache = new Map<KW, string[]>();
function flat(kw: KW): string[] {
  let v = cache.get(kw);
  if (!v) { v = []; for (const l of LANGS) for (const w of kw[l]) v.push(normalize(w)); cache.set(kw, v); }
  return v;
}

/** Posizione della prima parola chiave trovata (-1 se nessuna). Inizio di parola per le lingue con spazi. */
export function findPos(text: string, kw: KW): number {
  let best = -1;
  for (const w of flat(kw)) {
    const i = indexOfWord(text, w);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

type Cand = { kind: TaskKind; docFormat?: DocFormat; conf: number; pos: number; why: string };
const PRIORITY: TaskKind[] = ['web_search', 'translate', 'summarize', 'speech_to_text', 'text_to_speech', 'image_edit', 'image_generate', 'music_generate', 'document_create', 'agent_task', 'reasoning'];

export function classify(req: { text: string; images?: RouteImage[] }): Classification {
  const raw = req.text ?? '';
  const n = normalize(raw);
  const hasImages = !!req.images && req.images.length > 0;
  const mk = (kind: TaskKind, confidence: number, reason: string, extra: Partial<Classification> = {}): Classification => ({ kind, confidence, needsConfirm: confidence < CONFIRM_BELOW, reason, local: false, alternatives: [], ...extra });

  if (!n.trim()) return hasImages ? mk('vision_read', 0.8, tx('Hai allegato un\'immagine senza testo: la leggo e la descrivo.')) : mk('chat', 1, tx('Nessun testo.'), { needsConfirm: false });

  const make = findPos(n, MAKE);
  const strong: Cand[] = [];
  const weak: { kind: TaskKind; why: string }[] = [];
  const add = (c: Cand) => strong.push(c);

  const web = findPos(n, WEB); if (web >= 0) add({ kind: 'web_search', conf: 0.9, pos: web, why: tx('Chiedi una ricerca sul web.') });
  const tr = findPos(n, TRANSLATE); if (tr >= 0) add({ kind: 'translate', conf: 0.9, pos: tr, why: tx('Chiedi una traduzione.') });
  const su = findPos(n, SUMMARIZE); if (su >= 0) add({ kind: 'summarize', conf: 0.9, pos: su, why: tx('Chiedi un riassunto.') });
  const st = findPos(n, STT); if (st >= 0) add({ kind: 'speech_to_text', conf: 0.85, pos: st, why: tx('Chiedi una trascrizione.') });
  const ts = findPos(n, TTS); if (ts >= 0) add({ kind: 'text_to_speech', conf: 0.85, pos: ts, why: tx('Chiedi di leggere ad alta voce.') });

  // musica
  const song = findPos(n, SONG); const play = findPos(n, PLAY);
  if (song >= 0) {
    if (play >= 0 && make < 0) { /* ascoltare non e' creare: nessun compito a pagamento */ }
    else if (make >= 0) add({ kind: 'music_generate', conf: 0.9, pos: song, why: tx('Chiedi di creare una canzone.') });
    else weak.push({ kind: 'music_generate', why: tx('una canzone') });
  }

  // immagini
  const draw = findPos(n, DRAW); const img = findPos(n, IMG); const take = findPos(n, TAKE_PHOTO); const edit = findPos(n, EDIT);
  if (!(take >= 0 && draw < 0)) {
    const wantsImage = draw >= 0 || (img >= 0 && make >= 0);
    if (wantsImage) {
      const pos = draw >= 0 ? draw : img;
      if (hasImages) add({ kind: 'image_edit', conf: edit >= 0 ? 0.8 : 0.65, pos, why: edit >= 0 ? tx('Chiedi di modificare l\'immagine allegata.') : tx('Hai allegato un\'immagine e chiedi di crearne una: non so se vuoi modificarla.') });
      else add({ kind: 'image_generate', conf: draw >= 0 ? 0.9 : 0.85, pos, why: tx('Chiedi di creare un\'immagine.') });
    } else if (img >= 0 && !hasImages) weak.push({ kind: 'image_generate', why: tx('un\'immagine') });
    else if (hasImages && edit >= 0 && img >= 0) add({ kind: 'image_edit', conf: 0.8, pos: edit, why: tx('Chiedi di modificare l\'immagine allegata.') });
  }

  // documenti
  const fmts: [DocFormat, number][] = [['slides', findPos(n, DOC_SLIDES)], ['sheet', findPos(n, DOC_SHEET)], ['pdf', findPos(n, DOC_PDF)], ['docx', findPos(n, DOC_DOCX)]];
  const found = fmts.filter(([, p]) => p >= 0);
  if (found.length) {
    const fmt = found[0][0];
    const pos = Math.min(...found.map(([, p]) => p));
    if (make >= 0) add({ kind: 'document_create', docFormat: fmt, conf: 0.85, pos, why: tx('Chiedi di creare un documento.') });
    else weak.push({ kind: 'document_create', why: tx('un documento') });
  }

  // agenti
  const an = findPos(n, AGENT_NOUN);
  if (an >= 0) { if (findPos(n, AGENT_VERB) >= 0) add({ kind: 'agent_task', conf: 0.85, pos: an, why: tx('Chiedi di usare un agente.') }); else weak.push({ kind: 'agent_task', why: tx('un agente') }); }

  const rs = findPos(n, REASON);
  // delega solo cio' che serve davvero a un altro modello: media, documenti, agenti e web battono il locale; il resto, se e' un comando dell'app, resta in locale
  const lv = localVerdict(raw);
  const MEDIA: TaskKind[] = ['image_generate', 'image_edit', 'music_generate', 'document_create', 'agent_task', 'web_search'];
  if (lv.local && !strong.some((c) => MEDIA.includes(c.kind) && c.conf >= CONFIRM_BELOW)) {
    return mk('chat', 0.9, lv.reason, { local: true, localReason: lv.reason, needsConfirm: false });
  }
  const main = strong;
  if (main.length) {
    const ok = main.filter((c) => c.conf >= CONFIRM_BELOW);
    const pool = ok.length ? ok : main;
    pool.sort((a, b) => a.pos - b.pos || PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
    const c = pool[0];
    const alt = c.conf < CONFIRM_BELOW ? (c.kind === 'image_edit' ? ['image_edit', 'image_generate', 'vision_read'] : [c.kind]) as TaskKind[] : [];
    return mk(c.kind, c.conf, c.why, { docFormat: c.docFormat, alternatives: alt });
  }
  if (hasImages) return mk('vision_read', 0.9, tx('Hai allegato un\'immagine: la leggo.'));
  if (rs >= 0) return mk('reasoning', 0.75, tx('Serve un ragionamento a piu\' passi.'));
  if (weak.length) {
    const what = weak.map((w) => w.why).join(tx(' o '));
    return mk('chat', 0.4, tx('Non e\' chiaro se vuoi {0}: prima di usare un servizio a pagamento ti chiedo conferma.', what), { needsConfirm: true, alternatives: weak.map((w) => w.kind) });
  }
  return mk('chat', 0.8, tx('Conversazione normale.'), { needsConfirm: false });
}

/** Frase leggibile per proporre le alternative. */
export const alternativesText = (alts: TaskKind[]): string => alts.map((k) => KIND_LABEL_SHORT[k]).join(tx(' oppure '));
