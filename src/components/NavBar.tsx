import { isDoubleTap, triggerPageRefresh } from '@/lib/pageRefresh';
import { Mascot } from '@/components/mascot/Mascot';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, Card, Row, Sheet, Item, Chev, Press } from '@/components/ui';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useTheme } from '@/hooks/use-theme';
import { translate, sectionNamesFor } from '@/lib/i18n';
import { Icon, areaColors } from '@/lib/icons';
import { sectionColor } from '@/lib/liveTheme';
import { go } from '@/lib/nav';
import { navCatalog, useApp } from '@/store/app';
import { toast } from '@/store/toast';
import { useUI } from '@/components/ui';
import { translateText } from '@/i18n/core';
import { TourTarget } from '@/components/tour/TourTarget';
import { requestUnlock } from '@/components/tour/hooks';
import { isUnlocked } from '@/lib/tour';
import { useTour } from '@/store/tour';

const translatedNav: Record<string, string> = { home: 'navHome', ai: 'navAi', lifenetwork: 'navNetwork', lifefinance: 'navFinance', profile: 'navProfile' };

export function navLabelFor(id: string, language: Parameters<typeof translate>[0]) {
  if (translatedNav[id]) return translate(language, translatedNav[id]);
  return sectionNamesFor(language)[id] || navCatalog[id] || id;
}

/** La barra è sempre ferma: fino a 7 icone (oltre 6 i nomi si vedono solo sulla pagina attuale). */
const NAV_MAX = 7;
const navChoices = ['home', 'ai', 'plan', 'lifenetwork', 'lifefinance', 'profile', 'lifehealth', 'lifefitness', 'lifenotes', 'lifetravel', 'lifedrive', 'lifetask', 'lifepointsPage', 'settings'];

/** Modalità «Personalizza la barra»: sopra c'è lo spazio con tutti i pulsanti che non sono in barra, sotto la barra stessa.
 *  Trascina un pulsante dallo spazio alla barra per aggiungerlo; tieni premuto un pulsante della barra per spostarlo
 *  (o portalo nello spazio sopra per toglierlo). */
function NavEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { navItems, language, set } = useApp();
  const items = useRef(navItems); items.current = navItems;
  const [drag, setDrag] = useState<{ id: string; from: 'bar' | 'grid'; x: number; y: number } | null>(null);
  const dragRef = useRef(drag); dragRef.current = drag;
  const origin = useRef({ x: 0, y: 0 });
  const rootRef = useRef<View>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ id: string; from: 'bar' | 'grid'; x: number; y: number } | null>(null);

  const barH = 64 + insets.bottom;
  const avail = navChoices.filter((id) => !navItems.includes(id));
  const COLS = 4, TILE_H = 78, HEAD = 52;
  const innerW = W - 24 - 24, tileW = innerW / COLS;
  /* il pannello ha sempre la stessa altezza (non salta quando togli o aggiungi un pulsante) */
  const rows = Math.max(1, Math.ceil((navChoices.length - 2) / COLS));
  const panelH = 12 + HEAD + rows * TILE_H + 12;
  const panelTop = H - barH - 12 - panelH;
  const slotW = W / Math.max(1, navItems.length);
  const inBar = (y: number) => y > H - barH - 18;
  const slotAt = (x: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(x / (W / Math.max(1, n)))));

  const hit = (x: number, y: number): { id: string; from: 'bar' | 'grid' } | null => {
    if (y >= H - barH) { const i = slotAt(x, items.current.length); return { id: items.current[i], from: 'bar' }; }
    const rx = x - 24, ry = y - panelTop - 12 - HEAD;
    if (rx < 0 || rx >= innerW || ry < 0) return null;
    const col = Math.floor(rx / tileW), row = Math.floor(ry / TILE_H);
    const list = navChoices.filter((id) => !items.current.includes(id));
    const id = list[row * COLS + col];
    return id ? { id, from: 'grid' } : null;
  };
  const drop = (d: { id: string; from: 'bar' | 'grid'; x: number; y: number }) => {
    const cur = items.current;
    if (inBar(d.y)) {
      if (d.from === 'grid') {
        if (cur.length >= NAV_MAX) { toast('La barra può avere al massimo 7 icone'); return; }
        const i = Math.max(0, Math.min(cur.length, Math.round(d.x / (W / (cur.length + 1)) - 0.5)));
        const a = cur.slice(); a.splice(i, 0, d.id); set({ navItems: a });
      } else {
        const without = cur.filter((x) => x !== d.id);
        const i = Math.max(0, Math.min(without.length, Math.round(d.x / (W / cur.length) - 0.5)));
        without.splice(i, 0, d.id); set({ navItems: without });
      }
    } else if (d.from === 'bar') {
      if (d.id === 'home') { toast('Home resta sempre nella barra'); return; }
      if (cur.length <= 2) { toast('Servono almeno due icone nella barra'); return; }
      set({ navItems: cur.filter((x) => x !== d.id) });
    }
  };
  const api = useRef({ hit, drop }); api.current = { hit, drop };
  const pan = useRef(PanResponder.create({
    /* il pannello cattura solo i tocchi sulle icone: «Fatto» e lo sfondo restano pulsanti normali (su Android un piccolo movimento del dito li annullava) */
    onStartShouldSetPanResponder: (e) => !!api.current.hit(e.nativeEvent.pageX - origin.current.x, e.nativeEvent.pageY - origin.current.y),
    onMoveShouldSetPanResponder: (_e, g) => !!api.current.hit(g.x0 - origin.current.x, g.y0 - origin.current.y),
    onPanResponderGrant: (e, g) => {
      const x = g.x0 - origin.current.x, y = g.y0 - origin.current.y;
      const h = api.current.hit(x, y);
      start.current = h ? { ...h, x, y } : null;
      if (hold.current) clearTimeout(hold.current);
      if (h?.from === 'bar') hold.current = setTimeout(() => { if (start.current) setDrag({ ...start.current }); }, 220);
    },
    onPanResponderMove: (_e, g) => {
      const x = g.moveX - origin.current.x, y = g.moveY - origin.current.y;
      const st = start.current; if (!st) return;
      if (!dragRef.current) {
        if (st.from === 'grid' && Math.hypot(g.dx, g.dy) > 8) setDrag({ ...st, x, y });
        else if (st.from === 'bar' && Math.hypot(g.dx, g.dy) > 12 && hold.current) { clearTimeout(hold.current); hold.current = null; }
      } else setDrag({ ...dragRef.current, x, y });
    },
    onPanResponderRelease: (_e, g) => {
      if (hold.current) { clearTimeout(hold.current); hold.current = null; }
      const d = dragRef.current;
      if (d) api.current.drop({ ...d, x: g.moveX - origin.current.x, y: g.moveY - origin.current.y });
      setDrag(null); start.current = null;
    },
    onPanResponderTerminate: () => { if (hold.current) clearTimeout(hold.current); setDrag(null); start.current = null; },
  })).current;

  const shown = drag?.from === 'bar' ? navItems.filter((x) => x !== drag.id) : navItems;
  const target = drag && inBar(drag.y) ? (drag.from === 'grid' ? Math.max(0, Math.min(navItems.length, Math.round(drag.x / (W / (navItems.length + 1)) - 0.5))) : Math.max(0, Math.min(shown.length, Math.round(drag.x / (W / Math.max(1, navItems.length)) - 0.5)))) : -1;
  const barItems = target >= 0 ? [...shown.slice(0, target), '__gap', ...shown.slice(target)] : shown;
  const compact = navItems.length > 6;
  const cell = (id: string, big?: boolean) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={id} size={big ? 26 : compact ? 20 : 22} color={t.text} />
      {big || !compact ? <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: t.text, fontSize: big ? 11.5 : 10.5, marginTop: 4, maxWidth: big ? tileW - 4 : W / Math.max(5, navItems.length) - 4 }}>{navLabelFor(id, language)}</Text> : null}
    </View>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View ref={rootRef} style={[{ flex: 1 }, { userSelect: 'none' } as never]} onLayout={() => { rootRef.current?.measureInWindow?.((x, y) => { origin.current = { x: x || 0, y: y || 0 }; }); }} {...pan.panHandlers}>
        <Pressable accessibilityRole="button" accessibilityLabel={translateText('Chiudi')} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <View pointerEvents="box-none" style={{ position: 'absolute', start: 12, end: 12, top: panelTop, height: panelH, borderRadius: 22, backgroundColor: t.mode === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(22,26,40,0.78)', borderWidth: 1, borderColor: t.border, padding: 12 }}>
          <View style={{ height: HEAD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingEnd: 10 }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{translateText('Altri pulsanti')}</Text>
              <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{translateText('Trascinali sulla barra (massimo 7)')}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: t.text }}><Text style={{ color: t.onText, fontWeight: '800' }}>{translateText('Fatto')}</Text></Pressable>
          </View>
          {avail.length === 0 ? <Text style={{ color: t.muted, textAlign: 'center', marginTop: 24 }}>{translateText('Sono tutti già nella barra')}</Text> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {avail.map((id) => (
                <View key={id} style={{ width: '25%', height: TILE_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, opacity: drag?.id === id ? 0.25 : 1 }}>{cell(id, true)}</View>
              ))}
            </View>
          )}
        </View>
        <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: barH, flexDirection: 'row', paddingTop: 10, paddingBottom: 10 + insets.bottom, backgroundColor: t.nav, borderTopWidth: 1, borderTopColor: t.navBorder }}>
          {barItems.map((id, i) => id === '__gap'
            ? <View key={'gap' + i} style={{ flex: 1, marginHorizontal: 6, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.accent }} />
            : <View key={id} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>{cell(id)}</View>)}
        </View>
        {drag ? <View pointerEvents="none" style={{ position: 'absolute', start: drag.x - 36, top: drag.y - 52, width: 72, height: 72, borderRadius: 20, backgroundColor: t.mode === 'light' ? '#ffffffee' : '#2a3050ee', borderWidth: 1, borderColor: t.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1.1 }] }}>{cell(drag.id, true)}</View> : null}
      </View>
    </Modal>
  );
}

