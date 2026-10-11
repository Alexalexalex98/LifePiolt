/**
 * Comprensione in 12 lingue, offline e onesta.
 * `understand(text, lang)` riconosce la lingua, e per le 10 lingue oltre a italiano/inglese traduce il comando in un comando CANONICO IN INGLESE
 * che l'assistente locale (src/lib/assistant) esegue senza modifiche. È un lessico, non una comprensione generale: se non è sicuro non indovina.
 */
import { fold } from './fold.ts';
import { extractWhen } from './when.ts';
import { applyRules, hitsOf, titleOf, type Ctx, type Span } from './rules.ts';
import { detectLang } from './detect.ts';
import { rx } from './build.ts';
import { LEXICONS } from './lex/index.ts';
import type { Concept, Understood } from './types.ts';

export { detectLang, scriptOf } from './detect.ts';
export type { Understood } from './types.ts';
export const NATIVE_ENGINE_LANGS = ['it', 'en'];

export type UnderstandOpts = {
  /** true se l'utente ha scelto la lingua del messaggio (voce con lingua scelta): non si rileva */
  forced?: boolean;
  /** lingua dell'app: preferita quando il rilevamento è incerto */
  appLang?: string;
};

const QUOTE = /[«“"„「『][^»”"」』]{1,80}[»”"」』]/u;

export function understand(text: string, lang: string, opts: UnderstandOpts = {}): Understood {
  const raw = (text ?? '').trim();
  if (!raw) return { status: 'unknown', lang };
  const target = opts.forced ? lang : detectLang(raw, opts.appLang ?? lang).lang;
  if (target === 'it' || target === 'en' || !LEXICONS[target as keyof typeof LEXICONS]) {
    // una lingua che non conosciamo: se è it/en passa com'è; altrimenti non indovino
    return target === 'it' || target === 'en' ? { status: 'passthrough', text: raw, lang: target } : { status: 'unknown', lang: target };
  }
  const lex = LEXICONS[target as keyof typeof LEXICONS];
  const fd = fold(raw, lex.script);
  let f = fd.f;
  const all: Span[] = [];

  // titolo tra virgolette: resta identico
  let quoted: string | undefined;
  const q = QUOTE.exec(f);
  if (q) {
    const a = q.index, b = q.index + q[0].length;
    quoted = fd.src.slice(fd.map[a + 1], fd.map[b - 1]).trim();
    f = f.slice(0, a) + ' '.repeat(b - a) + f.slice(b);
    all.push([a, b]);
  }

  // le parole che fanno parte di un impegno ("makan malam" = cena) non sono una fascia oraria
  const protect: Span[] = [];
  for (const k of ['event', 'cal', 'task'] as Concept[]) {
    const src = lex.c[k]; if (!src) continue;
    const re = new RegExp(rx(lex, src).source, 'gu');
    for (let mm = re.exec(f); mm; mm = re.exec(f)) { if (!mm[0].length) { re.lastIndex++; continue; } protect.push([mm.index, mm.index + mm[0].length]); }
  }
  const { when, f: f2 } = extractWhen(lex, f, protect);
  all.push(...when.spans);
  const hit = hitsOf(lex, f2);
  // "有什么安排" / "what's planned": la parola di azione dentro la domanda non è un comando
  const qh = hit.h.qHave;
  if (qh) for (const k of ['add', 'plan', 'write', 'mark'] as Concept[]) { const sp = hit.h[k]; if (sp && sp[0] < qh[1] && qh[0] < sp[1]) delete hit.h[k]; }
  // "riepilogo di oggi": la frase contiene una parola di data, che sopra è stata tolta
  if (!hit.h.briefing && lex.c.briefing && rx(lex, lex.c.briefing).test(f)) hit.h.briefing = [0, 0];
  const spans: Span[] = [...all];
  for (const s of Object.values(hit.h)) if (s && s[1] > s[0]) spans.push(s);

  // persona (condivisione agenda)
  let person: string | undefined;
  if (hit.personSpan) {
    const [x, y] = hit.personSpan;
    person = fd.src.slice(fd.map[x], fd.map[y]).trim();
    person = person.charAt(0).toLocaleUpperCase() + person.slice(1);
    spans.push(hit.personSpan);
  }

  const richTitle = (strip: Concept[]) => {
    const cut: Span[] = [...all];
    const pol = hit.h.polite; if (pol && pol[1] > pol[0]) cut.push(pol);
    for (const k of strip) { const s = hit.h[k]; if (s && s[1] > s[0]) cut.push(s); }
    for (const [k, s] of Object.entries(hit.h)) if (k.startsWith('page:') || k.startsWith('mood:')) { void s; }
    return titleOf({ lex, fd }, cut);
  };

  // parole non spiegate (per capire se la frase è davvero un comando semplice)
  const leftover = titleOf({ lex, fd }, spans);
  const words = !leftover ? 0 : lex.spaced ? leftover.split(/\s+/).length : Math.ceil(leftover.length / 2);

  const c: Ctx = { lex, fd, f: f2, h: hit.h, page: hit.page, mood: hit.mood, w: when, quoted, person, all, words };

  // rinomina: "X in Y" (svo) oppure "X <nome> Y" (lingue SOV: il vecchio nome sta prima del verbo)
  if (hit.h.rename) {
    const r = hit.h.rename;
    const rest: Span[] = [...all];
    for (const k of ['polite', 'rename', 'task', 'event'] as Concept[]) { const s = hit.h[k]; if (s && s[1] > s[0]) rest.push(s); }
    const intoRe = lex.c.into ? rx(lex, lex.c.into) : null;
    const im = intoRe ? intoRe.exec(f2.slice(r[1])) : null;
    const iS = im ? r[1] + im.index : -1, iE = im ? r[1] + im.index + im[0].length : -1;
    let old = '', neu = '';
    if (lex.renameSov) {
      old = titleOf({ lex, fd }, rest, 0, r[0]);
      neu = im ? titleOf({ lex, fd }, rest, r[1], iS) : titleOf({ lex, fd }, rest, r[1]);
    } else if (im) {
      old = titleOf({ lex, fd }, rest, r[1], iS);
      neu = titleOf({ lex, fd }, rest, iE);
    }
    if (old && neu) c.rn = { old, neu };
  }

  const m = applyRules(c, richTitle);
  if (!m) {
    // solo data/ora (risposta a "quando?")
    const only = (when.any || when.hint) && !leftover.trim() && !Object.keys(hit.h).some((k) => k !== 'polite');
    if (only) {
      const en = [when.day, when.start && when.end ? `from ${when.start} to ${when.end}` : when.start ? `at ${when.start}` : '', when.dur ? `for ${when.dur}` : ''].filter(Boolean).join(' ');
      if (en) return { status: 'translated', text: en, lang: target, intent: 'when.only', confidence: 0.8 };
    }
    return { status: 'unknown', lang: target };
  }
  return { status: m.confidence >= 0.7 ? 'translated' : 'confirm', text: m.text, lang: target, intent: m.intent, confidence: m.confidence };
}
