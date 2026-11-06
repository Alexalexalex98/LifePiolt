/** Casa (modulo PURO, nessun alias '@/'): stanze e planimetria, faccende con intervalli, piano giornaliero e annuale, famiglia, punti, supporto ADHD.
 *  Pensato per ridurre il carico mentale: il piano si bilancia da solo, i ritardi scivolano senza colpa, mai liste rosse. Tutto si calcola sul telefono. */
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dateOf = (day: string) => new Date(day + 'T12:00:00Z');
export const addDays = (day: string, n: number): string => { const d = dateOf(day); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
export const daysBetween = (a: string, b: string): number => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86400000);
export const weekday = (day: string): number => dateOf(day).getUTCDay();
export const monthOf = (day: string): string => day.slice(0, 7);

/* ---------- intervalli ---------- */
export type Unit = 'day' | 'week' | 'month' | 'year';
export type Every = { n: number; unit: Unit };
export function addEvery(day: string, e: Every): string {
  if (e.unit === 'day') return addDays(day, e.n);
  if (e.unit === 'week') return addDays(day, 7 * e.n);
  const d = dateOf(day); const dd = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + (e.unit === 'month' ? e.n : 12 * e.n));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dd, last)); return isoOf(d);
}
export const everyDays = (e: Every): number => e.n * { day: 1, week: 7, month: 30, year: 365 }[e.unit];
export const everyLabel = (e: Every): string => {
  if (e.n === 1) return { day: 'ogni giorno', week: 'ogni settimana', month: 'ogni mese', year: 'ogni anno' }[e.unit];
  return `ogni ${e.n} ${{ day: 'giorni', week: 'settimane', month: 'mesi', year: 'anni' }[e.unit]}`;
};
export const INTERVALS: { label: string; every: Every }[] = [
  { label: 'Ogni giorno', every: { n: 1, unit: 'day' } }, { label: 'Ogni 3 giorni', every: { n: 3, unit: 'day' } }, { label: 'Ogni settimana', every: { n: 1, unit: 'week' } },
  { label: 'Ogni 2 settimane', every: { n: 2, unit: 'week' } }, { label: 'Ogni mese', every: { n: 1, unit: 'month' } }, { label: 'Ogni 3 mesi', every: { n: 3, unit: 'month' } },
  { label: 'Ogni 6 mesi', every: { n: 6, unit: 'month' } }, { label: 'Ogni anno', every: { n: 1, unit: 'year' } },
];

