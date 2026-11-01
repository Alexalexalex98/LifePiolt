import { computeDashboard } from '@/lib/analyticsData';
import { t } from '@/i18n/core';

/** «Qual è il mio life score», «fammi un recap del mio punteggio»: Theia lo legge dall'app, non serve l'AI. */
export const LIFESCORE_Q = /\b(life ?score|lifescore|il mio punteggio|punteggio (di )?(vita|benessere|life)|come sto messo|che punteggio)\b/i;
const RECAP = /\b(recap|riepilogo|riassunto|riassumi|spiegami|perche|motivo|dettagli)\b/i;

/** Il Life Score con il perché, in testo, per il contesto di Theia (dati sul telefono). */
export function lifeScoreFacts(): string {
  try {
    const d = computeDashboard();
    const ls = d.lifeScore;
    const total = d.scores.total;
    if (total == null && ls.score == null) return '';
    const L = [`Life Score ${ls.score ?? total}/100${ls.confidence === 'bassa' || ls.provisional ? ' (provvisorio: pochi dati)' : ` (affidabilità ${ls.confidence})`}.`];
    if (ls.summary) L.push(ls.summary);
    for (const r of ls.reasons.slice(0, 6)) L.push(`- ${r}`);
    if (ls.factors.length) L.push(`Fattori: ${ls.factors.map((f) => `${f.label} ${Math.round(f.score)}/100 (${f.value}${f.vsBase ? `, ${f.vsBase}` : ''})`).join('; ')}.`);
    if (ls.down.length) L.push(`Lo abbassano: ${ls.down.map((f) => `${f.label} (${f.why})`).join('; ')}.`);
    if (ls.up.length) L.push(`Lo sostengono: ${ls.up.map((f) => f.label).join(', ')}.`);
    if (ls.notSeen.length) L.push(`Non vedo ancora: ${ls.notSeen.join(', ')}.`);
    for (const c of ls.context.slice(0, 6)) L.push(`${c.label}: ${c.text}`);
    return `Life Score (calcolato dall'app):\n${L.join('\n')}`;
  } catch { return ''; }
}

/** Risposta pronta (con perché e prossimo passo). null = nessun dato per calcolarlo. */
export function lifeScoreAnswer(question: string): string | null {
  try {
    const d = computeDashboard();
    const ls = d.lifeScore;
    const score = ls.score ?? d.scores.total;
    if (score == null) return t('Per calcolare il tuo Life Score mi servono ancora alcuni dati: umore, sonno, movimento. Segnali nei prossimi giorni e te lo mostro con tutti i motivi.');
    const prov = ls.confidence === 'bassa' || ls.provisional;
    const out: string[] = [prov ? t('Il tuo Life Score è {0} su 100, ma è ancora provvisorio: ho pochi dati.', Math.round(score)) : t('Il tuo Life Score è {0} su 100 (affidabilità {1}).', Math.round(score), ls.confidence)];
    if (ls.down.length) out.push(t('Lo abbassano: {0}.', ls.down.slice(0, 3).map((f) => `${f.label} (${f.why})`).join('; ')));
    if (ls.up.length) out.push(t('Lo sostengono: {0}.', ls.up.slice(0, 3).map((f) => f.label).join(', ')));
    if (RECAP.test(question) && ls.reasons.length) out.push(t('I motivi:') + '\n' + ls.reasons.slice(0, 5).map((r) => `• ${r}`).join('\n'));
    if (ls.down[0]?.tip) out.push(t('Da dove partire: {0}', ls.down[0].tip));
    return out.join('\n\n');
  } catch { return null; }
}