export function NavBar({ state }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardInset();
  const { navItems, pageVisits, dismissedNav, language, set } = useApp();
  const tourMode = useTour((s) => s.mode), tourLevel = useTour((s) => s.level), tourAll = useTour((s) => s.allUnlocked);
  const lockedPage = (id: string) => !isUnlocked({ mode: tourMode, level: tourLevel, allUnlocked: tourAll }, id);
  const [editing, setEditing] = useState(false);
  const current = state.routes[state.index]?.name === 'index' ? 'home' : state.routes[state.index]?.name;

  // suggerimento: scambia la voce meno usata con la più visitata fuori barra
  let suggestion: { out: string; inn: string } | null = null;
  const nonNav = Object.keys(navCatalog).filter((id) => !navItems.includes(id)).sort((a, b) => (pageVisits[b] || 0) - (pageVisits[a] || 0));
  const best = nonNav[0];
  if (best && (pageVisits[best] || 0) >= 8) {
    const weakest = navItems.filter((id) => id !== 'home').sort((a, b) => (pageVisits[a] || 0) - (pageVisits[b] || 0))[0];
    if (weakest && (pageVisits[best] || 0) > (pageVisits[weakest] || 0) * 1.5 && !dismissedNav.includes(`${weakest}>${best}`)) suggestion = { out: weakest, inn: best };
  }

  const { width: W } = useWindowDimensions();
  const lastTap = useRef(0);
  /* chi aveva salvato più di 7 icone (quando la barra scorreva) riparte con le prime 7 */
  useEffect(() => { if (navItems.length > NAV_MAX) set({ navItems: navItems.slice(0, NAV_MAX) }); }, [navItems, set]);
  const renderItem = (id: string) => {
          const active = id === current;
          const locked = lockedPage(id);
          const ink = locked ? t.muted : active ? t.text : t.navInactive;
          return (
            <TourTarget key={id} id={`nav.${id}`}>
              <Press onPress={() => { if (locked) { requestUnlock(id); return; } if (active) { const now = Date.now(); if (isDoubleTap(lastTap.current, now)) { lastTap.current = 0; if (triggerPageRefresh(id)) toast('Pagina aggiornata'); } else lastTap.current = now; return; } go(id); }} onLongPress={() => setEditing(true)} role="tab" selected={active} accessibilityLabel={translateText(navLabelFor(id, language)) + (locked ? translateText(', si sblocca presto') : '')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} style={{ alignItems: 'center', minWidth: navItems.length > 5 ? 48 : 56, minHeight: 44, justifyContent: 'center', opacity: locked ? 0.5 : 1 }}>
                {active && <View style={{ position: 'absolute', top: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: t.accent }} />}
                <View>
                  <Icon name={id} size={20} color={ink} />
                  {locked && <View style={{ position: 'absolute', end: -7, bottom: -4, backgroundColor: t.nav, borderRadius: 7, padding: 1 }}><Icon name="lock" size={11} color={t.text} stroke={2.4} /></View>}
                </View>
                {navItems.length <= 6 || active ? <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: ink, fontSize: navItems.length >= 6 ? 10 : 11, marginTop: 2, fontWeight: active ? '700' : '400', maxWidth: W / navItems.length - 2 }}>{navLabelFor(id, language)}</Text> : null}
              </Press>
            </TourTarget>
          );
  };
  // la stanza live è a tutto schermo: nessuna barra di navigazione
  if (current === 'liveRoom') return null;
  // con la tastiera aperta la barra di navigazione sparisce: lo spazio serve alla barra di scrittura
  if (kb.visible && !kb.floating) return null;
  return (
    <View>
      {suggestion && (
        <View style={{ position: 'absolute', bottom: 74 + insets.bottom, start: 16, end: 16, zIndex: 6 }}>
          <Card>
            <Body small style={{ marginBottom: 10 }}>
              Usi spesso <Text style={{ fontWeight: '700' }}>{navLabelFor(suggestion.inn, language)}</Text>. Vuoi sostituire{' '}
              <Text style={{ fontWeight: '700' }}>{navLabelFor(suggestion.out, language)}</Text> con questa nella barra?
            </Body>
            <Row>
              <Btn small ghost style={{ flex: 1 }} title="No grazie" onPress={() => set({ dismissedNav: [...dismissedNav, `${suggestion!.out}>${suggestion!.inn}`] })} />
              <Btn small style={{ flex: 1 }} title="Sostituisci" onPress={() => { set({ navItems: navItems.map((id) => (id === suggestion!.out ? suggestion!.inn : id)) }); toast('Barra di navigazione aggiornata'); }} />
            </Row>
          </Card>
        </View>
      )}
      <View accessibilityRole="tablist" style={{ backgroundColor: t.nav, borderTopWidth: 1, borderTopColor: t.navBorder, paddingTop: 10, paddingBottom: 10 + insets.bottom }}>
        <View style={{ flexDirection: 'row' }}>{navItems.map((id) => <View key={id} style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>{renderItem(id)}</View>)}</View>
      </View>
      <NavEditor visible={editing} onClose={() => setEditing(false)} />
    </View>
  );
}

