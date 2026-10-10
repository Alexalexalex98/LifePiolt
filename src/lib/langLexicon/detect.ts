/** Rilevamento della lingua di un messaggio: script Unicode per zh/hi/ar/ru/ja, parole funzione per le lingue latine. PURO. */
import { fold } from './fold.ts';

export type Detected = { lang: string; sure: boolean };

const LATIN_WORDS: Record<string, string> = {
  it: 'il lo gli una uno che per con mio mia miei domani oggi dopodomani alle sono non cosa devo aggiungi aggiungimi impegno riunione ricordami quando sposta cancella elimina nel nella del della dei della settimana ogni mese stasera ho fare fatto ciao grazie',
  en: 'the and to my add what tomorrow today at with is for of please you are have do i me when show delete move remind meeting task plan next week every month tonight undo hello thanks',
  es: 'agrega agregar anade anadir manana hoy una un por favor reunion tarea cita recuerdame mi mis que para los las pasado hacer tengo elimina borra mueve semana proxima cada mes esta noche hola gracias calendario cuando',
  fr: 'ajoute ajouter demain aujourd hui une un pour avec mon ma mes je est reunion tache rappelle supprime efface deplace semaine prochaine chaque mois ce soir bonjour merci que les des du apres rendez',
  de: 'der die das und ich mein meine morgen heute fuge hinzu um uhr mit fur termin aufgabe bitte ein eine nachste woche jeden monat heute abend hallo danke losche verschiebe erinnere mich was habe',
  pt: 'adiciona adicione amanha hoje uma um por favor reuniao tarefa lembra meu minha meus que para os as as nao eu semana proxima cada mes hoje a noite ola obrigado apaga remove muda marcar compromisso',
  id: 'yang dan di ke dari untuk dengan saya aku besok hari ini tambah tambahkan jam pukul tolong rapat tugas apa kapan hapus pindahkan ingatkan minggu depan setiap bulan nanti malam halo terima kasih jadwal',
};
const SETS = Object.fromEntries(Object.entries(LATIN_WORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
// parole che appartengono davvero a una sola lingua pesano di più
const DISTINCT: Record<string, string[]> = {
  it: ['aggiungi', 'aggiungimi', 'domani', 'dopodomani', 'alle', 'ricordami', 'riunione', 'impegno', 'cosa', 'devo'],
  en: ['the', 'tomorrow', 'add', 'what', 'my', 'please', 'meeting', 'remind'],
  es: ['agrega', 'anade', 'manana', 'hoy', 'tarea', 'reunion', 'recuerdame', 'cita', 'favor'],
  fr: ['ajoute', 'demain', 'aujourd', 'tache', 'rappelle', 'bonjour', 'merci', 'mon', 'je'],
  de: ['ich', 'morgen', 'heute', 'uhr', 'termin', 'aufgabe', 'bitte', 'und', 'mein'],
  pt: ['adiciona', 'adicione', 'amanha', 'hoje', 'tarefa', 'reuniao', 'obrigado', 'nao', 'meu'],
  id: ['besok', 'tambah', 'tambahkan', 'jam', 'pukul', 'tolong', 'rapat', 'tugas', 'saya', 'yang'],
};

export function scriptOf(text: string): 'zh' | 'ja' | 'hi' | 'ar' | 'ru' | 'latin' | 'none' {
  let han = 0, kana = 0, dev = 0, arab = 0, cyr = 0, lat = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff)) kana++;
    else if ((c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)) han++;
    else if (c >= 0x0900 && c <= 0x097f) dev++;
    else if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f)) arab++;
    else if (c >= 0x0400 && c <= 0x04ff) cyr++;
    else if (/\p{L}/u.test(ch)) lat++;
  }
  const total = han + kana + dev + arab + cyr + lat;
  if (!total) return 'none';
  if (kana > 0) return 'ja';
  const best = Math.max(han, dev, arab, cyr, lat);
  if (best === lat) return 'latin';
  if (best === han) return 'zh';
  if (best === dev) return 'hi';
  if (best === arab) return 'ar';
  return 'ru';
}

/** `hint` = lingua preferita (quella dell'app o scelta al volo): vince a parità e dà un piccolo bonus. */
export function detectLang(text: string, hint?: string): Detected {
  const sc = scriptOf(text);
  if (sc === 'none') return { lang: hint ?? 'it', sure: false };
  if (sc !== 'latin') {
    // il cinese scritto solo in caratteri Han può essere giapponese: se l'utente ha scelto ja, resta ja
    if (sc === 'zh' && hint === 'ja') return { lang: 'ja', sure: false };
    return { lang: sc, sure: true };
  }
  const toks = fold(text, 'latin').f.replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
  const score: Record<string, number> = {};
  for (const lg of Object.keys(SETS)) {
    let s = 0;
    for (const t of toks) {
      if (SETS[lg].has(t)) s += 1;
      if (DISTINCT[lg].includes(t)) s += 1;
    }
    score[lg] = s;
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const hintScore = hint ? score[hint] ?? 0 : 0;
  if (topScore === 0) return { lang: hint ?? 'it', sure: false };
  if (hint && hintScore >= topScore) return { lang: hint, sure: hintScore >= 2 };
  // la lingua preferita vince se è vicina
  if (hint && hintScore >= topScore - 1 && hintScore > 0) return { lang: hint, sure: false };
  return { lang: top, sure: topScore >= 2 && topScore - (ranked[1]?.[1] ?? 0) >= 1 };
}
