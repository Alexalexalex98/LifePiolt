import { indexOfWord, normalize } from './match.ts';
import { tx } from './tx.ts';

/**
 * Riscrittura FEDELE del prompt. La riscrittura vera la fa un modello sul server con REWRITE_SYSTEM_PROMPT;
 * qui ci sono: il prompt, un verificatore deterministico (checkFidelity), e una pulizia locale di base per quando il modello non c'e'.
 * Principio: stesso comando dell'utente, mai inventare, aggiungere stile o cambiare significato.
 */
export const REWRITE_SYSTEM_PROMPT = `You rewrite a user's request into a clean prompt for a generative AI provider.
You are a faithful editor, NOT a creative writer.

RULES
1. Keep EXACTLY the same command and meaning. Do not add, remove or change anything the user asked for.
2. Fix typos, filler words, repetitions and mixed languages. Translate into {TARGET_LANGUAGE} (usually English) and make the sentence clear and well structured.
3. Preserve every number, quantity, name, place, quoted text, color, object, position and constraint, exactly.
4. Do NOT add style, quality or detail words the user did not say (no "photorealistic", "4k", "cinematic", "highly detailed", "masterpiece", lighting, camera, artist names, etc.).
5. Do NOT resolve ambiguity by guessing. If something is ambiguous, keep it as ambiguous in the prompt and list it in "ambiguities".
6. Do not answer the request, do not add explanations, do not refuse or moralize: only rewrite.
7. Never include personal data that is not in the user's text.

OUTPUT: a single JSON object, nothing else:
{"prompt": "<the rewritten prompt>", "language": "<language code of the prompt>", "ambiguities": ["<short note>", ...]}`;

// --- pulizia locale ---
const FILLERS = /(?<![\p{L}\p{N}])(?:ehm|uhm|uhh|umm|mmm|euh|ähm|äh|ahm)(?![\p{L}\p{N}])[,.]?\s*/giu;

/** Pulizia minima: solo spazi (usata quando la riscrittura non e' fedele). */
export const minimalClean = (s: string): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** Pulizia locale di base (offline): spazi, riempitivi, ripetizioni, punteggiatura doppia, maiuscola iniziale. Non cambia il significato. */
export function cleanLocal(s: string): string {
  let t = minimalClean(s);
  t = t.replace(FILLERS, ' ');
  t = t.replace(/(?<![\p{L}\p{N}])(\p{L}+)(?:\s+\1)+(?![\p{L}\p{N}])/giu, '$1');
  t = t.replace(/([!?])\1+/g, '$1').replace(/\.{4,}/g, '...').replace(/,{2,}/g, ',');
  t = t.replace(/\s+([,;:!?.])/g, '$1').replace(/(\p{L})([,;:!?])(?=\p{L})/gu, '$1$2 ');
  t = minimalClean(t);
  return t ? t.charAt(0).toLocaleUpperCase() + t.slice(1) : t;
}

// --- dizionari di concetti (forma canonica inglese) ---
const expand = (stems: string[], suffixes: string[]) => stems.flatMap((s) => suffixes.map((x) => s + x));
const RU_ADJ = ['ый', 'ая', 'ое', 'ые', 'ого', 'ым', 'ой', 'ую', 'ому', 'ых'];

