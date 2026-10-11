import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, Share, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';

import { CardFace } from '@/components/profile/CardFace';
import { useCardFor } from '@/components/profile/cardData';
import { Body, Btn, Card, H, Input, Page, Pill, Row, Seg, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { CARD_RATIO, FIELD_LABEL, FONTS, MAX_ELEMENTS, MAX_STROKES, MAX_POINTS, TEMPLATES, commit, hist, newElId, redo, sanitizeDesign, templateDesign, undo, type CardDesign, type El, type FieldId, type FontId, type Side, type Stroke } from '@/lib/profile/card';
import { pickImage } from '@/lib/profile/pickImage';
import { MAX_ON_CARD } from '@/lib/profile/skills';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { toast } from '@/store/toast';
import { confirmDelete } from '@/lib/confirm';

const INK = ['#111111', '#ffffff', '#6c8cff', '#e0866b', '#4fb58a', '#c9a24a', '#a46bd6', '#d65f8a'];

/** Editor visivo del biglietto: modelli, sfondo, foto, forme, disegno a mano libera, testi, trascinamento, fronte/retro, salvataggio e condivisione. */
export default function CardEditor() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const base = useCardFor(me);
  const store = useIdentity();
  const [h, setH] = useState(() => hist<CardDesign>(base.design));
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [tool, setTool] = useState<'move' | 'draw'>('move');
  const [sel, setSel] = useState<string | null>(null);
  const [ink, setInk] = useState('#111111');
  const [width, setWidth] = useState(4);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const shot = useRef<View>(null);
  const design = h.present;
  const cur: Side = design[side];
  const w = Math.min(useWindowDimensions().width - 32, 380);
  const hh = w / CARD_RATIO;
  const dRef = useRef(design); dRef.current = design;
  const toolRef = useRef(tool); toolRef.current = tool;
  const sideRef = useRef(side); sideRef.current = side;
  const inkRef = useRef({ ink, width }); inkRef.current = { ink, width };
  const draftRef = useRef<Stroke | null>(null);

  const apply = (fn: (d: CardDesign) => CardDesign) => setH((x) => commit(x, fn(x.present)));
  const setSide2 = (fn: (s: Side) => Side) => apply((d) => ({ ...d, [side]: fn(d[side]) }));
  const patchEl = (id: string, p: Partial<El>) => setSide2((s) => ({ ...s, els: s.els.map((e) => (e.id === id ? ({ ...e, ...p } as El) : e)) }));
  // il trascinamento aggiorna lo stato senza riempire la cronologia a ogni pixel
  const move = (id: string, x: number, y: number) => setH((z) => ({ ...z, present: { ...z.present, [sideRef.current]: { ...z.present[sideRef.current], els: z.present[sideRef.current].els.map((e) => (e.id === id ? { ...e, x, y } : e)) } } }));
  const selected = cur.els.find((e) => e.id === sel) ?? null;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => toolRef.current === 'draw',
    onMoveShouldSetPanResponder: () => toolRef.current === 'draw',
    onPanResponderGrant: (e: GestureResponderEvent) => { draftRef.current = { color: inkRef.current.ink, width: inkRef.current.width, pts: [[Math.min(1, Math.max(0, e.nativeEvent.locationX / dims.current.w)), Math.min(1, Math.max(0, e.nativeEvent.locationY / dims.current.h))]] }; setDraft(draftRef.current); },
    onPanResponderMove: (e: GestureResponderEvent) => {
      const d = draftRef.current; if (!d || d.pts.length >= MAX_POINTS) return;
      d.pts = [...d.pts, [Math.min(1, Math.max(0, e.nativeEvent.locationX / dims.current.w)), Math.min(1, Math.max(0, e.nativeEvent.locationY / dims.current.h))]];
      setDraft({ ...d });
    },
    onPanResponderRelease: () => {
      const d = draftRef.current; draftRef.current = null; setDraft(null);
      if (!d || !d.pts.length) return;
      setH((z) => (z.present[sideRef.current].strokes.length >= MAX_STROKES ? z : commit(z, { ...z.present, [sideRef.current]: { ...z.present[sideRef.current], strokes: [...z.present[sideRef.current].strokes, d] } })));
    },
  })).current;
  const dims = useRef({ w, h: hh }); dims.current = { w, h: hh };
  useEffect(() => { void dRef.current; }, []);

  const addEl = (e: El) => { if (cur.els.length >= MAX_ELEMENTS) { toast('Troppi elementi sul biglietto'); return; } setSide2((s) => ({ ...s, els: [...s.els, e] })); setSel(e.id); setTool('move'); };
  const addPhoto = async (src: 'gallery' | 'camera') => { const r = await pickImage(src, { aspect: [1, 1] }); if (r.error) toast(r.error); else if (r.uri) addEl({ id: newElId(), t: 'image', uri: r.uri, x: 0.62, y: 0.12, w: 0.28, round: false }); };
  const bg = cur.bg;

  const save = () => { store.setDesign(sanitizeDesign(design)); toast('Biglietto salvato'); };
  const shareImage = async () => {
    store.setDesign(sanitizeDesign(design));
    try {
      const uri = await captureRef(shot, { format: 'png', quality: 1 });
      if (Platform.OS === 'web') { await Share.share({ message: base.qrText, url: uri }); return; }
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Condividi il biglietto' }); return; }
      await Share.share({ url: uri, message: base.qrText });
    } catch {
      // senza cattura immagine condividiamo la composizione e il contenuto come testo
      Share.share({ message: `${base.data.name}${base.data.role ? ' · ' + base.data.role : ''}\n${base.qrText}` }).catch(() => toast('Condivisione non disponibile'));
      toast('Immagine non disponibile qui: ho condiviso il testo');
    }
  };
  const skills = useIdentity((s) => s.declared);
  const chosen = design.skills ?? [];

  return (
    <Page id="cardEditor" back title="Il tuo biglietto">
      <View style={{ alignItems: 'center' }}>
        <View ref={shot} collapsable={false} style={{ width: w, height: hh, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8, borderRadius: 10 }}>
          <CardFace side={cur} design={design} data={base.data} width={w} qrText={base.qrText} selectedId={tool === 'move' ? sel : null} onSelect={tool === 'move' ? setSel : undefined} onMove={tool === 'move' ? move : undefined} draftStroke={draft}
            overlay={tool === 'draw' ? <View {...pan.panHandlers} accessibilityLabel="Area di disegno" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }} /> : null} />
        </View>
      </View>
      <Seg options={['Fronte', 'Retro']} value={side === 'front' ? 'Fronte' : 'Retro'} onChange={(v) => { setSide(v === 'Fronte' ? 'front' : 'back'); setSel(null); }} />
      <Row gap={8} style={{ marginBottom: 6 }}>
        <Btn small ghost icon="minus" title="Annulla" disabled={!h.past.length} onPress={() => setH(undo)} />
        <Btn small ghost icon="plus" title="Ripristina" disabled={!h.future.length} onPress={() => setH(redo)} />
        <Btn small style={{ flex: 1 }} title="Salva" onPress={save} />
      </Row>

      <Seg options={['Sposta', 'Disegna']} value={tool === 'move' ? 'Sposta' : 'Disegna'} onChange={(v) => { setTool(v === 'Sposta' ? 'move' : 'draw'); setSel(null); }} />
      {tool === 'draw' && (
        <Card>
          <Body small muted>Disegna con il dito sul biglietto. Colore e spessore valgono per il prossimo tratto.</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
            {INK.map((c) => <Pressable key={c} onPress={() => setInk(c)} accessibilityRole="button" accessibilityLabel={`Colore ${c}`} accessibilityState={{ selected: ink === c }} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: ink === c ? 3 : 1, borderColor: ink === c ? t.accent : t.border }} />)}
          </Row>
          <Row style={{ justifyContent: 'flex-start', marginTop: 10 }} gap={8}>
            {[2, 4, 8, 14].map((n) => <Pill key={n} label={`${n}`} on={width === n} onPress={() => setWidth(n)} />)}
            <Btn small ghost title="Annulla tratto" disabled={!cur.strokes.length} onPress={() => setSide2((s) => ({ ...s, strokes: s.strokes.slice(0, -1) }))} />
            <Btn small ghost danger title="Cancella" disabled={!cur.strokes.length} onPress={() => confirmDelete('tutto il disegno su questo lato', () => setSide2((s) => ({ ...s, strokes: [] })))} />
          </Row>
        </Card>
      )}

      {tool === 'move' && selected && (
        <Card>
          <Row><Body bold style={{ flex: 1 }}>{selected.t === 'field' ? FIELD_LABEL[selected.field] : selected.t === 'text' ? 'Testo' : selected.t === 'image' ? 'Foto' : selected.t === 'qr' ? 'QR code' : 'Forma'}</Body>
            <Btn small ghost danger icon="trash" title="Togli" onPress={() => { setSide2((s) => ({ ...s, els: s.els.filter((e) => e.id !== selected.id) })); setSel(null); }} /></Row>
          <Body small muted style={{ marginBottom: 6 }}>Trascina l’elemento sul biglietto per spostarlo.</Body>
          {(selected.t === 'field' || selected.t === 'text') && (
            <>
              {selected.t === 'text' && <Input value={selected.text} onChangeText={(v) => patchEl(selected.id, { text: v } as Partial<El>)} placeholder="Testo" maxLength={80} />}
              <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
                {FONTS.map((f) => <Pill key={f.id} label={f.label} on={selected.font === f.id} onPress={() => patchEl(selected.id, { font: f.id as FontId } as Partial<El>)} />)}
              </Row>
              <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={8}>
                <Btn small ghost icon="minus" title="Più piccolo" onPress={() => patchEl(selected.id, { size: Math.max(7, selected.size - 1.5) } as Partial<El>)} />
                <Btn small ghost icon="plus" title="Più grande" onPress={() => patchEl(selected.id, { size: Math.min(40, selected.size + 1.5) } as Partial<El>)} />
                <Pill label="Grassetto" on={!!selected.bold} onPress={() => patchEl(selected.id, { bold: !selected.bold } as Partial<El>)} />
              </Row>
            </>
          )}
          {(selected.t === 'image' || selected.t === 'shape' || selected.t === 'qr') && (
            <Row style={{ justifyContent: 'flex-start' }} gap={8}>
              <Btn small ghost icon="minus" title="Più piccolo" onPress={() => patchEl(selected.id, { w: Math.max(0.05, selected.w - 0.04) } as Partial<El>)} />
              <Btn small ghost icon="plus" title="Più grande" onPress={() => patchEl(selected.id, { w: Math.min(1, selected.w + 0.04) } as Partial<El>)} />
              {selected.t === 'image' && <Pill label="Tondo" on={!!selected.round} onPress={() => patchEl(selected.id, { round: !selected.round } as Partial<El>)} />}
            </Row>
          )}
          {selected.t !== 'image' && (
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
              {INK.map((c) => <Pressable key={c} onPress={() => patchEl(selected.id, { color: c } as Partial<El>)} accessibilityRole="button" accessibilityLabel={`Colore ${c}`} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: 1, borderColor: t.border }} />)}
            </Row>
          )}
        </Card>
      )}

      <H style={{ marginTop: 12 }}>Modello</H>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 6 }} gap={8}>
        {TEMPLATES.map((m) => <Pill key={m.id} label={m.label} on={design.template === m.id} onPress={() => { apply((d) => ({ ...templateDesign(m.id), skills: d.skills, qr: d.qr })); setSel(null); }} />)}
      </Row>

      <H style={{ marginTop: 12 }}>Sfondo ({side === 'front' ? 'fronte' : 'retro'})</H>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 6 }} gap={8}>
        {['#ffffff', '#f5f1e8', '#111827', '#6c8cff', '#4fb58a', '#e0866b', '#a46bd6'].map((c) => <Pressable key={c} onPress={() => setSide2((s) => ({ ...s, bg: { ...s.bg, kind: 'solid', c1: c, c2: c } }))} accessibilityRole="button" accessibilityLabel={`Sfondo ${c}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 1, borderColor: t.border }} />)}
      </Row>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        {([['#6c8cff', '#3b2a7a'], ['#e0866b', '#a4343a'], ['#4fb58a', '#1f5a7a'], ['#141a2b', '#2a1f4a']] as const).map(([a, b2]) => <Pressable key={a} onPress={() => setSide2((s) => ({ ...s, bg: { kind: 'gradient', c1: a, c2: b2, angle: 135 } }))} accessibilityRole="button" accessibilityLabel={`Sfumatura ${a} ${b2}`} style={{ width: 54, height: 34, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}><LinearGradient colors={[a, b2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} /></Pressable>)}
      </Row>
      {bg.kind === 'gradient' && <Body small muted style={{ marginTop: 4 }}>Sfumatura attiva.</Body>}

      <H style={{ marginTop: 12 }}>Aggiungi</H>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 6 }} gap={8}>
        <Btn small ghost icon="image" title="Foto o logo" onPress={() => void addPhoto('gallery')} />
        <Btn small ghost icon="camera" title="Scatta" onPress={() => void addPhoto('camera')} />
        <Btn small ghost icon="edit" title="Testo" onPress={() => addEl({ id: newElId(), t: 'text', text: 'Il tuo testo', x: 0.08, y: 0.85, size: 11, color: '#111111', font: 'sans' })} />
        <Btn small ghost title="Rettangolo" onPress={() => addEl({ id: newElId(), t: 'shape', shape: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.12, color: '#6c8cff' })} />
        <Btn small ghost title="Cerchio" onPress={() => addEl({ id: newElId(), t: 'shape', shape: 'circle', x: 0.7, y: 0.1, w: 0.18, h: 0.18 * CARD_RATIO, color: '#e0866b' })} />
        <Btn small ghost title="Linea" onPress={() => addEl({ id: newElId(), t: 'shape', shape: 'line', x: 0.08, y: 0.7, w: 0.5, h: 0.012, color: '#111111' })} />
      </Row>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        {(['name', 'role', 'business', 'skills', 'email', 'phone'] as FieldId[]).filter((f) => !cur.els.some((e) => e.t === 'field' && e.field === f)).map((f) => (
          <Pill key={f} label={`+ ${FIELD_LABEL[f]}`} onPress={() => addEl({ id: newElId(), t: 'field', field: f, x: 0.08, y: 0.5, size: 12, color: '#111111', font: 'sans' })} />
        ))}
      </Row>

      <H style={{ marginTop: 14 }}>Contenuto</H>
      <Body small muted style={{ marginBottom: 6 }}>Sul biglietto: nome, ruolo, attività, competenze e contatti. Niente scuole, titoli, storico lavorativo, età o indirizzo.</Body>
      <Input placeholder="Ruolo o mestiere (lo scrivi tu)" value={store.role} onChangeText={(v) => store.patch({ role: v })} maxLength={50} />
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>
        <Pill label="Nessuna attività" on={!store.cardBusinessId} onPress={() => store.patch({ cardBusinessId: null })} />
        {store.businesses.map((b) => <Pill key={b.id} label={b.name} on={store.cardBusinessId === b.id} onPress={() => store.patch({ cardBusinessId: b.id })} />)}
      </Row>
      <Body small muted style={{ marginBottom: 4 }}>{`Competenze sul biglietto (massimo ${MAX_ON_CARD}, solo quelle che hai dichiarato)`}</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        {skills.length === 0 ? <Body small muted>Nessuna competenza dichiarata: aggiungile dal profilo.</Body> : skills.map((s) => (
          <Pill key={s.id} label={s.label} on={chosen.includes(s.id)} onPress={() => apply((d) => { const c = d.skills ?? []; return { ...d, skills: c.includes(s.id) ? c.filter((x) => x !== s.id) : c.length >= MAX_ON_CARD ? c : [...c, s.id] }; })} />
        ))}
      </Row>
      <Row style={{ marginTop: 10 }}><Body style={{ flex: 1 }}>QR con il link al profilo</Body><Switch value={design.qr} onValueChange={(v) => { apply((d) => ({ ...d, qr: v, back: { ...d.back, els: v ? [...d.back.els.filter((e) => e.t !== 'qr'), { id: newElId(), t: 'qr', x: 0.68, y: 0.5, w: 0.26, color: '#111111' }] : d.back.els.filter((e) => e.t !== 'qr') } })); }} accessibilityLabel="QR con il link al profilo" /></Row>
      <Body small muted>Il QR contiene un link interno all’app (lifepilot://): funziona per chi ha già LifePilot. Un link web pubblico richiede il server.</Body>
      <Body small muted style={{ marginTop: 6 }}>Email e telefono compaiono solo se li hai attivati in «Cosa condivido».</Body>

      <Row style={{ marginTop: 16 }} gap={8}>
        <Btn style={{ flex: 1 }} title="Salva" onPress={save} />
        <Btn style={{ flex: 1 }} ghost icon="send" title="Condividi immagine" onPress={() => void shareImage()} />
      </Row>
      <Btn ghost danger style={{ marginTop: 8 }} title="Ripristina il modello" onPress={() => confirmDelete('le modifiche non salvate', () => { setH(hist(sanitizeDesign(useIdentity.getState().design))); })} />
    </Page>
  );
}