/* ---------- stanze e faccende ---------- */
export type RoomType = 'cucina' | 'bagno' | 'camera' | 'cameretta' | 'soggiorno' | 'ingresso' | 'corridoio' | 'studio' | 'lavanderia' | 'balcone' | 'cantina' | 'garage' | 'altro';
export const ROOM_TYPES: { id: RoomType; label: string }[] = [{ id: 'cucina', label: 'Cucina' }, { id: 'bagno', label: 'Bagno' }, { id: 'camera', label: 'Camera da letto' }, { id: 'cameretta', label: 'Cameretta' }, { id: 'soggiorno', label: 'Soggiorno' }, { id: 'ingresso', label: 'Ingresso' }, { id: 'corridoio', label: 'Corridoio' }, { id: 'studio', label: 'Studio' }, { id: 'lavanderia', label: 'Lavanderia' }, { id: 'balcone', label: 'Balcone' }, { id: 'cantina', label: 'Cantina' }, { id: 'garage', label: 'Garage' }, { id: 'altro', label: 'Altro' }];
export type Room = { id: string; name: string; type: RoomType; w: number; l: number };
export type Chore = { id: string; title: string; room: string | null; every: Every; minutes: number; effort: 1 | 2 | 3; assignee: string | 'rotate' | null; due: string | null; lastDone?: string; active: boolean; note?: string };
const E = (n: number, unit: Unit): Every => ({ n, unit });
type Item = { title: string; every: Every; minutes: number; effort: 1 | 2 | 3 };
export const CATALOG: Record<RoomType | 'casa', Item[]> = {
  cucina: [{ title: 'Pulire piano cottura e piani di lavoro', every: E(1, 'day'), minutes: 5, effort: 1 }, { title: 'Lavare il pavimento', every: E(1, 'week'), minutes: 15, effort: 2 }, { title: 'Pulire il lavello e il rubinetto', every: E(1, 'week'), minutes: 5, effort: 1 }, { title: 'Svuotare e pulire il frigo', every: E(1, 'month'), minutes: 25, effort: 2 }, { title: 'Pulire il forno', every: E(3, 'month'), minutes: 40, effort: 3 }, { title: 'Pulire il filtro della lavastoviglie', every: E(1, 'month'), minutes: 10, effort: 1 }, { title: 'Pulire cappa e filtri', every: E(3, 'month'), minutes: 30, effort: 3 }, { title: 'Controllare le scadenze in dispensa', every: E(1, 'month'), minutes: 15, effort: 1 }],
  bagno: [{ title: 'Pulire lavandino e specchio', every: E(1, 'week'), minutes: 8, effort: 1 }, { title: 'Pulire WC', every: E(1, 'week'), minutes: 8, effort: 2 }, { title: 'Pulire doccia o vasca', every: E(1, 'week'), minutes: 15, effort: 2 }, { title: 'Lavare il pavimento', every: E(1, 'week'), minutes: 10, effort: 2 }, { title: 'Lavare la tenda della doccia', every: E(3, 'month'), minutes: 10, effort: 1 }, { title: 'Pulire le fughe e il silicone', every: E(6, 'month'), minutes: 30, effort: 3 }, { title: 'Controllare farmaci e cosmetici scaduti', every: E(6, 'month'), minutes: 15, effort: 1 }],
  camera: [{ title: 'Cambiare le lenzuola', every: E(2, 'week'), minutes: 15, effort: 2 }, { title: 'Aspirare il pavimento', every: E(1, 'week'), minutes: 10, effort: 1 }, { title: 'Spolverare i mobili', every: E(1, 'week'), minutes: 10, effort: 1 }, { title: 'Girare o arieggiare il materasso', every: E(3, 'month'), minutes: 10, effort: 2 }, { title: 'Lavare le tende', every: E(3, 'month'), minutes: 20, effort: 2 }, { title: 'Cambio armadio di stagione', every: E(6, 'month'), minutes: 60, effort: 3 }],
  cameretta: [{ title: 'Rimettere a posto i giochi', every: E(1, 'day'), minutes: 10, effort: 1 }, { title: 'Aspirare il pavimento', every: E(1, 'week'), minutes: 10, effort: 1 }, { title: 'Cambiare le lenzuola', every: E(2, 'week'), minutes: 15, effort: 2 }, { title: 'Spolverare i mobili', every: E(1, 'week'), minutes: 10, effort: 1 }, { title: 'Scegliere i giochi da regalare', every: E(6, 'month'), minutes: 30, effort: 2 }],
  soggiorno: [{ title: 'Riordinare divano e tavolino', every: E(1, 'day'), minutes: 5, effort: 1 }, { title: 'Aspirare il pavimento', every: E(1, 'week'), minutes: 15, effort: 1 }, { title: 'Spolverare mobili e libreria', every: E(1, 'week'), minutes: 15, effort: 1 }, { title: 'Pulire le finestre', every: E(3, 'month'), minutes: 40, effort: 3 }, { title: 'Lavare le tende', every: E(3, 'month'), minutes: 20, effort: 2 }, { title: 'Aspirare il divano', every: E(1, 'month'), minutes: 15, effort: 2 }],
  ingresso: [{ title: 'Sistemare scarpe e giacche', every: E(1, 'day'), minutes: 3, effort: 1 }, { title: 'Lavare il pavimento', every: E(1, 'week'), minutes: 8, effort: 1 }, { title: 'Svuotare la posta e la carta', every: E(1, 'week'), minutes: 5, effort: 1 }],
  corridoio: [{ title: 'Aspirare o spazzare', every: E(1, 'week'), minutes: 8, effort: 1 }, { title: 'Spolverare cornici e battiscopa', every: E(1, 'month'), minutes: 10, effort: 1 }],
  studio: [{ title: 'Sistemare la scrivania', every: E(1, 'week'), minutes: 10, effort: 1 }, { title: 'Aspirare il pavimento', every: E(1, 'week'), minutes: 8, effort: 1 }, { title: 'Ordinare i documenti', every: E(1, 'month'), minutes: 20, effort: 2 }, { title: 'Pulire schermo e tastiera', every: E(1, 'month'), minutes: 5, effort: 1 }],
  lavanderia: [{ title: 'Pulire il filtro della lavatrice', every: E(1, 'month'), minutes: 10, effort: 1 }, { title: 'Pulire la guarnizione della lavatrice', every: E(1, 'month'), minutes: 10, effort: 1 }, { title: 'Pulire il filtro dell\'asciugatrice', every: E(1, 'week'), minutes: 3, effort: 1 }, { title: 'Lavatrice a vuoto con anticalcare', every: E(3, 'month'), minutes: 5, effort: 1 }],
  balcone: [{ title: 'Spazzare e annaffiare', every: E(1, 'week'), minutes: 10, effort: 1 }, { title: 'Lavare il pavimento', every: E(1, 'month'), minutes: 20, effort: 2 }],
  cantina: [{ title: 'Controllare umidità e scatole', every: E(3, 'month'), minutes: 20, effort: 2 }, { title: 'Riordinare gli scaffali', every: E(6, 'month'), minutes: 45, effort: 3 }],
  garage: [{ title: 'Spazzare e fare ordine', every: E(3, 'month'), minutes: 30, effort: 2 }],
  altro: [{ title: 'Pulizia generale', every: E(1, 'week'), minutes: 15, effort: 1 }],
  casa: [{ title: 'Portare fuori i rifiuti', every: E(3, 'day'), minutes: 5, effort: 1 }, { title: 'Lavare le finestre di tutta la casa', every: E(6, 'month'), minutes: 90, effort: 3 }, { title: 'Pulire i termosifoni', every: E(6, 'month'), minutes: 30, effort: 2 }, { title: 'Cambiare le batterie dei rilevatori di fumo', every: E(1, 'year'), minutes: 15, effort: 1 }, { title: 'Pulire i filtri del condizionatore', every: E(3, 'month'), minutes: 20, effort: 2 }, { title: 'Decalcificare rubinetti e docce', every: E(3, 'month'), minutes: 25, effort: 2 }],
};
export const roomName = (rooms: Room[], id: string | null): string => (id ? rooms.find((r) => r.id === id)?.name ?? 'Stanza' : 'Tutta la casa');
export const choreFrom = (id: string, room: string | null, it: Item): Chore => ({ id, title: it.title, room, every: it.every, minutes: it.minutes, effort: it.effort, assignee: null, due: null, active: true });
/** Faccende del catalogo adatte a una stanza e non ancora presenti. */
export const suggestFor = (room: Room | null, have: Chore[]): Item[] => (CATALOG[room?.type ?? 'casa'] ?? []).filter((it) => !have.some((c) => c.room === (room?.id ?? null) && c.title === it.title));
export const choreUid = (n: number, now: number) => `c${now.toString(36)}${n}`;