export const COLORS: Record<string, string[]> = {
  red: ['rosso', 'rossa', 'rossi', 'rosse', 'red$', 'rojo', 'roja', 'rouge', 'rot$', 'rote', 'roten', 'roter', 'vermelho', 'vermelha', '红', '紅', 'लाल', 'احمر', 'أحمر', ...expand(['красн'], RU_ADJ), '赤', 'merah$'],
  blue: ['blu$', 'azzurro', 'azzurra', 'blue', 'azul', 'bleu', 'blau', '蓝', '藍', '青', 'नीला', 'ازرق', 'أزرق', 'синий', 'синяя', 'синее', 'синие', 'синего', 'голуб', 'biru'],
  green: ['verde', 'verdi', 'green', 'vert$', 'verte', 'grun', '绿', '緑', 'हरा', 'اخضر', 'أخضر', ...expand(['зелен'], RU_ADJ), 'hijau'],
  yellow: ['giallo', 'gialla', 'yellow', 'amarillo', 'amarilla', 'jaune', 'gelb', 'amarelo', 'amarela', '黄', 'पीला', 'اصفر', 'أصفر', ...expand(['желт'], RU_ADJ), 'kuning'],
  orange: ['arancione', 'arancio', 'orange', 'naranja', 'laranja', '橙', '橘', 'नारंगी', 'برتقالي', ...expand(['оранжев'], RU_ADJ), 'oranye', 'jingga'],
  purple: ['viola$', 'violetto', 'purple', 'violet', 'morado', 'violeta', 'lila$', 'violett', 'roxo', '紫', 'बैंगनी', 'ارجواني', 'بنفسجي', ...expand(['фиолетов'], RU_ADJ), 'ungu'],
  pink: ['rosa$', 'pink', 'rosado', '粉', 'ピンク', 'गुलाबी', 'وردي', ...expand(['розов'], RU_ADJ), 'merah muda'],
  black: ['nero', 'nera', 'neri', 'nere', 'black', 'negro', 'negra', 'noir', 'schwarz', 'preto', 'preta', '黑', '黒', 'काला', 'اسود', 'أسود', ...expand(['черн'], RU_ADJ), 'hitam'],
  white: ['bianco', 'bianca', 'bianchi', 'bianche', 'white', 'blanco', 'blanca', 'blanc', 'blanche', 'weiss', 'weiß', 'branco', 'branca', '白', 'सफ़ेद', 'सफेद', 'ابيض', 'أبيض', ...expand(['бел'], RU_ADJ), 'putih'],
  gray: ['grigio', 'grigia', 'gray', 'grey', 'gris$', 'grau', 'cinza', '灰', 'ग्रे', 'स्लेटी', 'رمادي', ...expand(['сер'], RU_ADJ), 'abu-abu'],
  brown: ['marrone', 'castano', 'brown', 'marron', 'braun', 'castanho', '棕', '茶色', 'भूरा', 'بني', ...expand(['коричнев'], RU_ADJ), 'coklat', 'cokelat'],
  gold: ['oro$', 'dorato', 'dorata', 'gold', 'golden', 'dorado', 'dore', 'ouro$', 'dourado', '金色', 'सुनहरा', 'ذهبي', ...expand(['золот'], RU_ADJ), 'emas'],
  silver: ['argento', 'argentato', 'silver', 'plata$', 'plateado', 'argent$', 'silber', 'prata$', '银', '銀', 'चांदी', 'فضي', ...expand(['серебрян'], RU_ADJ), 'perak'],
};

