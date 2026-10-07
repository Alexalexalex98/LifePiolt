/** Controllo automatico (puro, senza dipendenze da React Native) di un file caricato rispetto al documento richiesto. */

export type DocStatus = 'ok' | 'dubbio' | 'invalido';
export type DocReq = { key: string; label: string; group?: string };
export type PickedFile = { name: string; size?: number; mime?: string };
export type DocCheck = { status: DocStatus; title: string; details: string[] };

export const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'xlsx', 'csv', 'docx'];
export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'heic'];
export const MAX_BYTES = 50 * 1024 * 1024;

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_DE = ['januar', 'februar', 'marz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
const MONTHS_ABBR = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_ABBR_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function fileExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,6})$/);
  return m ? m[1] : '';
}

export function isImageFile(f: { name: string; mime?: string }): boolean {
  return IMAGE_EXT.includes(fileExt(f.name)) || !!f.mime?.startsWith('image/');
}

/** Minuscole, senza accenti, separatori ridotti a spazio. */
export function normName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-.()+,]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function fmtBytes(b?: number): string {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  return b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

const has = (hay: string, words: string[]) => words.some((w) => new RegExp(`(^| )${w}`).test(hay));

/** Indice del mese (0-11) richiamato nel nome file, oppure -1. */
export function monthInName(norm: string): number {
  for (let i = 0; i < 12; i++) {
    if (has(norm, [MONTHS[i], MONTHS_EN[i], MONTHS_DE[i]])) return i;
    if (new RegExp(`(^| )(${MONTHS_ABBR[i]}|${MONTHS_ABBR_EN[i]})( |$|\\d)`).test(norm)) return i;
  }
  const iso = norm.match(/(?:^| )20\d\d (0[1-9]|1[0-2])(?: |$)/) ?? norm.match(/(?:^| )(0[1-9]|1[0-2]) 20\d\d(?: |$)/);
  return iso ? parseInt(iso[1], 10) - 1 : -1;
}

const PAYSLIP = ['busta paga', 'buste paga', 'bustapaga', 'stipendio', 'salario', 'payslip', 'lohnausweis', 'lohnabrechnung', 'cedolino', 'paga'];
const STATEMENT = ['estratto conto', 'estratto', 'statement', 'kontoauszug', 'conto', 'banca', 'bank', 'saldo', 'extrait'];
const SPOUSE = ['coniuge', 'moglie', 'marito', 'partner', 'spouse', 'wife', 'husband', 'ehepartner'];
const OWNER = ['titolare', 'owner'];

const GENERIC: Record<string, { words: string[]; name: string }> = {
  salario: { words: ['certificato', 'salario', 'lohnausweis', 'stipendio', 'salary'], name: 'certificato di salario' },
  '3pillar': { words: ['3 pilastro', '3pilastro', 'terzo pilastro', 'pilastro', '3a', 'saule', 'pillar', 'previdenza'], name: 'attestato 3° pilastro' },
  cassamalati: { words: ['cassa malati', 'cassamalati', 'assicurazione', 'assic', 'premi', 'krankenkasse', 'health', 'sanitaria', 'attestato'], name: 'attestato premi cassa malati' },
  ipoteca: { words: ['ipoteca', 'mutuo', 'interessi', 'hypothek', 'mortgage', 'banca'], name: 'interessi su mutuo/ipoteca' },
  donazioni: { words: ['donazion', 'donazione', 'ricevut', 'spenden', 'offerta', 'donation', 'beneficenza'], name: 'ricevute donazioni' },
  spesemediche: { words: ['medic', 'spese', 'fattura', 'ricevut', 'referto', 'farmacia', 'dentist', 'ospedale', 'visita', 'arzt', 'rechnung', 'medical'], name: 'spese mediche' },
  figli: { words: ['figli', 'figlio', 'asilo', 'retta', 'rette', 'scuola', 'nido', 'kita', 'bambin', 'child', 'cure'], name: 'spese per figli' },
};

/** Cartella di LifeDrive adatta al documento fiscale. */
export function taxDocFolder(key: string): string {
  if (key.startsWith('ps|')) return 'Documenti';
  if (key.startsWith('bank|')) return 'Documenti';
  const k = key.replace(/^doc\|/, '');
  if (k === 'cassamalati' || k === 'spesemediche') return 'Salute';
  if (k === 'donazioni' || k === 'figli') return 'Ricevute';
  return 'Documenti';
}

function bankTokens(bank: string): string[] {
  return normName(bank).split(' ').filter((w) => w.length >= 3 && !['banca', 'bank', 'conto', 'della', 'del', 'the'].includes(w));
}

export function checkDoc(req: DocReq, file: PickedFile): DocCheck {
  const details: string[] = [];
  const ext = fileExt(file.name);
  const extOk = ALLOWED_EXT.includes(ext);
  if (!extOk) {
    return { status: 'invalido', title: 'File non valido', details: [ext ? `Il formato .${ext} non è ammesso` : 'Il file non ha un\'estensione riconoscibile', `Formati ammessi: ${ALLOWED_EXT.map((e) => e.toUpperCase()).join(', ')}`] };
  }
  if (file.size === 0) return { status: 'invalido', title: 'File non valido', details: ['Il file è vuoto'] };
  if (file.size != null && file.size > MAX_BYTES) return { status: 'invalido', title: 'File non valido', details: [`Il file è troppo grande (${fmtBytes(file.size)}, massimo ${fmtBytes(MAX_BYTES)})`] };
  if (file.size != null && file.size < 200) return { status: 'invalido', title: 'File non valido', details: ['Il file è troppo piccolo per essere un documento reale'] };

  const norm = normName(file.name.replace(/\.[a-z0-9]{1,6}$/i, ''));
  const dubious: string[] = [];
  const good: string[] = [];
  const [kind, ...rest] = req.key.split('|');

  if (kind === 'ps') {
    const [month, person] = rest;
    if (has(norm, PAYSLIP)) good.push('il nome richiama una busta paga');
    else dubious.push('busta paga');
    const mi = monthInName(norm);
    const wantMi = MONTHS.findIndex((m) => m === normName(month));
    if (mi >= 0) {
      if (mi === wantMi) good.push(`indica il mese di ${month}`);
      else { dubious.push(`mese ${month} (nel nome compare ${MONTHS[mi]})`); }
    }
    const spouse = has(norm, SPOUSE), owner = has(norm, OWNER);
    if (person === 'Coniuge') { if (spouse) good.push('indica il coniuge'); else if (owner) dubious.push('Coniuge'); }
    else if (person === 'Titolare') { if (owner) good.push('indica il titolare'); else if (spouse) dubious.push('Titolare (il nome indica il coniuge)'); }
  } else if (kind === 'bank') {
    const bank = rest.join('|');
    const toks = bankTokens(bank);
    const bankHit = toks.some((w) => norm.includes(w));
    const stmtHit = has(norm, STATEMENT);
    if (stmtHit) good.push('il nome richiama un estratto conto');
    if (bankHit) good.push(`richiama la banca ${bank}`);
    if (!stmtHit && !bankHit) dubious.push(`estratto conto ${bank}`);
  } else {
    const g = GENERIC[rest[0]];
    const words = g ? g.words : normName(req.label).split(' ').filter((w) => w.length >= 5);
    const hit = words.some((w) => norm.includes(normName(w)));
    if (hit) good.push(`il nome richiama ${g ? g.name : normName(req.label)}`);
    else dubious.push(g ? g.name : req.label);
  }

  const fmt = fmtBytes(file.size);
  if (fmt) good.push(`dimensione plausibile (${fmt})`);
  const shortLabel = req.label.charAt(0).toLowerCase() + req.label.slice(1);
  if (dubious.length === 0) return { status: 'ok', title: 'Sembra corretto', details: [`Formato .${ext} ammesso`, ...good] };
  return {
    status: 'dubbio',
    title: `Non sono sicuro: il nome del file non richiama ${shortLabel}`,
    details: [`Formato .${ext} ammesso`, ...good.filter((g) => !g.startsWith('dimensione')), `Da verificare: ${dubious.join(', ')}`, 'Controlla tu il contenuto prima di confermare'],
  };
}