/* ---------- pianificazione ---------- */
export type PlanOpts = { budget: number; restDays?: number[] };
/** Assegna le prime scadenze in modo da distribuire il lavoro: non si accumulano tutte lo stesso giorno. Tocca solo le faccende senza scadenza (o tutte con `all`). */
export function balanceDue(chores: Chore[], today: string, o: PlanOpts & { all?: boolean }, horizon = 366): Chore[] {
  const load = new Array<number>(horizon + 1).fill(0); const rest = new Set(o.restDays ?? []);
  const out = chores.map((c) => ({ ...c })); const todo: number[] = [];
  out.forEach((c, i) => { if (!c.active) return; if (c.due && !o.all) { for (let d = c.due, k = 0; k < 400 && daysBetween(today, d) <= horizon; d = addEvery(d, c.every), k++) { const off = daysBetween(today, d); if (off >= 0) load[off]! += c.minutes; } } else todo.push(i); });
  todo.sort((a, b) => everyDays(out[a]!.every) - everyDays(out[b]!.every) || out[b]!.minutes - out[a]!.minutes);
  for (const i of todo) {
    const c = out[i]!; const span = Math.max(1, Math.min(everyDays(c.every), 45)); let best = 0; let bestCost = Infinity;
    for (let s = 0; s < span; s++) {
      const start = addDays(today, s); let cost = 0; let k = 0;
      for (let d = start; k < 400 && daysBetween(today, d) <= horizon; d = addEvery(d, c.every), k++) { const off = daysBetween(today, d); const over = Math.max(0, (load[off] ?? 0) + c.minutes - o.budget); cost += over * 3 + (load[off] ?? 0) + (rest.has(weekday(d)) ? 1000 : 0); }
      if (cost < bestCost) { bestCost = cost; best = s; }
    }
    const start = addDays(today, best); c.due = start;
    for (let d = start, k = 0; k < 400 && daysBetween(today, d) <= horizon; d = addEvery(d, c.every), k++) load[daysBetween(today, d)]! += c.minutes;
  }
  return out;
}
export const choreState = (c: Chore, today: string): 'in ritardo' | 'oggi' | 'presto' | 'più avanti' | 'spenta' => (!c.active ? 'spenta' : !c.due ? 'più avanti' : c.due < today ? 'in ritardo' : c.due === today ? 'oggi' : daysBetween(today, c.due) <= 7 ? 'presto' : 'più avanti');
/** Più il ritardo è grande rispetto all'intervallo, più la faccenda conta; a pari merito prima le più brevi. */
export const priority = (c: Chore, today: string): number => (c.due ? Math.max(0, daysBetween(c.due, today)) / Math.max(1, everyDays(c.every)) : 0);
export type PlanItem = { chore: Chore; late: boolean };
/** Cosa fare oggi: le faccende in scadenza dentro il tempo che hai. Con poca energia: al massimo due cose, brevi e facili. Quello che non entra scivola in avanti, senza colpa. */
export function dailyPlan(chores: Chore[], today: string, o: { budget: number; lowEnergy?: boolean; doneToday?: string[]; who?: string }): { items: PlanItem[]; later: Chore[]; minutes: number } {
  const done = new Set(o.doneToday ?? []);
  const due = chores.filter((c) => c.active && c.due && c.due <= today && !done.has(c.id) && (!o.who || c.assignee === o.who || c.assignee === 'rotate' || c.assignee === null));
  due.sort((a, b) => priority(b, today) - priority(a, today) || a.minutes - b.minutes);
  let budget = o.lowEnergy ? Math.min(o.budget, 15) : o.budget; const cap = o.lowEnergy ? 2 : 99;
  const pool = o.lowEnergy ? due.filter((c) => c.effort === 1 && c.minutes <= 10) : due;
  const items: PlanItem[] = []; let used = 0;
  for (const c of pool) { if (items.length >= cap) break; if (items.length === 0 || used + c.minutes <= budget) { items.push({ chore: c, late: !!c.due && c.due < today }); used += c.minutes; budget = Math.max(budget, 0); } }
  const inPlan = new Set(items.map((x) => x.chore.id));
  return { items, later: due.filter((c) => !inPlan.has(c.id)), minutes: used };
}
export const complete = (c: Chore, day: string): Chore => ({ ...c, lastDone: day, due: addEvery(day, c.every) });
export const postpone = (c: Chore, today: string, days = 1): Chore => ({ ...c, due: addDays(today, days) });
/** Il «non ce l'ho fatta» non esiste: le cose arretrate vengono riportate nei giorni dopo, dove c'è posto, senza fare un elenco di ritardi. */
export function slideBacklog(chores: Chore[], today: string, o: { budget: number; restDays?: number[] }): Chore[] {
  const rest = new Set(o.restDays ?? []); const load = new Map<string, number>();
  const bump = (d: string, m: number) => load.set(d, (load.get(d) ?? 0) + m);
  for (const c of chores) if (c.active && c.due && c.due >= today) bump(c.due, c.minutes);
  const todayLoad = () => load.get(today) ?? 0;
  return chores.map((c) => {
    if (!c.active || !c.due || c.due >= today) return c;
    if (todayLoad() + c.minutes <= o.budget) { bump(today, c.minutes); return { ...c, due: today }; }
    for (let k = 1; k <= 21; k++) { const d = addDays(today, k); if (rest.has(weekday(d))) continue; if ((load.get(d) ?? 0) + c.minutes <= o.budget) { bump(d, c.minutes); return { ...c, due: d }; } }
    return { ...c, due: addDays(today, 7) };
  });
}
export type MonthPlan = { month: string; count: number; minutes: number; items: { day: string; chore: Chore }[] };
/** Il piano dell'anno: per ogni mese, cosa c'è da fare e quanto tempo serve. */
export function yearPlan(chores: Chore[], from: string, months = 12): MonthPlan[] {
  const end = addEvery(from, { n: months, unit: 'month' }); const map = new Map<string, MonthPlan>();
  for (let i = 0; i < months; i++) { const m = monthOf(addEvery(`${monthOf(from)}-01`, { n: i, unit: 'month' })); map.set(m, { month: m, count: 0, minutes: 0, items: [] }); }
  for (const c of chores) {
    if (!c.active || !c.due) continue; let k = 0;
    for (let d = c.due < from ? from : c.due; d < end && k < 800; d = addEvery(d, c.every), k++) { const p = map.get(monthOf(d)); if (p) { p.count++; p.minutes += c.minutes; p.items.push({ day: d, chore: c }); } }
  }
  return [...map.values()].map((p) => ({ ...p, items: p.items.sort((a, b) => a.day.localeCompare(b.day)) }));
}

