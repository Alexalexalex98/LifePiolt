import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, Card, Row, Sheet, Item, Chev, Press } from '@/components/ui';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useTheme } from '@/hooks/use-theme';
import { translate, sectionNamesFor } from '@/lib/i18n';
import { Icon, areaColors } from '@/lib/icons';
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

const NAV_MAX = 6;
const navChoices = ['home', 'ai', 'plan', 'lifenetwork', 'lifefinance', 'profile', 'lifehealth', 'lifefitness', 'lifenotes', 'lifetravel', 'lifedrive', 'lifetask', 'lifepointsPage', 'settings'];

function NavEditSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { navItems, language, set } = useApp();
  const move = (i: number, d: number) => { const a = navItems.slice(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ navItems: a }); };
  const remove = (id: string) => { if (id === 'home' || navItems.length <= 2) return; set({ navItems: navItems.filter((x) => x !== id) }); };
  const add = (id: string) => { if (navItems.length >= NAV_MAX) { toast('La barra può avere al massimo 6 icone'); return; } set({ navItems: [...navItems, id] }); };
  const avail = navChoices.filter((id) => !navItems.includes(id));
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 10 };
  const small = { width: 36, height: 36, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: t.input, borderWidth: 1, borderColor: t.border };
  return (
    <Sheet visible={visible} title="Personalizza la barra" onClose={onClose}>
      <Body small style={{ marginBottom: 8 }}>Scegli fino a 6 icone e spostale con le frecce. Home resta sempre in barra.</Body>
      <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8 }}>{`In barra (${navItems.length}/${NAV_MAX})`}</Text>
      {navItems.map((id, i) => (
        <View key={id} style={row}>
          <Icon name={id} size={20} color={t.text} />
          <Text style={{ color: t.text, flex: 1, fontWeight: '500' }}>{navLabelFor(id, language)}</Text>
          <Press onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel="Sposta a sinistra" style={[small, i === 0 && { opacity: 0.35 }]}><View style={{ transform: [{ rotate: '90deg' }] }}><Chev /></View></Press>
          <Press onPress={() => move(i, 1)} disabled={i === navItems.length - 1} accessibilityLabel="Sposta a destra" style={[small, i === navItems.length - 1 && { opacity: 0.35 }]}><View style={{ transform: [{ rotate: '-90deg' }] }}><Chev /></View></Press>
          <Press onPress={() => remove(id)} disabled={id === 'home'} accessibilityLabel="Togli dalla barra" style={[small, id === 'home' && { opacity: 0.35 }]}><Icon name="x" size={14} color={t.text} stroke={2.4} /></Press>
        </View>
      ))}
      {avail.length > 0 && <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14 }}>Aggiungi alla barra</Text>}
      {avail.map((id) => (
        <View key={id} style={row}>
          <Icon name={id} size={20} color={t.text} />
          <Text style={{ color: t.text, flex: 1, fontWeight: '500' }}>{navLabelFor(id, language)}</Text>
          <Press onPress={() => add(id)} accessibilityLabel="Aggiungi alla barra" style={[small, navItems.length >= NAV_MAX && { opacity: 0.35 }]}><Icon name="plus" size={14} color={t.text} stroke={2.4} /></Press>
        </View>
      ))}
      <Btn title="Fatto" onPress={onClose} style={{ marginTop: 14 }} />
    </Sheet>
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
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: t.nav, borderTopWidth: 1, borderTopColor: t.navBorder, paddingTop: 10, paddingBottom: 10 + insets.bottom }}>
        {navItems.map((id) => {
          const active = id === current;
          const locked = lockedPage(id);
          const ink = locked ? t.muted : active ? t.text : t.navInactive;
          return (
            <TourTarget key={id} id={`nav.${id}`}>
              <Press onPress={() => (locked ? requestUnlock(id) : go(id))} onLongPress={() => setEditing(true)} role="tab" selected={active} accessibilityLabel={translateText(navLabelFor(id, language)) + (locked ? translateText(', si sblocca presto') : '')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} style={{ alignItems: 'center', minWidth: navItems.length > 5 ? 48 : 56, minHeight: 44, justifyContent: 'center', opacity: locked ? 0.5 : 1 }}>
                {active && <View style={{ position: 'absolute', top: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: t.accent }} />}
                <View>
                  <Icon name={id} size={20} color={ink} />
                  {locked && <View style={{ position: 'absolute', end: -7, bottom: -4, backgroundColor: t.nav, borderRadius: 7, padding: 1 }}><Icon name="lock" size={11} color={t.text} stroke={2.4} /></View>}
                </View>
                <Text style={{ color: ink, fontSize: 11, marginTop: 2, fontWeight: active ? '700' : '400' }}>{navLabelFor(id, language)}</Text>
              </Press>
            </TourTarget>
          );
        })}
      </View>
      <NavEditSheet visible={editing} onClose={() => setEditing(false)} />
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
    { label: 'Le tue sezioni', items: [['lifehealth', 'LifeHealth'], ['lifefitness', 'LifeFitness'], ['lifenetwork', 'LifeNetwork'], ['lifefinance', 'LifeFinance'], ['lifenotes', 'LifeNotes'], ['lifetravel', 'LifeTravel'], ['lifedrive', 'LifeDrive'], ['lifetask', 'LifeTask'], ['lifepointsPage', 'LifePoints'], ['myServices', 'I tuoi servizi'], ['myClubs', 'I tuoi LifeClub']] },
    { label: 'Account', items: [['activity', 'La tua attività'], ['orders', 'I miei ordini'], ['savedPosts', 'Post salvati'], ['importSocial', 'Importa da un altro social'], ['help', 'Aiuto e domande'], ['settings', sn.settings]] },
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
              const color = t.mode === 'light' ? t.accent : (areaColors[id] ?? t.accent);
              const locked = !isUnlocked({ mode: tourMode, level: tourLevel, allUnlocked: tourAll }, id);
              return (
                <Item key={id} last={i === g.items.length - 1} style={{ paddingHorizontal: 14, paddingVertical: 12 }} onPress={() => { setMenu(false); if (locked) requestUnlock(id); else go(id); }}>
                  <Row style={{ justifyContent: 'flex-start', opacity: locked ? 0.5 : 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={id} size={17} color={color} stroke={1.9} />
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
