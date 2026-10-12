/**
 * Ponte store -> eventi di dominio per cio' che cambia da molte schermate (task completato, obiettivo avanzato, impegno
 * aggiunto/tolto, umore registrato). Non modifica gli store: li osserva e emette gli eventi corrispondenti.
 */
import { useHealth } from '@/store/health';
import { useLife, type CalEvent } from '@/store/life';
import { emit } from './events.ts';

let started = false;
const count = (e: Record<string, CalEvent[]>) => Object.values(e ?? {}).reduce((n, l) => n + (l?.length ?? 0), 0);

export function startDomainBridge() {
  if (started) return;
  started = true;
  useLife.subscribe((s, p) => {
    if (s.tasks !== p.tasks) {
      const was = new Map(p.tasks.map((t) => [t.id, !!t.done]));
      for (const t of s.tasks) if (t.done && was.get(t.id) === false) emit('task.completed', { id: t.id });
    }
    if (s.goals !== p.goals) {
      const was = new Map(p.goals.map((g) => [g.id, g.p]));
      for (const g of s.goals) { const b = was.get(g.id); if (b !== undefined && g.p !== b) emit('goal.progressed', { id: g.id, pct: g.p }); }
    }
    if (s.events !== p.events) {
      const a = count(s.events), b = count(p.events);
      if (a > b) emit('event.added', { day: '' });
      else if (a < b) emit('event.removed', { day: '' });
      else emit('event.updated', { day: '' });
    }
  });
  useHealth.subscribe((s, p) => {
    if (s.moods !== p.moods && s.moods.length) emit('mood.logged', { mood: s.moods[0]?.mood ?? '' });
  });
}
