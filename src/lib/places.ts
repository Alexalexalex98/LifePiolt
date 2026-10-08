/** Spostamenti tra luoghi: stima semplice (nessuna rete) per avvisare quando due impegni sono troppo vicini. */
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Minuti di viaggio tra città svizzere/vicine più comuni (simmetrico). Se manca la coppia: 30 min se i luoghi sono diversi. */
const TABLE: Record<string, number> = {
  'lugano|bellinzona': 30, 'lugano|locarno': 45, 'lugano|chiasso': 25, 'lugano|mendrisio': 20, 'lugano|como': 40, 'lugano|milano': 90,
  'lugano|zurigo': 150, 'lugano|berna': 190, 'lugano|basilea': 190, 'lugano|ginevra': 270, 'lugano|lucerna': 120, 'lugano|san gallo': 210,
  'zurigo|berna': 60, 'zurigo|basilea': 55, 'zurigo|lucerna': 45, 'zurigo|san gallo': 60, 'zurigo|ginevra': 170, 'berna|ginevra': 105, 'berna|basilea': 55,
  'milano|como': 50, 'milano|chiasso': 70, 'bellinzona|locarno': 20,
};
const HOME = new Set(['casa', 'ufficio', 'online', 'zoom', 'meet', 'teams', 'telefono', 'call', 'videochiamata']);

export function sameBase(a: string, b: string) { return strip(a) === strip(b); }

export function travelMinutes(from: string, to: string): number {
  const a = strip(from), b = strip(to);
  if (!a || !b || a === b) return 0;
  if ((HOME.has(a) && HOME.has(b)) || a === 'online' || b === 'online' || HOME.has(a) && a !== 'casa' && a !== 'ufficio' || HOME.has(b) && b !== 'casa' && b !== 'ufficio') return 0;
  return TABLE[`${a}|${b}`] ?? TABLE[`${b}|${a}`] ?? 30;
}

export type PlaceEv = { time: string; title: string; dur?: number; place?: string };
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** Avvisi per l'impegno `ev` rispetto a quelli dello stesso giorno: serve più tempo per spostarsi di quello che c'è tra i due. */
export function travelWarnings(day: PlaceEv[], ev: PlaceEv): string[] {
  if (!ev.place) return [];
  const s = toMin(ev.time), e = s + (ev.dur || 60);
  const out: string[] = [];
  day.filter((x) => x.place && !(x.time === ev.time && x.title === ev.title)).forEach((x) => {
    const xs = toMin(x.time), xe = xs + (x.dur || 60);
    const need = travelMinutes(x.place!, ev.place!);
    if (!need) return;
    if (xe <= s) { const gap = s - xe; if (gap < need) out.push(`Tra «${x.title}» (${x.place}) e «${ev.title}» (${ev.place}) hai ${gap} min ma ne servono circa ${need} per spostarti.`); }
    else if (e <= xs) { const gap = xs - e; if (gap < need) out.push(`Tra «${ev.title}» (${ev.place}) e «${x.title}» (${x.place}) hai ${gap} min ma ne servono circa ${need} per spostarti.`); }
  });
  return out;
}
