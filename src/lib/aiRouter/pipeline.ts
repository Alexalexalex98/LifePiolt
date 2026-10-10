import { callProvider } from './adapters/index.ts';
import { alternativesText, classify, type Classification } from './classify.ts';
import { KIND_NAME } from './labels.ts';
import { buildContext, byteLength, describeOutgoing, needsConsent, redact, type AiData, type Consents, type Context, type OutgoingSummary, type Redaction, type SendLogEntry, type ShareFlags } from './privacy.ts';
import { canSpend, estimateRequestTokens, localOffsetMin, planById, type SpendCheck, type UsageEntry } from './quota.ts';
import { KIND_LABEL } from './registry.ts';
import { cleanLocal, rewriteFaithfully, REWRITE_SYSTEM_PROMPT, type RewriteOutcome } from './rewrite.ts';
import { pickUsable, selectProvider, type AiPrefs, type Selection } from './select.ts';
import { simplifyText, toAttachment, type Attachment } from './postprocess.ts';
import { tx } from './tx.ts';
import type { ProxyRequest, RouteImage, RouteRequest, RouteResult, ServerProxyClient, TaskKind } from './types.ts';

export type ConsentRequest = { providerId: string; providerShort: string; summary: OutgoingSummary; why: string; prompt: string };
export type ConsentAnswer = 'once' | 'always' | 'cancel';

export type Deps = {
  prefs: AiPrefs;
  planId: string;
  usage: UsageEntry[];
  consents: Consents;
  client: ServerProxyClient;
  /** un fornitore e' collegato se il server lo e' (oggi nessuno) */
  isConnected: (providerId: string) => boolean;
  now: number;
  tzOffsetMin?: number;
  profile: { lang: string; answerStyle: string };
  share: ShareFlags;
  data: AiData;
  askConsent?: (r: ConsentRequest) => Promise<ConsentAnswer>;
  onSpent?: (usage: UsageEntry, log: SendLogEntry) => void;
  onConsentAlways?: (providerId: string) => void;
  onAttachment?: (a: Attachment) => void;
  newId?: () => string;
};

export type Verdict = 'local' | 'clarify' | 'delegate';

/** Tutto cio' che il router ha deciso, senza spendere nulla (serve anche al simulatore). */
export type Plan = {
  cls: Classification;
  verdict: Verdict;
  selection?: Selection;
  quota?: SpendCheck;
  context?: Context;
  redaction?: Redaction;
  rewrite?: RewriteOutcome;
  /** testo che uscirebbe */
  prompt: string;
  outgoing?: OutgoingSummary;
  estCost: number;
  estTokens: number;
  providerId?: string;
  providerShort?: string;
  /** solo sul telefono attivo: nessuna delega possibile */
  phoneOnly: boolean;
  connected: boolean;
  message: string;
  status: RouteResult['status'];
  resultKind: string;
  /** per 'clarify': le opzioni da proporre (2-3) */
  options?: string[];
};

export const REWRITE_KINDS: TaskKind[] = ['image_generate', 'image_edit', 'music_generate'];

const CLARIFY_DEFAULT: TaskKind[] = ['chat'];

