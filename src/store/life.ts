import { create } from 'zustand';

import { dayKey, minutesToTime, timeToMinutes, uid, weekdayShortDate } from '@/lib/format';
import { persisted } from './persist';

export type Subtask = { t: string; h: number; done: boolean; type: 'lavoro' | 'piacere' };
export type Task = { id: string; t: string; done?: boolean; recurring?: 'none' | 'daily' | 'weekly'; subtasks?: Subtask[] };
export type Goal = { id: string; t: string; p: number };
export type Automation = { id: string; t: string; on: boolean };
export type Note = { id: string; text: string; date: string };
export type DriveFile = { id: string; n: string; s: string; folder: string; date: string; uri?: string };
export type CalEvent = { time: string; title: string; reminder?: boolean };
export type Vacation = { id: string; dest: string; month: string; hotel: string; price: number; days: number; flight: number };
export type ChatMsg = { who: 'me' | 'ai'; text: string };

export const driveFolders = ['Documenti', 'Ricevute', 'Salute', 'Foto', 'Business', 'Altro'];
export const driveFolderColors: Record<string, string> = { Documenti: '#7bb8e0', Ricevute: '#e0c97b', Salute: '#ff9d9d', Foto: '#b96bff', Business: '#7be0b0', Altro: '#8e98a8' };

export function detectFileFolder(name: string): string {
  const low = name.toLowerCase();
  if (/\.(jpg|jpeg|png|heic|gif)$/.test(low)) return 'Foto';
  if (/contratto|locazione|affitto|accordo|documento|id[a-z]?\b/.test(low)) return 'Documenti';
  if (/ricevuta|fattura|scontrino/.test(low)) return 'Ricevute';
  if (/referto|analisi|esame|medic|cassa malati/.test(low)) return 'Salute';
  if (/aura|life sa|pitch|investit|fornitor/.test(low)) return 'Business';
  return 'Altro';
}

export const taskIsDone = (t: Task) => (t.subtasks?.length ? t.subtasks.every((s) => s.done) : !!t.done);

type LifeState = {
  tasks: Task[];
  goals: Goal[];
  automations: Automation[];
  notes: Note[];
  drive: DriveFile[];
  events: Record<string, CalEvent[]>;
  vacRange: { start: string; end: string | null } | null;
  vacations: Vacation[];
  freeBuffer: number;
  chat: Record<string, ChatMsg[]>;
  activeCat: string;

  addTask: (t: Omit<Task, 'id'>) => void;
  toggleTask: (id: string, v: boolean) => string | null;
  delTask: (id: string) => Task | null;
  restoreTask: (t: Task, idx: number) => void;
  patchTask: (id: string, patch: Partial<Task>) => void;
  toggleSubtask: (id: string, si: number, v: boolean) => void;
  expandSubtask: (id: string, si: number, steps: { t: string; h: number }[]) => void;
  scheduleBreakdown: (id: string, workStart: string, workEnd: string) => { scheduled: number; skipped: number };

  addGoal: (t: string) => void;
  bumpGoal: (id: string) => number;
  delGoal: (id: string) => void;
  addAuto: (t: string) => void;
  toggleAuto: (id: string, on: boolean) => void;

  saveNote: (id: string | null, text: string) => void;
  delNote: (id: string) => { note: Note; idx: number } | null;
  restoreNote: (n: Note, idx: number) => void;

  addFile: (f: Omit<DriveFile, 'id'>) => void;
  delFile: (id: string) => void;

  addEvent: (day: string, ev: CalEvent, weeklyUntil?: string) => number;
  delEvent: (day: string, idx: number) => CalEvent | null;
  restoreEvent: (day: string, idx: number, ev: CalEvent) => void;
  toggleReminder: (day: string, idx: number) => boolean;
  addEvents: (day: string, evs: CalEvent[]) => void;

  setVacRange: (r: LifeState['vacRange']) => void;
  addVacation: (v: Omit<Vacation, 'id'>) => void;
  delVacation: (id: string) => void;

  pushChat: (cat: string, m: ChatMsg) => void;
  setCat: (c: string) => void;
  reset: () => void;
};

const initial = {
  tasks: [] as Task[],
  goals: [] as Goal[],
  automations: [] as Automation[],
  notes: [] as Note[],
  drive: [] as DriveFile[],
  events: {} as Record<string, CalEvent[]>,
  vacRange: null as LifeState['vacRange'],
  vacations: [] as Vacation[],
  freeBuffer: 30,
  chat: {} as Record<string, ChatMsg[]>,
  activeCat: 'General',
};

