import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Input, Row, Seg, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { over } from '@/lib/a11y';
import { KIND_LABEL, PALETTE, DEFAULT_COLOR_OF_KIND, colorIdOf, colorOf, tintOf, vacationColor, type ColorKind, type ColorMode } from '@/lib/calendarColors';
import { addDays, agenda, bandsOnDay, daySummary, daysBetween, hourRange, isKey, layoutDay, monthGrid, parseKey, vacationBands, weekSegments, weekStart, ymd, type Band } from '@/lib/calendarLayout';
import { confirmDelete } from '@/lib/confirm';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useCalPrefs, type CalView } from '@/store/calprefs';
import { useLife } from '@/store/life';
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
    of: (ev: { title: string; important?: boolean; ref?: string; color?: string }) => colorOf(ev, mode),
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

const VIEW_LABEL: Record<CalView, string> = { month: 'Mese', week: 'Settimana', agenda: 'Agenda' };
const VIEWS: CalView[] = ['month', 'week', 'agenda'];

/* ---------- pannello: selettore vista + legenda ---------- */
export function CalendarPanel({ selectMode, onPickDay, onOpenBand }: { selectMode: boolean; onPickDay: (key: string) => void; onOpenBand: (id: string) => void }) {
  const th = useTheme();
  const view = useCalPrefs((s) => s.view);
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
          <Text style={{ color: th.text, fontWeight: '700', fontSize: 16, textAlign: 'center', textTransform: 'capitalize' }} numberOfLines={1}>{label}</Text>
        </Pressable>
        {view !== 'agenda' ? (
          <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText('Successivo')} style={{ padding: 6 }}><Icon name="arrow-right" size={18} color={th.text} /></Pressable>
        ) : <View style={{ width: 30 }} />}
      </Row>
      {view === 'month' && <MonthView offset={offset} selectMode={selectMode} onPickDay={onPickDay} onOpenBand={onOpenBand} />}
      {view === 'week' && <WeekView offset={offset} onPickDay={onPickDay} onOpenBand={onOpenBand} />}
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
  const kinds = Object.keys(DEFAULT_COLOR_OF_KIND) as ColorKind[];
  return (
    <View style={{ marginTop: 10 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={translateText('Legenda colori')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {kinds.map((k) => <View key={k} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colorOf({ title: '', color: DEFAULT_COLOR_OF_KIND[k] }, c.mode) }} />)}
        </View>
        <Text style={{ color: c.th.muted, fontSize: 12, fontWeight: '600', flex: 1 }}>Legenda colori</Text>
        <Icon name={open ? 'arrow-up' : 'arrow-down'} size={14} color={c.th.muted} />
      </Pressable>
      {open && (
        <View style={{ gap: 6, paddingVertical: 4 }}>
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
          <Text style={{ color: c.th.muted, fontSize: 11 }}>Puoi scegliere un colore diverso per ogni impegno aprendo il giorno.</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- vista mese ---------- */
function MonthView({ offset, selectMode, onPickDay, onOpenBand }: { offset: number; selectMode: boolean; onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const bands = useBands();
  const vacRange = useLife((s) => s.vacRange);
  const [w, setW] = useState(0);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  const rows = useMemo(() => monthGrid(y, m), [y, m]);
  const today = dayKey();
  const cellW = w / 7;
  const wide = cellW >= 44; // con celle larghe scrivo i titoli, altrimenti barrette colorate
  const labelH = 13;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((wd, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: th.muted, fontSize: 11 }}>{weekdayNarrow(wd)}</Text>)}
      </View>
      {w > 0 && rows.map((row, ri) => {
        const segs = weekSegments(bands, row);
        const lanes = segs.reduce((n, s) => Math.max(n, s.lane + 1), 0);
        const eventsH = wide ? 16 + 3 * labelH + 12 : 16 + 10 + 12;
        const rowH = eventsH + lanes * 13;
        return (
          <View key={ri} style={{ height: rowH, flexDirection: 'row', borderTopWidth: 1, borderTopColor: th.border }}>
            {row.map((k, ci) => {
              if (!k) return <View key={ci} style={{ width: cellW }} />;
              const isToday = k === today;
              const sum = daySummary(events[k], 3);
              const inSel = !!vacRange && k >= vacRange.start && k <= (vacRange.end ?? vacRange.start);
              const names = sum.shown.map((x) => x.e.title).join(', ');
              const a11y = sum.total ? tl('{0}: {1} impegni · {2}', fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' }), sum.total, names) : fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <Pressable key={ci} onPress={() => onPickDay(k)} accessibilityRole="button" accessibilityLabel={a11y} style={{ width: cellW, paddingHorizontal: 1, paddingTop: 2, backgroundColor: inSel ? c.tint(c.vac, 0.1) : 'transparent' }}>
                  <View style={{ alignSelf: 'center', minWidth: 20, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? th.accent : 'transparent', marginBottom: 1 }}>
                    <Text style={{ color: isToday ? th.onAccent : th.text, fontSize: 11, fontWeight: isToday ? '800' : '500' }}>{Number(k.slice(8))}</Text>
                  </View>
                  {wide ? (
                    <View style={{ gap: 1 }}>
                      {sum.shown.map(({ e, idx }) => {
                        const col = c.of(e);
                        return (
                          <View key={idx} style={{ height: labelH - 1, borderRadius: 3, borderLeftWidth: 2, borderLeftColor: col, backgroundColor: c.tint(col), justifyContent: 'center', paddingHorizontal: 2, overflow: 'hidden' }}>
                            <Text numberOfLines={1} style={{ color: th.text, fontSize: 9, lineHeight: 11 }}>{e.title}</Text>
                          </View>
                        );
                      })}
                      {sum.more > 0 && <Text style={{ color: th.muted, fontSize: 9, fontWeight: '700', textAlign: 'center' }}>+{sum.more}</Text>}
                    </View>
                  ) : (
                    <View style={{ gap: 2, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {sum.shown.map(({ e, idx }) => <View key={idx} style={{ width: Math.max(6, cellW - 14) / (sum.shown.length > 1 ? 1.6 : 1), maxWidth: 14, height: 5, borderRadius: 3, backgroundColor: c.of(e) }} />)}
                      </View>
                      {sum.more > 0 && <Text style={{ color: th.muted, fontSize: 9, fontWeight: '700' }}>+{sum.more}</Text>}
                    </View>
                  )}
                </Pressable>
              );
            })}
            {segs.map((s, si) => (
              <Pressable key={si} pointerEvents={selectMode ? 'none' : 'auto'} onPress={() => onOpenBand(s.band.id)} accessibilityRole="button" accessibilityLabel={tl('Vacanza: {0}', s.band.name)}
                style={{ position: 'absolute', left: s.col0 * cellW + (s.capL ? 2 : 0), width: (s.col1 - s.col0 + 1) * cellW - (s.capL ? 2 : 0) - (s.capR ? 2 : 0), bottom: 1 + s.lane * 13, height: 12, backgroundColor: c.tint(c.vac, 0.38), borderTopLeftRadius: s.capL ? 6 : 0, borderBottomLeftRadius: s.capL ? 6 : 0, borderTopRightRadius: s.capR ? 6 : 0, borderBottomRightRadius: s.capR ? 6 : 0, borderLeftWidth: s.capL ? 3 : 0, borderLeftColor: c.vac, justifyContent: 'center', paddingHorizontal: 3, overflow: 'hidden' }}>
                <Text numberOfLines={1} style={{ color: th.text, fontSize: 9, fontWeight: '700', lineHeight: 11 }}>{s.band.name}</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/* ---------- vista settimana ---------- */
const HOUR_H = 40;
const GUTTER = 32;
const COL_W = 78;

function WeekView({ offset, onPickDay, onOpenBand }: { offset: number; onPickDay: (k: string) => void; onOpenBand: (id: string) => void }) {
  const c = useCalColors();
  const th = c.th;
  const events = useLife((s) => s.events);
  const bands = useBands();
  const wh = useApp((s) => s.workHours);
  const [tick, setTick] = useState(0);
  const hRef = useRef<ScrollView>(null);
  const vRef = useRef<ScrollView>(null);
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(id); }, []);
  const today = dayKey();
  const start = addDays(weekStart(today), offset * 7);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const range = useMemo(() => hourRange(week, events, wh), [week, events, wh]);
  const hours = Array.from({ length: range.to - range.from }, (_, i) => range.from + i);
  const gridH = hours.length * HOUR_H;
  const segs = weekSegments(bands, week);
  const lanes = segs.reduce((n, s) => Math.max(n, s.lane + 1), 0);
  const layouts = week.map((k) => layoutDay(events[k]));
  const maxAllDay = layouts.reduce((n, l) => Math.max(n, l.allDay.length), 0);
  const allDayH = lanes * 15 + Math.min(maxAllDay, 3) * 15 + 4;
  const wsMin = (() => { const p = wh.start.split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); })();
  const weMin = (() => { const p = wh.end.split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); })();
  const work = over(th.accent + '18', th.card);
  const d0 = new Date();
  void tick;
  const nowMin = d0.getHours() * 60 + d0.getMinutes();
  const todayCol = week.indexOf(today);
  const totalW = GUTTER + 7 * COL_W;

  useEffect(() => {
    const tm = setTimeout(() => {
      try {
        hRef.current?.scrollTo({ x: Math.max(0, (todayCol < 0 ? 0 : todayCol - 1) * COL_W), animated: false });
        const focus = todayCol >= 0 ? Math.max(range.from * 60, nowMin - 90) : Math.max(range.from * 60, wsMin);
        vRef.current?.scrollTo({ y: Math.max(0, ((focus - range.from * 60) / 60) * HOUR_H), animated: false });
      } catch { /* niente */ }
    }, 60);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  return (
    <ScrollView ref={hRef} horizontal showsHorizontalScrollIndicator nestedScrollEnabled style={{ flexGrow: 0 }}>
      <View style={{ width: totalW }}>
        {/* intestazione giorni */}
        <View style={{ flexDirection: 'row', paddingLeft: GUTTER }}>
          {week.map((k, i) => {
            const isToday = k === today;
            return (
              <Pressable key={k} onPress={() => onPickDay(k)} accessibilityRole="button" accessibilityLabel={fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' })} style={{ width: COL_W, alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ color: th.muted, fontSize: 11 }}>{weekdayNarrow((i + 1) % 7)}</Text>
                <View style={{ minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? th.accent : 'transparent' }}>
                  <Text style={{ color: isToday ? th.onAccent : th.text, fontWeight: '700', fontSize: 13 }}>{Number(k.slice(8))}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {/* fasce vacanze e impegni senza orario */}
        <View style={{ height: allDayH, marginLeft: GUTTER, borderTopWidth: 1, borderBottomWidth: 1, borderColor: th.border }}>
          <View style={{ flexDirection: 'row', position: 'absolute', top: lanes * 15 + 2, left: 0 }}>
            {layouts.map((l, ci) => (
              <View key={ci} style={{ width: COL_W, paddingHorizontal: 2, gap: 1 }}>
                {l.allDay.slice(0, 3).map(({ e, idx }) => {
                  const col = c.of(e);
                  return (
                    <Pressable key={idx} onPress={() => onPickDay(week[ci])} style={{ height: 14, borderLeftWidth: 2, borderLeftColor: col, backgroundColor: c.tint(col), borderRadius: 3, justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text numberOfLines={1} style={{ color: th.text, fontSize: 9, lineHeight: 11 }}>{e.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          {segs.map((s, si) => (
            <Pressable key={si} onPress={() => onOpenBand(s.band.id)} accessibilityRole="button" accessibilityLabel={tl('Vacanza: {0}', s.band.name)}
              style={{ position: 'absolute', top: 2 + s.lane * 15, left: s.col0 * COL_W + (s.capL ? 2 : 0), width: (s.col1 - s.col0 + 1) * COL_W - (s.capL ? 2 : 0) - (s.capR ? 2 : 0), height: 14, backgroundColor: c.tint(c.vac, 0.38), borderTopLeftRadius: s.capL ? 7 : 0, borderBottomLeftRadius: s.capL ? 7 : 0, borderTopRightRadius: s.capR ? 7 : 0, borderBottomRightRadius: s.capR ? 7 : 0, borderLeftWidth: s.capL ? 3 : 0, borderLeftColor: c.vac, justifyContent: 'center', paddingHorizontal: 4, overflow: 'hidden' }}>
              <Text numberOfLines={1} style={{ color: th.text, fontSize: 10, fontWeight: '700', lineHeight: 12 }}>{s.band.name}</Text>
            </Pressable>
          ))}
        </View>
        {/* griglia oraria */}
        <ScrollView ref={vRef} nestedScrollEnabled style={{ maxHeight: 380 }} showsVerticalScrollIndicator>
          <View style={{ height: gridH, flexDirection: 'row' }}>
            <View style={{ width: GUTTER }}>
              {hours.map((h, i) => <Text key={h} style={{ position: 'absolute', top: i * HOUR_H - 6, right: 4, color: th.muted, fontSize: 10 }}>{String(h).padStart(2, '0')}</Text>)}
            </View>
            {week.map((k, ci) => {
              const weekday = ci < 5;
              const top = Math.max(0, ((wsMin - range.from * 60) / 60) * HOUR_H);
              const hgt = Math.max(0, ((weMin - wsMin) / 60) * HOUR_H);
              return (
                <Pressable key={k} onPress={() => onPickDay(k)} accessibilityLabel={fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' })} style={{ width: COL_W, height: gridH, borderLeftWidth: 1, borderLeftColor: th.border }}>
                  {weekday && hgt > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top, height: hgt, backgroundColor: work }} />}
                  {hours.map((h, i) => <View key={h} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: i * HOUR_H, height: 1, backgroundColor: th.border, opacity: 0.7 }} />)}
                  {layouts[ci].placed.map((p) => {
                    const col = c.of(p.e);
                    const tp = ((p.start - range.from * 60) / 60) * HOUR_H;
                    const hh = Math.max(18, ((p.end - p.start) / 60) * HOUR_H - 1);
                    const lw = (COL_W - 4) / p.lanes;
                    return (
                      <Pressable key={p.idx} onPress={() => onPickDay(k)} accessibilityRole="button" accessibilityLabel={`${p.e.time} ${p.e.title}`}
                        style={{ position: 'absolute', top: tp, height: hh, left: 2 + p.lane * lw, width: lw - 1, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: col, backgroundColor: c.tint(col, 0.3), paddingHorizontal: 3, paddingVertical: 1, overflow: 'hidden' }}>
                        <Text numberOfLines={hh > 34 ? 3 : 1} style={{ color: th.text, fontSize: 10, lineHeight: 12, fontWeight: '600' }}>{p.e.title}</Text>
                        {hh > 30 && <Text numberOfLines={1} style={{ color: th.muted, fontSize: 9 }}>{p.e.time}</Text>}
                      </Pressable>
                    );
                  })}
                  {ci === todayCol && nowMin >= range.from * 60 && nowMin <= range.to * 60 && (
                    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ((nowMin - range.from * 60) / 60) * HOUR_H, height: 2, backgroundColor: th.danger }}>
                      <View style={{ position: 'absolute', left: -3, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: th.danger }} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
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
              <Text style={{ color: d.day === today ? th.accent : th.muted, fontSize: 12, fontWeight: '800', textTransform: 'capitalize', marginBottom: 4 }}>{title}</Text>
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
              const col = c.of(e);
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
