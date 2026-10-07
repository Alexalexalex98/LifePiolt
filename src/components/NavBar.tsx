import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, Card, Row, Sheet, Item, Chev } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translate, sectionNamesFor } from '@/lib/i18n';
import { Icon, areaColors } from '@/lib/icons';
import { go } from '@/lib/nav';
import { navCatalog, useApp } from '@/store/app';
import { toast } from '@/store/toast';
import { useUI } from '@/components/ui';

const translatedNav: Record<string, string> = { home: 'navHome', ai: 'navAi', lifenetwork: 'navNetwork', lifefinance: 'navFinance', profile: 'navProfile' };

export function navLabelFor(id: string, language: Parameters<typeof translate>[0]) {
  if (translatedNav[id]) return translate(language, translatedNav[id]);
  return sectionNamesFor(language)[id] || navCatalog[id] || id;
}

export function NavBar({ state }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { navItems, pageVisits, dismissedNav, language, set } = useApp();
  const current = state.routes[state.index]?.name === 'index' ? 'home' : state.routes[state.index]?.name;

  // suggerimento: scambia la voce meno usata con la più visitata fuori barra
  let suggestion: { out: string; inn: string } | null = null;
  const nonNav = Object.keys(navCatalog).filter((id) => !navItems.includes(id)).sort((a, b) => (pageVisits[b] || 0) - (pageVisits[a] || 0));
  const best = nonNav[0];
  if (best && (pageVisits[best] || 0) >= 8) {
    const weakest = navItems.filter((id) => id !== 'home').sort((a, b) => (pageVisits[a] || 0) - (pageVisits[b] || 0))[0];
    if (weakest && (pageVisits[best] || 0) > (pageVisits[weakest] || 0) * 1.5 && !dismissedNav.includes(`${weakest}>${best}`)) suggestion = { out: weakest, inn: best };
  }

  return (
    <View>
      {suggestion && (
        <View style={{ position: 'absolute', bottom: 74 + insets.bottom, left: 16, right: 16, zIndex: 6 }}>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: t.nav, borderTopWidth: 1, borderTopColor: t.navBorder, paddingTop: 10, paddingBottom: 10 + insets.bottom }}>
        {navItems.map((id) => {
          const active = id === current;
          return (
            <Pressable key={id} onPress={() => go(id)} style={{ alignItems: 'center', minWidth: 56 }} accessibilityRole="button" accessibilityState={{ selected: active }}>
              {active && <View style={{ position: 'absolute', top: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#8fa4ff' }} />}
              <Icon name={id} size={20} color={active ? t.text : '#8792a2'} />
              <Text style={{ color: active ? t.text : '#8792a2', fontSize: 11, marginTop: 2 }}>{navLabelFor(id, language)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MenuSheet() {
  const t = useTheme();
  const open = useUI((s) => s.menuOpen);
  const setMenu = useUI((s) => s.setMenu);
  const language = useApp((s) => s.language);
  const sn = sectionNamesFor(language);
  const groups = [
    { label: 'Principali', items: [['ai', 'LifeChat'], ['home', sn.home], ['plan', sn.plan]] },
    { label: 'Le tue sezioni', items: [['lifehealth', 'LifeHealth'], ['lifenetwork', 'LifeNetwork'], ['lifefinance', 'LifeFinance'], ['lifenotes', 'LifeNotes'], ['lifetravel', 'LifeTravel'], ['lifedrive', 'LifeDrive'], ['lifetask', 'LifeTask'], ['lifepointsPage', 'LifePoints']] },
    { label: 'Account', items: [['settings', sn.settings]] },
  ];
  return (
    <Sheet visible={open} title={translate(language, 'menuTitle')} onClose={() => setMenu(false)}>
      <Pressable
        onPress={() => { setMenu(false); go('searchPage'); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: t.input, borderWidth: 1, borderColor: t.border, borderRadius: 14, marginBottom: 16 }}>
        <Icon name="search" size={17} color={t.text} />
        <Text style={{ color: t.muted }}>{sn.searchPage || 'Cerca'}</Text>
      </Pressable>
      {groups.map((g) => (
        <View key={g.label}>
          <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6, marginLeft: 2 }}>{g.label}</Text>
          <View style={{ backgroundColor: t.input, borderWidth: 1, borderColor: t.border, borderRadius: 16, overflow: 'hidden' }}>
            {g.items.map(([id, label], i) => {
              const color = areaColors[id] ?? '#8fa4ff';
              return (
                <Item key={id} last={i === g.items.length - 1} style={{ paddingHorizontal: 14, paddingVertical: 12 }} onPress={() => { setMenu(false); go(id); }}>
                  <Row style={{ justifyContent: 'flex-start' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={id} size={17} color={color} stroke={1.9} />
                    </View>
                    <Text style={{ color: t.text, fontWeight: '500', flex: 1 }}>{label}</Text>
                    <Chev />
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
