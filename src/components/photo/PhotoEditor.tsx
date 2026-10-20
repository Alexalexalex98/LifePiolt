import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/T';
import { EditSlider } from '@/components/photo/EditSlider';
import { useTheme } from '@/hooks/use-theme';
import { translateText as tr } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { prepareBase, renderEdited, type Base } from '@/lib/photoExport';
import { AUTO, COLOR_BANDS, DEFAULTS, GEO0, GROUPS, LOOKS, RATIO_LIST, cleanParams, geoEdited, isEdited, type Geo, type ParamKey, type PhotoParams } from '@/lib/photoShader';

type Canvas = ComponentType<{ uri: string; params: PhotoParams; geo: Geo; boxW: number; boxH: number; seed?: number }>;
type Snap = { p: PhotoParams; g: Geo };
type Tab = 'look' | 'luce' | 'colore' | 'colori' | 'dettagli' | 'effetti' | 'ritaglia';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'look', label: 'Look', icon: 'sparkle' }, { id: 'luce', label: 'Luce', icon: 'sun' }, { id: 'colore', label: 'Colore', icon: 'drop' }, { id: 'colori', label: 'Colori', icon: 'palette' },
  { id: 'dettagli', label: 'Dettagli', icon: 'detail' }, { id: 'effetti', label: 'Effetti', icon: 'vignette' }, { id: 'ritaglia', label: 'Ritaglia', icon: 'crop' },
];

/**
 * Editor foto: look pronti, luce, colore, colori singoli, dettagli, effetti e ritaglio. Il risultato si vede subito e il file finale
 * viene calcolato con lo stesso motore. Tieni premuta la foto per vedere l'originale; annulla e ripeti sempre disponibili.
 */
