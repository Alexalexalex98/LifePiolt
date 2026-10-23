/**
 * Traguardi (modulo PURO): Theia cresce con te. Ogni traguardo VERO (task fatti, allenamenti, obiettivi raggiunti, mesi di risparmio, sfide vinte insieme...)
 * porta benefici a lei: stelline per la casa, punti per crescere, a volte un mobile in regalo. Si ritirano quando vuoi; nessuno scade e nessuno si perde.
 */
export type Stats = { tasksDone: number; workouts: number; goalsDone: number; meals: number; mindEntries: number; challengesReached: number; careDays: number; savingMonths: number; level: number };
export type Milestone = { id: string; stat: keyof Stats; target: number; title: string; desc: string; reward: { coins: number; xp: number; item?: string } };

const M = (stat: keyof Stats, target: number, title: string, desc: string, coins: number, xp: number, item?: string): Milestone => ({ id: `${stat}:${target}`, stat, target, title, desc, reward: { coins, xp, item } });
export const MILESTONES: Milestone[] = [
  M('tasksDone', 10, 'Dieci cose fatte', 'Hai completato 10 task.', 20, 8),
  M('tasksDone', 50, 'Cinquanta cose fatte', 'Hai completato 50 task.', 60, 20, 'plant:1'),
  M('tasksDone', 200, 'Duecento cose fatte', 'Hai completato 200 task.', 200, 50),
  M('workouts', 5, 'Cinque allenamenti', 'Ti sei allenato 5 volte.', 30, 10),
  M('workouts', 20, 'Venti allenamenti', 'Ti sei allenato 20 volte.', 100, 30, 'rug:1'),
  M('workouts', 60, 'Sessanta allenamenti', 'Ti sei allenato 60 volte.', 300, 60),
  M('goalsDone', 1, 'Un obiettivo raggiunto', 'Hai raggiunto un tuo obiettivo.', 80, 25, 'art:1'),
  M('goalsDone', 3, 'Tre obiettivi raggiunti', 'Hai raggiunto tre obiettivi.', 200, 50),
  M('meals', 20, 'Venti pasti segnati', 'Hai segnato 20 pasti.', 30, 8),
  M('meals', 100, 'Cento pasti segnati', 'Hai segnato 100 pasti.', 120, 30),
  M('careDays', 3, 'Tre giorni di cura', 'Ti sei preso cura di Theia per 3 giorni.', 20, 10),
  M('careDays', 14, 'Due settimane di cura', 'Ti sei preso cura di Theia per 14 giorni.', 100, 30, 'lamp:1'),
  M('careDays', 60, 'Due mesi di cura', 'Ti sei preso cura di Theia per 60 giorni.', 400, 80, 'sofa:2'),
  M('savingMonths', 1, 'Un mese di risparmio', 'Hai messo da parte almeno il 10% delle entrate in un mese.', 100, 30),
  M('savingMonths', 3, 'Tre mesi di risparmio', 'Per tre mesi hai messo da parte almeno il 10%.', 300, 60),
  M('challengesReached', 1, 'Una sfida vinta insieme', 'Tu e un amico avete raggiunto il traguardo.', 80, 30, 'bench:1'),
  M('challengesReached', 5, 'Cinque sfide insieme', 'Cinque traguardi raggiunti con gli amici.', 300, 70),
  M('mindEntries', 3, 'Tre momenti per te', 'Ti sei preso 3 momenti per fermarti e capire cosa senti.', 40, 15),
  M('level', 5, 'Theia è cresciuta', 'Theia ha raggiunto il livello 5.', 100, 0),
  M('level', 10, 'Theia è grande', 'Theia ha raggiunto il livello 10.', 300, 0),
];

export type MilestoneState = Milestone & { value: number; done: boolean; claimed: boolean; pct: number };
export function milestonesOf(stats: Stats, claimed: string[]): MilestoneState[] {
  return MILESTONES.map((m) => { const value = stats[m.stat]; return { ...m, value, done: value >= m.target, claimed: claimed.includes(m.id), pct: Math.min(100, Math.round((value / m.target) * 100)) }; });
}
/** Quelli pronti da ritirare. */
export const claimable = (stats: Stats, claimed: string[]) => milestonesOf(stats, claimed).filter((m) => m.done && !m.claimed);

/** Stadio di crescita: cambia il nome e un po' la taglia di Theia, mai in meno. */
export const STAGES = [{ from: 1, name: 'Cucciolo' }, { from: 3, name: 'Giovane' }, { from: 6, name: 'Adulto' }, { from: 10, name: 'Saggio' }];
export const stageOf = (level: number) => [...STAGES].reverse().find((s) => level >= s.from)!;
export const sizeFactor = (level: number) => 0.84 + Math.min(10, level) * 0.016;
