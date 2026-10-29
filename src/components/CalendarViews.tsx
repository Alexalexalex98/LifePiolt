import type { ComponentRef } from 'react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from "react-native";
type ViewToken = { item: any; key: string; index?: number | null; isViewable: boolean; section?: any };;

import { Text } from '@/components/T';
import { Body, Btn, Input, Row, Seg, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { over } from '@/lib/a11y';
import { KIND_LABEL, PALETTE, kindOf, DEFAULT_COLOR_OF_KIND, URGENCY_COLOR, URGENCY_LABEL, URGENCY_ORDER, colorIdOf, colorOf, tintOf, urgencyOf, vacationColor, type ColorKind, type ColorMode } from '@/lib/calendarColors';
import { addDays, agenda, bandsOnDay, daysBetween, hourRange, isKey, layoutDay, monthGrid, parseKey, vacationBands, weekSegments, weekStart, ymd, type Band } from '@/lib/calendarLayout';
import { confirmDelete } from '@/lib/confirm';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useCalPrefs, type CalView } from '@/store/calprefs';
import { useLife } from '@/store/life';
import { useMemos } from '@/store/memos';
import { occursOn, timeStr } from '@/lib/memo';
import { toast } from '@/store/toast';
import { t as tl, translateText } from '@/i18n/core';
import { fmtDate, monthName, weekdayNarrow } from '@/i18n/format';

/* ---------- colori ---------- */
export function useCalColors() {
  const th = useTheme();
  const mode: ColorMode = th.mode === 'light' ? 'light' : 'dark';
  return useMemo(() => ({
    mode,
    th,
    /** colore dell'impegno; con il giorno, Theia lo sceglie in base all'urgenza */
    of: (ev: { title: string; important?: boolean; ref?: string; color?: string }, day?: string) => colorOf(ev, mode, day ? { today: dayKey(), day } : undefined),
    urgency: (ev: { title: string; important?: boolean; ref?: string; color?: string }, day: string) => urgencyOf(ev, { today: dayKey(), day }),
    vac: vacationColor(mode),
    tint: (hex: string, s = 0.22) => tintOf(hex, th.card, s),
  }), [mode, th]);
}

/** Fasce delle vacanze (con date) + intervallo selezionato nel Plan. */
export function useBands(): Band[] {
  const vacations = useLife((s) => s.vacations);
  const vacRange = useLife((s) => s.vacRange);
  return useMemo(() => vacationBands(vacations, vacRange), [vacations, vacRange]);
}

const cap = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
const VIEW_LABEL: Record<CalView, string> = { month: 'Mese', week: 'Settimana', agenda: 'Elenco' };
const VIEWS: CalView[] = ['month', 'week', 'agenda'];


/* ---------- scorrimento a pagine tra mesi o settimane ---------- */
/** Pagine affiancate (una per mese o settimana): si scorre con il dito e la pagina corrente resta in sincronia con `offset`. */
function OffsetPager({ offset, onOffset, span, render }: { offset: number; onOffset: (n: number) => void; span: number; render: (o: number) => ReactNode }) {
  const [w, setW] = useState(0);
  const ref = useRef<FlatList<number>>(null);
  const data = useMemo(() => Array.from({ length: span * 2 + 1 }, (_, i) => i - span), [span]);
  const cur = useRef(offset);
  useEffect(() => {
    if (!w || cur.current === offset) return;
    cur.current = offset;
    ref.current?.scrollToIndex({ index: Math.max(0, Math.min(data.length - 1, offset + span)), animated: true });
  }, [offset, w, span, data.length]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const v = viewableItems.find((x) => x.isViewable && x.index != null);
    if (v?.index != null) { const o = v.index - span; if (o !== cur.current) { cur.current = o; onOffset(o); } }
  }).current;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <FlatList
          ref={ref} data={data} keyExtractor={(o) => String(o)} horizontal pagingEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.max(0, Math.min(data.length - 1, offset + span))} getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          windowSize={3} initialNumToRender={1} maxToRenderPerBatch={2}
          onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => <View style={{ width: w }}>{render(item)}</View>}
        />
      )}
    </View>
  );
}
const MONTH_SPAN = 120, WEEK_SPAN = 520;

