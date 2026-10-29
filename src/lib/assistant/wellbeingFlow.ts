import { t } from '@/i18n/core';
import { CRISIS_RESOURCES, CRISIS_TEXT } from '@/lib/safety';
import { QUESTIONNAIRES, isDue, scoreQuestionnaire, type QKind } from '@/lib/wellbeing/questionnaires';
import { deviations, describeDeviations, type Sig } from '@/lib/wellbeing/baseline';
import { useAssistant } from '@/store/assistant';
import { useWellbeing } from '@/store/wellbeing';
import type { TheiaAction } from './theiaExt';

/** Il benessere in chat: consenso esplicito, questionari brevi a domande e risposte, segnalazione dei cambiamenti dal solito. Non è una diagnosi. */
const push = (text: string, actions?: TheiaAction[]) => useAssistant.getState().push({ who: 'ai', text, source: 'chat', ext: actions?.length ? { actions } : undefined });
const mine = (text: string) => useAssistant.getState().push({ who: 'me', text, source: 'chat' });
const wb = (label: string, op: 'consent' | 'start' | 'answer' | 'cancel', extra: { q?: QKind; v?: number } = {}): TheiaAction => ({ kind: 'wb', label, op, ...extra });

export const WB_LIMITS = 'LifePilot ti accompagna e ti orienta, ma non fa diagnosi e non sostituisce un medico o uno psicologo. Se ti senti male da più di due settimane, o stai peggiorando, parlane con uno specialista.';
export const WB_CONSENT_TEXT = 'Per aiutarti a capire come stai, posso guardare insieme umore, sonno, pasti, movimento e impegni, e proporti ogni tanto un breve questionario riconosciuto (WHO-5 o PHQ-9). Sono dati sulla salute: li uso solo sul tuo telefono, solo se me lo permetti, li tengo al minimo e puoi cancellarli quando vuoi dal Centro Privacy. Quello che mi racconti in chat resta tra noi.';

/** Il consenso viene prima di tutto: senza, non si calcola e non si chiede nulla. */
export function askConsent(): void {
  push(`${t(WB_CONSENT_TEXT)}\n\n${t(WB_LIMITS)}`, [wb(t('Va bene, acconsento'), 'consent'), { kind: 'dismiss', label: t('Non ora') }]);
}

function question(kind: QKind, i: number): void {
  const q = QUESTIONNAIRES[kind];
  const head = i === 0 ? `${t(q.intro)}\n\n` : '';
  push(`${head}${i + 1}/${q.items.length}. ${t(q.items[i]!)}`, [...q.options.map((o) => wb(t(o.label), 'answer', { v: o.v })), wb(t('Interrompi'), 'cancel')]);
}

export function startQuestionnaire(kind: QKind): void {
  if (!useWellbeing.getState().consent) { askConsent(); return; }
  useWellbeing.getState().start(kind);
  question(kind, 0);
}

const BAND_TEXT = {
  ok: 'È un punteggio nella norma. Lo rifacciamo tra un paio di settimane, così vediamo come cambia.',
  attenzione: 'È un punteggio che merita attenzione. Se dura da più di due settimane, parlane con il tuo medico di famiglia o con uno psicologo: non devi aspettare di stare peggio.',
  alto: 'È un punteggio che non voglio ignorare. Ti consiglio di parlarne presto con il tuo medico o con uno psicologo: da solo/a pesa di più. Se vuoi, ti aiuto a prepararti a quella conversazione.',
} as const;

export function answerQuestionnaire(label: string, v: number): void {
  mine(label);
  const s = useWellbeing.getState();
  const p = s.answer(v);
  if (!p) return;
  const q = QUESTIONNAIRES[p.kind];
  if (p.answers.length < q.items.length) { question(p.kind, p.answers.length); return; }
  const r = scoreQuestionnaire(p.kind, p.answers);
  s.finish({ kind: p.kind, score: r.score, max: r.max, label: r.label });
  const what = p.kind === 'who5' ? t('Il tuo punteggio WHO-5 è {0} su {1} ({2}).', r.score, r.max, t(r.label)) : t('Il tuo punteggio PHQ-9 è {0} su {1} (sintomi {2}).', r.score, r.max, t(r.label));
  push(`${what}\n\n${t(BAND_TEXT[r.band])}\n\n${t(WB_LIMITS)}`, [{ kind: 'say', label: t('Parliamone'), text: 'vorrei parlare di come sto' }]);
  /* la domanda 9 del PHQ-9 (pensieri di morte o di farsi del male) apre SEMPRE il percorso di sicurezza, qualunque sia il punteggio */
  if (r.selfHarm) push(t(CRISIS_TEXT), [...CRISIS_RESOURCES.map((x): TheiaAction => ({ kind: 'open', label: t(x.label), url: `tel:${x.tel}` })), { kind: 'dismiss', label: t('Per ora sto bene, grazie') }]);
  else if (p.kind === 'who5' && r.band !== 'ok') push(t('Se ti va, posso farti anche il PHQ-9: sono nove domande in più, per capire meglio.'), [wb(t('Facciamolo'), 'start', { q: 'phq9' }), { kind: 'dismiss', label: t('Non ora') }]);
}

