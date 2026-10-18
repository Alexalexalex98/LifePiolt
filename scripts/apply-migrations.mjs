#!/usr/bin/env node
// Applica le tre migrazioni al tuo progetto Supabase, in ordine, dal TUO computer.
// Uso:  npm i --no-save pg   (una volta)   poi   node scripts/apply-migrations.mjs
// Ti chiede l'indirizzo di connessione al database (Connect > "Direct" / "Session pooler", con la tua password).
// Quell'indirizzo resta nel tuo terminale: non viene salvato né inviato a nessuno.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

let pg;
try { pg = (await import('pg')).default; } catch { console.error('Manca il pacchetto "pg". Lancia prima:  npm i --no-save pg'); process.exit(1); }

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
console.log(`Migrazioni trovate: ${files.join(', ')}`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let conn = (await rl.question('Incolla l\'indirizzo di connessione (postgresql://...), lasciando [YOUR-PASSWORD] com\'è: ')).trim();
if (/\[YOUR-PASSWORD\]/i.test(conn)) {
  // la password si chiede a parte e si codifica: simboli come @ # / : nella password rompevano l'indirizzo
  const pw = (await rl.question('Password del database (senza parentesi quadre): ')).trim().replace(/^\[|\]$/g, '');
  conn = conn.replace(/\[YOUR-PASSWORD\]/i, encodeURIComponent(pw));
}
rl.close();
if (!/^postgres(ql)?:\/\//i.test(conn)) { console.error('Quello non sembra un indirizzo di connessione (deve iniziare con postgresql://).'); process.exit(1); }

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
try { await client.connect(); } catch (e) {
  console.error(`Non riesco a collegarmi: ${e.message}`);
  if (/password authentication failed/i.test(e.message)) console.error('La password non è quella del database. Reimpostala da Supabase (Project Settings > Database > Reset database password), scegline una SENZA simboli speciali (solo lettere e numeri) e riprova.');
  else console.error('Prova la voce "Session pooler" della finestra Connect se "Direct" non risponde.');
  process.exit(1);
}
for (const f of files) {
  process.stdout.write(`${f} ... `);
  try { await client.query(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('ok'); }
  catch (e) { console.log('ERRORE'); console.error(`  ${e.message}\n  Mandami questo messaggio e riproviamo (le migrazioni si possono rieseguire).`); await client.end(); process.exit(1); }
}
const { rows } = await client.query("select table_name from information_schema.tables where table_schema='public' order by 1");
console.log(`\nFatto. Tabelle nel progetto: ${rows.map((r) => r.table_name).join(', ')}`);
await client.end();
