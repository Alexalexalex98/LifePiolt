import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';

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
export function DashGrid({ edit, onEnterEdit, onSelect }: { edit: boolean; onEnterEdit: () => void; onSelect: (id: string) => void }) {
  const t = useTheme();
  const items = useDash((s) => s.items);
  const photos = useDash((s) => s.photos);
  const dim = useDash((s) => s.dim);
  const move = useDash((s) => s.move);
  const remove = useDash((s) => s.remove);
  const [W, setW] = useState(0);
  const [ghost, setGhost] = useState<Ghost>(null);
  const cell = W > 0 ? (W - (COLS - 1) * GAP) / COLS : 0;
  const step = cell + GAP;
  const rows = visibleRows(items, edit ? 6 : 1);
  const H = Math.max(0, rows * step - GAP);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const enter = useMemo(() => ({ enter: onEnterEdit }), [onEnterEdit]);

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {W > 0 ? (
        <View style={{ height: H + (photos.length ? 16 : 0), paddingVertical: photos.length ? 8 : 0 }}>
          {photos.length ? <Mosaic photos={photos} dim={dim} width={W} height={H + 16} cell={cell} /> : null}
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
  const drv = useRef({ startY: 0, dx: 0, dy: 0, moveY: 0, timer: null as ReturnType<typeof setInterval> | null });
  live.current = { it, items, step };
  const pw = it.w * cell + (it.w - 1) * GAP, ph = it.h * cell + (it.h - 1) * GAP;
  /** Il punto dove atterra: lo spostamento del dito più quanto è scorsa la pagina nel frattempo. */
  const target = (dx: number, dy: number) => {
    const { it: i, step: s } = live.current;
    const x = Math.max(0, Math.min(COLS - i.w, Math.round((i.x * s + dx) / s)));
    const y = Math.max(0, Math.round((i.y * s + dy) / s));
    return { x, y };
  };
  const stop = () => { if (drv.current.timer) { clearInterval(drv.current.timer); drv.current.timer = null; } useScrollLock.getState().set(false); };
  const refresh = () => {
    const d = drv.current;
    const dy = d.dy + (pageScroll.y - d.startY);
    pos.setValue({ x: d.dx, y: dy });
    const { it: i, items: all } = live.current;
    const p = target(d.dx, dy);
    onGhost({ ...p, w: i.w, h: i.h, ok: fits(all, { ...p, w: i.w, h: i.h }, i.id) });
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const d = drv.current;
      d.startY = pageScroll.y; d.dx = 0; d.dy = 0; d.moveY = e.nativeEvent.pageY;
      useScrollLock.getState().set(true);
      setDrag(true);
      // vicino al bordo dello schermo la pagina scorre da sola, così si può portare un widget lontano
      d.timer = setInterval(() => {
        const edge = 120;
        const y = d.moveY;
        const top = 150, bottom = winHRef.current - 110;
        let v = 0;
        if (y > bottom - edge + 40) v = Math.min(22, (y - (bottom - edge + 40)) / 3);
        else if (y < top + edge - 40) v = -Math.min(22, ((top + edge - 40) - y) / 3);
        if (v) { pageScroll.scrollTo(pageScroll.y + v); pageScroll.y = Math.max(0, pageScroll.y + v); refresh(); }
      }, 16);
    },
    onPanResponderMove: (_e, g) => { const d = drv.current; d.dx = g.dx; d.dy = g.dy; d.moveY = g.moveY; refresh(); },
    onPanResponderRelease: () => { const d = drv.current; const p = target(d.dx, d.dy + (pageScroll.y - d.startY)); stop(); pos.setValue({ x: 0, y: 0 }); setDrag(false); onDrop(p.x, p.y); },
    onPanResponderTerminate: () => { stop(); pos.setValue({ x: 0, y: 0 }); setDrag(false); onGhost(null); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  if (!def) return null;
  const Comp = def.Comp;
  return (
    <Animated.View style={{ position: 'absolute', left: it.x * step, top: it.y * step, width: pw, height: ph, zIndex: drag ? 10 : 1, opacity: drag ? 0.92 : 1, transform: pos.getTranslateTransform() }}>
      <View pointerEvents={edit ? 'none' : 'auto'} style={{ width: pw, height: ph }}><WidgetBoundary type={it.type} pw={pw} ph={ph}><Comp w={it.w} h={it.h} pw={pw} ph={ph} cfg={it.cfg} /></WidgetBoundary></View>
      {edit ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Opzioni del widget')} onPress={onSelect} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 2, borderColor: t.accent + '99', backgroundColor: 'rgba(0,0,0,0.18)' }} />
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli il widget')} hitSlop={8} onPress={onRemove} style={{ position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={14} color="#fff" stroke={3} />
          </Pressable>
          <View {...pan.panHandlers} accessibilityLabel={tl('Trascina il widget')} accessible style={{ position: 'absolute', right: 4, bottom: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="grid" size={16} color={t.onAccent} stroke={2.2} />
          </View>
          {it.w * it.h >= 2 ? <View pointerEvents="none" style={{ position: 'absolute', left: 8, bottom: 6 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{`${it.w}×${it.h}`}</Text></View> : null}
        </>
      ) : null}
    </Animated.View>
  );
}

/** Lo sfondo a mosaico: più foto messe una dopo l'altra lungo la pagina, ognuna adattata al suo riquadro, scurite per tenere leggibili i widget. */
function Mosaic({ photos, dim, width, height, cell }: { photos: string[]; dim: number; width: number; height: number; cell: number }) {
  const bh = Math.max(120, cell * 3 + GAP * 2);
  const n = Math.max(1, Math.ceil(height / bh));
  let k = 0;
  const next = () => photos[k++ % photos.length];
  const blocks = Array.from({ length: n }, (_, i) => {
    const pat = i % 4;
    if (pat === 0 || pat === 2) return [{ uri: next(), flex: 1 }];
    return pat === 1 ? [{ uri: next(), flex: 3 }, { uri: next(), flex: 2 }] : [{ uri: next(), flex: 2 }, { uri: next(), flex: 3 }];
  });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -4, right: -4, top: 0, bottom: 0, borderRadius: 22, overflow: 'hidden' }}>
      {blocks.map((b, i) => (
        <View key={i} style={{ height: bh, width: width + 8, flexDirection: 'row' }}>
          {b.map((p, j) => <Image key={j} source={{ uri: p.uri }} style={{ flex: p.flex, height: bh }} contentFit="cover" />)}
        </View>
      ))}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: `rgba(7,9,13,${dim})` }} />
    </View>
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
