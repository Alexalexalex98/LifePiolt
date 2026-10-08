import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, ModalToast, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { featureCount, featureGroups, type Feature } from '@/data/features';
import { sendToAssistant } from '@/lib/assistant/run';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useDiscover } from '@/store/discover';

/** All'apertura dell'app mette in evidenza tutto quello che si può fare. Ogni voce si prova con un tocco. */
export function DiscoverHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const open = useDiscover((s) => s.open);
  const showOnOpen = useDiscover((s) => s.showOnOpen);
  const name = useApp((s) => s.account.name);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (useDiscover.getState().showOnOpen) useDiscover.getState().show();
  }, []);

  const hide = () => useDiscover.getState().hide();
  function tryIt(f: Feature) {
    hide();
    setTimeout(() => {
      if (f.cmd) { void sendToAssistant(f.cmd); go('ai'); }
      else if (f.page) go(f.page);
    }, 150);
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={hide} statusBarTranslucent>
      <ModalToast />
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 150 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>{name ? `CIAO ${name.toUpperCase()}` : 'BENVENUTO'}</Text>
          <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>Tutto quello che puoi fare con LifePilot</Text>
          <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 14 }}>{featureCount} funzioni in {featureGroups.length} aree. Tocca un’area per vedere cosa fa, poi “Provalo” per aprirla subito.</Text>
          {featureGroups.map((g) => {
            const on = openGroup === g.id;
            return (
              <View key={g.id} style={{ backgroundColor: t.card, borderColor: on ? g.color : t.border, borderWidth: on ? 1.5 : 1, borderRadius: 20, marginBottom: 10, overflow: 'hidden' }}>
                <Pressable onPress={() => setOpenGroup(on ? null : g.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }} accessibilityRole="button" accessibilityLabel={`${g.title}: ${g.tagline}`}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: g.color + '2e', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={g.icon} size={22} color={g.color} stroke={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{g.title}</Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>{g.tagline}</Text>
                  </View>
                  <View style={{ backgroundColor: g.color + '2e', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: g.color, fontWeight: '800', fontSize: 12 }}>{g.items.length}</Text></View>
                  <View style={{ transform: [{ rotate: on ? '90deg' : '0deg' }] }}><Icon name="chevron" size={16} color={t.muted} stroke={2.2} /></View>
                </Pressable>
                {on && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
                    {g.items.map((f, i) => (
                      <View key={f.title} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                        <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{f.title}</Text>
                        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{f.text}</Text>
                        <Pressable onPress={() => tryIt(f)} style={{ alignSelf: 'flex-start', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: g.color + '2e', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }} accessibilityLabel={`Provalo: ${f.title}`}>
                          <Text style={{ color: g.color, fontWeight: '800', fontSize: 13 }}>Provalo</Text>
                          <Icon name="arrow-right" size={14} color={g.color} stroke={2.4} />
                        </Pressable>
                        {i === g.items.length - 1 ? null : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bg, borderTopColor: t.border, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10 }}>
          <Toggle label="Mostra questa guida a ogni apertura" value={showOnOpen} onChange={(v) => useDiscover.getState().setShowOnOpen(v)} />
          <Btn title="Inizia" icon="check" onPress={hide} />
        </View>
      </View>
    </Modal>
  );
}

/** Card per riaprire la guida in qualsiasi momento. */
export function DiscoverCard() {
  const t = useTheme();
  return (
    <Pressable onPress={() => useDiscover.getState().show()} style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityRole="button" accessibilityLabel="Scopri tutto quello che puoi fare con LifePilot">
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent + '2a', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkle" size={20} color={t.accent} stroke={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>Scopri tutto quello che puoi fare</Text>
        <Body small muted>{featureCount} funzioni da provare con un tocco</Body>
      </View>
      <Icon name="chevron" size={16} color={t.muted} stroke={2.2} />
    </Pressable>
  );
}
