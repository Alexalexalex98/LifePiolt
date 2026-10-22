import * as Haptics from 'expo-haptics';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { EditCtx } from '@/components/dash/editCtx';
import { WBY } from '@/components/dash/registry';
import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { COLS, fits, visibleRows, type Placed } from '@/lib/dash/grid';
import { Icon } from '@/lib/icons';
import { logError } from '@/lib/errorLog';
import { pageScroll, useScrollLock } from '@/lib/pageScroll';
import { useDash, type DashItem } from '@/store/dash';

export const GAP = 8;

type Ghost = { x: number; y: number; w: number; h: number; ok: boolean } | null;

/** La griglia: 4 colonne di quadratini, posizioni libere. In modifica compaiono i puntini e si trascina dalla maniglia. */
import { walletHeld } from '@/components/LifePay';
export function DashGrid({ edit, onEnterEdit, onSelect }: { edit: boolean; onEnterEdit: () => void; onSelect: (id: string) => void }) {
  const t = useTheme();
  const items = useDash((s) => s.items);
  const move = useDash((s) => s.move);
  const remove = useDash((s) => s.remove);
  const [W, setW] = useState(0);
  const [ghost, setGhost] = useState<Ghost>(null);
  const cell = W > 0 ? (W - (COLS - 1) * GAP) / COLS : 0;
  const step = cell + GAP;
  const rows = visibleRows(items, edit ? 6 : 1);
  const H = Math.max(0, rows * step - GAP);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const enter = useMemo(() => ({ enter: () => { if (!walletHeld()) onEnterEdit(); } }), [onEnterEdit]);

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {W > 0 ? (
        <View style={{ height: H }}>
          <View style={{ height: H }}>
            {edit ? Array.from({ length: rows * COLS }, (_, k) => (
              <View key={k} pointerEvents="none" style={{ position: 'absolute', left: (k % COLS) * step + cell / 2 - 2, top: Math.floor(k / COLS) * step + cell / 2 - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: t.muted, opacity: 0.55 }} />
            )) : null}
            <EditCtx.Provider value={enter}>
              {items.map((it) => (
                <Cell key={it.id} it={it} items={items} step={step} cell={cell} edit={edit} onGhost={setGhost} onDrop={(x, y) => { move(it.id, x, y); setGhost(null); }} onSelect={() => onSelect(it.id)} onRemove={() => remove(it.id)} />
              ))}
            </EditCtx.Provider>
            {ghost ? <View pointerEvents="none" style={{ position: 'absolute', zIndex: 5, left: ghost.x * step, top: ghost.y * step, width: ghost.w * cell + (ghost.w - 1) * GAP, height: ghost.h * cell + (ghost.h - 1) * GAP, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: ghost.ok ? t.positive : t.danger, backgroundColor: (ghost.ok ? t.positive : t.danger) + '1f' }} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Cell({ it, items, step, cell, edit, onGhost, onDrop, onSelect, onRemove }: { it: DashItem; items: Placed[]; step: number; cell: number; edit: boolean; onGhost: (g: Ghost) => void; onDrop: (x: number, y: number) => void; onSelect: () => void; onRemove: () => void }) {
  const t = useTheme();
  const def = WBY[it.type];
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [drag, setDrag] = useState(false);
  const winH = useWindowDimensions().height;
  const winHRef = useRef(winH);
  winHRef.current = winH;
  const live = useRef({ it, items, step });
  live.current = { it, items, step };
  const st = useRef({ sx: 0, sy: 0, dx: 0, dy: 0, moveY: 0, startScroll: 0, dragging: false, timer: null as ReturnType<typeof setTimeout> | null, auto: null as ReturnType<typeof setInterval> | null });
  const pw = it.w * cell + (it.w - 1) * GAP, ph = it.h * cell + (it.h - 1) * GAP;
  /** Il punto dove atterra: lo spostamento del dito più quanto è scorsa la pagina nel frattempo. */
  const target = (dx: number, dy: number) => {
    const { it: i, step: s } = live.current;
    const x = Math.max(0, Math.min(COLS - i.w, Math.round((i.x * s + dx) / s)));
    const y = Math.max(0, Math.round((i.y * s + dy) / s));
    return { x, y };
  };
  const clearTimers = () => { const d = st.current; if (d.timer) { clearTimeout(d.timer); d.timer = null; } if (d.auto) { clearInterval(d.auto); d.auto = null; } };
  const finish = () => { clearTimers(); st.current.dragging = false; useScrollLock.getState().set(false); };
  const refresh = () => {
    const d = st.current;
    const dy = d.dy + (pageScroll.y - d.startScroll);
    pos.setValue({ x: d.dx, y: dy });
    const { it: i, items: all } = live.current;
    const p = target(d.dx, dy);
    onGhost({ ...p, w: i.w, h: i.h, ok: fits(all, { ...p, w: i.w, h: i.h }, i.id) });
  };
  const begin = () => {
    const d = st.current;
    d.dragging = true; d.startScroll = pageScroll.y;
    useScrollLock.getState().set(true);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setDrag(true);
    // vicino al bordo dello schermo la pagina scorre da sola, così si può portare un widget lontano
    d.auto = setInterval(() => {
      const top = 170, bottom = winHRef.current - 120;
      let v = 0;
      if (d.moveY > bottom) v = Math.min(22, (d.moveY - bottom) / 3);
      else if (d.moveY < top) v = -Math.min(22, (top - d.moveY) / 3);
      if (v) { const y = Math.max(0, pageScroll.y + v); pageScroll.scrollTo(y); pageScroll.y = y; refresh(); }
    }, 16);
    refresh();
  };
  useEffect(() => finish, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* Tenendo premuto in un punto qualsiasi del widget (circa un quarto di secondo) lo si prende e si trascina. Prima di allora il dito può ancora far scorrere la pagina. */
  const responder = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => !st.current.dragging,
    onResponderGrant: (e: GestureResponderEvent) => { const d = st.current; d.sx = e.nativeEvent.pageX; d.sy = e.nativeEvent.pageY; d.dx = 0; d.dy = 0; d.moveY = e.nativeEvent.pageY; d.timer = setTimeout(begin, 260); },
    onResponderMove: (e: GestureResponderEvent) => {
      const d = st.current;
      const dx = e.nativeEvent.pageX - d.sx, dy = e.nativeEvent.pageY - d.sy;
      if (!d.dragging) { if (d.timer && Math.hypot(dx, dy) > 10) { clearTimeout(d.timer); d.timer = null; } return; }
      d.dx = dx; d.dy = dy; d.moveY = e.nativeEvent.pageY; refresh();
    },
    onResponderRelease: () => {
      const d = st.current;
      if (!d.dragging) { clearTimers(); return; }
      const p = target(d.dx, d.dy + (pageScroll.y - d.startScroll));
      finish(); pos.setValue({ x: 0, y: 0 }); setDrag(false); onDrop(p.x, p.y);
    },
    onResponderTerminate: () => { const was = st.current.dragging; finish(); if (was) { pos.setValue({ x: 0, y: 0 }); setDrag(false); onGhost(null); } },
  };
  if (!def) return null;
  const Comp = def.Comp;
  return (
    <Animated.View style={{ position: 'absolute', left: it.x * step, top: it.y * step, width: pw, height: ph, zIndex: drag ? 10 : 1, opacity: drag ? 0.92 : 1, transform: pos.getTranslateTransform() }}>
      <View pointerEvents={edit ? 'none' : 'auto'} style={{ width: pw, height: ph }}><WidgetBoundary type={it.type} pw={pw} ph={ph}><Comp w={it.w} h={it.h} pw={pw} ph={ph} cfg={it.cfg} /></WidgetBoundary></View>
      {edit ? (
        <>
          <View {...responder} accessibilityLabel={tl('Tieni premuto per spostare il widget')} accessible style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 2, borderColor: drag ? t.accent : t.accent + '99', backgroundColor: 'rgba(0,0,0,0.18)' }} />
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli il widget')} hitSlop={8} onPress={onRemove} style={{ position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={14} color="#fff" stroke={3} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Cambia la forma del widget')} hitSlop={6} onPress={onSelect} style={{ position: 'absolute', right: 4, bottom: 4, minWidth: 30, height: 30, paddingHorizontal: it.w * it.h >= 2 ? 8 : 0, borderRadius: 15, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
            <Icon name="grid" size={15} color={t.onAccent} stroke={2.2} />
            {it.w * it.h >= 2 ? <Text style={{ color: t.onAccent, fontSize: 11, fontWeight: '800' }}>{`${it.w}×${it.h}`}</Text> : null}
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );
}

/** Se un widget va in errore non cade tutta la pagina: al suo posto compare un riquadro che dice quale widget e cosa è successo. */
class WidgetBoundary extends Component<{ type: string; pw: number; ph: number; children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) }; }
  componentDidCatch(e: unknown) { logError(e, `dash.widget.${this.props.type}`); }
  render() {
    if (this.state.err === null) return this.props.children;
    return (
      <View style={{ width: this.props.pw, height: this.props.ph, borderRadius: 18, borderWidth: 1, borderColor: '#d23535', backgroundColor: '#3b1f24', padding: 10, overflow: 'hidden' }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{`${this.props.type}: problema`}</Text>
        <Text numberOfLines={5} style={{ color: '#ffd5d5', fontSize: 11, marginTop: 2 }}>{this.state.err}</Text>
      </View>
    );
  }
}