export function planRequest(req: RouteRequest, d: Deps, modelRewrite?: string | null): Plan {
  const cls = classify(req);
  const base = { cls, prompt: req.text.trim(), estCost: 0, estTokens: 0, phoneOnly: !!d.prefs.phoneOnly, connected: false };

  if (cls.local) return { ...base, verdict: 'local', status: 'answered', resultKind: 'local', message: cls.localReason ?? tx('Lo gestisce l\'assistente sul telefono.') };

  if (cls.needsConfirm) {
    const alts = (cls.alternatives.length ? cls.alternatives : CLARIFY_DEFAULT);
    const opts = [...new Set([...alts.map((k) => tx('Sì, voglio {0}', alternativesText([k]))), tx('No, rispondi solo con un testo')])].slice(0, 3);
    return { ...base, verdict: 'clarify', status: 'answered', resultKind: 'clarify', message: tx('Non sono sicura di cosa vuoi: {0} Non spendo nulla finché non me lo confermi.', cls.reason), options: opts };
  }

  const hasImages = !!req.images?.length;
  const sel = selectProvider({ kind: cls.kind, docFormat: cls.docFormat, hasImages, prefs: d.prefs });
  const estTokens = estimateRequestTokens(cls.kind, req.text);
  if (!sel.ok) return { ...base, verdict: 'delegate', selection: sel, estTokens, status: 'error', resultKind: cls.kind, message: sel.message };

  const chosen = sel.chosen;
  const estCost = chosen.cost;
  const quota = canSpend(d.usage, planById(d.planId), { kind: cls.kind, tokens: estTokens, cost: estCost }, d.now, d.tzOffsetMin ?? localOffsetMin(d.now));
  const redaction = redact(req.text, d.prefs.redact);
  const context = buildContext(cls.kind, req.text, { lang: d.profile.lang, answerStyle: d.profile.answerStyle, share: d.share, data: d.data, redact: d.prefs.redact });
  const rw = REWRITE_KINDS.includes(cls.kind) ? rewriteFaithfully(req.text, modelRewrite, d.profile.lang) : undefined;
  // la riscrittura parte dal testo gia' ripulito dai dati personali
  const rwSafe = rw && !modelRewrite ? { ...rw, text: cleanLocal(redaction.text) } : rw;
  const prompt = (rwSafe?.text ?? redaction.text).trim();
  const outgoing = describeOutgoing({ providerShort: chosen.provider.short, images: hasImages ? req.images!.length : 0, context, redactions: redaction.found });
  const usable = pickUsable(sel, d.isConnected);
  const shown = usable?.candidate ?? chosen;
  const common = { ...base, verdict: 'delegate' as Verdict, selection: sel, quota, context, redaction, rewrite: rwSafe, prompt, outgoing, estCost, estTokens, providerId: shown.provider.id, providerShort: shown.provider.short, connected: !!usable, resultKind: cls.kind };

  if (!quota.ok) return { ...common, status: 'limit', message: quota.reason };
  if (d.prefs.phoneOnly) return { ...common, status: 'not_connected', message: tx('Questa richiesta richiede un\'AI esterna: attivala in Intelligenza di Theia.') };
  if (!usable) {
    return { ...common, status: 'not_connected', message: tx('Per questa richiesta userei {0} ({1}). Non è ancora collegato: quando lo sarà, il testo che invierei è: «{2}». {3} {4}', chosen.provider.short, tx(KIND_NAME[cls.kind]).toLowerCase(), prompt, outgoing.headline, outgoing.notSent) };
  }
  return { ...common, status: 'answered', message: sel.explanation };
}

export type Trace = { plan: Plan; result: RouteResult; options?: string[] };

