/**
 * Server IA di LifePilot (Cloudflare Worker) con modelli aperti su Workers AI: niente Google.
 * Stessi percorsi del vecchio server (/chat, /vision, /analyze, /translate) e stesse risposte ({reply}), così l'app non cambia.
 * Accesso: il token di accesso dell'utente su Supabase (ognuno ha il suo) oppure, per le prove, APP_TOKEN.
 * Non registra mai il contenuto delle richieste. Variabili: SUPABASE_URL, SUPABASE_KEY (chiave pubblica), AI (binding Workers AI), APP_TOKEN (facoltativo).
 */
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, GET, OPTIONS' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });

/** I modelli, dal più forte al più leggero: se uno non risponde si passa al successivo. Su un piano a pagamento si possono aggiungere in cima GLM, DeepSeek, Kimi. */
export const SMART = ['@cf/openai/gpt-oss-120b', '@cf/nvidia/nemotron-3-120b-a12b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen3.8-27b'];
export const VISION = ['@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/meta/llama-4-scout-17b-16e-instruct'];
/** Modalita' leggera: risposte piu' brevi e veloci, per quando i messaggi "completi" del giorno sono finiti o l'accesso non e' verificato. Theia risponde comunque. */
export const LITE = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen3.8-27b', '@cf/openai/gpt-oss-120b'];
export const LITE_TOKENS = 450;

const SYSTEM = 'Sei Theia, l\'assistente di LifePilot: gentile, chiara e precisa. Rispondi nella lingua dell\'utente. Non inventare mai numeri, date o fatti che non ti sono stati dati: se non lo sai, dillo. I calcoli con i dati dell\'utente li fai solo sui numeri che ti sono forniti e li mostri. Non dai consigli medici, legali o fiscali definitivi: indichi di sentire un professionista. Rispondi solo a ciò che ti viene chiesto: non aggiungere consigli, avvisi, osservazioni o proposte non richieste. Niente emoji.';

export const textOf = (r) => {
  const t = r?.choices?.[0]?.message?.content ?? r?.response ?? r?.result?.response ?? '';
  return String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};
export const isQuota = (e) => /4006|daily free allocation|quota|exceeded|not available on the Workers Free/i.test(String(e?.message ?? e));

/** Prova i modelli in ordine; restituisce il primo testo non vuoto. Se tutti falliscono per quota lo dice. */
export async function run(env, models, input, max = 1500) {
  let quota = false; let last = '';
  for (const m of models) {
    try {
      const out = await env.AI.run(m, { ...input, max_tokens: max });
      const text = textOf(out);
      if (text) return { text, model: m };
    } catch (e) { if (isQuota(e)) quota = true; last = String(e?.message ?? e).slice(0, 160); }
  }
  const err = new Error(quota ? 'quota' : last || 'nessun modello ha risposto');
  err.quota = quota;
  throw err;
}

