#!/usr/bin/env node
// Collega l'app a Supabase.  Uso (sul TUO computer, nella cartella del progetto):  node scripts/setup-supabase.mjs
// Chiede l'indirizzo del progetto e la chiave PUBBLICA (anon). Non chiedere né incollare mai la chiave service_role.
import fs from 'node:fs';
import readline from 'node:readline/promises';

const FILE = '.env.local';
const set = (txt, k, v) => (new RegExp(`^${k}=`, 'm').test(txt) ? txt.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : `${txt}${txt && !txt.endsWith('\n') ? '\n' : ''}${k}=${v}\n`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const url = (await rl.question('Project URL (es. https://abcd1234.supabase.co): ')).trim().replace(/\/+$/, '');
const key = (await rl.question('Chiave anon / public (inizia con eyJ...): ')).trim();
rl.close();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) { console.error('L\'indirizzo non sembra quello di un progetto Supabase (https://xxxx.supabase.co).'); process.exit(1); }
if (!key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) { console.error('Quella non sembra la chiave anon/public (di solito inizia con "eyJ").'); process.exit(1); }
try {
  const payload = key.startsWith('eyJ') ? JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()) : {};
  if (payload.role === 'service_role') { console.error('Questa è la chiave service_role: NON va usata nell\'app. Prendi quella "anon / public".'); process.exit(1); }
} catch { /* chiave non decodificabile: si va avanti */ }
let txt = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
txt = set(set(txt, 'EXPO_PUBLIC_SUPABASE_URL', url), 'EXPO_PUBLIC_SUPABASE_ANON_KEY', key);
fs.writeFileSync(FILE, txt);
try {
  const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
  console.log(r.ok ? 'Il progetto risponde.' : `Il progetto ha risposto ${r.status}: se è in pausa, riattivalo da supabase.com.`);
} catch (e) { console.log(`Non riesco a raggiungere il progetto adesso (${e.message}): controlla la connessione.`); }
console.log(`Scritto ${FILE}. Ora riavvia l'app con: npx expo start -c`);
