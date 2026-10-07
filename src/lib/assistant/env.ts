import * as ImagePicker from 'expo-image-picker';

import { buildAgenda } from '@/lib/chatShare';
import { dayKey } from '@/lib/format';
import { useApp } from '@/store/app';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import type { Env } from './engine';
import { financeReport, healthReport, moodReport } from './reports';

/** Collega il motore dell'assistente agli archivi reali dell'app. */
export function makeEnv(): Env {
  const life = () => useLife.getState();
  return {
    now: () => new Date(),
    events: () => life().events,
    addEvent: (day, ev) => { life().addEvent(day, { time: ev.time, title: ev.title }); },
    delEvent: (day, ev) => {
      const idx = (life().events[day] ?? []).findIndex((x) => x.time === ev.time && x.title === ev.title);
      if (idx >= 0) life().delEvent(day, idx);
    },
    tasks: () => life().tasks.map((t) => ({ id: t.id, t: t.t, done: !!t.done })),
    addTask: (t) => { life().addTask({ t, done: false }); return life().tasks[life().tasks.length - 1]?.id ?? ''; },
    setTaskDone: (id, v) => { life().toggleTask(id, v); },
    delTask: (id) => life().delTask(id),
    restoreTask: (t) => life().restoreTask({ id: t.id, t: t.t, done: t.done }, 0),
    renameTask: (id, t) => life().patchTask(id, { t }),
    addNote: (text) => life().saveNote(null, text),
    addGoal: (t) => life().addGoal(t),
    logMood: (m) => useHealth.getState().logMood(m),
    workHours: () => useApp.getState().workHours,
    setWorkHours: (start, end) => useApp.getState().set({ workHours: { start, end } }),
    setDark: (dark) => useApp.getState().set({ appearance: dark ? 'Scuro' : 'Chiaro' }),
    setNotifications: (on) => useApp.getState().set({ notif: { ...useApp.getState().notif, push: on } }),
    setPrivateProfile: (on) => useApp.getState().set({ privacy: { ...useApp.getState().privacy, 'Profilo privato': on } }),
    isPrivateProfile: () => !!useApp.getState().privacy['Profilo privato'],
    pickProfilePhoto: async () => {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (r.canceled || !r.assets[0]) return false;
      const a = useApp.getState().account;
      useApp.getState().set({ account: { ...a, photo: r.assets[0].uri } });
      return true;
    },
    financeReport, healthReport, moodReport,
    shareAgenda: (_p, range, mode) => (buildAgenda(range, mode) ? null : 'Non hai impegni in quel periodo.'),
    userName: () => useApp.getState().account.name,
  };
}
void dayKey;
