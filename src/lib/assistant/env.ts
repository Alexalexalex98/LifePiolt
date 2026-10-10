import * as ImagePicker from 'expo-image-picker';

import { buildAgenda } from '@/lib/chatShare';
import { agendaAllows } from '@/lib/dataCatalog';
import { readChoices } from '@/store/sharing';
import { bestMatch } from './nlp';
import { useChat } from '@/store/chat';
import { dayKey } from '@/lib/format';
import { t } from '@/i18n/core';
import { useApp } from '@/store/app';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import type { Env } from './engine';
import { briefingFor } from './briefing';
import { financeReport, healthReport, moodReport } from './reports';

/** Collega il motore dell'assistente agli archivi reali dell'app. */
export function makeEnv(): Env {
  const life = () => useLife.getState();
  return {
    now: () => new Date(),
    events: () => life().events,
    addEvent: (day, ev) => { life().addEvent(day, { time: ev.time, title: ev.title, ...(ev.dur ? { dur: ev.dur } : {}), ...(ev.important ? { important: true } : {}), ...(ev.place ? { place: ev.place } : {}), ...(ev.ref ? { ref: ev.ref } : {}) }); },
    delEvent: (day, ev) => {
      const idx = (life().events[day] ?? []).findIndex((x) => x.time === ev.time && x.title === ev.title);
      if (idx >= 0) life().delEvent(day, idx);
    },
    tasks: () => life().tasks.map((t) => ({ id: t.id, t: t.t, done: !!t.done, urgent: t.urgent, due: t.due })),
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
    people: () => Object.values(useChat.getState().chats).filter((c) => !c.archived).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).map((c) => c.name),
    shareAgenda: (person, range, mode) => {
      // rispetta "Cosa condivido": il livello massimo scelto per l'agenda
      if (!agendaAllows(readChoices().plan_agenda, mode)) return t('Non l\'ho inviata: nelle impostazioni "Cosa condivido" la tua agenda non può essere condivisa in questa modalità. Puoi cambiarlo da Profilo > Cosa condivido.');
      const chat = useChat.getState();
      const target = bestMatch(person, Object.values(chat.chats), (c) => c.name, 0.4);
      const me = useApp.getState().account.name;
      const agenda = buildAgenda(range, mode);
      if (!agenda) return null;
      const id = target ? target.id : chat.ensureDm(person, me);
      chat.send(id, me, { kind: 'agenda', agenda });
      const how = mode === 'liberi' ? t('solo slot liberi, nessun titolo') : mode === 'occupato' ? t('solo occupato/libero, nessun titolo') : t('con i titoli');
      return t('Fatto: ho inviato la tua agenda a {0} ({1}).', target?.name ?? person, how);
    },
    setTaskDue: (id, day) => life().patchTask(id, { due: day }),
    addRecurring: (day, ev, until, kind) => {
      const ref = `rec:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const base = { time: ev.time, title: ev.title, ...(ev.dur ? { dur: ev.dur } : {}), ...(ev.place ? { place: ev.place } : {}), ref };
      if (kind === 'weekly') life().addEvent(day, base, until);
      else { const d = new Date(day + 'T00:00:00'); const end = new Date(until + 'T00:00:00'); while (d <= end) { life().addEvent(dayKey(d), { ...base }); d.setDate(d.getDate() + 1); } }
      return ref;
    },
    delByRef: (ref) => useLife.setState((st) => ({ events: Object.fromEntries(Object.entries(st.events).map(([d, l]) => [d, l.filter((e) => e.ref !== ref)])) })),
    briefing: () => briefingFor(new Date()),
    setTaskUrgent: (id, v) => life().patchTask(id, { urgent: v }),
    setEventImportant: (day, ev, v) => {
      const idx = (life().events[day] ?? []).findIndex((x) => x.time === ev.time && x.title === ev.title);
      if (idx >= 0) life().patchEvent(day, idx, { important: v });
    },
    userName: () => useApp.getState().account.name,
  };
}
void dayKey;
