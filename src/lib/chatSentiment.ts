/**
 * Umore e stress letti da quello che scrivi a Theia, SUL TELEFONO (nessuna AI, niente esce): parole di benessere, di malessere e di stress,
 * con la negazione («non sto bene» = malessere). Ogni giorno con abbastanza messaggi dà un tono (da 1 a 5) e un livello di stress (0-100).
 * È un segnale grezzo, utile solo insieme agli altri dati: non è una diagnosi. Modulo PURO.
 */
export type Pt = { d: string; v: number };

const POS = new Set(['bene', 'benissimo', 'felice', 'contento', 'contenta', 'ottimo', 'ottima', 'fantastico', 'fantastica', 'bello', 'bella', 'tranquillo', 'tranquilla', 'sereno', 'serena', 'riposato', 'riposata', 'energia', 'motivato', 'motivata', 'orgoglioso', 'orgogliosa', 'divertito', 'divertita', 'rilassato', 'rilassata', 'soddisfatto', 'soddisfatta', 'grazie', 'adoro', 'amo', 'meraviglioso', 'splendido', 'carico', 'carica', 'ottimista', 'fiducioso', 'fiduciosa', 'grato', 'grata', 'entusiasta', 'finalmente', 'happy', 'great', 'good', 'calm', 'relaxed', 'excited', 'proud']);
const NEG = new Set(['male', 'malissimo', 'triste', 'tristezza', 'stanco', 'stanca', 'stanchissimo', 'esausto', 'esausta', 'sfinito', 'sfinita', 'giù', 'depresso', 'depressa', 'solo', 'sola', 'soletto', 'arrabbiato', 'arrabbiata', 'frustrato', 'frustrata', 'insonnia', 'piango', 'pianto', 'demotivato', 'demotivata', 'deluso', 'delusa', 'pessimo', 'pessima', 'orribile', 'terribile', 'schifo', 'inutile', 'colpa', 'vergogna', 'sad', 'tired', 'exhausted', 'lonely', 'angry', 'depressed', 'awful']);
const STRESS = new Set(['stress', 'stressato', 'stressata', 'stressante', 'ansia', 'ansioso', 'ansiosa', 'panico', 'agitato', 'agitata', 'agitazione', 'preoccupato', 'preoccupata', 'preoccupazione', 'preoccupazioni', 'paura', 'nervoso', 'nervosa', 'sopraffatto', 'sopraffatta', 'pressione', 'tensione', 'burnout', 'esaurimento', 'scadenza', 'scadenze', 'ritardo', 'urgente', 'anxious', 'anxiety', 'stressed', 'overwhelmed', 'worried', 'deadline']);
const STRESS_PHRASES = [/non ce la faccio/, /troppe cose/, /troppo da fare/, /non riesco a dormire/, /non dormo/, /mi sento sotto pressione/, /non ho tempo/, /sono in ritardo/, /mi sento sopraffatt/];
const NEGATORS = new Set(['non', 'mai', 'senza', 'niente', 'no', 'not', "n't"]);

const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

export type TextScore = { pos: number; neg: number; stress: number; words: number };
/** Conta parole positive, negative e di stress in un testo; una parola dopo «non» (entro 2 parole) vale il contrario. */
export function scoreText(raw: string): TextScore {
  const text = norm(raw);
  const words = text ? text.split(' ') : [];
  let pos = 0, neg = 0, stress = 0;
  words.forEach((w, i) => {
    const negated = [1, 2].some((k) => NEGATORS.has(words[i - k] ?? ''));
    if (POS.has(w)) { if (negated) neg++; else pos++; }
    else if (NEG.has(w)) { if (negated) pos++; else neg++; }
    else if (STRESS.has(w)) { if (negated) pos++; else stress++; }
  });
  for (const re of STRESS_PHRASES) if (re.test(text)) stress++;
  return { pos, neg, stress, words: words.length };
}

/** Per giorno: tono (1-5, 3 = neutro) e stress (0-100). Un giorno conta se ha almeno 2 segnali emotivi nei messaggi (meno non dice niente). */
export function analyzeMessages(msgs: { ts: number; text: string }[], dayOf: (ts: number) => string): { mood: Pt[]; stress: Pt[] } {
  const by = new Map<string, TextScore>();
  for (const m of msgs) {
    if (!m.text || m.text.length < 3) continue;
    const s = scoreText(m.text);
    const d = dayOf(m.ts);
    const cur = by.get(d) ?? { pos: 0, neg: 0, stress: 0, words: 0 };
    by.set(d, { pos: cur.pos + s.pos, neg: cur.neg + s.neg, stress: cur.stress + s.stress, words: cur.words + s.words });
  }
  const mood: Pt[] = [], stress: Pt[] = [];
  for (const [d, s] of [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const signals = s.pos + s.neg + s.stress;
    if (signals < 2) continue;
    const tone = (s.pos - s.neg - s.stress * 0.7) / (signals + 1);
    mood.push({ d, v: Math.round(Math.max(1, Math.min(5, 3 + 2 * tone)) * 10) / 10 });
    stress.push({ d, v: Math.round(Math.max(0, Math.min(100, 20 + 80 * (s.stress / signals)))) });
  }
  return { mood, stress };
}