/** Esegue la pipeline completa. Non spende mai senza limiti verificati e consenso. */
export async function routeDetailed(req: RouteRequest, d: Deps): Promise<Trace> {
  // riscrittura con modello (solo se il server e' collegato, il testo non e' vuoto e l'utente non ha escluso i servizi esterni)
  let modelRewrite: string | null = null;
  const first = planRequest(req, d, null);
  const finish = (plan: Plan, result: RouteResult): Trace => ({ plan, result, options: plan.options });
  const msgOnly = (p: Plan): RouteResult => {
    return { status: p.status, kind: p.resultKind, message: p.message, ...(p.options ? { text: p.options.join('\n') } : {}), ...(p.providerId && p.status !== 'answered' ? { provider: p.providerId } : {}) };
  };
  if (first.verdict !== 'delegate' || first.status === 'limit' || first.status === 'error' || first.phoneOnly || !first.connected) return finish(first, msgOnly(first));

  const sel = first.selection as Extract<Selection, { ok: true }>;
  const hasImages = !!req.images?.length;
  const newId = d.newId ?? (() => Math.random().toString(36).slice(2));

  if (REWRITE_KINDS.includes(first.cls.kind) && d.client.isConfigured()) {
    const rewriter = selectProvider({ kind: 'translate', prefs: d.prefs });
    const rp = rewriter.ok ? pickUsable(rewriter, d.isConnected) : null;
    if (rp) {
      const r = await callProvider(d.client, { kind: 'rewrite', provider: rp.candidate.provider.id, prompt: redact(req.text, d.prefs.redact).text, attachments: [], constraints: { lang: d.profile.lang }, context: [{ key: 'system', value: REWRITE_SYSTEM_PROMPT }] });
      if (r.type === 'ok' && r.res.text) modelRewrite = r.res.text;
    }
  }
  const plan = modelRewrite ? planRequest(req, d, modelRewrite) : first;

  let lastMessage = '';
  for (const cand of sel.ranking) {
    if (!d.isConnected(cand.provider.id)) continue;
    const consent = needsConsent(cand.provider.id, d.consents, plan.outgoing?.sensitive ?? false);
    if (consent.needed) {
      const ans = d.askConsent ? await d.askConsent({ providerId: cand.provider.id, providerShort: cand.provider.short, summary: plan.outgoing!, why: consent.why, prompt: plan.prompt }) : 'cancel';
      if (ans === 'cancel') return finish(plan, { status: 'error', kind: plan.resultKind, provider: cand.provider.id, message: tx('Annullato: non ho inviato nulla.') });
      if (ans === 'always') d.onConsentAlways?.(cand.provider.id);
    }
    const body: ProxyRequest = {
      kind: plan.cls.kind, provider: cand.provider.id, prompt: plan.prompt,
      attachments: (req.images ?? []).map((im: RouteImage, i) => ({ id: `img${i}`, kind: 'image' as const, mime: im.mime })),
      constraints: { lang: d.profile.lang, euOnly: d.prefs.euOnly, noImages: d.prefs.noImages, docFormat: plan.cls.docFormat },
      context: plan.context?.items.map((i) => ({ key: i.key, value: i.value })),
    };
    const out = await callProvider(d.client, body);
    if (out.type === 'retry') { lastMessage = out.message; continue; }
    if (out.type === 'fail') return finish(plan, { status: 'error', kind: plan.resultKind, provider: cand.provider.id, message: out.message });

    const res = out.res;
    const spent: UsageEntry = {
      ts: d.now, kind: plan.cls.kind, units: res.usage?.units ?? 1,
      tokens: (res.usage?.tokensIn ?? 0) + (res.usage?.tokensOut ?? 0) || plan.estTokens, cost: res.usage?.cost ?? cand.cost,
    };
    const parts = ['testo', ...(hasImages ? ['immagini'] : []), ...plan.context!.items.filter((i) => i.key !== 'lang' && i.key !== 'style').map((i) => i.key as string)];
    d.onSpent?.(spent, { id: newId(), ts: d.now, kind: plan.cls.kind, provider: cand.provider.id, bytes: byteLength(plan.prompt) + (plan.context?.items.reduce((a, i) => a + byteLength(i.value), 0) ?? 0), parts, redacted: plan.redaction?.total ?? 0 });

    const images: RouteImage[] = [];
    const atts: Attachment[] = [];
    for (const a of res.assets ?? []) {
      const att = toAttachment(a, newId(), plan.cls.docFormat);
      atts.push(att);
      d.onAttachment?.(att);
      if (a.kind === 'image') images.push({ uri: a.url, mime: a.mime, width: a.width, height: a.height });
    }
    const textKinds: TaskKind[] = ['chat', 'reasoning', 'vision_read', 'translate', 'summarize', 'web_search', 'agent_task', 'speech_to_text'];
    let text = res.text;
    if (text && textKinds.includes(plan.cls.kind) && plan.cls.kind !== 'translate') text = simplifyText(text, d.profile).text;
    if (!text && atts.length) text = atts.map((a) => a.title).join(', ');
    return finish(plan, { status: 'answered', kind: plan.resultKind, provider: cand.provider.id, ...(text ? { text } : {}), ...(images.length ? { images } : {}), message: cand === sel.chosen ? sel.explanation : tx('Ho usato {0} perché il fornitore preferito non era disponibile.', cand.provider.short) });
  }
  return finish(plan, { status: 'error', kind: plan.resultKind, message: lastMessage || tx('Nessun fornitore ha risposto per {0}.', KIND_LABEL[plan.cls.kind]) });
}