/* Chi è l'utente: token Supabase (verificato col server di accesso) o token di prova. Cache di un minuto. */
const seen = new Map();
export async function whoIs(req, env, fetcher = fetch) {
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!tok) return null;
  if (env.APP_TOKEN && tok === env.APP_TOKEN) return { id: 'prova' };
  const hit = seen.get(tok);
  if (hit && Date.now() - hit.at < 60000) return hit.user;
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return null;
  try {
    const r = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${tok}` } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;
    if (seen.size > 500) seen.clear();
    const user = { id: u.id };
    seen.set(tok, { user, at: Date.now() });
    return user;
  } catch { return null; }
}

/* Freno semplice per persona: al massimo 40 richieste al minuto da questo punto di accesso. */
const hits = new Map();
export function tooMany(id, now = Date.now(), max = 40) {
  const a = (hits.get(id) ?? []).filter((t) => now - t < 60000);
  a.push(now); hits.set(id, a);
  if (hits.size > 2000) hits.clear();
  return a.length > max;
}


/* ---------- ricerca sul web (solo con la tua domanda, mai i tuoi dati) ---------- */
const UA = 'Mozilla/5.0 (compatible; LifePilot/1.0)';
const ents = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&nbsp;': ' ' };
const clean = (h) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|nbsp|#x27|#39);/g, (m) => ents[m] ?? m).replace(/\s+/g, ' ').trim();
/** Estrae titolo, indirizzo e frase dai risultati di DuckDuckGo (pagina semplice). */
export function parseDdg(html, max = 6) {
  const out = [];
  const parts = String(html).split('result__a').slice(1);
  for (const part of parts) {
    const href = /href="([^"]+)"/.exec(part)?.[1];
    const title = clean(/>([\s\S]*?)<\/a>/.exec(part)?.[1]);
    const snippet = clean(/result__snippet[^>]*>([\s\S]*?)<\/a>/.exec(part)?.[1]);
    if (!href || !title) continue;
    let url = href.replace(/&amp;/g, '&');
    try { const u = new URL(url.startsWith('//') ? `https:${url}` : url, 'https://duckduckgo.com'); url = u.searchParams.get('uddg') ?? u.href; } catch { continue; }
    if (!/^https?:/.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    out.push({ title, url, snippet });
    if (out.length >= max) break;
  }
  return out;
}
/** Cerca sul web: prima DuckDuckGo, se non risponde Wikipedia (italiano, poi inglese). */
export async function webSearch(q, fetcher = fetch) {
  try {
    const r = await fetcher('https://html.duckduckgo.com/html/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA }, body: `q=${encodeURIComponent(q)}&kl=it-it` });
    if (r.ok) { const res = parseDdg(await r.text()); if (res.length) return res; }
  } catch { /* si prova Wikipedia */ }
  for (const lang of ['it', 'en']) {
    try {
      const r = await fetcher(`https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=4&prop=extracts&exintro=1&explaintext=1&exchars=700&format=json&origin=*`, { headers: { 'user-agent': UA } });
      if (!r.ok) continue;
      const pages = Object.values((await r.json())?.query?.pages ?? {});
      const res = pages.map((p) => ({ title: p.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`, snippet: clean(p.extract) })).filter((p) => p.snippet);
      if (res.length) return res;
    } catch { /* prossima lingua */ }
  }
  return [];
}
const SKIP_WEB = /^\s*(ciao|salve|grazie|ok|s[iì]|no|va bene|perfetto)\b[^?]{0,20}$/i;
/** Decide se serve cercare sul web e con quale frase GENERICA (niente nomi, importi, salute o altri dati personali). */
export async function planSearch(env, q) {
  if (!q || q.length < 10 || SKIP_WEB.test(q)) return null;
  try {
    const { text } = await run(env, LITE, { messages: msgs('Decidi se per rispondere a questa domanda serve cercare sul web: fatti aggiornati, luoghi, orari, prezzi, notizie, eventi, procedure, cose che potresti non sapere o non ricordare con certezza. NON cercare per: saluti, conversazione, calcoli, richieste sui dati personali dell\'utente (soldi, salute, agenda, task), consigli generali, cose che sai con certezza. Rispondi SOLO con JSON: {"search":true|false,"query":"frase di ricerca breve"}. La query deve essere generica e anonima: niente nomi di persone private, importi, indirizzi, dati di salute o finanziari.', String(q).slice(0, 600)) }, 120);
    const m = /\{[\s\S]*\}/.exec(text);
    const j = m ? JSON.parse(m[0]) : null;
    return j?.search === true && typeof j.query === 'string' && j.query.trim() ? j.query.trim().slice(0, 160) : null;
  } catch { return null; }
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

const msgs = (system, user, extra = []) => [{ role: 'system', content: system }, ...extra, { role: 'user', content: user }];
const imageMsg = (text, images) => [{ role: 'system', content: SYSTEM }, { role: 'user', content: [{ type: 'text', text }, ...images.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.mime || 'image/jpeg'};base64,${im.data}` } }))] }];

async function pdfText(env, f) {
  try {
    const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
    const r = await env.AI.toMarkdown([{ name: 'documento.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }]);
    return String(r?.[0]?.data ?? '').slice(0, 60000);
  } catch { return ''; }
}

async function handle(path, b, env, lite = false) {
  const TEXT = lite ? LITE : SMART;
  const cap = (n) => (lite ? Math.min(n, LITE_TOKENS) : n);
  if (path === '/chat') {
    const history = Array.isArray(b.history) ? b.history.slice(-12).filter((m) => m && (m.role === 'user' || m.role === 'assistant')).map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 4000) })) : [];
    let message = String(b.message ?? '').slice(0, 24000);
    let sources = [];
    if (b.web !== false && b.q) {
      const query = await planSearch(env, String(b.q));
      if (query) {
        const found = await webSearch(query, env.__fetch ?? fetch);
        if (found.length) {
          sources = found.slice(0, 4).map((x) => host(x.url)).filter(Boolean);
          message += `\n\nRisultati di una ricerca sul web per «${query}» (usali per rispondere ai fatti; se non bastano dillo con onestà; non inventare):\n` + found.map((x, i) => `[${i + 1}] ${x.title} (${host(x.url)}): ${x.snippet}`).join('\n');
        }
      }
    }
    const { text } = await run(env, TEXT, { messages: msgs(SYSTEM, message, history) }, cap(1500));
    return { reply: sources.length ? `${text}\n\nFonti: ${[...new Set(sources)].join(', ')}.` : text };
  }
  if (path === '/vision') {
    if (String(b.mime || '').includes('pdf')) {
      const t = await pdfText(env, { data: b.image });
      const { text } = await run(env, TEXT, { messages: msgs(SYSTEM, `${String(b.prompt ?? '')}\n\nTesto del documento:\n${t || '(vuoto)'}`) }, cap(1500));
      return { reply: text };
    }
    const { text } = await run(env, VISION, { messages: imageMsg(String(b.prompt ?? 'Descrivi l\'immagine.'), [{ data: b.image, mime: b.mime }]) }, 1200);
    return { reply: text };
  }
  if (path === '/analyze') {
    const files = Array.isArray(b.files) ? b.files.slice(0, 6) : [];
    const question = [b.context, b.question].filter(Boolean).join('\n\n') || 'Analizza il documento.';
    const images = files.filter((f) => !String(f.mime).includes('pdf'));
    const pdfs = files.filter((f) => String(f.mime).includes('pdf'));
    let doc = '';
    for (const f of pdfs) doc += `\n\n--- documento ---\n${await pdfText(env, f)}`;
    const { text } = images.length
      ? await run(env, VISION, { messages: imageMsg(`${question}${doc}`, images) }, 1500)
      : await run(env, TEXT, { messages: msgs(SYSTEM, `${question}${doc}`) }, cap(1500));
    let result = null;
    try { const m = text.match(/[[{][\s\S]*[\]}]/); if (m) result = JSON.parse(m[0]); } catch { /* testo libero */ }
    return { reply: text, result };
  }
  if (path === '/translate') {
    const prompt = `Traduci ogni testo nella lingua con codice "${b.lang}". Rispondi SOLO con un array JSON di stringhe, nello stesso ordine e con la stessa lunghezza.\n${JSON.stringify(b.texts || [])}`;
    const { text } = await run(env, SMART, { messages: msgs('Sei un traduttore preciso. Rispondi solo con JSON.', prompt) }, 4000);
    return { reply: (text.match(/\[[\s\S]*\]/) || [text])[0] };
  }
  return null;
}

/** Conta una richiesta sul tuo account (con il tuo stesso token) e dice piano e se hai ancora messaggi "completi" oggi. Se non risponde, nessun blocco. */
export async function usage(tok, env, fetcher = fetch) {
  try {
    const r = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/ai_take`, { method: 'POST', headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: '{}' });
    if (!r.ok) return null;
    const u = await r.json();
    return u && typeof u.full === 'boolean' ? u : null;
  } catch { return null; }
}
const RATE = { free: 15, plus: 30, pro: 60 };
const guestHits = new Map();
export function guestTooMany(ip, now = Date.now()) {
  const a = (guestHits.get(ip) ?? []).filter((t) => now - t < 60000);
  a.push(now); guestHits.set(ip, a);
  if (guestHits.size > 2000) guestHits.clear();
  return a.length > 12;
}