/* ---------- famiglia e punti ---------- */
export type Member = { id: string; name: string; kind: 'adulto' | 'ragazzo' | 'bambino'; color: string };
export type Done = { id: string; chore: string; member: string; day: string; points: number; ts: number };
export const MEMBER_COLORS = ['#0F766E', '#7C3AED', '#B45309', '#2563EB', '#DB2777', '#16A34A'];
export const KIND_LABEL: Record<Member['kind'], string> = { adulto: 'Adulto', ragazzo: 'Ragazzo', bambino: 'Bambino' };
export const basePoints = (c: Pick<Chore, 'effort' | 'minutes'>): number => c.effort * 8 + Math.round(c.minutes / 5);
/** Stessa faccenda già fatta oggi (da chiunque): niente punti doppi. */
export const pointsFor = (c: Chore, log: Done[], day: string): number => (log.some((d) => d.chore === c.id && d.day === day) ? 0 : basePoints(c));
export type Row = { member: Member; points: number; count: number; share: number };
export function monthlyBoard(log: Done[], month: string, members: Member[]): { rows: Row[]; total: number } {
  const mine = log.filter((d) => monthOf(d.day) === month); const total = mine.reduce((n, d) => n + d.points, 0);
  const rows = members.map((m) => { const l = mine.filter((d) => d.member === m.id); const p = l.reduce((n, d) => n + d.points, 0); return { member: m, points: p, count: l.length, share: total ? Math.round((p / total) * 100) : 0 }; }).sort((a, b) => b.points - a.points || b.count - a.count || a.member.name.localeCompare(b.member.name));
  return { rows, total };
}
/** Chi può fare cosa: i bambini solo cose facili e brevi, i ragazzi fino a medie. */
export const canDo = (m: Member, c: Pick<Chore, 'effort' | 'minutes'>): boolean => (m.kind === 'bambino' ? c.effort === 1 && c.minutes <= 15 : m.kind === 'ragazzo' ? c.effort <= 2 : true);
/** «A turno»: tocca a chi finora ha fatto meno questo mese tra chi può farla. */
export function rotateTo(c: Chore, members: Member[], log: Done[], month: string): Member | null {
  const ok = members.filter((m) => canDo(m, c)); if (!ok.length) return null;
  const pts = (m: Member) => log.filter((d) => d.member === m.id && monthOf(d.day) === month).reduce((n, d) => n + d.points, 0);
  return [...ok].sort((a, b) => pts(a) - pts(b) || a.name.localeCompare(b.name))[0]!;
}
/** Minuti a settimana per ogni persona, per vedere se il peso è giusto. */
export function weeklyLoad(chores: Chore[], members: Member[]): { member: Member; minutes: number }[] {
  const per = (c: Chore) => (c.minutes * 7) / Math.max(1, everyDays(c.every)); const m = new Map<string, number>(members.map((x) => [x.id, 0]));
  for (const c of chores) { if (!c.active) continue; const who = c.assignee && c.assignee !== 'rotate' ? [c.assignee] : members.filter((x) => canDo(x, c)).map((x) => x.id); const part = per(c) / Math.max(1, who.length); for (const id of who) if (m.has(id)) m.set(id, m.get(id)! + part); }
  return members.map((x) => ({ member: x, minutes: Math.round(m.get(x.id) ?? 0) }));
}