export const OBJECTS: Record<string, string[]> = {
  cat: ['gatto', 'gatta', 'gatti', 'gatte', 'cat$', 'cats$', 'gato', 'gata', 'chat$', 'chatte', 'katze', 'kater', '猫', 'बिल्ली', 'قطة', 'кошк', 'кот$', 'котик', 'kucing'],
  dog: ['cane$', 'cani$', 'dog$', 'dogs$', 'perro', 'chien', 'hund', 'cachorro', 'cao$', '狗', '犬', 'कुत्ता', 'كلب', 'собак', 'anjing'],
  house: ['casa$', 'case$', 'house', 'maison', 'haus$', 'casas$', '房子', '家', 'घर', 'منزل', 'بيت', 'дом$', 'дома$', 'rumah'],
  car: ['auto$', 'macchina', 'car$', 'cars$', 'coche', 'carro', 'voiture', 'wagen', '汽车', '車', 'कार', 'سيارة', 'машин', 'автомобил', 'mobil$'],
  tree: ['albero', 'alberi', 'tree$', 'trees$', 'arbol', 'arbre', 'baum', 'arvore', '树', 'पेड़', 'شجرة', 'дерев', 'pohon'],
  sun: ['sole$', 'sun$', 'sol$', 'soleil', 'sonne', '太阳', '太陽', 'सूरज', 'شمس', 'солнц', 'matahari'],
  moon: ['luna$', 'moon$', 'lune$', 'mond$', '月亮', 'चांद', 'قمر', 'луна$', 'луну$', 'bulan'],
  sea: ['mare$', 'sea$', 'ocean', 'oceano', 'mar$', 'mer$', 'meer', '海', 'समुद्र', 'بحر', 'море$', 'море,', 'laut$'],
  mountain: ['montagna', 'montagne', 'mountain', 'montana', 'berg$', '山', 'पहाड़', 'جبل', 'гора$', 'горы$', 'гору$', 'gunung'],
  flower: ['fiore', 'fiori', 'flower', 'flor$', 'fleur', 'blume', '花', 'फूल', 'زهرة', 'цветок', 'цветы', 'bunga'],
  bird: ['uccello', 'uccelli', 'bird$', 'birds$', 'pajaro', 'oiseau', 'vogel', 'passaro', '鸟', '鳥', 'पक्षी', 'طائر', 'птиц', 'burung'],
  horse: ['cavallo', 'cavalli', 'horse', 'caballo', 'cheval', 'pferd', 'cavalo', '马', '馬', 'घोड़ा', 'حصان', 'лошад', 'kuda$'],
  dragon: ['drago$', 'dragon$', 'drache', 'dragao', '龙', '龍', 'ドラゴン', 'ड्रैगन', 'تنين', 'дракон', 'naga$'],
  robot: ['robot', 'робот', '机器人', 'ロボット'],
  castle: ['castello', 'castle', 'castillo', 'chateau', 'schloss', 'castelo', '城堡', 'किला', 'قلعة', 'замок', 'kastil'],
  woman: ['donna', 'donne', 'woman', 'women', 'mujer', 'femme', 'frau$', 'mulher', '女人', '女性', 'महिला', 'امرأة', 'женщин', 'wanita'],
  man: ['uomo', 'uomini', 'man$', 'men$', 'hombre', 'homme', 'mann$', 'homem', '男人', '男性', 'आदमी', 'رجل', 'мужчин', 'pria$'],
  child: ['bambino', 'bambina', 'bambini', 'child', 'children', 'kid$', 'kids$', 'nino', 'enfant', 'crianca', '孩子', 'बच्चा', 'طفل', 'ребен', 'anak$'],
};

const NUMW: [number, string[]][] = [
  [2, ['due', 'two', 'dos', 'deux', 'zwei', 'dois', 'duas', '两', '二', 'दो', 'اثنان', 'два', 'две', 'dua']],
  [3, ['tre', 'three', 'tres', 'trois', 'drei', '三', 'तीन', 'ثلاثة', 'три', 'tiga']],
  [4, ['quattro', 'four', 'cuatro', 'quatre', 'vier', 'quatro', '四', 'चार', 'اربعة', 'أربعة', 'четыре', 'empat']],
  [5, ['cinque', 'five', 'cinco', 'cinq', 'funf', '五', 'पांच', 'خمسة', 'пять', 'lima']],
  [6, ['sei', 'six', 'seis', 'sechs', '六', 'छह', 'ستة', 'шесть', 'enam']],
  [7, ['sette', 'seven', 'siete', 'sept', 'sieben', 'sete', '七', 'सात', 'سبعة', 'семь', 'tujuh']],
  [8, ['otto', 'eight', 'ocho', 'huit', 'acht', 'oito', '八', 'आठ', 'ثمانية', 'восемь', 'delapan']],
  [9, ['nove', 'nine', 'nueve', 'neuf', 'neun', '九', 'नौ', 'تسعة', 'девять', 'sembilan']],
  [10, ['dieci', 'ten', 'diez', 'dix', 'zehn', 'dez', '十', 'दस', 'عشرة', 'десять', 'sepuluh']],
];