export default {
  async fetch(req, env, _ctx, fetcher = fetch) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const path = new URL(req.url).pathname;
    if (req.method !== 'POST') return json({ ok: true, service: 'lifepilot-ai', models: { smart: SMART[0], vision: VISION[0] } });
    const user = await whoIs(req, env, fetcher);
    let lite = false; let info = { plan: 'guest', lite: true };
    if (!user) {
      /* senza account (o con accesso scaduto) Theia funziona lo stesso, chat, foto e documenti: modalita' leggera e un freno per dispositivo */
      if (guestTooMany(req.headers.get('cf-connecting-ip') || 'ospite')) return json({ error: 'troppe richieste: aspetta un minuto' }, 429);
      lite = true;
    } else {
      const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
      const u = user.id === 'prova' || path === '/translate' ? null : await usage(tok, env, fetcher);
      const plan = u?.plan ?? 'free';
      if (tooMany(user.id, Date.now(), RATE[plan] ?? 15)) return json({ error: 'troppe richieste: aspetta un minuto' }, 429);
      lite = u ? !u.full : false;
      info = { plan, lite, left: u ? Math.max(0, u.limit - u.used) : undefined, limit: u?.limit };
    }
    let b;
    try { b = await req.json(); } catch { return json({ error: 'richiesta non valida' }, 400); }
    try {
      const out = await handle(path, b, env, lite);
      return out ? json({ ...out, ...info }) : json({ error: 'percorso sconosciuto' }, 404);
    } catch (e) {
      if (e?.quota) return json({ error: 'Il limite gratuito di oggi dell\'intelligenza artificiale è finito: riprova domani.', code: 'quota' }, 429);
      return json({ error: 'Il servizio AI non ha risposto: riprova tra poco.' }, 502);
    }
  },
};