/* ---------- pannello: selettore vista + legenda ---------- */
export function CalendarPanel({ selectMode, onPickDay, onOpenBand }: { selectMode: boolean; onPickDay: (key: string) => void; onOpenBand: (id: string) => void }) {
  const th = useTheme();
  const storedView = useCalPrefs((s) => s.view);
  const view: CalView = VIEWS.includes(storedView) ? storedView : 'month';
  const setView = useCalPrefs((s) => s.setView);
  const [offset, setOffset] = useState(0); // mesi (vista mese) o settimane (vista settimana)
  const now = new Date();
  const label = view === 'month'
    ? fmtDate(new Date(now.getFullYear(), now.getMonth() + offset, 1), { month: 'long', year: 'numeric' })
    : view === 'week'
      ? (() => { const a = parseKey(addDays(weekStart(dayKey()), offset * 7)); const b = parseKey(addDays(weekStart(dayKey()), offset * 7 + 6)); return `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short' })}`; })()
      : tl('Prossimi 14 giorni');
  return (
    <View>
      <Seg options={VIEWS.map((v) => VIEW_LABEL[v])} value={VIEW_LABEL[view]} onChange={(l) => { setView(VIEWS.find((v) => VIEW_LABEL[v] === l) ?? 'month'); setOffset(0); }} />
      <Row style={{ marginBottom: 8 }}>
        {view !== 'agenda' ? (
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Precedente')} style={{ padding: 6 }}><Icon name="arrow-left" size={18} color={th.text} /></Pressable>
        ) : <View style={{ width: 30 }} />}
        <Pressable onPress={() => setOffset(0)} accessibilityRole="button" accessibilityLabel={translateText('Torna a oggi')} style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }} numberOfLines={1}>{cap(label)}</Text>
        </Pressable>
        {view !== 'agenda' ? (
          <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Successivo')} style={{ padding: 6 }}><Icon name="arrow-right" size={18} color={th.text} /></Pressable>
        ) : <View style={{ width: 30 }} />}
      </Row>
      {view === 'month' && <OffsetPager key="m" offset={offset} onOffset={setOffset} span={MONTH_SPAN} render={(o) => <MonthView offset={o} selectMode={selectMode} onPickDay={onPickDay} onOpenBand={onOpenBand} />} />}
      {view === 'week' && <OffsetPager key="w" offset={offset} onOffset={setOffset} span={WEEK_SPAN} render={(o) => <WeekView offset={o} onPickDay={onPickDay} onOpenBand={onOpenBand} />} />}
      {view === 'agenda' && <AgendaView onPickDay={onPickDay} onOpenBand={onOpenBand} />}
      <Legend />
    </View>
  );
}

/* ---------- legenda ---------- */
export function Legend() {
  const c = useCalColors();
  const open = useCalPrefs((s) => s.legendOpen);
  const setOpen = useCalPrefs((s) => s.setLegend);
  const kinds = (Object.keys(DEFAULT_COLOR_OF_KIND) as ColorKind[]).filter((k) => k !== 'important' && k !== 'normal');
  return (
    <View style={{ marginTop: 10 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={translateText('Legenda colori')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {URGENCY_ORDER.map((u) => <View key={u} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colorOf({ title: '', color: URGENCY_COLOR[u] }, c.mode) }} />)}
          {kinds.map((k) => <View key={k} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colorOf({ title: '', color: DEFAULT_COLOR_OF_KIND[k] }, c.mode) }} />)}
        </View>
        <Text style={{ color: c.th.muted, fontSize: 12, fontWeight: '600', flex: 1 }}>Legenda colori</Text>
        <Icon name={open ? 'arrow-up' : 'arrow-down'} size={14} color={c.th.muted} />
      </Pressable>
      {open && (
        <View style={{ gap: 6, paddingVertical: 4 }}>
          <Text style={{ color: c.th.muted, fontSize: 11 }}>Theia sceglie il colore in base all'urgenza:</Text>
          {URGENCY_ORDER.map((u) => (
            <View key={u} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 22, height: 10, borderRadius: 5, backgroundColor: c.tint(colorOf({ title: '', color: URGENCY_COLOR[u] }, c.mode), 0.3), borderLeftWidth: 3, borderLeftColor: colorOf({ title: '', color: URGENCY_COLOR[u] }, c.mode) }} />
              <Text style={{ color: c.th.text, fontSize: 12, flex: 1 }}>{URGENCY_LABEL[u]}</Text>
            </View>
          ))}
          {kinds.map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 22, height: 10, borderRadius: 5, backgroundColor: c.tint(colorOf({ title: '', color: DEFAULT_COLOR_OF_KIND[k] }, c.mode), 0.3), borderLeftWidth: 3, borderLeftColor: colorOf({ title: '', color: DEFAULT_COLOR_OF_KIND[k] }, c.mode) }} />
              <Text style={{ color: c.th.text, fontSize: 12, flex: 1 }}>{KIND_LABEL[k]}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 22, height: 10, borderRadius: 5, backgroundColor: c.tint(c.vac, 0.35) }} />
            <Text style={{ color: c.th.text, fontSize: 12, flex: 1 }}>Vacanze</Text>
          </View>
          <Text style={{ color: c.th.muted, fontSize: 11 }}>Puoi cambiare il colore di ogni impegno aprendo il giorno.</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- vista mese: nessun titolo nelle celle, solo colori (Theia li sceglie per urgenza) ---------- */
