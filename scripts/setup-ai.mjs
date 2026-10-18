#!/usr/bin/env node
// Collega l'app al Worker AI.  Uso (sul TUO computer, nella cartella del progetto):
//   node scripts/setup-ai.mjs            crea/aggiorna .env.local e, se serve, genera una parola d'ordine nuova
//   node scripts/setup-ai.mjs --test     prova il Worker con la parola d'ordine di .env.local
// La parola d'ordine (EXPO_PUBLIC_AI_TOKEN) è la STESSA che deve stare in Cloudflare come APP_TOKEN.
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILE = '.env.local';
const DEFAULT_URL = 'https://lifepilot-api.alex-stefanovic1998.workers.dev';
const read = () => (fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '');
const get = (txt, k) => txt.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const set = (txt, k, v) => (new RegExp(`^${k}=`, 'm').test(txt) ? txt.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : `${txt}${txt && !txt.endsWith('\n') ? '\n' : ''}${k}=${v}\n`);

if (process.argv.includes('--test')) {
  const txt = read();
  const url = (get(txt, 'EXPO_PUBLIC_AI_URL') || DEFAULT_URL).replace(/\/+$/, '');
  const token = get(txt, 'EXPO_PUBLIC_AI_TOKEN');
  if (!token) { console.error('Manca EXPO_PUBLIC_AI_TOKEN in .env.local: lancia prima "node scripts/setup-ai.mjs".'); process.exit(1); }
  try {
    const r = await fetch(`${url}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: 'Rispondi solo con la parola: ok' }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) console.error('401 non autorizzato: in Cloudflare APP_TOKEN è diverso da quello di .env.local. Incolla lì la parola d\'ordine stampata da questo script e fai Deploy.');
    else if (!r.ok) console.error(`Errore ${r.status}: ${JSON.stringify(j).slice(0, 400)}\nSe parla del modello, controlla il nome del modello Gemini nel Worker (MODEL) in Google AI Studio.`);
    else console.log(`Funziona. Risposta di Gemini: «${String(j.reply ?? '').trim().slice(0, 80)}»`);
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(`Non riesco a raggiungere ${url}: ${e.message}`); process.exit(1); }
}

let txt = read();
txt = set(txt, 'EXPO_PUBLIC_AI_URL', get(txt, 'EXPO_PUBLIC_AI_URL') || DEFAULT_URL);
let token = get(txt, 'EXPO_PUBLIC_AI_TOKEN');
let fresh = false;
if (!token) {
  // si chiede la tua APP_TOKEN di Cloudflare; se non la ricordi, invio e se ne crea una nuova
  const rl = (await import('node:readline/promises')).createInterface({ input: process.stdin, output: process.stdout });
  token = (await rl.question('Incolla la tua APP_TOKEN di Cloudflare (la stessa del Worker), oppure premi invio per crearne una nuova: ')).trim();
  rl.close();
  if (!token) { token = crypto.randomBytes(24).toString('hex'); fresh = true; }
  txt = set(txt, 'EXPO_PUBLIC_AI_TOKEN', token);
}
fs.writeFileSync(FILE, txt);
console.log(`Scritto ${FILE} con l'indirizzo del Worker.`);
if (fresh) {
  console.log('\nParola d\'ordine NUOVA (copiala, serve in Cloudflare):\n');
  console.log(`  ${token}\n`);
  console.log('In Cloudflare: Workers & Pages > lifepilot-api > Settings > Variables and Secrets > APP_TOKEN > Edit > incolla questa parola > Deploy.');
} else console.log('Parola d\'ordine salvata in .env.local: è quella del tuo Worker, in Cloudflare non devi cambiare nulla.');
console.log('\nPoi: node scripts/setup-ai.mjs --test   e   npx expo start -c');
