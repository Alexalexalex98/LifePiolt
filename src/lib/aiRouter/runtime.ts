import { alertT } from '@/lib/alert';
import { t } from '@/i18n/core';
import { useApp } from '@/store/app';
import { useAiRouter } from '@/store/aiRouter';
import { useLife } from '@/store/life';
import { usePrefs } from '@/store/prefs';
import { isSharedNow, readChoices } from '@/store/sharing';

import { createProxyClient } from './adapters/serverProxy.ts';
import { planRequest, routeDetailed, type ConsentAnswer, type ConsentRequest, type Deps, type Plan, type Trace } from './pipeline.ts';
import { tx, setTranslate } from './tx.ts';
import type { ServerProxyClient, RouteRequest, RouteResult } from './types.ts';

/** Collega il router puro agli store dell'app. Unico file con alias '@/'. */

let client: ServerProxyClient | null = null;
/** Client verso il NOSTRO server (nessuna chiave API nell'app). Senza URL (oggi) e' "non collegato". */
export function getClient(): ServerProxyClient {
  if (!client) {
    const baseUrl = process.env.EXPO_PUBLIC_AI_BASE_URL ?? '';
    client = createProxyClient({ baseUrl, getToken: () => null, fetchImpl: baseUrl ? ((u, i) => fetch(u, i) as never) : undefined });
  }
  return client;
}

export function ensureTranslate() { setTranslate(t); }

function askConsent(r: ConsentRequest): Promise<ConsentAnswer> {
  return new Promise((resolve) => {
    alertT(tx('Inviare a {0}?', r.providerShort), `${r.summary.headline}\n${r.summary.notSent}\n${r.why}`, [
      { text: 'Annulla', style: 'cancel', onPress: () => resolve('cancel') },
      { text: 'Consenti sempre per questo fornitore', onPress: () => resolve('always') },
      { text: 'Consenti una volta', onPress: () => resolve('once') },
    ]);
  });
}

/** Dati che l'utente ha scelto di condividere con l'assistente AI (Cosa condivido). Nessun dato critico. */
function aiData() {
  const life = useLife.getState();
  return {
    tasks: life.tasks.filter((x) => !x.done).slice(0, 5).map((x) => x.t),
    goals: life.goals.slice(0, 5).map((g) => g.t),
  };
}

export function buildDeps(over: Partial<Deps> = {}): Deps {
  ensureTranslate();
  const st = useAiRouter.getState();
  const c = getClient();
  const ch = readChoices();
  return {
    prefs: st.prefs, planId: st.planId, usage: st.usage, consents: st.consents, client: c,
    isConnected: () => c.isConfigured(),
    now: Date.now(),
    profile: { lang: useApp.getState().language || 'it', answerStyle: usePrefs.getState().answerStyle },
    share: { memory: isSharedNow('ai_memory', ch), health: isSharedNow('health_activity', ch), finance: isSharedNow('fin_summary', ch) },
    data: aiData(),
    askConsent,
    onSpent: (u, log) => { const s = useAiRouter.getState(); s.addUsage(u); s.addLog(log); },
    onConsentAlways: (id) => useAiRouter.getState().grantAlways(id),
    ...over,
  };
}

export async function routeWithRuntime(req: RouteRequest): Promise<RouteResult> {
  try { return (await routeDetailed(req, buildDeps())).result; }
  catch (e) { return { status: 'error', kind: 'chat', message: tx('Non sono riuscita a instradare la richiesta: {0}', e instanceof Error ? e.message : String(e)) }; }
}

/** Per il simulatore: decide tutto senza inviare nulla. */
export function simulate(text: string, opts: { phoneOnly?: boolean; images?: number } = {}): Plan {
  const d = buildDeps();
  const prefs = opts.phoneOnly === undefined ? d.prefs : { ...d.prefs, phoneOnly: opts.phoneOnly };
  const images = Array.from({ length: opts.images ?? 0 }, (_, i) => ({ uri: `sim://${i}`, mime: 'image/jpeg' }));
  return planRequest({ text, lang: d.profile.lang, images, source: 'typed' }, { ...d, prefs });
}
export type { Trace };