function MonthView({ offset, selectMode, onPickDay, onOpenBand, hideOpen, below, onSelect }: { offset: number; selectMode: boolean; onPickDay: (k: string) => void; onOpenBand: (id: string) => void; hideOpen?: boolean; below?: (sel: string) => ReactNode; onSelect?: (k: string) => void }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const tasks = useLife((s) => s.tasks);
  const bands = useBands();
  const vacRange = useLife((s) => s.vacRange);
  const [w, setW] = useState(0);
  const today = dayKey();
  const [sel, setSel] = useState<string>(today);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  const rows = useMemo(() => monthGrid(y, m), [y, m]);
  const cellW = w / 7;
  const CELL_H = 54;
  const rank = (k: string, e: { title: string; important?: boolean; ref?: string; color?: string }) => URGENCY_ORDER.indexOf(c.urgency(e, k));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((wd, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: th.muted, fontSize: 11 }}>{weekdayNarrow(wd)}</Text>)}
      </View>
      {w > 0 && rows.map((row, ri) => {
        const segs = weekSegments(bands, row);
        const lanes = segs.reduce((n, s2) => Math.max(n, s2.lane + 1), 0);
        const rowH = CELL_H + lanes * 13;
        return (
          <View key={ri} style={{ height: rowH, flexDirection: 'row' }}>
            {row.map((k, ci) => {
              if (!k) return <View key={ci} style={{ width: cellW }} />;
              const isToday = k === today;
              const isSel = k === sel;
              const list = (events[k] ?? []).map((e) => ({ e, r: rank(k, e) })).sort((a, b2) => a.r - b2.r);
              const top = list[0];
              const nTasks = tasks.filter((x) => !x.done && x.due === k).length;
              const inSel = !!vacRange && k >= vacRange.start && k <= (vacRange.end ?? vacRange.start);
              const tintBg = top ? c.tint(c.of(top.e, k), top.r === 0 ? 0.2 : top.r === 1 ? 0.14 : 0.08) : inSel ? c.tint(c.vac, 0.1) : 'transparent';
              const label = fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <Pressable key={ci} onPress={() => { setSel(k); onSelect?.(k); if (selectMode) onPickDay(k); }} accessibilityRole="button" accessibilityState={{ selected: isSel }} accessibilityLabel={list.length ? tl('{0}: {1} impegni', label, list.length) : label}
                  style={{ width: cellW - 3, height: CELL_H - 3, marginHorizontal: 1.5, marginTop: 1.5, borderRadius: 12, backgroundColor: tintBg, borderWidth: isSel ? 2 : 0, borderColor: th.text, alignItems: 'center', paddingTop: 4 }}>
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? th.accent : 'transparent' }}>
                    <Text style={{ color: isToday ? th.onAccent : th.text, fontSize: 13, fontWeight: isToday || top ? '800' : '500' }}>{Number(k.slice(8))}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, alignItems: 'center' }}>
                    {list.slice(0, nTasks ? 2 : 3).map(({ e }, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.of(e, k) }} />)}
                    {nTasks ? <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: th.accent }} /> : null}
                    {list.length > (nTasks ? 2 : 3) ? <Text style={{ color: th.muted, fontSize: 9, fontWeight: '700' }}>+</Text> : null}
                  </View>
                </Pressable>
              );
            })}
            {segs.map((s2, si) => (
              <Pressable key={si} pointerEvents={selectMode ? 'none' : 'auto'} onPress={() => onOpenBand(s2.band.id)} accessibilityRole="button" accessibilityLabel={tl('Vacanza: {0}', s2.band.name)}
                style={{ position: 'absolute', left: s2.col0 * cellW + (s2.capL ? 2 : 0), width: (s2.col1 - s2.col0 + 1) * cellW - (s2.capL ? 2 : 0) - (s2.capR ? 2 : 0), bottom: 0 + s2.lane * 13, height: 12, backgroundColor: c.tint(c.vac, 0.38), borderRadius: 6, justifyContent: 'center', paddingHorizontal: 5, overflow: 'hidden' }}>
                <Text numberOfLines={1} style={{ color: th.text, fontSize: 9, fontWeight: '700', lineHeight: 11 }}>{s2.band.name}</Text>
              </Pressable>
            ))}
          </View>
        );
      })}

      <DayDetail sel={sel} onPickDay={onPickDay} hideOpen={hideOpen} />
      {below ? below(sel) : null}
    </View>
  );
}

