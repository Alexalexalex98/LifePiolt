// Provider «manuale»: le traduzioni le scrive una persona (o un assistente) in file, la pipeline fa mascheratura, controlli e salvataggio.
//  1) MANUAL_EXPORT=1 node scripts/translate-i18n.mjs --provider=manual --lang=fr  -> scrive .i18n-cache/manual/fr/in-001.json, in-002.json... (liste di testi da tradurre)
//  2) per ogni in-NNN.json si scrive out-NNN.json: stessa lunghezza e stesso ordine, token ⟦n⟧ lasciati identici
//  3) node scripts/translate-i18n.mjs --provider=manual --lang=fr  -> legge gli out, controlla e salva nel catalogo
import fs from 'node:fs';
import path from 'node:path';

export const DIR = path.resolve('.i18n-cache/manual');
// condivisi tra le istanze (il motore ne crea più d'una, anche per l'inglese dei comandi)
const seen = {};
let hooked = false;
const SIZE = 300;
const pad = (n) => String(n).padStart(3, '0');

export function create({ env = process.env } = {}) {
  const exportMode = env.MANUAL_EXPORT === '1';
  const maps = {};
  const load = (lang) => {
    if (maps[lang]) return maps[lang];
    const m = new Map();
    const d = path.join(DIR, lang);
    if (fs.existsSync(d)) {
      for (const f of fs.readdirSync(d).filter((x) => /^in-\d+\.json$/.test(x))) {
        const o = path.join(d, f.replace('in-', 'out-'));
        if (!fs.existsSync(o)) continue;
        try {
          const a = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), b = JSON.parse(fs.readFileSync(o, 'utf8'));
          if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) a.forEach((t, i) => { if (typeof b[i] === 'string' && b[i].trim()) m.set(t, b[i]); });
          else console.error(`  ${lang}/${f}: lunghezze diverse (${a.length} vs ${Array.isArray(b) ? b.length : '?'}), file ignorato`);
        } catch (e) { console.error(`  ${lang}/${o}: ${e.message}`); }
      }
    }
    return (maps[lang] = m);
  };
  const flush = () => {
    const only = (process.argv.find((a) => a.startsWith('--lang=')) ?? '').slice(7).split(',').filter(Boolean);
    for (const [lang, set] of Object.entries(seen)) {
      if (only.length && !only.includes(lang)) continue; // i testi inglesi dei comandi servono solo quando si traduce l'inglese
      const d = path.join(DIR, lang);
      fs.rmSync(d, { recursive: true, force: true });
      fs.mkdirSync(d, { recursive: true });
      const all = [...set];
      for (let i = 0; i * SIZE < all.length; i++) fs.writeFileSync(path.join(d, `in-${pad(i + 1)}.json`), JSON.stringify(all.slice(i * SIZE, (i + 1) * SIZE), null, 0));
      console.log(`  ${lang}: ${all.length} testi da tradurre in ${Math.ceil(all.length / SIZE)} file (${d})`);
    }
  };
  return {
    name: 'manual', maskStyle: 'brackets', batchSize: 400, concurrency: 1,
    isAvailable: () => true, supports: () => true,
    async translateBatch({ texts, to }) {
      if (exportMode) {
        (seen[to] ??= new Set());
        texts.forEach((t) => seen[to].add(t));
        if (!hooked) { hooked = true; process.on('exit', flush); }
        return texts.map(() => null);
      }
      const m = load(to);
      return texts.map((t) => m.get(t) ?? null);
    },
  };
}
export default { create, envKeys: [], explicitOnly: true };
