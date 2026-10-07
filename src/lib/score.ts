import { todayKey } from '@/lib/id';
import type { Goal, HealthDay, Task, Tx } from '@/store';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function healthScore(day?: HealthDay): number | null {
  if (!day || (day.sleepHours == null && day.steps == null)) return null;
  const parts: number[] = [];
  if (day.sleepHours != null) parts.push(clamp((day.sleepHours / 8) * 100));
  if (day.steps != null) parts.push(clamp((day.steps / 10000) * 100));
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function mindScore(health: Record<string, HealthDay>): number | null {
  const moods: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const m = health[todayKey(d)]?.mood;
    if (m) moods.push(m);
  }
  if (!moods.length) return null;
  return clamp(((moods.reduce((a, b) => a + b, 0) / moods.length - 1) / 4) * 100);
}

export function financeScore(salary: number, txs: Tx[]): number | null {
  if (!salary) return null;
  const month = todayKey().slice(0, 7);
  const spent = txs.filter((t) => t.date.startsWith(month) && t.amount < 0).reduce((a, t) => a - t.amount, 0);
  return clamp((1 - spent / salary) * 100);
}

export function growthScore(goals: Goal[], tasks: Task[]): number | null {
  const parts: number[] = [];
  if (goals.length) parts.push(goals.reduce((a, g) => a + g.progress, 0) / goals.length);
  if (tasks.length) parts.push((tasks.filter((t) => t.done).length / tasks.length) * 100);
  if (!parts.length) return null;
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Media dei punteggi disponibili; null se non c'è ancora nessun dato. */
export function lifeScore(parts: (number | null)[]): number | null {
  const v = parts.filter((p): p is number => p != null);
  return v.length ? clamp(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