export function PhotoEditor({ uri, Canvas, onDone, onCancel }: { uri: string; Canvas: Canvas; onDone: (uri: string | null) => void; onCancel: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [base, setBase] = useState<Base | null>(null);
  const [err, setErr] = useState(false);
  const [params, setParams] = useState<PhotoParams>(DEFAULTS);
  const [geo, setGeo] = useState<Geo>(GEO0);
  const [tab, setTab] = useState<Tab>('look');
  const [orig, setOrig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ w: W - 24, h: 360 });
  const hist = useRef<Snap[]>([{ p: DEFAULTS, g: GEO0 }]);
  const idx = useRef(0);
  const [, force] = useState(0);
  const cur = useRef<Snap>({ p: DEFAULTS, g: GEO0 }); cur.current = { p: params, g: geo };

  useEffect(() => { let off = false; prepareBase(uri).then((b) => { if (!off) setBase(b); }).catch(() => { if (!off) setErr(true); }); return () => { off = true; }; }, [uri]);

  const commit = useCallback(() => {
    const s = cur.current;
    const last = hist.current[idx.current];
    if (JSON.stringify(last) === JSON.stringify(s)) return;
    hist.current = [...hist.current.slice(0, idx.current + 1), s].slice(-60); idx.current = hist.current.length - 1; force((n) => n + 1);
  }, []);
  const set = (k: ParamKey, v: number) => setParams((p) => ({ ...p, [k]: v }));
  const apply = (s: Snap) => { setParams(s.p); setGeo(s.g); };
  const undo = () => { if (idx.current > 0) { idx.current -= 1; apply(hist.current[idx.current]); force((n) => n + 1); } };
  const redo = () => { if (idx.current < hist.current.length - 1) { idx.current += 1; apply(hist.current[idx.current]); force((n) => n + 1); } };
  const jump = (p: PhotoParams, g: Geo = geo) => { setParams(p); setGeo(g); setTimeout(commit, 0); };
  const edited = isEdited(params) || geoEdited(geo);

  const cancel = () => {
    if (!edited) { onCancel(); return; }
    Alert.alert(tr('Scartare le modifiche?'), tr('La foto torna come l’avevi scelta.'), [{ text: tr('Continua a modificare'), style: 'cancel' }, { text: tr('Scarta'), style: 'destructive', onPress: onCancel }]);
  };
  const done = async () => {
    if (!base) return;
    if (!edited) { onDone(null); return; }
    setBusy(true);
    const out = await renderEdited(base, params, geo);
    setBusy(false);
    if (!out) { Alert.alert(tr('Non sono riuscita a salvare la foto'), tr('Riprova: se capita ancora, la foto resta com’era.')); return; }
    onDone(out);
  };

  const canUndo = idx.current > 0, canRedo = idx.current < hist.current.length - 1;
  const IconBtn = ({ icon, on, press, label }: { icon: string; on: boolean; press: () => void; label: string }) => (
    <Pressable onPress={press} disabled={!on} accessibilityRole="button" accessibilityLabel={tr(label)} hitSlop={8} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', opacity: on ? 1 : 0.35 }}><Icon name={icon} size={20} color="#fff" stroke={2} /></Pressable>
  );

  const sliders = (keys: { key: ParamKey; label: string; hint?: string; min: number; max: number; dot?: string }[]) => keys.map((c) => (
    <EditSlider key={c.key} label={c.label} hint={c.hint} dot={c.dot} min={c.min} max={c.max} zero={DEFAULTS[c.key]} value={params[c.key]} onChange={(v) => set(c.key, v)} onCommit={commit} />
  ));
  const group = (id: 'luce' | 'colore' | 'dettagli' | 'effetti') => GROUPS.find((g) => g.id === id)!.controls;

  const panel = () => {
    if (!base) return null;
    if (tab === 'look') {
      const tiles: { id: string; label: string; p: PhotoParams; auto?: boolean }[] = [{ id: 'auto', label: 'Migliora', p: cleanParams(AUTO), auto: true }, ...LOOKS.map((l) => ({ id: l.id, label: l.label, p: cleanParams(l.p) }))];
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingVertical: 8 }}>
          {tiles.map((x) => {
            const on = JSON.stringify(x.p) === JSON.stringify(params);
            return (
              <Pressable key={x.id} onPress={() => jump(x.p)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={tr(x.label)} style={{ width: 78, alignItems: 'center', gap: 5 }}>
                <View style={{ width: 74, height: 74, borderRadius: 14, overflow: 'hidden', borderWidth: on ? 2.5 : 0, borderColor: t.accent, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
                  <Canvas uri={base.uri} params={x.p} geo={{ ...GEO0, ratio: '1:1' }} boxW={74} boxH={74} />
                </View>
                <Text numberOfLines={1} style={{ color: on ? t.accent : '#e6e8ee', fontSize: 12, fontWeight: on ? '800' : '600' }}>{tr(x.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      );
    }
    if (tab === 'ritaglia') {
      return (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
            {RATIO_LIST.map((r) => <Chip key={r.id} on={geo.ratio === r.id} label={r.label} press={() => jump(params, { ...geo, ratio: r.id, panX: 0, panY: 0 })} />)}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
            <Chip icon="rotate" label="Ruota" on={false} press={() => jump(params, { ...geo, rot90: (((geo.rot90 + 1) % 4) as 0 | 1 | 2 | 3), panX: 0, panY: 0 })} />
            <Chip icon="flip" label="Specchia" on={geo.flip} press={() => jump(params, { ...geo, flip: !geo.flip })} />
            <Chip label="Azzera" on={false} press={() => jump(params, GEO0)} />
          </View>
          <EditSlider label="Raddrizza" hint="Inclina la foto per sistemare l’orizzonte" min={-45} max={45} zero={0} value={geo.angle} onChange={(v) => setGeo((g) => ({ ...g, angle: v }))} onCommit={commit} />
          <EditSlider label="Zoom" hint="Avvicina l’inquadratura" min={100} max={400} zero={100} value={Math.round(geo.zoom * 100)} onChange={(v) => setGeo((g) => ({ ...g, zoom: v / 100 }))} onCommit={commit} />
          <EditSlider label="Sposta in orizzontale" min={-100} max={100} zero={0} value={Math.round(geo.panX * 100)} onChange={(v) => setGeo((g) => ({ ...g, panX: v / 100 }))} onCommit={commit} />
          <EditSlider label="Sposta in verticale" min={-100} max={100} zero={0} value={Math.round(geo.panY * 100)} onChange={(v) => setGeo((g) => ({ ...g, panY: v / 100 }))} onCommit={commit} />
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
        {tab === 'luce' && sliders(group('luce'))}
        {tab === 'colore' && sliders(group('colore'))}
        {tab === 'colori' && <>
          <Text style={{ color: '#9aa3b5', fontSize: 12, marginBottom: 2 }}>{tr('Intensità di ogni colore: per esempio più verdi nell’erba o meno rossi sulla pelle.')}</Text>
          {sliders(COLOR_BANDS.map((b) => ({ key: b.key, label: b.label, min: -100, max: 100, dot: b.dot })))}
        </>}
        {tab === 'dettagli' && sliders(group('dettagli'))}
        {tab === 'effetti' && <>
          {sliders(group('effetti'))}
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 10 }}>{tr('Tono delle ombre')}</Text>
          {sliders([{ key: 'shHue', label: 'Colore', min: 0, max: 360 }, { key: 'shAmt', label: 'Quantità', min: 0, max: 100 }])}
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 10 }}>{tr('Tono delle luci')}</Text>
          {sliders([{ key: 'hiHue', label: 'Colore', min: 0, max: 360 }, { key: 'hiAmt', label: 'Quantità', min: 0, max: 100 }])}
        </>}
        {(tab === 'luce' || tab === 'colore' || tab === 'dettagli' || tab === 'effetti') ? <Pressable onPress={() => jump(DEFAULTS)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 10 }}><Text style={{ color: '#9aa3b5', fontWeight: '700' }}>{tr('Azzera tutti i ritocchi')}</Text></Pressable> : null}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0c10' }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="x" on press={cancel} label="Annulla" />
        <View style={{ flex: 1 }} />
        <IconBtn icon="undo" on={canUndo} press={undo} label="Annulla ultima modifica" />
        <IconBtn icon="redo" on={canRedo} press={redo} label="Ripeti" />
        <Pressable onPress={() => void done()} disabled={busy || !base} accessibilityRole="button" accessibilityLabel={tr('Fatto')} style={{ height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !base ? 0.5 : 1 }}>
          <Text style={{ color: t.onText, fontWeight: '900', fontSize: 15 }}>{tr('Fatto')}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width - 16, h: e.nativeEvent.layout.height - 8 })}>
        {err ? <Text style={{ color: '#fff' }}>{tr('Non riesco ad aprire questa foto.')}</Text> : !base ? <ActivityIndicator color="#fff" /> : (
          <Pressable onPressIn={() => setOrig(true)} onPressOut={() => setOrig(false)} accessibilityLabel={tr('Tieni premuto per vedere la foto originale')}>
            <Canvas uri={base.uri} params={orig ? DEFAULTS : params} geo={orig ? GEO0 : geo} boxW={box.w} boxH={box.h} />
            {orig ? <View style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{tr('ORIGINALE')}</Text></View> : null}
          </Pressable>
        )}
      </View>
      {!orig && edited ? <Text style={{ color: '#6b7488', fontSize: 11.5, textAlign: 'center', marginBottom: 4 }}>{tr('Tieni premuta la foto per vedere l’originale')}</Text> : null}

      <View style={{ height: tab === 'look' ? 142 : 268, backgroundColor: '#12141b', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 6 }}>
        {panel()}
      </View>
      <View style={{ backgroundColor: '#12141b', paddingBottom: insets.bottom + 6, paddingTop: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}>
          {TABS.map((x) => {
            const on = tab === x.id;
            return (
              <Pressable key={x.id} onPress={() => setTab(x.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tr(x.label)} style={{ minWidth: 70, alignItems: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 14, backgroundColor: on ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
                <Icon name={x.icon} size={21} color={on ? t.accent : '#9aa3b5'} stroke={2} />
                <Text style={{ color: on ? '#fff' : '#9aa3b5', fontSize: 11.5, fontWeight: on ? '800' : '600' }}>{tr(x.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {busy ? <View pointerEvents="auto" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator color="#fff" size="large" /><Text style={{ color: '#fff', fontWeight: '700' }}>{tr('Preparo la foto…')}</Text></View> : null}
    </View>
  );
}

function Chip({ label, on, press, icon }: { label: string; on: boolean; press: () => void; icon?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={press} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 38, borderRadius: 19, backgroundColor: on ? t.accent : 'rgba(255,255,255,0.09)' }}>
      {icon ? <Icon name={icon} size={16} color={on ? t.onText : '#fff'} stroke={2.1} /> : null}
      <Text style={{ color: on ? t.onText : '#fff', fontWeight: '700', fontSize: 13 }}>{tr(label)}</Text>
    </Pressable>
  );
}