export const useLife = create<LifeState>()(
  persisted<LifeState>('life', (set, get) => ({
    ...initial,

    addTask: (t) => set((s) => ({ tasks: [...s.tasks, { id: uid(), ...t }] })),
    toggleTask: (id, v) => {
      let note: string | null = null;
      set((s) => {
        const tasks = s.tasks.map((t) => (t.id === id ? { ...t, done: v } : t));
        const cur = s.tasks.find((t) => t.id === id);
        if (v && cur?.recurring && cur.recurring !== 'none') {
          tasks.push({ id: uid(), t: cur.t, done: false, recurring: cur.recurring });
          note = `Task completato · nuova occorrenza aggiunta (${cur.recurring === 'daily' ? 'domani' : 'settimana prossima'})`;
        }
        return { tasks };
      });
      return note;
    },
    delTask: (id) => {
      const t = get().tasks.find((x) => x.id === id) ?? null;
      set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }));
      return t;
    },
    restoreTask: (t, idx) => set((s) => { const a = s.tasks.slice(); a.splice(idx, 0, t); return { tasks: a }; }),
    patchTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    toggleSubtask: (id, si, v) =>
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && t.subtasks ? { ...t, subtasks: t.subtasks.map((x, i) => (i === si ? { ...x, done: v } : x)) } : t)) })),
    expandSubtask: (id, si, steps) =>
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== id || !t.subtasks) return t;
          const orig = t.subtasks[si];
          const subs = t.subtasks.slice();
          subs.splice(si, 1, ...steps.map((x) => ({ t: x.t, h: x.h, done: false, type: orig.type })));
          return { ...t, subtasks: subs };
        }),
      })),
    scheduleBreakdown: (id, workStart, workEnd) => {
      const s = get();
      const t = s.tasks.find((x) => x.id === id);
      if (!t?.subtasks) return { scheduled: 0, skipped: 0 };
      const day = dayKey();
      const ws = timeToMinutes(workStart), we = timeToMinutes(workEnd);
      let cw = ws, cl = we + s.freeBuffer, scheduled = 0, skipped = 0;
      const add: CalEvent[] = [];
      t.subtasks.forEach((st) => {
        if (st.done) return;
        const dur = Math.round(st.h * 60);
        if (st.type === 'piacere') { add.push({ time: minutesToTime(cl), title: st.t }); cl += dur; scheduled++; }
        else if (cw + dur <= we) { add.push({ time: minutesToTime(cw), title: st.t }); cw += dur; scheduled++; }
        else skipped++;
      });
      set((st) => ({ events: { ...st.events, [day]: [...(st.events[day] || []), ...add] } }));
      return { scheduled, skipped };
    },

    addGoal: (t) => set((s) => ({ goals: [...s.goals, { id: uid(), t, p: 0 }] })),
    bumpGoal: (id) => {
      let p = 0;
      set((s) => ({ goals: s.goals.map((g) => { if (g.id !== id) return g; p = Math.min(100, g.p + 5); return { ...g, p }; }) }));
      return p;
    },
    delGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
    addAuto: (t) => set((s) => ({ automations: [...s.automations, { id: uid(), t, on: true }] })),
    toggleAuto: (id, on) => set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, on } : a)) })),

    saveNote: (id, text) =>
      set((s) => (id ? { notes: s.notes.map((n) => (n.id === id ? { ...n, text } : n)) } : { notes: [...s.notes, { id: uid(), text, date: weekdayShortDate() }] })),
    delNote: (id) => {
      const idx = get().notes.findIndex((n) => n.id === id);
      if (idx < 0) return null;
      const note = get().notes[idx];
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      return { note, idx };
    },
    restoreNote: (n, idx) => set((s) => { const a = s.notes.slice(); a.splice(idx, 0, n); return { notes: a }; }),

    addFile: (f) => set((s) => ({ drive: [...s.drive, { id: uid(), ...f }] })),
    delFile: (id) => set((s) => ({ drive: s.drive.filter((f) => f.id !== id) })),

    addEvent: (day, ev, weeklyUntil) => {
      let count = 1;
      set((s) => {
        const events = { ...s.events, [day]: [...(s.events[day] || []), ev] };
        if (weeklyUntil) {
          const d = new Date(day + 'T00:00:00');
          const end = new Date(weeklyUntil + 'T00:00:00');
          d.setDate(d.getDate() + 7);
          while (d <= end) {
            const k = dayKey(d);
            events[k] = [...(events[k] || []), { ...ev }];
            count++;
            d.setDate(d.getDate() + 7);
          }
        }
        return { events };
      });
      return count;
    },
    delEvent: (day, idx) => {
      const list = get().events[day] || [];
      const ev = list[idx];
      if (!ev) return null;
      set((s) => ({ events: { ...s.events, [day]: list.filter((_, i) => i !== idx) } }));
      return ev;
    },
    restoreEvent: (day, idx, ev) => set((s) => { const l = (s.events[day] || []).slice(); l.splice(idx, 0, ev); return { events: { ...s.events, [day]: l } }; }),
    toggleReminder: (day, idx) => {
      let on = false;
      set((s) => ({ events: { ...s.events, [day]: (s.events[day] || []).map((e, i) => { if (i !== idx) return e; on = !e.reminder; return { ...e, reminder: on }; }) } }));
      return on;
    },
    addEvents: (day, evs) =>
      set((s) => {
        const cur = s.events[day] || [];
        const fresh = evs.filter((e) => !cur.some((c) => c.time === e.time && c.title === e.title));
        return { events: { ...s.events, [day]: [...cur, ...fresh] } };
      }),

    setVacRange: (r) => set({ vacRange: r }),
    addVacation: (v) => set((s) => ({ vacations: [{ id: uid(), ...v }, ...s.vacations] })),
    delVacation: (id) => set((s) => ({ vacations: s.vacations.filter((v) => v.id !== id) })),

    pushChat: (cat, m) => set((s) => ({ chat: { ...s.chat, [cat]: [...(s.chat[cat] || []), m].slice(-200) } })),
    setCat: (c) => set({ activeCat: c }),
    reset: () => set({ ...initial }),
  })),
);
