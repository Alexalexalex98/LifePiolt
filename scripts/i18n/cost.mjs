// Stima del costo prima di partire. I numeri sono indicativi (vedi pricing.json).
export function estimateCost({ pricing, providerName, model, perLang, batchSize = 40, priceOverride = null }) {
  // perLang: { lang: { items, chars } }
  const langs = Object.keys(perLang);
  const totalChars = langs.reduce((a, l) => a + perLang[l].chars, 0);
  const totalItems = langs.reduce((a, l) => a + perLang[l].items, 0);
  let usd = 0;
  let detail = '';
  if (providerName === 'anthropic') {
    const p = pricing.anthropic;
    const price = p.models[model] ?? p.fallbackModel;
    let tin = 0; let tout = 0;
    for (const l of langs) {
      const { items, chars } = perLang[l];
      const batches = Math.ceil(items / batchSize);
      const base = chars / p.charsPerToken;
      tin += base + batches * p.promptOverheadTokensPerBatch + items * p.perItemOverheadTokens;
      tout += base * (p.outputTokenFactor[l] ?? p.outputTokenFactor.default) + items * p.perItemOverheadTokens;
    }
    usd = (tin / 1e6) * price.inputPerMTok + (tout / 1e6) * price.outputPerMTok;
    detail = `~${Math.round(tin / 1000)}k token in / ~${Math.round(tout / 1000)}k token out (${model})`;
  } else {
    const rate = priceOverride ?? pricing[providerName]?.perMChars ?? 0;
    usd = (totalChars / 1e6) * rate;
    const free = pricing[providerName]?.freeCharsPerMonth ?? 0;
    detail = `${totalChars} caratteri x ${rate} USD/Mchar${free ? ` (quota gratuita mensile ${free} caratteri, non sottratta)` : ''}`;
  }
  return { usd, totalChars, totalItems, detail };
}
