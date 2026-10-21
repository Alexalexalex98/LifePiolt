import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import { GAP } from '@/components/dash/DashGrid';
import { CATS, WIDGETS, WBY, type CatId } from '@/components/dash/registry';
import { Text } from '@/components/T';
import { Body, Btn, Item, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { SHAPES, parseShape, shapeKey } from '@/lib/dash/grid';
import { Icon } from '@/lib/icons';
import { pickNetMediaMany } from '@/lib/netMedia';
import { BY_SYM } from '@/lib/markets/catalog';
import { useDash } from '@/store/dash';
import { useMarkets } from '@/store/markets';
import { toast } from '@/store/toast';

const shapeLabel = (k: string) => k.replace('x', '×');

/** Aggiungi un widget: prima la categoria, poi la lista con l'anteprima e le forme possibili. Tocchi una forma e il widget entra nel primo posto libero. */
export function AddWidgetSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const add = useDash((s) => s.add);
  const items = useDash((s) => s.items);
  const [cat, setCat] = useState<CatId | null>(null);
  const PREVIEW_CELL = Math.max(56, Math.floor((useWindowDimensions().width - 60 - 3 * GAP) / 4));
  const close = () => { setCat(null); onClose(); };
  const c = CATS.find((x) => x.id === cat);
  const list = WIDGETS.filter((w) => w.cat === cat);
  const subs = [...new Set(list.map((w) => w.sub ?? ''))];
  const put = (type: string, shape: string) => {
    const w = WBY[type];
    const watch = useMarkets.getState().watch;
    add(type, parseShape(shape), w.pick === 'stock' ? { sym: watch[0] ?? 'AAPL' } : undefined);
    toast(tl('Aggiunto: {0}', tl(w.title)));
    close();
  };
  return (
    <Sheet visible={visible} title={c ? tl(c.label) : 'Aggiungi un widget'} onClose={close}>
      {!c ? (
        <View>
          {CATS.map((x, i) => (
            <Item key={x.id} last={i === CATS.length - 1} onPress={() => setCat(x.id)}>
              <Row gap={12}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: x.color + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon} size={18} color={x.color} stroke={2} /></View>
                <Body style={{ flex: 1 }}>{x.label}</Body>
                <Body small muted>{WIDGETS.filter((w) => w.cat === x.id).length}</Body>
                <Icon name="chevron" size={16} color={t.muted} />
              </Row>
            </Item>
          ))}
        </View>
      ) : (
        <View>
          <Btn small ghost icon="arrow-left" title="Categorie" onPress={() => setCat(null)} />
          {subs.map((sub) => (
            <View key={sub}>
              {sub ? <Body bold style={{ marginTop: 14 }}>{tl(sub)}</Body> : null}
              {list.filter((w) => (w.sub ?? '') === sub).map((w) => {
                const prev = parseShape(w.def);
                const pw = prev.w * PREVIEW_CELL + (prev.w - 1) * GAP, ph = prev.h * PREVIEW_CELL + (prev.h - 1) * GAP;
                const Comp = w.Comp;
                return (
                  <View key={w.type} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12 }}>
                    <Row gap={8}><Body bold style={{ flex: 1 }}>{w.title}</Body>{items.some((i) => i.type === w.type) ? <Pill label="Già aggiunto" off /> : null}</Row>
                    <Body small muted>{w.desc}</Body>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      <View pointerEvents="none" style={{ width: pw, height: ph }}><Comp w={prev.w} h={prev.h} pw={pw} ph={ph} /></View>
                    </ScrollView>
                    <Body small muted style={{ marginTop: 8 }}>Tocca la forma che vuoi (quadratini):</Body>
                    <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 4 }} gap={6}>
                      {w.sizes.map((k) => <Pill key={k} label={shapeLabel(k)} onPress={() => put(w.type, k)} />)}
                    </Row>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
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

/** Sfondo: più foto per un mosaico lungo la pagina, e quanto scurirle. */
export function BackgroundSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const photos = useDash((s) => s.photos);
  const dim = useDash((s) => s.dim);
  const addPhotos = useDash((s) => s.addPhotos);
  const delPhoto = useDash((s) => s.delPhoto);
  const setDim = useDash((s) => s.setDim);
  const pick = async () => {
    try {
      const l = await pickNetMediaMany(Math.max(1, 12 - photos.length));
      const uris = l.filter((m) => m.media === 'photo').map((m) => m.uri);
      if (uris.length) addPhotos(uris);
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); }
  };
  return (
    <Sheet visible={visible} title="Sfondo della Dashboard" onClose={onClose}>
      <Body small muted>Scegli una o più foto: restano sul telefono. Se la pagina è lunga le foto si susseguono a mosaico, ognuna adattata al suo riquadro.</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
        {photos.map((u, i) => (
          <View key={`${u}${i}`} style={{ width: 84, height: 84 }}>
            <Image source={{ uri: u }} style={{ width: 84, height: 84, borderRadius: 14 }} contentFit="cover" />
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli la foto')} hitSlop={6} onPress={() => delPhoto(i)} style={{ position: 'absolute', right: -4, top: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={12} color="#fff" stroke={3} /></Pressable>
          </View>
        ))}
        {photos.length < 12 ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi foto')} onPress={() => void pick()} style={{ width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color={t.muted} /></Pressable> : null}
      </Row>
      <Body bold style={{ marginTop: 16 }}>Quanto scurire le foto</Body>
      <Body small muted>Più scure = widget più leggibili.</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={6}>
        {[0, 0.25, 0.45, 0.65, 0.8].map((d) => <Pill key={d} label={d === 0 ? 'Niente' : `${Math.round(d * 100)}%`} on={Math.abs(dim - d) < 0.01} onPress={() => setDim(d)} />)}
      </Row>
      <Text style={{ height: 1 }}>{''}</Text>
    </Sheet>
  );
}
