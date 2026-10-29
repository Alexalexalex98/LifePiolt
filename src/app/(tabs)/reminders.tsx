import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { REPEAT_LABEL, dayStr, sortedMemos, timeStr, whenOf, type Memo, type Repeat } from '@/lib/memo';
import { ensureMemoPermission } from '@/lib/memoSync';
import { useMemos } from '@/store/memos';
import { toast } from '@/store/toast';

const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
const dayLabel = (d: Date, today: Date) => {
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  return diff === 0 ? tl('Oggi') : diff === 1 ? tl('Domani') : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
export const whenText = (ms: number, now = new Date()) => `${dayLabel(new Date(ms), now)} · ${timeStr(new Date(ms))}`;

type Draft = { id?: string; text: string; date: string; time: string; repeat: Repeat };

/** I promemoria: «ricordami di…» con data, ora e ripetizione. Suonano come notifica anche con l'app chiusa. */
export default function Reminders() {
  const t = useTheme();
  const memos = useMemos((s) => s.memos);
  const { add, update, setDone, remove, restore, clearDone } = useMemos.getState();
  const [draft, setDraft] = useState<Draft | null>(null);
  const now = Date.now();
  const { upcoming, overdue, done } = sortedMemos(memos, now);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  const newDraft = (): Draft => { const d = new Date(now + 3600000); d.setMinutes(0, 0, 0); return { text: '', date: dayStr(d), time: timeStr(d), repeat: 'none' }; };
  const edit = (m: Memo): Draft => ({ id: m.id, text: m.text, date: dayStr(new Date(m.at)), time: timeStr(new Date(m.at)), repeat: m.repeat });
  const submit = () => {
    if (!draft) return;
    if (!draft.text.trim()) { toast(tl('Scrivi cosa devo ricordarti')); return; }
    const at = whenOf(draft.date, draft.time);
    if (!Number.isFinite(at)) { toast(tl('Scrivi l\'ora così: 09:30')); return; }
    if (draft.repeat === 'none' && at <= Date.now()) { toast(tl('Quell\'ora è già passata: scegline una futura')); return; }
    if (draft.id) update(draft.id, { text: draft.text.trim(), at, repeat: draft.repeat }); else add({ text: draft.text, at, repeat: draft.repeat });
    ensureMemoPermission();
    setDraft(null);
    toast(tl('Promemoria salvato'));
  };
  const del = (m: Memo) => confirmDelete(tl('il promemoria «{0}»', m.text), () => { remove(m.id); }, () => restore(m));

  const row = (m: Memo, next?: number, last = false) => (
    <Item key={m.id} last={last}>
      <Row gap={10}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={tl('Fatto')} accessibilityState={{ checked: !!m.done }} onPress={() => setDone(m.id, !m.done)} hitSlop={8}
          style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: m.done ? t.positive : t.border, backgroundColor: m.done ? t.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {m.done ? <Icon name="check" size={14} color="#07090d" stroke={3} /> : null}
        </Pressable>
        <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={m.text} onPress={() => setDraft(edit(m))}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', textDecorationLine: m.done ? 'line-through' : 'none', opacity: m.done ? 0.5 : 1 }}>{m.text}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>{whenText(next ?? m.at)}{m.repeat !== 'none' ? ` · ${tl(REPEAT_LABEL[m.repeat])}` : ''}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Elimina')} hitSlop={8} onPress={() => del(m)}><Icon name="trash" size={18} color={t.muted} /></Pressable>
      </Row>
    </Item>
  );

  return (
    <Page id="reminders" back title={tl('Promemoria')} right={<Btn small icon="plus" title={tl('Nuovo')} onPress={() => setDraft(newDraft())} />}>
      <Body small muted style={{ marginBottom: 10 }}>{tl('Scrivi cosa ricordarti e quando: ti arriva una notifica all\'ora scelta, anche con l\'app chiusa. Puoi anche chiederlo a Theia: «ricordami di chiamare l\'idraulico domani alle 9».')}</Body>
      <Card accent="#ffb84f">
        <H>{tl('Prossimi')}</H>
        {upcoming.length ? upcoming.map((m, i) => row(m, m.next, i === upcoming.length - 1)) : <Empty text={tl('Nessun promemoria in arrivo. Tocca «Nuovo» per aggiungerne uno.')} />}
      </Card>
      {overdue.length ? (
        <Card>
          <H>{tl('Scaduti, non fatti')}</H>
          {overdue.map((m, i) => row(m, undefined, i === overdue.length - 1))}
        </Card>
      ) : null}
      {done.length ? (
        <Card>
          <Row><H style={{ flex: 1 }}>{tl('Fatti')}</H><Btn small ghost title={tl('Svuota')} onPress={() => clearDone()} /></Row>
          {done.slice(0, 20).map((m, i) => row(m, undefined, i === Math.min(done.length, 20) - 1))}
        </Card>
      ) : null}

      <Sheet visible={!!draft} title={draft?.id ? tl('Modifica promemoria') : tl('Nuovo promemoria')} onClose={() => setDraft(null)}>
        {draft ? (
          <View style={{ gap: 10 }}>
            <Input placeholder={tl('Es. Chiamare l\'idraulico')} value={draft.text} onChangeText={(v) => setDraft({ ...draft, text: v })} />
            <Body small bold muted>{tl('Quando')}</Body>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {days.map((d) => <Pill key={dayStr(d)} label={dayLabel(d, new Date())} on={draft.date === dayStr(d)} onPress={() => setDraft({ ...draft, date: dayStr(d) })} />)}
            </ScrollView>
            <Row gap={8} style={{ justifyContent: 'flex-start' }}>
              <Input style={{ width: 110, marginBottom: 0 }} keyboardType="numbers-and-punctuation" placeholder="09:30" value={draft.time} onChangeText={(v) => setDraft({ ...draft, time: v })} />
              {[['08:00', '08:00'], ['12:30', '12:30'], ['18:00', '18:00'], ['21:00', '21:00']].map(([k, v]) => <Pill key={k} label={v!} on={draft.time === v} onPress={() => setDraft({ ...draft, time: v! })} />)}
            </Row>
            <Body small bold muted>{tl('Ripeti')}</Body>
            <Row gap={6} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {REPEATS.map((r) => <Pill key={r} label={tl(REPEAT_LABEL[r])} on={draft.repeat === r} onPress={() => setDraft({ ...draft, repeat: r })} />)}
            </Row>
            <Btn title={tl('Salva')} onPress={submit} />
            {draft.id ? <Btn ghost title={tl('Elimina')} onPress={() => { const m = memos.find((x) => x.id === draft.id); setDraft(null); if (m) del(m); }} /> : null}
          </View>
        ) : <View />}
      </Sheet>
    </Page>
  );
}