/** Il giorno scelto: qui i titoli, nelle celle solo i colori. Condiviso da vista mese, settimana e dal selettore dello spostamento. */
function DayDetail({ sel, onPickDay, hideOpen }: { sel: string; onPickDay: (k: string) => void; hideOpen?: boolean }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const dueTasks = useLife((s) => s.tasks).filter((x) => !x.done && x.due === sel);
  const dueMemos = useMemos((s) => s.memos).filter((m) => occursOn(m, sel));
  const bands = useBands();
  const selList = layoutDay(events[sel]);
  const selItems = [...selList.placed.map((p) => ({ e: p.e, idx: p.idx })), ...selList.allDay];
  const selBands = bandsOnDay(bands, sel);
  const onOpenBand = (_id: string) => onPickDay(sel);
  return (
    <>
      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: th.border }}>
        <Row style={{ marginBottom: 6 }}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{cap(fmtDate(parseKey(sel), { weekday: 'long', day: 'numeric', month: 'long' }))}</Text>
          {hideOpen ? null : <Pressable onPress={() => onPickDay(sel)} hitSlop={8} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: th.chip }}><Text style={{ color: th.text, fontSize: 13, fontWeight: '700' }}>Apri</Text></Pressable>}
        </Row>
        {selBands.map((b) => (
          <Pressable key={b.id} onPress={() => onOpenBand(b.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: c.tint(c.vac, 0.25), marginBottom: 6 }}>
            <Icon name="compass" size={14} color={th.text} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '700', fontSize: 13, flex: 1 }}>{b.name}</Text>
          </Pressable>
        ))}
        {selItems.length === 0 && selBands.length === 0 && dueTasks.length === 0 && dueMemos.length === 0 ? <Text style={{ color: th.muted, fontSize: 13, paddingVertical: 6 }}>Giornata libera.</Text> : selItems.map(({ e, idx }) => {
          const col = c.of(e, sel);
          const u = kindIsPlain(e) ? URGENCY_LABEL[c.urgency(e, sel)] : '';
          return (
            <Pressable key={idx} onPress={() => onPickDay(sel)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: c.tint(col, 0.16), marginBottom: 6 }}>
              <View style={{ width: 5, alignSelf: 'stretch', borderRadius: 3, backgroundColor: col }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: th.text, fontSize: 14, fontWeight: '700' }}>{e.title}</Text>
                <Text numberOfLines={1} style={{ color: th.muted, fontSize: 12 }}>{e.time || tl('Tutto il giorno')}{e.place ? ` · ${e.place}` : ''}</Text>
              </View>
              {u ? <Text style={{ color: col, fontSize: 11, fontWeight: '800' }}>{u}</Text> : null}
            </Pressable>
          );
        })}
        {dueMemos.length ? <Text style={{ color: th.muted, fontSize: 11, fontWeight: '800', marginTop: 8, marginBottom: 4 }}>{tl('PROMEMORIA')}</Text> : null}
        {dueMemos.map((m) => (
          <Pressable key={m.id} onPress={() => go('reminders')} accessibilityRole="button" accessibilityLabel={m.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: c.tint('#ffb84f', 0.16), marginBottom: 6 }}>
            <Icon name="bell" size={16} color="#ffb84f" />
            <Text numberOfLines={2} style={{ color: th.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{m.text}</Text>
            <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700' }}>{timeStr(new Date(m.at))}</Text>
          </Pressable>
        ))}
        {dueTasks.length ? <Text style={{ color: th.muted, fontSize: 11, fontWeight: '800', marginTop: 8, marginBottom: 4 }}>{tl('TASK DA FARE')}</Text> : null}
        {dueTasks.map((x) => (
          <Pressable key={x.id} onPress={() => go('lifetask')} accessibilityRole="button" accessibilityLabel={x.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: c.tint(th.accent, 0.14), marginBottom: 6 }}>
            <Icon name="check" size={16} color={th.accent} />
            <Text numberOfLines={2} style={{ color: th.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{x.t}</Text>
            {x.urgent ? <Text style={{ color: th.accent, fontSize: 11, fontWeight: '800' }}>{tl('Urgente')}</Text> : null}
          </Pressable>
        ))}
      </View>
    </>
  );
}
const kindIsPlain = (e: { title: string; important?: boolean; ref?: string; color?: string }) => !e.color && ['important', 'normal'].includes(kindOf(e));

