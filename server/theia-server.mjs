// Server minimo di esempio per Theia (l'assistente AI di LifePilot).
// Tiene la chiave API fuori dall'app. Avvio:  ANTHROPIC_API_KEY=... node server/theia-server.mjs
// Poi nell'app: EXPO_PUBLIC_API_URL=http://<IP-del-tuo-computer>:8787
// ATTENZIONE: è un esempio senza login né limiti di richieste. Prima di pubblicarlo aggiungi
// autenticazione, rate limiting e HTTPS.
import http from 'node:http';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.THEIA_MODEL || 'claude-sonnet-5-5';
if (!KEY) { console.error('Manca ANTHROPIC_API_KEY'); process.exit(1); }

const system = (name, context) => `Sei ${name}, l'assistente personale dentro l'app LifePilot. Rispondi in italiano, breve e concreto.
Se ti viene dato un testo selezionato o uno screenshot, lavora su quello. Se trovi azioni da fare, elencale.
Non inventare dati: usa solo il contesto qui sotto. Non sei un medico, un avvocato o un consulente finanziario.
${context ? `\nContesto dell'utente:\n${context}` : ''}`;

async function theia(body) {
  const content = [];
  if (body.image?.base64) content.push({ type: 'image', source: { type: 'base64', media_type: body.image.mime || 'image/jpeg', data: body.image.base64 } });
  content.push({ type: 'text', text: `${body.selection ? `Testo selezionato:\n"""${body.selection}"""\n\n` : ''}Richiesta: ${body.question}` });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: system(body.assistant || 'Theia', body.context), messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}`);
  const data = await r.json();
  const reply = data.content?.map((c) => c.text).filter(Boolean).join('\n') ?? '';
  const tasks = /task|da fare|azion/i.test(body.question) ? reply.split('\n').filter((l) => /^[-•*\d]/.test(l.trim())).map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean) : undefined;
  return { reply, tasks };
}

http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST' || req.url !== '/theia') { res.writeHead(404); return res.end(); }
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 12e6) req.destroy(); });
  req.on('end', async () => {
    try {
      const out = await theia(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message) }));
    }
  });
}).listen(8787, () => console.log('Theia server su :8787'));