export function runWb(a: Extract<TheiaAction, { kind: 'wb' }>): void {
  const s = useWellbeing.getState();
  if (a.op === 'consent') { mine(a.label); s.setConsent(true); push(t('Grazie per la fiducia. Puoi toglierlo quando vuoi dal Centro Privacy. Vuoi iniziare con un questionario breve (5 domande, 1 minuto)?'), [wb(t('Sì, iniziamo'), 'start', { q: 'who5' }), { kind: 'dismiss', label: t('Più tardi') }]); return; }
  if (a.op === 'start' && a.q) { mine(a.label); startQuestionnaire(a.q); return; }
  if (a.op === 'answer' && a.v != null) { answerQuestionnaire(a.label, a.v); return; }
  if (a.op === 'cancel') { s.cancel(); push(t('Va bene, interrompiamo. Quando vuoi lo riprendiamo.')); }
}

/** Le deviazioni dal solito, sui segnali forti. Usa i dati già raccolti dall'app (carica l'analisi solo quando serve). */
export function wellbeingSignals(): { sigs: Sig[]; today: string } | null {
  try {
    const { collect } = require('@/lib/analyticsData') as typeof import('@/lib/analyticsData');
    const { todayStr } = require('@/lib/analytics') as typeof import('@/lib/analytics');
    const today = todayStr();
    const want: Record<string, { label: string; bad: 'down' | 'up' }> = { mood: { label: 'Umore', bad: 'down' }, sleep: { label: 'Sonno', bad: 'down' }, mealRhythm: { label: 'Ritmo dei pasti', bad: 'down' }, social: { label: 'Contatti con le persone', bad: 'down' }, steps: { label: 'Movimento', bad: 'down' }, stressChat: { label: 'Stress nei messaggi', bad: 'up' } };
    const sigs = collect(today).filter((x) => want[x.def.id]).map((x) => ({ id: x.def.id, label: want[x.def.id]!.label, bad: want[x.def.id]!.bad, pts: x.pts }));
    return { sigs, today };
  } catch { return null; }
}

/** All'apertura dell'app: se c'è il consenso, propone il questionario ogni due settimane e segnala con delicatezza i cambiamenti dal solito (non più di una volta ogni tre giorni). */
export function checkWellbeing(now = Date.now()): void {
  const s = useWellbeing.getState();
  if (!s.consent || s.progress) return;
  const lastWho = s.results.find((r) => r.kind === 'who5')?.ts;
  if (isDue('who5', lastWho, now) && now - s.lastOffer > 3 * 86400000) {
    s.mark({ lastOffer: now });
    push(t('Sono passate un paio di settimane: ti va di fare il questionario breve sul benessere? Sono 5 domande, 1 minuto.'), [wb(t('Sì, iniziamo'), 'start', { q: 'who5' }), { kind: 'dismiss', label: t('Non ora') }]);
    return;
  }
  if (now - s.lastNotice < 3 * 86400000) return;
  const d = wellbeingSignals();
  if (!d) return;
  const r = deviations(d.sigs, d.today);
  if (r.level !== 'attenzione' && r.level !== 'forte') return;
  s.mark({ lastNotice: now });
  push(t('Negli ultimi giorni ho notato qualcosa di diverso dal tuo solito: {0}. Non è una diagnosi, a volte capita. Come stai davvero? Se ti va, ne parliamo.', describeDeviations(r)), [{ kind: 'say', label: t('Parliamone'), text: 'vorrei parlare di come sto' }, wb(t('Questionario breve'), 'start', { q: 'who5' }), { kind: 'dismiss', label: t('Sto bene') }]);
}

/** Cosa sa Theia per rispondere come un amico (solo con il consenso): ultimo questionario e deviazioni recenti. */
export function wellbeingContext(): string {
  const s = useWellbeing.getState();
  if (!s.consent) return '';
  const lines: string[] = [];
  const last = s.results[0];
  if (last) lines.push(`Ultimo questionario ${last.kind === 'who5' ? 'WHO-5' : 'PHQ-9'}: ${last.score}/${last.max} (${last.label}), ${new Date(last.ts).toISOString().slice(0, 10)}.`);
  const d = wellbeingSignals();
  if (d) { const r = deviations(d.sigs, d.today); if (r.ready && r.devs.length) lines.push(`Cambiamenti recenti dal suo solito: ${r.devs.map((x) => x.label).join(', ')}.`); else if (!r.ready) lines.push('Dati ancora pochi per conoscere il suo solito.'); }
  try {
    const { computeDashboard } = require('@/lib/analyticsData') as typeof import('@/lib/analyticsData');
    const ls = computeDashboard().lifeScore;
    if (ls.score != null) lines.push(`Life Score ${ls.score}/100 (${ls.confidence === 'bassa' ? 'provvisorio' : 'affidabilità ' + ls.confidence}). Lo abbassano: ${ls.down.map((f) => f.label).join(', ') || 'niente di importante'}. Lo sostengono: ${ls.up.map((f) => f.label).join(', ') || 'niente di evidente'}.`);
    for (const c of ls.context.slice(0, 6)) lines.push(`${c.label}: ${c.text}`);
  } catch { /* senza Life Score */ }
  return lines.length ? `Benessere (consenso dato, dati sul telefono):\n${lines.join('\n')}` : '';
}