export function MenuSheet() {
  const t = useTheme();
  const open = useUI((s) => s.menuOpen);
  const setMenu = useUI((s) => s.setMenu);
  const language = useApp((s) => s.language);
  const sn = sectionNamesFor(language);
  const tourMode = useTour((s) => s.mode), tourLevel = useTour((s) => s.level), tourAll = useTour((s) => s.allUnlocked);
  const groups = [
    { label: 'Principali', items: [['ai', 'LifeChat'], ['home', sn.home], ['plan', sn.plan]] },
    { label: 'Le tue sezioni', items: [['lifehealth', 'LifeHealth'], ['lifefitness', 'LifeFitness'], ['lifenetwork', 'LifeNetwork'], ['lifefinance', 'LifeFinance'], ['lifenotes', 'LifeNotes'], ['lifetravel', 'LifeTravel'], ['lifedrive', 'LifeDrive'], ['lifetask', 'LifeTask'], ['projects', 'Progetti'], ['lifepointsPage', 'LifePoints'], ['theiaPet', 'Theia, il gioco'], ['myServices', 'I tuoi servizi'], ['myClubs', 'I tuoi LifeClub']] },
    { label: 'Account', items: [['activity', 'La tua attività'], ['creatorStats', 'Le tue statistiche'], ['orders', 'I miei ordini'], ['savedPosts', 'Post salvati'], ['importSocial', 'Importa da un altro social'], ['help', 'Aiuto e domande'], ['settings', sn.settings]] },
  ];
  return (
    <Sheet visible={open} title={translate(language, 'menuTitle')} onClose={() => setMenu(false)}>
      <Press
        onPress={() => { setMenu(false); go('searchPage'); }}
        accessibilityLabel={translateText(sn.searchPage || 'Cerca')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: t.input, borderWidth: 1, borderColor: t.border, borderRadius: 14, marginBottom: 16 }}>
        <Icon name="search" size={17} color={t.text} />
        <Text style={{ color: t.muted }}>{sn.searchPage || 'Cerca'}</Text>
      </Press>
      {groups.map((g) => (
        <View key={g.label}>
          <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6, marginStart: 2 }}>{g.label}</Text>
          <View style={{ backgroundColor: t.input, borderWidth: 1, borderColor: t.border, borderRadius: 16, overflow: 'hidden' }}>
            {g.items.map(([id, label], i) => {
              const color = t.mode === 'light' ? t.accent : sectionColor(areaColors[id], t.accent);
              const locked = !isUnlocked({ mode: tourMode, level: tourLevel, allUnlocked: tourAll }, id);
              return (
                <Item key={id} last={i === g.items.length - 1} style={{ paddingHorizontal: 14, paddingVertical: 12 }} onPress={() => { setMenu(false); if (locked) requestUnlock(id); else go(id); }}>
                  <Row style={{ justifyContent: 'flex-start', opacity: locked ? 0.5 : 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      {id === 'theiaPet' ? <Mascot size={26} color={t.accent} animated={false} expression="happy" /> : <Icon name={id === 'creatorStats' ? 'chart' : id} size={17} color={color} stroke={1.9} />}
                    </View>
                    <Text style={{ color: t.text, fontWeight: '500', flex: 1 }}>{label}</Text>
                    {locked ? <Icon name="lock" size={16} color={t.muted} stroke={2.2} /> : <Chev />}
                  </Row>
                </Item>
              );
            })}
          </View>
        </View>
      ))}
    </Sheet>
  );
}