/** toponimi tradotti spesso dai modelli */
const NAME_ALIAS: Record<string, string> = {
  roma: 'rome', milano: 'milan', venezia: 'venice', firenze: 'florence', napoli: 'naples', torino: 'turin', genova: 'genoa',
  parigi: 'paris', londra: 'london', mosca: 'moscow', monaco: 'munich', vienna: 'vienna', germania: 'germany', francia: 'france', spagna: 'spain', svizzera: 'switzerland', italia: 'italy',
  zurigo: 'zurich', ginevra: 'geneva', berna: 'bern', lisbona: 'lisbon', atene: 'athens', pechino: 'beijing', tokyo: 'tokyo', nuovayork: 'newyork',
  germany: 'germany', deutschland: 'germany', espana: 'spain', italien: 'italy', zurich: 'zurich', munchen: 'munich', wien: 'vienna', moskau: 'moscow', londres: 'london', lisboa: 'lisbon',
};

const STOP = new Set(['il', 'lo', 'la', 'le', 'li', 'gli', 'un', 'una', 'uno', 'i', 'the', 'a', 'an', 'el', 'los', 'las', 'unos', 'unas', 'une', 'des', 'les', 'der', 'die', 'das', 'ein', 'eine', 'o', 'os', 'as', 'um', 'uma', 'e', 'ed', 'y', 'et', 'and', 'und', 'di', 'da', 'in', 'con', 'per', 'su', 'of', 'to', 'for', 'with', 'on', 'at', 'my', 'mi', 'mio', 'mia', 'ma', 'ho', 'io', 'i', 'voglio', 'vorrei', 'disegna', 'crea', 'fai', 'genera', 'draw', 'create', 'make', 'generate', 'please', 'per favore', 'puoi', 'can', 'could', 'dibuja', 'dessine', 'zeichne', 'desenha']);

const STYLE: Record<string, { terms: string[]; eq: string[] }> = {
  photorealistic: { terms: ['photorealistic', 'photo-realistic', 'photo realistic', 'hyperrealistic', 'hyper-realistic', 'hyper realistic'], eq: ['fotorealistic', 'iperrealistic', 'fotorrealista', 'photoréaliste', 'photoreal', 'fotorealist', '写实', 'реалистичн'] },
  realistic: { terms: ['realistic'], eq: ['realistic', 'realista', 'realiste', 'realistisch', '写实', '逼真', 'реалистичн', 'リアル'] },
  cinematic: { terms: ['cinematic', 'cinematographic'], eq: ['cinematograf', 'cinematic', 'cinemat', '电影', 'кинематограф', '映画'] },
  k4: { terms: ['4k', '8k', '16k', 'uhd', 'ultra hd', 'ultra-hd'], eq: ['4k', '8k', '16k', 'uhd'] },
  detailed: { terms: ['highly detailed', 'ultra detailed', 'intricate', 'hyper detailed', 'hyper-detailed'], eq: ['dettagliat', 'detallad', 'detaille', 'detailliert', 'detalhad', '细节', 'детализирован', '詳細', 'detail'] },
  masterpiece: { terms: ['masterpiece', 'award-winning', 'award winning', 'best quality', 'trending on artstation', 'artstation'], eq: ['capolavoro', 'obra maestra', 'chef-d', 'meisterwerk', 'obra-prima', 'artstation'] },
  render: { terms: ['unreal engine', 'octane render', '3d render', 'ray tracing', 'ray-tracing'], eq: ['unreal', 'octane', '3d', 'render'] },
  lighting: { terms: ['dramatic lighting', 'studio lighting', 'golden hour', 'volumetric', 'bokeh', 'soft lighting', 'rim light'], eq: ['luce', 'iluminacion', 'lumiere', 'licht', 'luz', 'bokeh', 'golden', 'light', '光', 'свет', '光'] },
  vibe: { terms: ['stunning', 'epic', 'breathtaking', 'beautiful', 'gorgeous', 'vibrant', 'sharp focus', 'professional'], eq: ['bell', 'bonit', 'hermos', 'beau', 'schon', 'bonito', 'lind', 'epic', 'stupend', 'vibrant', 'professional', 'professionale', 'nitid', '美', 'красив', '綺麗', 'cantik', 'indah'] },
  medium: { terms: ['digital art', 'oil painting', 'watercolor', 'watercolour', 'anime', 'pixel art', 'concept art', 'sketch', 'cartoon'], eq: ['digital', 'digitale', 'olio', 'oleo', 'huile', 'acquerell', 'acuarela', 'aquarelle', 'aquarell', 'aquarela', '水彩', 'акварел', 'anime', 'pixel', 'schizzo', 'bozzetto', 'cartone', 'cartoon', 'dibujo', 'dessin', 'zeichnung', 'desenho', '油画', 'sketch', 'abbozz'] },
};

