/**
 * Server IA di LifePilot (Cloudflare Worker) con modelli aperti su Workers AI: niente Google.
 * Stessi percorsi del vecchio server (/chat, /vision, /analyze, /translate) e stesse risposte ({reply}), così l'app non cambia.
 * Accesso: il token di accesso dell'utente su Supabase (ognuno ha il suo) oppure, per le prove, APP_TOKEN.
 * Non registra mai il contenuto delle richieste. Variabili: SUPABASE_URL, SUPABASE_KEY (chiave pubblica), AI (binding Workers AI), APP_TOKEN (facoltativo).
 */
import { detectDomain, expertPrompt, isDeep, isOfficial, officialQueries } from './domains.js';

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
/** Estrae le notizie da un feed RSS (Google News, Bing News): titolo, indirizzo, data, testata e frase. */
export function parseRss(xml, max = 8) {
  const out = [];
  for (const it of String(xml).split('<item>').slice(1)) {
    const tag = (n) => { const m = new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`).exec(it); return m ? clean(String(m[1]).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : ''; };
    const title = tag('title'), url = tag('link'), date = tag('pubDate'), source = tag('source') || tag('News:Source');
    let snippet = tag('description');
    if (!title || !/^https?:/.test(url)) continue;
    if (snippet.startsWith(title)) snippet = snippet.slice(title.length).trim();
    const d = date ? new Date(date) : null;
    const when = d && !isNaN(+d) ? d.toISOString().slice(0, 10) : '';
    out.push({ title: source && !title.includes(source) ? `${title} - ${source}` : title, url, snippet: [when, snippet].filter(Boolean).join(': '), when });
    if (out.length >= max) break;
  }
  return out;
}
const tryFetch = async (fetcher, url, init, parse) => { try { const r = await fetcher(url, { ...init, headers: { 'user-agent': UA, ...(init?.headers ?? {}) } }); return r.ok ? parse(await r.text()) : []; } catch { return []; } };
/**
 * Cerca sul web in parallelo su più fonti: notizie di Google News e Bing News (le più recenti, tantissime testate), DuckDuckGo
 * e Wikipedia (italiano, poi inglese). Le notizie vengono prima, con la data; poi le pagine; poi l'enciclopedia.
 */
export async function webSearch(q, fetcher = fetch) {
  const enc = encodeURIComponent(q);
  const [gn, bn, dd, wi, we] = await Promise.all([
    tryFetch(fetcher, `https://news.google.com/rss/search?q=${enc}&hl=it&gl=IT&ceid=IT:it`, undefined, (x) => parseRss(x, 8)),
    tryFetch(fetcher, `https://www.bing.com/news/search?q=${enc}&format=rss&setlang=it`, undefined, (x) => parseRss(x, 6)),
    tryFetch(fetcher, 'https://html.duckduckgo.com/html/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `q=${enc}&kl=it-it` }, (x) => parseDdg(x, 6)),
    tryFetch(fetcher, `https://it.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc}&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&exchars=700&format=json&origin=*`, undefined, (x) => wikiRes(x, 'it')),
    tryFetch(fetcher, `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc}&gsrlimit=2&prop=extracts&exintro=1&explaintext=1&exchars=700&format=json&origin=*`, undefined, (x) => wikiRes(x, 'en')),
  ]);
  const news = [...gn, ...bn].sort((a, b) => (b.when ?? '').localeCompare(a.when ?? '')).slice(0, 7);
  const seen = new Set();
  const all = [...news, ...dd.slice(0, 4), ...wi.slice(0, 2), ...(wi.length ? [] : we.slice(0, 2))].filter((x) => { const k = x.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  return all.slice(0, 12);
}
function wikiRes(text, lang) {
  try {
    const pages = Object.values(JSON.parse(text)?.query?.pages ?? {});
    return pages.map((p) => ({ title: p.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`, snippet: clean(p.extract) })).filter((p) => p.snippet);
  } catch { return []; }
}
const SKIP_WEB = /^\s*(ciao|salve|grazie|ok|s[iì]|no|va bene|perfetto)\b[^?]{0,20}$/i;
/** Decide se serve cercare sul web e con quali frasi GENERICHE (fino a 3, da angoli diversi; niente nomi, importi, salute o altri dati personali). */
export async function planSearch(env, q, force = false) {
  if (!q || q.length < 10 || SKIP_WEB.test(q)) return null;
  try {
    const { text } = await run(env, LITE, { messages: msgs('Decidi se per rispondere a questa domanda serve cercare sul web: fatti aggiornati, luoghi, orari, prezzi, notizie, eventi, procedure, persone pubbliche, aziende, scienza, cose che potresti non sapere o non ricordare con certezza. NON cercare per: saluti, conversazione, calcoli, richieste sui dati personali dell\'utente (soldi, salute, agenda, task), consigli generali, cose che sai con certezza. ' + (force ? 'Qui la ricerca SERVE: rispondi sempre con search true. ' : '') + 'Rispondi SOLO con JSON: {"search":true|false,"queries":["frase di ricerca 1","frase 2","frase 3"]}: da 1 a 3 ricerche brevi che guardano il tema da angoli diversi (per esempio una in italiano e una in inglese, o una sul fatto e una sull\'esito). Le query devono essere generiche e anonime: niente nomi di persone private, importi, indirizzi, dati di salute o finanziari.', String(q).slice(0, 600)) }, 200);
    const m = /\{[\s\S]*\}/.exec(text);
    const j = m ? JSON.parse(m[0]) : null;
    if (j?.search !== true && !force) return null;
    const list = (Array.isArray(j.queries) ? j.queries : [j.query]).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 160)).slice(0, 3);
    return list.length ? list : null;
  } catch { return null; }
}

/* ---------- affidabilita' delle fonti (come un buon motore di risposte: si fidano di piu' agenzie, enti, enciclopedie e testate note) ---------- */
const HIGH = /(^|\.)(wikipedia\.org|britannica\.com|reuters\.com|apnews\.com|bbc\.(com|co\.uk)|ansa\.it|agi\.it|adnkronos\.com|ilsole24ore\.com|corriere\.it|repubblica\.it|lastampa\.it|ilpost\.it|rainews\.it|rai\.it|theguardian\.com|nytimes\.com|washingtonpost\.com|aljazeera\.com|france24\.com|dw\.com|euronews\.com|lemonde\.fr|elpais\.com|bloomberg\.com|ft\.com|economist\.com|nature\.com|science\.org|thelancet\.com|nih\.gov|who\.int|un\.org|europa\.eu|nasa\.gov|iss\.it|salute\.gov\.it|istat\.it|oecd\.org|worldbank\.org|imf\.org)$|(^|\.)(gov|edu)(\.[a-z]{2})?$|\.gov\.[a-z]{2}$|\.gob\.[a-z]{2}$/i;
const LOW = /(^|\.)(facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|pinterest\.[a-z.]+|quora\.com|reddit\.com|yahoo\.com|answers\.[a-z.]+|blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|medium\.com|substack\.com|telegram\.(me|org)|youtube\.com|linkedin\.com|ebay\.[a-z.]+|alibaba\.com|aliexpress\.com)$/i;
/** 3 fonte molto affidabile, 2 normale, 0.5 social, forum, blog personali, contenuti non verificabili. */
export function credibility(url, dom) {
  const h = host(url);
  if (!h) return 1;
  if (LOW.test(h)) return 0.5;
  if (HIGH.test(h) || isOfficial(dom, h)) return 3;
  return 2;
}
/** Ordina i risultati per affidabilita' della fonte e freschezza, toglie i doppioni e le fonti poco affidabili se ce ne sono abbastanza di meglio. */
export function rankResults(list, now = Date.now(), dom = null) {
  const seen = new Set();
  const uniq = list.filter((x) => { const k = (x.url.split('#')[0].replace(/\/$/, '') + '|' + x.title.toLowerCase().slice(0, 50)); if (seen.has(k)) return false; seen.add(k); return true; });
  const scored = uniq.map((x, i) => {
    const days = x.when ? (now - new Date(x.when).getTime()) / 86400000 : null;
    const fresh = days !== null && days >= 0 ? (days <= 3 ? 0.8 : days <= 14 ? 0.4 : 0) : 0;
    const tr = credibility(x.url, dom);
    return { ...x, trust: tr, score: tr + (isOfficial(dom, host(x.url)) ? 0.6 : 0) + fresh - i * 0.01 };
  }).sort((a, b) => b.score - a.score);
  const good = scored.filter((x) => x.trust >= 2);
  return good.length >= 4 ? scored.filter((x) => x.trust >= 1) : scored;
}
/** Legge il testo di una pagina tramite un lettore pubblico (non pesa sul server): le prime righe utili, al massimo `max` caratteri. */
export async function readPage(url, fetcher = fetch, max = 2200) {
  if (/news\.google\.com/.test(url)) return '';
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetcher(`https://r.jina.ai/${url}`, { headers: { 'user-agent': UA, accept: 'text/plain', 'x-return-format': 'text' }, signal: ac.signal });
    if (!r.ok) return '';
    const t = await r.text();
    const body = t.includes('Markdown Content:') ? t.split('Markdown Content:').slice(1).join(' ') : t;
    return body.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>`|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  } catch { return ''; } finally { clearTimeout(timer); }
}
/** Ricerca completa: piu' ricerche in parallelo, classifica per affidabilita', legge le pagine migliori. */
export async function research(queries, fetcher = fetch, opts = {}) {
  const { dom = null, deep = false } = opts;
  const lists = await Promise.all(queries.map((qq) => webSearch(qq, fetcher)));
  const ranked = rankResults(lists.flat(), Date.now(), dom).slice(0, deep ? 14 : 10);
  const toRead = ranked.filter((x) => !/news\.google\.com/.test(x.url) && !/wikipedia\.org/.test(x.url)).slice(0, deep ? 5 : 3);
  const texts = await Promise.all(toRead.map((x) => readPage(x.url, fetcher, deep ? 3600 : 2200)));
  toRead.forEach((x, i) => { if (texts[i] && texts[i].length > 200) x.page = texts[i]; });
  return ranked;
}
const TRUST_LABEL = (n) => (n >= 3 ? 'fonte molto affidabile' : n >= 2 ? 'fonte normale' : 'fonte poco affidabile (social, forum, blog)');
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

/** I numeri delle fonti [1][2] diventano link brevi con il nome del sito; in fondo l'elenco dei siti (uno solo per sito), anche questo con i link. */
export function withSources(text, used) {
  const link = (x) => `[${host(x.url)}](${x.url})`;
  const body = String(text).replace(/(?:\[\d{1,2}\])+/g, (grp) => {
    const ids = [...grp.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1]) - 1);
    if (ids.some((i) => !used[i])) return grp;
    const hs = new Set(); return ids.filter((i) => { const h = host(used[i].url); if (hs.has(h)) return false; hs.add(h); return true; }).map((i) => link(used[i])).join(' ');
  });
  const seen = new Set(); const foot = [];
  for (const x of used) { const h = host(x.url); if (h && !seen.has(h) && foot.length < 6) { seen.add(h); foot.push(link(x)); } }
  return foot.length ? `${body}\n\nFonti: ${foot.join(', ')}` : body;
}

/** Prepara la richiesta di chat: conversazione recente e, se serve, la ricerca sul web con le fonti. */
/** Domande sui propri dati dell'app (soldi, task, agenda): le risponde l'app con i suoi numeri, non serve forzare una ricerca. */
const PERSONAL = /\b(ho speso|quanto ho|i miei|le mie|il mio|la mia|mio saldo|mia agenda|miei task|ho in cassa|mi rimane|mi resta)\b/i;
async function prepChat(b, env) {
    const history = Array.isArray(b.history) ? b.history.slice(-12).filter((m) => m && (m.role === 'user' || m.role === 'assistant')).map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 4000) })) : [];
    let message = String(b.message ?? '').slice(0, 24000);
    let used = [];
    const q = String(b.q ?? '');
    /* l'esperto del campo: istruzioni, fonti ufficiali e, se chiesto, l'approfondimento */
    const dom = q ? detectDomain(q.replace(/^\s*approfondisci\s*:?/i, '')) : null;
    const deep = isDeep(q);
    if (dom) message += expertPrompt(dom, deep);
    if (b.web !== false && q) {
      const must = (deep || !!dom?.serious) && !PERSONAL.test(q);
      let queries = await planSearch(env, q, must);
      if (queries && dom) queries = [...queries, ...officialQueries(dom, queries[0], deep ? 2 : 1)].slice(0, deep ? 5 : 4);
      if (queries) {
        const found = await research(queries, env.__fetch ?? fetch, { dom, deep });
        if (found.length) {
          used = found.slice(0, deep ? 10 : 8);
          message += `\n\nRICERCA SUL WEB (oggi e' ${new Date().toISOString().slice(0, 10)}; ricerche: ${queries.map((x) => `\u00ab${x}\u00bb`).join(', ')}). Come rispondere: usa SOLO queste fonti per i fatti; scarta quelle irrilevanti rispetto alla domanda; dai piu' peso alle fonti affidabili e alle piu' recenti; un fatto e' solido se lo confermano almeno due fonti indipendenti, altrimenti dillo ("secondo una sola fonte"); se le fonti si contraddicono o sono dubbie o poco affidabili, dillo con chiarezza e non presentare come certo cio' che non lo e'; diffida di titoli sensazionalistici e di notizie senza fonte; indica fra parentesi quadre il numero delle fonti che usi, per esempio [1][3]; se non trovi tutto non dire mai \u00abnon ho altre informazioni\u00bb e non mandare l'utente a cercare su internet: di' cosa hai trovato e, se manca qualcosa, dillo in una frase breve e invita a chiedere se vuole approfondire un punto preciso; non inventare. Rispondi per primo alla domanda, in modo diretto.\n` + used.map((x, i) => `[${i + 1}] ${x.title} (${host(x.url)}, ${TRUST_LABEL(x.trust)}${x.when ? `, ${x.when}` : ''}): ${x.page ? x.page : x.snippet}`).join('\n');
        }
      }
    }
  return { message, history, used, domain: dom ? { id: dom.id, name: dom.name } : null, deep };
}

/** Come `run` ma a flusso: chiama onDelta con il testo che si aggiunge (senza i pensieri interni del modello). Se un modello non risponde passa al successivo. */
export async function streamRun(env, models, input, max, onDelta) {
  let quota = false; let last = '';
  for (const m of models) {
    let raw = ''; let sent = 0;
    const push = () => {
      const vis = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/<(t(h(i(n(k)?)?)?)?)?$/, '');
      if (vis.length > sent) { onDelta(vis.slice(sent)); sent = vis.length; }
    };
    try {
      const out = await env.AI.run(m, { ...input, max_tokens: max, stream: true });
      if (out && typeof out.getReader === 'function') {
        const rd = out.getReader(); const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const pl = line.slice(5).trim();
            if (!pl || pl === '[DONE]') continue;
            try { const j = JSON.parse(pl); const d = j.response ?? j.choices?.[0]?.delta?.content ?? ''; if (typeof d === 'string' && d) { raw += d; push(); } } catch { /* riga non completa */ }
          }
        }
      } else { raw = textOf(out); push(); }
      const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (text) return { text, model: m };
    } catch (e) {
      if (isQuota(e)) quota = true; last = String(e?.message ?? e).slice(0, 160);
      if (sent > 0) { const t = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim(); if (t) return { text: t, model: m }; }
    }
  }
  const err = new Error(quota ? 'quota' : last || 'nessun modello ha risposto');
  err.quota = quota;
  throw err;
}

/** Chat a flusso (una riga JSON per evento): {"d":"testo"} mentre Theia scrive, poi {"done":true,"reply":"testo finale con i link alle fonti"}. */
export function streamChat(b, env, lite, info) {
  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const send = (o) => w.write(enc.encode(JSON.stringify(o) + '\n')).catch(() => {});
  (async () => {
    try {
      const { message, history, used, domain, deep } = await prepChat(b, env);
      const { text } = await streamRun(env, lite ? LITE : SMART, { messages: msgs(SYSTEM, message, history) }, lite ? Math.min(deep ? 900 : LITE_TOKENS, 1500) : (deep ? 2800 : 1500), (d) => { send({ d }); });
      await send({ done: true, reply: used.length ? withSources(text, used) : text, ...(domain ? { domain } : {}), ...info });
    } catch (e) {
      await send(e?.quota ? { error: 'Il limite gratuito di oggi dell\'intelligenza artificiale \u00e8 finito: riprova domani.', code: 'quota' } : { error: 'Il servizio AI non ha risposto: riprova tra poco.' });
    } finally { await w.close().catch(() => {}); }
  })();
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
}

async function handle(path, b, env, lite = false) {
  const TEXT = lite ? LITE : SMART;
  const cap = (n) => (lite ? Math.min(n, LITE_TOKENS) : n);
  if (path === '/chat') {
    const { message, history, used, domain, deep } = await prepChat(b, env);
    const { text } = await run(env, TEXT, { messages: msgs(SYSTEM, message, history) }, cap(deep ? 2800 : 1500));
    return { reply: used.length ? withSources(text, used) : text, ...(domain ? { domain } : {}) };
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
    if (path === '/chat' && b.stream === true) return streamChat(b, env, lite, info);
    try {
      const out = await handle(path, b, env, lite);
      return out ? json({ ...out, ...info }) : json({ error: 'percorso sconosciuto' }, 404);
    } catch (e) {
      if (e?.quota) return json({ error: 'Il limite gratuito di oggi dell\'intelligenza artificiale è finito: riprova domani.', code: 'quota' }, 429);
      return json({ error: 'Il servizio AI non ha risposto: riprova tra poco.' }, 502);
    }
  },
};
