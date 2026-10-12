// Attende che un URL risponda (CI: dopo l'avvio del server statico). node scripts/ci/wait-http.mjs <url> [timeoutSec]
const url = process.argv[2]; const limit = Number(process.argv[3] || 30) * 1000;
if (!url) { console.error('uso: wait-http.mjs <url> [timeoutSec]'); process.exit(2); }
const t0 = Date.now();
for (;;) {
  try { const r = await fetch(url); if (r.ok) { console.log(`ok ${url} (${r.status})`); process.exit(0); } } catch { /* non ancora */ }
  if (Date.now() - t0 > limit) { console.error(`timeout in attesa di ${url}`); process.exit(1); }
  await new Promise((r) => setTimeout(r, 500));
}