/* ---------- planimetria ---------- */
export const ROOM_DEFAULT: Record<RoomType, [number, number]> = { cucina: [3.5, 3], bagno: [2.5, 2], camera: [4, 3.5], cameretta: [3.5, 3], soggiorno: [5, 4], ingresso: [2.5, 2], corridoio: [4, 1.2], studio: [3, 3], lavanderia: [2, 2], balcone: [3, 1.5], cantina: [3, 3], garage: [5, 3], altro: [3, 3] };
export const areaOf = (r: Pick<Room, 'w' | 'l'>): number => Math.round(r.w * r.l * 10) / 10;
export const totalArea = (rooms: Room[]): number => Math.round(rooms.reduce((n, r) => n + r.w * r.l, 0) * 10) / 10;
export type Rect = { room: Room; x: number; y: number; w: number; h: number };
/** Disegno semplice della casa: le stanze in proporzione, a file, dentro la larghezza data. È una stima: si perfeziona cambiando le misure. */
export function layoutRooms(rooms: Room[], width: number, gap = 4): { rects: Rect[]; height: number; scale: number } {
  if (!rooms.length) return { rects: [], height: 0, scale: 1 };
  const sorted = [...rooms].sort((a, b) => b.w * b.l - a.w * a.l); const area = sorted.reduce((n, r) => n + r.w * r.l, 0);
  const rowM = Math.max(Math.max(...sorted.map((r) => r.w)), Math.sqrt(area * 1.5)); const scale = (width - gap) / rowM;
  const rects: Rect[] = []; let x = 0; let y = 0; let rowH = 0;
  for (const r of sorted) {
    const w = r.w * scale; const h = r.l * scale;
    if (x > 0 && x + w > width + 0.5) { x = 0; y += rowH + gap; rowH = 0; }
    rects.push({ room: r, x, y, w, h }); x += w + gap; rowH = Math.max(rowH, h);
  }
  return { rects, height: y + rowH, scale };
}
/** Stima delle stanze dai metri quadrati totali e dall'elenco dei tipi. */
export function estimateRooms(totalM2: number, types: RoomType[]): Omit<Room, 'id'>[] {
  const base = types.map((t) => ROOM_DEFAULT[t][0] * ROOM_DEFAULT[t][1]); const sum = base.reduce((n, x) => n + x, 0) || 1; const names = new Map<RoomType, number>();
  return types.map((t, i) => { const a = Math.max(2, (base[i]! / sum) * totalM2); const ratio = ROOM_DEFAULT[t][0] / ROOM_DEFAULT[t][1]; const l = Math.sqrt(a / ratio); const n = (names.get(t) ?? 0) + 1; names.set(t, n); const label = ROOM_TYPES.find((x) => x.id === t)!.label;
    return { name: types.filter((x) => x === t).length > 1 ? `${label} ${n}` : label, type: t, w: Math.round(l * ratio * 10) / 10, l: Math.round(l * 10) / 10 }; });
}
const TYPE_WORDS: [RegExp, RoomType][] = [[/cucin|kitchen|cottura/, 'cucina'], [/bagn|wc|toilet|bath|doccia/, 'bagno'], [/cameretta|bimb|kids|children/, 'cameretta'], [/camera|letto|bedroom|notte/, 'camera'], [/soggiorn|salotto|living|sala|pranzo/, 'soggiorno'], [/ingress|entrata|hall|entrance/, 'ingresso'], [/corridoi|disimpegno|passage/, 'corridoio'], [/studio|ufficio|office/, 'studio'], [/lavander|ripostigli|laundry/, 'lavanderia'], [/balcon|terrazz|veranda|patio/, 'balcone'], [/cantin|solaio|soffitta|basement/, 'cantina'], [/garage|box auto/, 'garage']];
export const roomTypeFrom = (s: string): RoomType => { const t = s.toLowerCase(); return TYPE_WORDS.find(([re]) => re.test(t))?.[1] ?? 'altro'; };
/** Legge la risposta dell'AI sulla planimetria: un elenco di stanze con misure in metri (stimate). Scarta tutto quello che non ha senso. */
export function parseRoomsJson(text: string): Omit<Room, 'id'>[] {
  const m = text.match(/\[[\s\S]*\]/); if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as { name?: unknown; type?: unknown; w?: unknown; l?: unknown }[]; if (!Array.isArray(arr)) return [];
    return arr.slice(0, 20).map((x) => { const name = String(x.name ?? '').trim().slice(0, 40); const type = roomTypeFrom(String(x.type ?? name)); const d = ROOM_DEFAULT[type]; const w = Number(x.w); const l = Number(x.l); const ok = (n: number) => Number.isFinite(n) && n >= 0.8 && n <= 20;
      return { name: name || ROOM_TYPES.find((t) => t.id === type)!.label, type, w: ok(w) ? Math.round(w * 10) / 10 : d[0], l: ok(l) ? Math.round(l * 10) / 10 : d[1] }; }).filter((r) => r.name);
  } catch { return []; }
}
export const FLOORPLAN_PROMPT = 'Guarda questa planimetria o schermata di una mappa del robot aspirapolvere. Elenca le stanze che vedi. Rispondi SOLO con un array JSON, senza testo prima o dopo, nel formato [{"name":"Cucina","type":"cucina","w":3.5,"l":3}]. "type" può essere: cucina, bagno, camera, cameretta, soggiorno, ingresso, corridoio, studio, lavanderia, balcone, cantina, garage, altro. "w" e "l" sono larghezza e lunghezza stimate in metri: se non ci sono misure, stima in modo ragionevole. Massimo 15 stanze.';