export type Entities = { nums: Set<string>; colors: Set<string>; objects: Set<string>; quotes: Set<string>; names: Set<string> };

const find = (n: string, words: string[]) => words.some((w) => indexOfWord(n, normalize(w)) >= 0);

const QUOTES = /«([^»]+)»|"([^"]+)"|“([^”]+)”|„([^“”]+)[“”]|「([^」]+)」|『([^』]+)』/g;

/** Estrae le entita' che devono sopravvivere alla riscrittura. lang 'de' disattiva i nomi propri (i sostantivi tedeschi hanno la maiuscola). */
export function extractEntities(text: string, lang = ''): Entities {
  const e: Entities = { nums: new Set(), colors: new Set(), objects: new Set(), quotes: new Set(), names: new Set() };
  const stripped = text.replace(/\[[A-Z]+\]/g, ' ').replace(QUOTES, (m, ...g) => { const q = g.slice(0, 6).find((x) => typeof x === 'string'); if (q) e.quotes.add(normalize(q).replace(/\s+/g, ' ').trim()); return ' '; });
  const n = normalize(stripped);
  for (const m of n.matchAll(/\d+(?:[.,]\d+)?/g)) e.nums.add(m[0].replace(',', '.'));
  for (const [v, words] of NUMW) if (find(n, words.map((w) => (/^[a-z]+$/.test(w) ? w + '$' : w)))) e.nums.add(String(v));
  for (const [k, words] of Object.entries(COLORS)) if (find(n, words)) e.colors.add(k);
  for (const [k, words] of Object.entries(OBJECTS)) if (find(n, words)) e.objects.add(k);
  if (lang !== 'de') {
    const letters = stripped.replace(/[^\p{L}]/gu, '');
    const shouting = letters.length > 3 && letters === letters.toLocaleUpperCase();
    if (!shouting) {
      const re = /(^|[.!?]\s+|\n)?(\p{Lu}[\p{L}'’-]*)/gu;
      for (const m of stripped.matchAll(re)) {
        const start = !!m[1] || m.index === 0;
        const w = normalize(m[2]).replace(/['’-]/g, '');
        if (start || w.length < 2 || STOP.has(w)) continue;
        const key = NAME_ALIAS[w] ?? w;
        // niente nomi che sono gia' colori/oggetti (es. "Rosso")
        if (find(w, Object.values(COLORS).flat()) || find(w, Object.values(OBJECTS).flat())) continue;
        e.names.add(key);
      }
    }
  }
  return e;
}

export type Fidelity = { ok: boolean; missing: string[]; invented: string[]; reasons: string[] };

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Verifica deterministica: la riscrittura conserva tutto cio' che c'era e non inventa dettagli. */
export function checkFidelity(original: string, rewritten: string, lang = ''): Fidelity {
  const missing: string[] = [], invented: string[] = [], reasons: string[] = [];
  const rw = (rewritten ?? '').trim();
  if (!rw) return { ok: false, missing, invented, reasons: [tx('La riscrittura è vuota.')] };
  const o = extractEntities(original, lang), r = extractEntities(rw, lang);
  const nr = normalize(rw);
  for (const x of o.nums) if (!r.nums.has(x)) missing.push(tx('numero {0}', x));
  for (const x of o.colors) if (!r.colors.has(x)) missing.push(tx('colore {0}', x));
  for (const x of o.objects) if (!r.objects.has(x)) missing.push(tx('oggetto {0}', x));
  for (const x of o.quotes) if (!nr.replace(/\s+/g, ' ').includes(x)) missing.push(tx('testo tra virgolette «{0}»', x));
  for (const x of o.names) if (!r.names.has(x) && !nr.includes(x)) missing.push(tx('nome {0}', x));
  for (const x of r.nums) if (!o.nums.has(x)) invented.push(tx('numero {0}', x));
  for (const x of r.colors) if (!o.colors.has(x)) invented.push(tx('colore {0}', x));
  for (const x of r.objects) if (!o.objects.has(x)) invented.push(tx('oggetto {0}', x));
  for (const x of r.quotes) if (!o.quotes.has(x)) invented.push(tx('testo tra virgolette «{0}»', x));
  const no = normalize(original);
  for (const [, s] of Object.entries(STYLE)) {
    const hit = s.terms.find((t) => indexOfWord(nr, normalize(t)) >= 0);
    if (hit && !find(no, s.terms) && !s.eq.some((q) => no.includes(normalize(q)))) invented.push(tx('stile «{0}»', hit));
  }
  const ow = wordCount(original), rwc = wordCount(rw);
  if (rwc > ow * 3 + 12) reasons.push(tx('La riscrittura è molto più lunga del testo originale.'));
  if (ow >= 4 && rwc < Math.max(1, Math.floor(ow * 0.25))) reasons.push(tx('La riscrittura è molto più corta del testo originale.'));
  if (missing.length) reasons.push(tx('Manca: {0}.', missing.join(', ')));
  if (invented.length) reasons.push(tx('Aggiunge: {0}.', invented.join(', ')));
  return { ok: reasons.length === 0, missing, invented, reasons };
}

export type RewriteResponse = { prompt: string; language?: string; ambiguities: string[] };

/** Legge la risposta del modello di riscrittura: JSON (anche dentro ```), oppure testo semplice. */
export function parseRewriteResponse(raw: string): RewriteResponse {
  const s = (raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const j = JSON.parse(s) as { prompt?: unknown; language?: unknown; ambiguities?: unknown };
    if (j && typeof j.prompt === 'string') return { prompt: j.prompt.trim(), language: typeof j.language === 'string' ? j.language : undefined, ambiguities: Array.isArray(j.ambiguities) ? j.ambiguities.filter((x): x is string => typeof x === 'string') : [] };
  } catch { /* testo semplice */ }
  return { prompt: s, ambiguities: [] };
}

export type RewriteOutcome = {
  text: string;
  source: 'model' | 'local' | 'fallback';
  note: string;
  ambiguities: string[];
  fidelity?: Fidelity;
};

/** Sceglie il testo da inviare: l'output del modello se fedele, altrimenti il testo dell'utente appena pulito (e lo segnala). */
export function rewriteFaithfully(original: string, modelRaw: string | null | undefined, lang = ''): RewriteOutcome {
  if (modelRaw == null || !modelRaw.trim()) {
    return { text: cleanLocal(original), source: 'local', ambiguities: [], note: tx('Pulizia locale di base. La traduzione e la riformulazione le farà un modello sul server, con controllo di fedeltà.') };
  }
  const parsed = parseRewriteResponse(modelRaw);
  const f = checkFidelity(original, parsed.prompt, lang);
  if (f.ok) return { text: parsed.prompt, source: 'model', ambiguities: parsed.ambiguities, fidelity: f, note: tx('Riscritto da un modello e verificato: conserva numeri, nomi, colori e oggetti.') };
  return { text: minimalClean(original), source: 'fallback', ambiguities: [], fidelity: f, note: tx('La riscrittura non era fedele ({0}): uso il tuo testo com\'è.', f.reasons.join(' ')) };
}