/* ---------- vista settimana: come il mese, solo colore e ora; il giorno scelto si apre sotto ---------- */
function WeekView({ offset, onPickDay, onOpenBand }: { offset: number; onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const bands = useBands();
  const today = dayKey();
  const start = addDays(weekStart(today), offset * 7);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const [sel, setSel] = useState<string>(today);
  const cur = week.includes(sel) ? sel : week.includes(today) ? today : week[0];
  const segs = weekSegments(bands, week);
  const lanes = segs.reduce((n, s2) => Math.max(n, s2.lane + 1), 0);
  const MAXC = 6;
  const rank = (k: string, e: { title: string; important?: boolean; ref?: string; color?: string }) => URGENCY_ORDER.indexOf(c.urgency(e, k));
  return (
    <View>
      {lanes > 0 && (
        <View style={{ height: lanes * 15, marginBottom: 4 }}>
          {segs.map((s2, si) => (
            <Pressable key={si} onPress={() => onOpenBand(s2.band.id)} accessibilityRole="button" accessibilityLabel={tl('Vacanza: {0}', s2.band.name)}
              style={{ position: 'absolute', top: s2.lane * 15, left: `${(s2.col0 / 7) * 100}%`, width: `${((s2.col1 - s2.col0 + 1) / 7) * 100}%`, height: 14, backgroundColor: c.tint(c.vac, 0.38), borderRadius: 7, justifyContent: 'center', paddingHorizontal: 5, overflow: 'hidden' }}>
              <Text numberOfLines={1} style={{ color: th.text, fontSize: 10, fontWeight: '700', lineHeight: 12 }}>{s2.band.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {week.map((k, i) => {
          const list = (events[k] ?? []).slice().sort((a, b2) => (a.time || '').localeCompare(b2.time || ''));
          const top = list.slice().sort((a, b2) => rank(k, a) - rank(k, b2))[0];
          const isToday = k === today, isSel = k === cur;
          const label = fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <Pressable key={k} onPress={() => setSel(k)} accessibilityRole="button" accessibilityState={{ selected: isSel }} accessibilityLabel={list.length ? tl('{0}: {1} impegni', label, list.length) : label}
              style={{ flex: 1, minHeight: 150, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 2, alignItems: 'center', backgroundColor: top ? c.tint(c.of(top, k), 0.1) : 'transparent', borderWidth: isSel ? 2 : 1, borderColor: isSel ? th.text : th.border }}>
              <Text style={{ color: th.muted, fontSize: 10 }}>{weekdayNarrow((i + 1) % 7)}</Text>
              <View style={{ minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? th.accent : 'transparent', marginBottom: 4 }}>
                <Text style={{ color: isToday ? th.onAccent : th.text, fontWeight: '800', fontSize: 13 }}>{Number(k.slice(8))}</Text>
              </View>
              {list.slice(0, MAXC).map((e, j) => {
                const col = c.of(e, k);
                return (
                  <View key={j} style={{ alignSelf: 'stretch', marginHorizontal: 1, marginBottom: 2, borderRadius: 5, backgroundColor: c.tint(col, 0.4), borderLeftWidth: 3, borderLeftColor: col, paddingVertical: 2, alignItems: 'center' }}>
                    <Text style={{ color: th.text, fontSize: 9, fontWeight: '700' }}>{e.time || '·'}</Text>
                  </View>
                );
              })}
              {list.length > MAXC ? <Text style={{ color: th.muted, fontSize: 9, fontWeight: '700' }}>+{list.length - MAXC}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <DayDetail sel={cur} onPickDay={onPickDay} />
    </View>
  );
}

/** Calendario per scegliere un giorno guardando tutti gli impegni (usato quando si sposta un impegno). `below` mostra altro sotto il giorno scelto. */
export function PickCalendar({ onSelect, below }: { onSelect: (k: string) => void; below?: (sel: string) => ReactNode }) {
  const th = useTheme();
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const label = fmtDate(new Date(now.getFullYear(), now.getMonth() + offset, 1), { month: 'long', year: 'numeric' });
  return (
    <View>
      <Row style={{ marginBottom: 8 }}>
        <Pressable onPress={() => setOffset(offset - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Precedente')} style={{ padding: 6 }}><Icon name="arrow-left" size={18} color={th.text} /></Pressable>
        <Text style={{ color: th.text, fontWeight: '700', fontSize: 16, textAlign: 'center', flex: 1 }}>{cap(label)}</Text>
        <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Successivo')} style={{ padding: 6 }}><Icon name="arrow-right" size={18} color={th.text} /></Pressable>
      </Row>
      <MonthView offset={offset} selectMode={false} hideOpen onSelect={onSelect} onPickDay={onSelect} onOpenBand={() => {}} below={below} />
    </View>
  );
}

/* ---------- vista agenda ---------- */
function AgendaView({ onPickDay, onOpenBand }: { onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const bands = useBands();
  const today = dayKey();
  const days = useMemo(() => agenda(events, bands, today, 14), [events, bands, today]);
  if (!days.length) return <Text style={{ color: th.muted, textAlign: 'center', paddingVertical: 22, fontSize: 14 }}>Nessun impegno nei prossimi 14 giorni.</Text>;
  return (
    <View>
      {days.map((d) => {
        const dt = parseKey(d.day);
        const title = d.day === today ? `${translateText('Oggi')} · ${fmtDate(dt, { day: 'numeric', month: 'short' })}` : d.day === addDays(today, 1) ? `${translateText('Domani')} · ${fmtDate(dt, { day: 'numeric', month: 'short' })}` : fmtDate(dt, { weekday: 'short', day: 'numeric', month: 'short' });
        return (
          <View key={d.day} style={{ marginBottom: 10 }}>
            <Pressable onPress={() => onPickDay(d.day)} accessibilityRole="button" accessibilityLabel={title}>
              <Text style={{ color: d.day === today ? th.accent : th.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{cap(title)}</Text>
            </Pressable>
            {d.bands.map((b) => (
              <Pressable key={b.id} onPress={() => onOpenBand(b.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.tint(c.vac, 0.3), borderLeftWidth: 4, borderLeftColor: c.vac, marginBottom: 4 }}>
                <Icon name="compass" size={14} color={th.text} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{b.name}</Text>
                  <Text style={{ color: th.muted, fontSize: 11 }}>{fmtDate(parseKey(b.start), { day: 'numeric', month: 'short' })} – {fmtDate(parseKey(b.end), { day: 'numeric', month: 'short' })}</Text>
                </View>
              </Pressable>
            ))}
            {d.items.map(({ e, idx }) => {
              const col = c.of(e, d.day);
              return (
                <Pressable key={idx} onPress={() => onPickDay(d.day)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.tint(col, 0.16), borderLeftWidth: 4, borderLeftColor: col, marginBottom: 4 }}>
                  <Text style={{ color: th.text, fontWeight: '700', fontSize: 12, width: 44 }}>{e.time}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ color: th.text, fontSize: 13 }}>{e.title}</Text>
                    {e.place ? <Text numberOfLines={1} style={{ color: th.muted, fontSize: 11 }}>{e.place}</Text> : null}
                  </View>
                  {e.important ? <Icon name="star" size={13} color={th.text} fill={th.text} /> : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/* ---------- tavolozza colori ---------- */
export function ColorPicker({ ev, onChange }: { ev: { title: string; important?: boolean; ref?: string; color?: string }; onChange: (colorId: string | undefined) => void }) {
  const c = useCalColors();
  const current = colorIdOf(ev);
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center' }}>
      {PALETTE.map((p) => {
        const sel = ev.color === p.id;
        return (
          <Pressable key={p.id} onPress={() => onChange(p.id)} accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={translateText(p.name)} hitSlop={4}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p[c.mode], borderWidth: sel ? 3 : 1, borderColor: sel ? c.th.text : c.th.border, alignItems: 'center', justifyContent: 'center' }}>
            {current === p.id ? <Icon name="check" size={14} color={c.mode === 'light' ? '#ffffff' : '#07090d'} stroke={3} /> : null}
          </Pressable>
        );
      })}
      <Btn small ghost title="Automatico" onPress={() => onChange(undefined)} />
    </View>
  );
}

/* ---------- modifica / elimina una vacanza ---------- */
export function VacationSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const vacations = useLife((s) => s.vacations);
  const vacRange = useLife((s) => s.vacRange);
  const { patchVacation, delVacation, restoreVacation, setVacRange } = useLife();
  const isRange = id === 'range';
  const vac = vacations.find((v) => v.id === id);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  useEffect(() => {
    if (isRange && vacRange) { setName(vacRange.name ?? ''); setStart(vacRange.start); setEnd(vacRange.end ?? vacRange.start); }
    else if (vac) { setName(vac.dest); setStart(vac.start ?? ''); setEnd(vac.end ?? ''); }
  }, [id, isRange, vac?.id, vacRange?.start, vacRange?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = !!id && (isRange ? !!vacRange : !!vac);
  if (!open) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const dates = isKey(start) && isKey(end) && end >= start;
  const days = dates ? daysBetween(start, end, true) : 0;

  const save = () => {
    if (!dates) { toast('Usa il formato AAAA-MM-GG e una data di fine uguale o successiva all\'inizio'); return; }
    if (isRange) setVacRange({ start, end, ...(name.trim() ? { name: name.trim() } : {}) });
    else if (vac) patchVacation(vac.id, { dest: name.trim() || vac.dest, start, end, days });
    toast('Vacanza aggiornata');
    onClose();
  };
  const plan = () => {
    if (!dates) { toast('Imposta prima le date della vacanza'); return; }
    onClose();
    go('lifetravel', { start, end });
  };
  const remove = () => {
    if (isRange) {
      const prev = vacRange;
      confirmDelete(tl('la vacanza «{0}»', name.trim() || translateText('Vacanza')), () => { setVacRange(null); onClose(); }, () => setVacRange(prev), { undoMessage: 'Vacanza eliminata' });
    } else if (vac) {
      const idx = useLife.getState().vacations.findIndex((x) => x.id === vac.id);
      const copy = vac;
      confirmDelete(tl('la vacanza «{0}»', vac.dest), () => { delVacation(vac.id); onClose(); }, () => restoreVacation(copy, idx), { undoMessage: 'Vacanza eliminata' });
    }
  };
  return (
    <Sheet visible title={isRange ? 'Vacanza selezionata' : 'Modifica vacanza'} onClose={onClose}>
      <Input placeholder="Destinazione o nome (es. Lisbona)" value={name} onChangeText={setName} />
      <Row>
        <Input flex={1} placeholder="Inizio AAAA-MM-GG" value={start} onChangeText={setStart} autoCapitalize="none" />
        <Input flex={1} placeholder="Fine AAAA-MM-GG" value={end} onChangeText={setEnd} autoCapitalize="none" />
      </Row>
      <Body small muted>{dates ? tl('{0} giorni · dal {1} al {2}', days, fmtDate(parseKey(start), { day: 'numeric', month: 'long' }), fmtDate(parseKey(end), { day: 'numeric', month: 'long' })) : 'Inserisci le date nel formato AAAA-MM-GG.'}</Body>
      <Btn style={{ marginTop: 12 }} title="Salva" onPress={save} />
      <Btn style={{ marginTop: 8 }} ghost icon="compass" title="Pianifica il viaggio" onPress={plan} />
      <Btn style={{ marginTop: 8 }} ghost danger title="Elimina vacanza" onPress={remove} />
    </Sheet>
  );
}

export { monthName, ymd, bandsOnDay };

/* ---------- agenda a pagine: una pagina per giorno, con le ore ---------- */
const BOOK_H = 600;
const BOOK_HOUR = 56;
const BOOK_GUTTER = 44;
const BOOK_SPAN = 200; // giorni disponibili prima e dopo oggi
const minToLabel = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function DayPage({ k, width, onPickDay, onOpenBand }: { k: string; width: number; onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const bands = useBands();
  const wh = useApp((s) => s.workHours);
  const vRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const today = dayKey();
  const lay = useMemo(() => layoutDay(events[k]), [events, k]);
  const dayBands = bandsOnDay(bands, k);
  const total = (events[k] ?? []).length;
  const d0 = new Date();
  const nowMin = d0.getHours() * 60 + d0.getMinutes();
  const wsMin = (() => { const q = wh.start.split(':').map(Number); return (q[0] || 0) * 60 + (q[1] || 0); })();
  const weMin = (() => { const q = wh.end.split(':').map(Number); return (q[0] || 0) * 60 + (q[1] || 0); })();
  const isToday = k === today;
  const dt = parseKey(k);
  const first = lay.placed[0]?.start;
  useEffect(() => {
    const focus = isToday ? Math.max(0, nowMin - 90) : Math.max(0, Math.min(first ?? wsMin, wsMin) - 30);
    const tm = setTimeout(() => vRef.current?.scrollTo({ y: (focus / 60) * BOOK_HOUR, animated: false }), 50);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const work = over(th.accent + '14', th.card);
  const colW = width - BOOK_GUTTER - 20;
  return (
    <View style={{ width, paddingHorizontal: 2 }}>
      <View style={{ borderRadius: 18, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, height: BOOK_H, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: th.border }}>
          <Text style={{ color: isToday ? th.accent : th.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>{Number(k.slice(8))}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 16, fontWeight: '700' }}>{cap(fmtDate(dt, { weekday: 'long' }))}</Text>
            <Text style={{ color: th.muted, fontSize: 13 }}>{cap(fmtDate(dt, { month: 'long', year: 'numeric' }))}{total ? ` · ${total === 1 ? tl('1 impegno') : tl('{0} impegni', total)}` : ''}</Text>
          </View>
          <Pressable onPress={() => onPickDay(k)} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText('Apri il giorno')} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} color={th.text} /></Pressable>
        </View>
        {(dayBands.length > 0 || lay.allDay.length > 0) && (
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, gap: 4, borderBottomWidth: 1, borderBottomColor: th.border }}>
            {dayBands.map((b) => (
              <Pressable key={b.id} onPress={() => onOpenBand(b.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.tint(c.vac, 0.3), borderLeftWidth: 4, borderLeftColor: c.vac }}>
                <Icon name="compass" size={13} color={th.text} /><Text numberOfLines={1} style={{ color: th.text, fontSize: 12, fontWeight: '700', flex: 1 }}>{b.name}</Text>
              </Pressable>
            ))}
            {lay.allDay.map(({ e, idx }) => {
              const col = c.of(e, k);
              return (
                <Pressable key={idx} onPress={() => onPickDay(k)} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.tint(col, 0.2), borderLeftWidth: 4, borderLeftColor: col }}>
                  <Text numberOfLines={1} style={{ color: th.text, fontSize: 12 }}>{e.title}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <ScrollView ref={vRef} nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <Pressable onPress={() => onPickDay(k)} accessibilityLabel={translateText('Giornata')} style={{ height: 24 * BOOK_HOUR + 8, flexDirection: 'row' }}>
            <View style={{ width: BOOK_GUTTER }}>
              {Array.from({ length: 24 }, (_, h) => <Text key={h} style={{ position: 'absolute', top: h * BOOK_HOUR + 2, right: 6, color: th.muted, fontSize: 11 }}>{String(h).padStart(2, '0')}:00</Text>)}
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              {wsMin < weMin && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (wsMin / 60) * BOOK_HOUR, height: ((weMin - wsMin) / 60) * BOOK_HOUR, backgroundColor: work }} />}
              {Array.from({ length: 24 }, (_, h) => (
                <View key={h} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: h * BOOK_HOUR, height: 1, backgroundColor: th.border, opacity: 0.8 }}>
                  <View style={{ position: 'absolute', left: 0, right: 0, top: BOOK_HOUR / 2, height: 1, backgroundColor: th.border, opacity: 0.35 }} />
                </View>
              ))}
              {lay.placed.map((p) => {
                const col = c.of(p.e, k);
                const tp = (p.start / 60) * BOOK_HOUR;
                const hh = Math.max(26, ((p.end - p.start) / 60) * BOOK_HOUR - 2);
                const lw = colW / p.lanes;
                return (
                  <Pressable key={p.idx} onPress={() => onPickDay(k)} accessibilityRole="button" accessibilityLabel={`${p.e.time} ${p.e.title}`}
                    style={{ position: 'absolute', top: tp + 1, height: hh, left: p.lane * lw, width: lw - 3, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: col, backgroundColor: c.tint(col, 0.28), paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' }}>
                    <Text numberOfLines={hh > 50 ? 2 : 1} style={{ color: th.text, fontSize: 13, fontWeight: '700' }}>{p.e.title}</Text>
                    <Text numberOfLines={1} style={{ color: th.muted, fontSize: 11 }}>{minToLabel(p.start)} – {minToLabel(p.end)}{p.e.place ? ` · ${p.e.place}` : ''}</Text>
                  </Pressable>
                );
              })}
              {isToday && (
                <View pointerEvents="none" style={{ position: 'absolute', left: -4, right: 0, top: (nowMin / 60) * BOOK_HOUR, height: 2, backgroundColor: th.danger }}>
                  <View style={{ position: 'absolute', left: -2, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: th.danger }} />
                </View>
              )}
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

/** Agenda a pagine: si sfoglia con uno swipe (o con le frecce), una pagina per ogni giorno, con tutte le ore. */
export function DayBook({ onPickDay, onOpenBand }: { onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const [scale, setScale] = useState<'Giorno' | 'Settimana' | 'Mese'>('Giorno');
  return (
    <View>
      <Seg options={['Giorno', 'Settimana', 'Mese']} value={scale} onChange={(v) => setScale(v as typeof scale)} />
      {scale === 'Giorno' ? <DayPager onPickDay={onPickDay} onOpenBand={onOpenBand} /> : <PeriodPager kind={scale === 'Mese' ? 'month' : 'week'} onPickDay={onPickDay} onOpenBand={onOpenBand} />}
    </View>
  );
}

/** Agenda per mese o per settimana: si scorre con il dito o con le frecce. */
function PeriodPager({ kind, onPickDay, onOpenBand }: { kind: 'month' | 'week'; onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const th = useTheme();
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const label = kind === 'month'
    ? fmtDate(new Date(now.getFullYear(), now.getMonth() + offset, 1), { month: 'long', year: 'numeric' })
    : `${fmtDate(parseKey(addDays(weekStart(dayKey()), offset * 7)), { day: 'numeric', month: 'short' })} – ${fmtDate(parseKey(addDays(weekStart(dayKey()), offset * 7 + 6)), { day: 'numeric', month: 'short' })}`;
  return (
    <View style={{ marginBottom: 6 }}>
      <Row style={{ marginBottom: 8 }}>
        <Pressable onPress={() => setOffset(offset - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText(kind === 'month' ? 'Mese precedente' : 'Settimana precedente')} style={{ padding: 6 }}><Icon name="arrow-left" size={18} color={th.text} /></Pressable>
        <Pressable onPress={() => setOffset(0)} accessibilityRole="button" accessibilityLabel={translateText('Torna a oggi')} style={{ flex: 1 }}>
          <Text style={{ color: offset === 0 ? th.accent : th.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }} numberOfLines={1}>{cap(label)}</Text>
        </Pressable>
        <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText(kind === 'month' ? 'Mese successivo' : 'Settimana successiva')} style={{ padding: 6 }}><Icon name="arrow-right" size={18} color={th.text} /></Pressable>
      </Row>
      {kind === 'month'
        ? <OffsetPager key="m" offset={offset} onOffset={setOffset} span={MONTH_SPAN} render={(o) => <MonthView offset={o} selectMode={false} onPickDay={onPickDay} onOpenBand={onOpenBand} />} />
        : <OffsetPager key="w" offset={offset} onOffset={setOffset} span={WEEK_SPAN} render={(o) => <WeekView offset={o} onPickDay={onPickDay} onOpenBand={onOpenBand} />} />}
    </View>
  );
}

function DayPager({ onPickDay, onOpenBand }: { onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const th = useTheme();
  const today = dayKey();
  const days = useMemo(() => Array.from({ length: BOOK_SPAN * 2 + 1 }, (_, i) => addDays(today, i - BOOK_SPAN)), [today]);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(BOOK_SPAN);
  const ref = useRef<FlatList<string>>(null);
  const go2 = (i: number, animated = true) => {
    const n = Math.max(0, Math.min(days.length - 1, i));
    setIdx(n);
    ref.current?.scrollToIndex({ index: n, animated });
  };
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const v = viewableItems.find((x) => x.isViewable && x.index != null);
    if (v?.index != null) setIdx(v.index);
  }).current;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginBottom: 6 }}>
      <Row style={{ marginBottom: 8 }}>
        <Pressable onPress={() => go2(idx - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Giorno precedente')} style={{ padding: 6 }}><Icon name="arrow-left" size={18} color={th.text} /></Pressable>
        <Pressable onPress={() => go2(BOOK_SPAN)} accessibilityRole="button" accessibilityLabel={translateText('Torna a oggi')} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: idx === BOOK_SPAN ? th.accent : th.text, fontWeight: '700', fontSize: 15 }}>{idx === BOOK_SPAN ? translateText('Oggi') : translateText('Torna a oggi')}</Text>
        </Pressable>
        <Pressable onPress={() => go2(idx + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Giorno successivo')} style={{ padding: 6 }}><Icon name="arrow-right" size={18} color={th.text} /></Pressable>
      </Row>
      {w > 0 && (
        <FlatList
          ref={ref}
          data={days}
          keyExtractor={(k) => k}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={BOOK_SPAN}
          getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => <DayPage k={item} width={w} onPickDay={onPickDay} onOpenBand={onOpenBand} />}
        />
      )}
    </View>
  );
}
