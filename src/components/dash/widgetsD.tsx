import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chrome } from '@/components/dash/Tile';
import type { WProps } from '@/components/dash/widgetsA';
import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { sortedMemos, timeStr } from '@/lib/memo';
import { taskIsDone, useLife } from '@/store/life';
import { useMemos } from '@/store/memos';

const PLAN = '#8fb3ff';
const GOAL = '#c9b6ff';

type Item = { key: string; title: string; sub?: string; right?: string; progress?: number; onPress?: () => void };

const dayText = (day: string, time?: string) => {
  const today = dayKey();
  const d = new Date(day + 'T00:00:00');
  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  const name = day === today ? tl('Oggi') : day === dayKey(tm) ? tl('Domani') : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return time ? `${name} · ${time}` : name;
};

/** Un widget che mostra una cosa alla volta (la prossima) e, con le frecce su e giù, scorre le altre. */
function Cycler({ p, icon, label, color, items, empty }: { p: WProps; icon: string; label: string; color: string; items: Item[]; empty: string }) {
  const t = useTheme();
  const [i, setI] = useState(0);
  const n = items.length;
  const idx = n ? ((i % n) + n) % n : 0;
  const cur = items[idx];
  const step = (d: number) => setI((idx + d + n) % n);
  const pad = 12;
  const rowsRoom = Math.max(0, Math.floor((p.ph - pad * 2 - 96) / 24));
  const rest = p.h >= 2 ? Array.from({ length: Math.min(rowsRoom, n - 1) }, (_, k) => items[(idx + 1 + k) % n]!) : [];
  const Arrow = ({ dir }: { dir: 1 | -1 }) => (
    <Pressable onPress={() => step(dir)} hitSlop={6} accessibilityRole="button" accessibilityLabel={dir > 0 ? tl('Il prossimo') : tl('Il precedente')} disabled={n < 2}
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center', opacity: n < 2 ? 0.35 : 1 }}>
      <Icon name={dir > 0 ? 'arrow-down' : 'arrow-up'} size={16} color={color} stroke={2.4} />
    </Pressable>
  );
  return (
    <Chrome pw={p.pw} ph={p.ph} color={color} pad={pad} label={label} onPress={cur?.onPress}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={icon} size={16} color={color} stroke={2} />
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, fontWeight: '700', flex: 1 }}>{label}</Text>
            {n > 1 ? <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700' }}>{idx + 1}/{n}</Text> : null}
          </View>
          {cur ? (
            <View style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text numberOfLines={p.h >= 2 ? 3 : 1} style={{ color: t.text, fontSize: p.h >= 2 ? 18 : 15, fontWeight: '800', flex: 1 }}>{cur.title}</Text>
                {cur.right ? <Text style={{ color, fontSize: p.h >= 2 ? 22 : 17, fontWeight: '800' }}>{cur.right}</Text> : null}
              </View>
              {cur.sub ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{cur.sub}</Text> : null}
              {cur.progress != null ? <View style={{ height: 6, borderRadius: 3, backgroundColor: color + '33', overflow: 'hidden', marginTop: 2 }}><View style={{ width: `${Math.round(Math.max(0, Math.min(1, cur.progress)) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: color }} /></View> : null}
            </View>
          ) : <Text style={{ color: t.muted, fontSize: 13 }}>{empty}</Text>}
          {rest.map((r) => (
            <Pressable key={r.key} disabled={!r.onPress} onPress={r.onPress} accessibilityRole="button" accessibilityLabel={r.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, flex: 1 }}>{r.title}</Text>
              {r.right || r.sub ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>{r.right ?? r.sub}</Text> : null}
            </Pressable>
          ))}
        </View>
        {n > 1 ? <View style={{ justifyContent: 'center', gap: 8 }}><Arrow dir={-1} /><Arrow dir={1} /></View> : null}
      </View>
    </Chrome>
  );
}

/** Il prossimo task da fare: solo quelli non fatti, urgenti e con scadenza vicina per primi. */
export function NextTaskW(p: WProps) {
  const tasks = useLife((s) => s.tasks);
  const items: Item[] = tasks.map((x, i) => ({ x, i })).filter(({ x }) => !taskIsDone(x))
    .sort((a, b) => (a.x.urgent ? 0 : 1) - (b.x.urgent ? 0 : 1) || (a.x.due ?? '9999').localeCompare(b.x.due ?? '9999') || a.i - b.i)
    .map(({ x }) => ({ key: x.id, title: x.t, sub: [x.urgent ? tl('Urgente') : '', x.due ? dayText(x.due) : ''].filter(Boolean).join(' · ') || undefined, right: x.due && x.due < dayKey() ? tl('in ritardo') : undefined, onPress: () => go('lifetask') }));
  return <Cycler p={p} icon="tasks" label={tl('Prossimo task')} color={PLAN} items={items} empty={tl('Nessun task da fare')} />;
}

/** Gli obiettivi con la percentuale di ognuno; le frecce passano al successivo. */
export function GoalsW(p: WProps) {
  const goals = useLife((s) => s.goals);
  const items: Item[] = goals.map((g) => ({ key: g.id, title: g.t, right: `${g.p}%`, progress: g.p / 100, onPress: () => go('plan') }));
  return <Cycler p={p} icon="award" label={tl('Obiettivi')} color={GOAL} items={items} empty={tl('Nessun obiettivo: aggiungilo dal Plan o chiedilo a Theia')} />;
}

/** Il prossimo impegno in agenda (da adesso in avanti). */
export function NextEventW(p: WProps) {
  const events = useLife((s) => s.events);
  const now = new Date(); const hhmm = now.toTimeString().slice(0, 5); const today = dayKey(now);
  const list: { day: string; i: number; e: { time: string; title: string } }[] = [];
  for (let k = 0; k < 30; k++) {
    const key = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k));
    (events[key] ?? []).forEach((e, i) => { if (key !== today || !e.time || e.time >= hhmm) list.push({ day: key, i, e }); });
  }
  list.sort((a, b) => (a.day + a.e.time).localeCompare(b.day + b.e.time));
  const items: Item[] = list.slice(0, 30).map((x) => ({ key: `${x.day}-${x.i}`, title: x.e.title, sub: dayText(x.day, x.e.time), right: x.day === today ? x.e.time : undefined, onPress: () => go('plan', { day: x.day, idx: String(x.i), at: String(Date.now()) }) }));
  return <Cycler p={p} icon="calendar" label={tl('Prossimo impegno')} color={PLAN} items={items} empty={tl('Nessun impegno in arrivo')} />;
}

/** Il Piano da adesso: impegni e task con scadenza insieme, in ordine di tempo. */
export function NextPlanW(p: WProps) {
  const events = useLife((s) => s.events);
  const tasks = useLife((s) => s.tasks);
  const now = new Date(); const hhmm = now.toTimeString().slice(0, 5); const today = dayKey(now);
  const all: { sort: string; item: Item }[] = [];
  for (let k = 0; k < 14; k++) {
    const key = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k));
    (events[key] ?? []).forEach((e, i) => { if (key !== today || !e.time || e.time >= hhmm) all.push({ sort: `${key} ${e.time || '00:00'}`, item: { key: `e${key}${i}`, title: e.title, sub: dayText(key, e.time), onPress: () => go('plan', { day: key, idx: String(i), at: String(Date.now()) }) } }); });
  }
  tasks.filter((x) => !taskIsDone(x) && x.due && x.due >= today && x.due <= dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 13)))
    .forEach((x) => all.push({ sort: `${x.due} 23:59`, item: { key: `t${x.id}`, title: x.t, sub: `${tl('Task')} · ${dayText(x.due!)}`, onPress: () => go('lifetask') } }));
  all.sort((a, b) => a.sort.localeCompare(b.sort));
  return <Cycler p={p} icon="calendar" label={tl('Il tuo Piano')} color={PLAN} items={all.map((x) => x.item)} empty={tl('Niente in programma nei prossimi giorni')} />;
}

/** I prossimi promemoria, uno alla volta (frecce per scorrere). */
export function NextMemoW(p: WProps) {
  const memos = useMemos((s) => s.memos);
  const now = Date.now();
  const items: Item[] = sortedMemos(memos, now).upcoming.slice(0, 30).map((m) => ({ key: m.id, title: m.text, sub: dayText(dayKey(new Date(m.next)), timeStr(new Date(m.next))), right: dayKey(new Date(m.next)) === dayKey() ? timeStr(new Date(m.next)) : undefined, onPress: () => go('reminders') }));
  return <Cycler p={p} icon="bell" label={tl('Promemoria')} color="#ffb84f" items={items} empty={tl('Nessun promemoria: aggiungilo o chiedilo a Theia')} />;
}