/* ---------- supporto ADHD ---------- */
/** Una cosa sola, la più piccola e utile: breve, facile, in ritardo o in scadenza. */
export function nextTinyStep(plan: PlanItem[]): PlanItem | null {
  return [...plan].sort((a, b) => a.chore.effort - b.chore.effort || a.chore.minutes - b.chore.minutes || Number(b.late) - Number(a.late))[0] ?? null;
}
/** La faccenda spezzata in pezzi piccoli e con tempi: prepara, fai la parte che si vede, rimetti a posto. */
export function microSteps(c: Pick<Chore, 'title' | 'minutes'>): { text: string; minutes: number }[] {
  const main = Math.max(2, c.minutes - 2);
  return [{ text: 'Prendi quello che ti serve', minutes: 1 }, { text: `${c.title}: parti dalla parte che si vede di più`, minutes: Math.ceil(main * 0.7) }, { text: 'Finisci con il resto, solo se hai ancora voglia', minutes: Math.floor(main * 0.3) || 1 }, { text: 'Rimetti a posto le cose', minutes: 1 }];
}
/** Il timer parte con un tempo breve: 5, 10 o 15 minuti. */
export const timeBox = (c: Pick<Chore, 'minutes'>): number => (c.minutes <= 5 ? 5 : c.minutes <= 10 ? 10 : 15);
export const PRAISE = ['Fatto. Una cosa in meno nella testa.', 'Ottimo, un pezzo di casa è a posto.', 'Bravo: era la parte più difficile, partire.', 'Una cosa alla volta, e ne hai fatta una.', 'Bella mossa. Ora puoi riposare un momento.'];
export const praiseOf = (n: number): string => PRAISE[Math.abs(n) % PRAISE.length]!;

