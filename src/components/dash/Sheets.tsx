import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { GAP } from '@/components/dash/DashGrid';
import { CATS, WIDGETS, WBY, type CatId } from '@/components/dash/registry';
import { Text } from '@/components/T';
import { Body, Btn, Item, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { SHAPES, parseShape, shapeKey } from '@/lib/dash/grid';
import { Icon } from '@/lib/icons';
import { PRESETS } from '@/lib/dash/backgrounds';
import { pickNetMedia } from '@/lib/netMedia';
import { BY_SYM } from '@/lib/markets/catalog';
import { useDash } from '@/store/dash';
import { useMarkets } from '@/store/markets';
import { toast } from '@/store/toast';

const shapeLabel = (k: string) => k.replace('x', '×');

/** Aggiungi un widget: tutti i widget in un'unica lista, divisi da un sottotitolo per sezione (con il colore della sezione). Tieni premuto e il widget entra nel primo posto libero. */
export function AddWidgetSheet({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded?: (id: string) => void }) {
  const t = useTheme();
  const add = useDash((s) => s.add);
  const items = useDash((s) => s.items);
  const PREVIEW_CELL = Math.max(56, Math.floor((useWindowDimensions().width - 60 - 3 * GAP) / 4));
  /* le anteprime compaiono a gruppi, cosi' la finestra si apre subito anche con tutti i widget */
  const [shown, setShown] = useState(6);
  useEffect(() => {
    if (!visible) { setShown(6); return; }
    if (shown >= WIDGETS.length) return;
    const h = setTimeout(() => setShown((n) => n + 6), 120);
    return () => clearTimeout(h);
  }, [visible, shown]);
  const close = () => { setShown(6); onClose(); };
  /** Si aggiunge tenendo premuto: entra con la forma consigliata nel primo posto libero, pronto da spostare. Le altre forme si scelgono dal pulsante in basso a destra del widget. */
  const put = (type: string) => {
    const w = WBY[type];
    const watch = useMarkets.getState().watch;
    const id = add(type, parseShape(w.def), w.pick === 'stock' ? { sym: watch[0] ?? 'AAPL' } : undefined);
    toast(tl('Aggiunto: {0}. Tienilo premuto per spostarlo.', tl(w.title)));
    close();
    onAdded?.(id);
  };
  let n = 0;
  return (
    <Sheet visible={visible} title="Aggiungi un widget" onClose={close}>
      <Body small muted>Tieni premuto il widget che vuoi: entra nella Dashboard con la forma consigliata, poi lo sposti dove vuoi. Le altre forme le scegli dal pulsante in basso a destra del widget.</Body>
      {CATS.map((c) => {
        const list = WIDGETS.filter((w) => w.cat === c.id);
        if (!list.length) return null;
        const subs = [...new Set(list.map((w) => w.sub ?? ''))];
        return (
          <View key={c.id} style={{ marginTop: 20 }}>
            <Row gap={10} style={{ justifyContent: 'flex-start', paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: c.color }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: c.color + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={17} color={c.color} stroke={2} /></View>
              <Body bold style={{ flex: 1, fontSize: 18, color: c.color }}>{tl(c.label)}</Body>
              <Body small muted>{list.length}</Body>
            </Row>
            {subs.map((sub) => (
              <View key={sub}>
                {sub ? <Body small muted style={{ marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>{tl(sub)}</Body> : null}
                {list.filter((w) => (w.sub ?? '') === sub).map((w) => {
                  const prev = parseShape(w.def);
                  const pw = prev.w * PREVIEW_CELL + (prev.w - 1) * GAP, ph = prev.h * PREVIEW_CELL + (prev.h - 1) * GAP;
                  const Comp = w.Comp;
                  const show = n++ < shown;
                  return (
                    <View key={w.type} style={{ marginTop: 12, borderLeftWidth: 3, borderLeftColor: c.color, paddingLeft: 12 }}>
                      <Row gap={8}><Body bold style={{ flex: 1 }}>{w.title}</Body>{items.some((i) => i.type === w.type) ? <Pill label="Già aggiunto" off /> : null}</Row>
                      <Body small muted>{w.desc}</Body>
                      <Pressable accessibilityRole="button" accessibilityLabel={`${tl('Aggiungi')} ${tl(w.title)}`} accessibilityHint={tl('Tieni premuto per aggiungerlo alla Dashboard')} delayLongPress={350} onLongPress={() => put(w.type)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                        <View pointerEvents="none" style={{ width: pw, height: ph }}>{show ? <Comp w={prev.w} h={prev.h} pw={pw} ph={ph} /> : <View style={{ flex: 1, borderRadius: 18, backgroundColor: c.color + '14' }} />}</View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}
    </Sheet>
  );
}

/** Opzioni di un widget: forma, posizione, titolo da seguire, rimozione. */
export function OptionsSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTheme();
  const it = useDash((s) => s.items.find((x) => x.id === id));
  const resize = useDash((s) => s.resize);
  const move = useDash((s) => s.move);
  const remove = useDash((s) => s.remove);
  const setCfg = useDash((s) => s.setCfg);
  const watch = useMarkets((s) => s.watch);
  const def = it ? WBY[it.type] : null;
  if (!it || !def) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const cur = shapeKey(it);
  const syms = [...new Set([...(it.cfg?.sym ? [it.cfg.sym] : []), ...watch, 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META'])].filter((s) => BY_SYM[s]).slice(0, 12);
  const arrow = (icon: string, dx: number, dy: number, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => move(it.id, it.x + dx, it.y + dy)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={t.text} stroke={2.2} /></Pressable>
  );
  return (
    <Sheet visible title={def.title} onClose={onClose}>
      <Body small muted>{def.desc}</Body>
      <Body bold style={{ marginTop: 14 }}>Forma (quadratini)</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={6}>
        {SHAPES.filter((s) => def.sizes.includes(shapeKey(s))).map((s) => <Pill key={shapeKey(s)} label={shapeLabel(shapeKey(s))} on={cur === shapeKey(s)} onPress={() => resize(it.id, s)} />)}
      </Row>
      <Body small muted style={{ marginTop: 6 }}>Un grafico compare solo dalle forme da 4 quadratini in su. Se non c'è posto, il widget si sposta nel posto libero più vicino.</Body>
      <Body bold style={{ marginTop: 14 }}>Sposta di un quadratino</Body>
      <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>
        {arrow('arrow-left', -1, 0, 'A sinistra')}{arrow('arrow-up', 0, -1, 'In alto')}{arrow('arrow-down', 0, 1, 'In basso')}{arrow('arrow-right', 1, 0, 'A destra')}
      </Row>
      {def.pick === 'stock' ? (
        <View>
          <Body bold style={{ marginTop: 14 }}>Titolo da seguire</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={6}>
            {syms.map((s) => <Pill key={s} label={s} on={(it.cfg?.sym ?? '') === s} onPress={() => setCfg(it.id, { sym: s })} />)}
          </Row>
        </View>
      ) : null}
      <Btn style={{ marginTop: 16 }} danger icon="trash" title="Togli il widget" onPress={() => { remove(it.id); onClose(); }} />
    </Sheet>
  );
}

/** Sfondo: una sola foto (mai ripetuta) oppure un modello di colore pronto. */
export function BackgroundSheet({ visible, onClose, onReopen }: { visible: boolean; onClose: () => void; onReopen?: () => void }) {
  const t = useTheme();
  const bg = useDash((s) => s.bg);
  const legacy = useDash((s) => s.photos?.[0]);
  const dim = useDash((s) => s.dim);
  const setBg = useDash((s) => s.setBg);
  const setDim = useDash((s) => s.setDim);
  const photo = bg.kind === 'photo' && bg.photo ? bg.photo : bg.kind === 'none' && legacy ? legacy : null;
  const pick = async () => {
    // su iPhone il selettore foto non si apre sopra una finestra: si chiude, si sceglie e si riapre
    onClose();
    await new Promise((r) => setTimeout(r, 550));
    try {
      const m = await pickNetMedia('photo');
      if (m) setBg({ kind: 'photo', photo: m.uri });
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); }
    onReopen?.();
  };
  const sel = (on: boolean) => ({ borderWidth: on ? 3 : 1, borderColor: on ? t.accent : t.border });
  return (
    <Sheet visible={visible} title="Sfondo della Dashboard" onClose={onClose}>
      <Body small muted>Una sola foto, adattata allo schermo, oppure un modello di colore. Resta ferma dietro ai widget mentre scorri.</Body>
      <Body bold style={{ marginTop: 14 }}>La tua foto</Body>
      <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={10}>
        {photo ? <Image source={{ uri: photo }} style={{ width: 72, height: 96, borderRadius: 14, ...sel(bg.kind === 'photo' || bg.kind === 'none') }} contentFit="cover" /> : null}
        <View style={{ gap: 8 }}>
          <Btn small icon="image" title={photo ? 'Cambia foto' : 'Scegli una foto'} onPress={() => void pick()} />
          {photo ? <Btn small ghost danger icon="trash" title="Togli la foto" onPress={() => setBg({ kind: 'none' })} /> : null}
        </View>
      </Row>
      {photo ? (
        <View>
          <Body small muted style={{ marginTop: 10 }}>Quanto scurirla, per tenere leggibili i widget:</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={6}>
            {[0, 0.25, 0.45, 0.65, 0.8].map((d) => <Pill key={d} label={d === 0 ? 'Niente' : `${Math.round(d * 100)}%`} on={Math.abs(dim - d) < 0.01} onPress={() => setDim(d)} />)}
          </Row>
        </View>
      ) : null}
      <Body bold style={{ marginTop: 18 }}>Modelli</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={10}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Nessuno sfondo')} onPress={() => setBg({ kind: 'none' })} style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', ...sel(bg.kind === 'none' && !photo) }}><Icon name="x" size={18} color={t.muted} /></Pressable>
        {PRESETS.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => setBg({ kind: 'preset', preset: p.id })} style={{ alignItems: 'center', gap: 4 }}>
            <LinearGradient colors={p.colors as [string, string, ...string[]]} start={{ x: p.from[0], y: p.from[1] }} end={{ x: p.to[0], y: p.to[1] }} style={{ width: 72, height: 72, borderRadius: 16, ...sel(bg.kind === 'preset' && bg.preset === p.id) }} />
            <Text style={{ color: t.muted, fontSize: 10.5 }}>{p.name}</Text>
          </Pressable>
        ))}
      </Row>
    </Sheet>
  );
}