/* ---------- prima e dopo ---------- */
export type Verdict = { verdict: 'meglio' | 'uguale' | 'da_rifinire'; praise: string; tips: string[] };
export const BEFORE_PROMPT = 'Questa è una foto di una parte della casa PRIMA del riordino. Descrivi in una o due frasi, in italiano, cosa c\'è fuori posto o da sistemare (per esempio vestiti sul letto, carte sul tavolo). Sii gentile e concreto, senza giudicare.';
export const afterPrompt = (before: string): string => `Questa è la stessa zona DOPO il riordino. Prima era così: "${before.slice(0, 400)}". Confronta con la foto di adesso. Rispondi SOLO con JSON: {"verdict":"meglio" oppure "uguale" oppure "da_rifinire","praise":"una frase di incoraggiamento sincera, in italiano","tips":["al massimo due consigli pratici e gentili"]}. Sii positivo e specifico, mai severo: se manca poco dillo con tatto. Se la foto non mostra la stessa zona dillo nei consigli.`;
export function parseVerdict(text: string): Verdict {
  const m = text.match(/\{[\s\S]*\}/);
  try { const j = JSON.parse(m ? m[0] : text) as Partial<Verdict>; const v = j.verdict === 'meglio' || j.verdict === 'uguale' || j.verdict === 'da_rifinire' ? j.verdict : 'meglio'; return { verdict: v, praise: String(j.praise ?? '').slice(0, 240) || 'Hai fatto un bel passo.', tips: (Array.isArray(j.tips) ? j.tips : []).map((t) => String(t).slice(0, 200)).slice(0, 2) }; }
  catch { return { verdict: 'meglio', praise: text.replace(/\s+/g, ' ').trim().slice(0, 240) || 'Hai fatto un bel passo.', tips: [] }; }
}
