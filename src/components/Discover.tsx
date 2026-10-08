import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, ModalToast, Press, Sheet, Toggle } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { dayIndex, featureCount, featureGroups, featureOfDay, guideMode, type Feature } from '@/data/features';
import { sendToAssistant } from '@/lib/assistant/run';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useDiscover } from '@/store/discover';

/** Apre la funzione (pagina o comando all'assistente). */
export function tryFeature(f: Feature) {
  useDiscover.getState().hide();
  setTimeout(() => {
    if (f.cmd) { void sendToAssistant(f.cmd); go('ai'); }
    else if (f.page) go(f.page);
  }, 150);
}

/**
 * All'apertura: nei primi 3 giorni la guida completa; poi, solo se attivo "showOnOpen", la sola funzione del giorno.
 * La guida completa resta riapribile dalla card in Home.
 */
export function DiscoverHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const open = useDiscover((s) => s.open);
  const mode = useDiscover((s) => s.mode);
  const showOnOpen = useDiscover((s) => s.showOnOpen);
  const reduce = useReduceMotion();
  const name = useApp((s) => s.account.name);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const d = useDiscover.getState();
    const now = Date.now();
    if (d.firstSeenAt == null) d.set({ firstSeenAt: now });
    const m = guideMode({ firstSeenAt: d.firstSeenAt, now, showOnOpen: d.showOnOpen, lastBiteDay: d.lastBiteDay });
    if (m === 'none') return;
    if (m === 'bite') d.set({ lastBiteDay: dayIndex(now) });
    d.show(m);
  }, []);

  const hide = () => useDiscover.getState().hide();
  const tryIt = tryFeature;

  if (mode === 'bite') {
    const f = featureOfDay();
    return (
      <Sheet visible={open} title="Funzione del giorno" onClose={hide}>
        <Text style={{ color: f.color, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{f.groupTitle}</Text>
        <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', marginTop: 4 }}>{f.title}</Text>
        <Body muted style={{ marginTop: 6, marginBottom: 14 }}>{f.text}</Body>
        <Btn title="Provalo" icon="arrow-right" onPress={() => tryIt(f)} />
        <Btn ghost title="Vedi tutte le funzioni" style={{ marginTop: 8 }} onPress={() => useDiscover.getState().show('full')} />
        <Toggle label="Mostra una funzione al giorno all'apertura" value={showOnOpen} onChange={(v) => useDiscover.getState().setShowOnOpen(v)} />
      </Sheet>
    );
  }

  return (
    <Modal visible={open} animationType={reduce ? 'none' : 'slide'} onRequestClose={hide} statusBarTranslucent>
      <ModalToast />
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 190 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>{name ? `CIAO ${name.toUpperCase()}` : 'BENVENUTO'}</Text>
          <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>Tutto quello che puoi fare con LifePilot</Text>
          <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 14 }}>{featureCount} funzioni in {featureGroups.length} aree. Tocca un’area per vedere cosa fa, poi “Provalo” per aprirla subito.</Text>
          {featureGroups.map((g) => {
            const on = openGroup === g.id;
            return (
              <View key={g.id} style={{ backgroundColor: t.card, borderColor: on ? g.color : t.border, borderWidth: on ? 1.5 : 1, borderRadius: 20, marginBottom: 10, overflow: 'hidden' }}>
                <Pressable onPress={() => setOpenGroup(on ? null : g.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: pressed ? 0.6 : 1 })} accessibilityRole="button" accessibilityState={{ expanded: on }} accessibilityLabel={`${g.title}: ${g.tagline}`}>
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
                    {g.items.map((f) => (
                      <View key={f.title} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.border }}>
                        <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{f.title}</Text>
                        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{f.text}</Text>
                        <Press onPress={() => tryIt(f)} accessibilityLabel={`Provalo: ${f.title}`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ alignSelf: 'flex-start', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: g.color + '2e', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 }}>
                          <Text style={{ color: t.mode === 'light' ? t.text : g.color, fontWeight: '800', fontSize: 13 }}>Provalo</Text>
                          <Icon name="arrow-right" size={14} color={t.mode === 'light' ? t.text : g.color} stroke={2.4} />
                        </Press>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bg, borderTopColor: t.border, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10 }}>
          <Toggle label="Dopo i primi 3 giorni, mostra una funzione al giorno all'apertura" value={showOnOpen} onChange={(v) => useDiscover.getState().setShowOnOpen(v)} />
          <Btn title="Inizia" icon="check" onPress={hide} />
        </View>
      </View>
    </Modal>
  );
}

/** Card compatta in Home: la funzione del giorno (cambia ogni giorno) + accesso alla guida completa. */
export function DiscoverCard() {
  const t = useTheme();
  const f = featureOfDay();
  return (
    <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent + '2a', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkle" size={20} color={t.accent} stroke={2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Funzione del giorno</Text>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{f.title}</Text>
        </View>
      </View>
      <Body small muted numberOfLines={2} style={{ marginTop: 8 }}>{f.text}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10 }}>
        <Btn small title="Provalo" icon="arrow-right" onPress={() => tryFeature(f)} />
        <Press onPress={() => useDiscover.getState().show('full')} accessibilityLabel={`Scopri tutte le ${featureCount} funzioni di LifePilot`} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
          <Text style={{ color: t.muted, fontSize: 13, textDecorationLine: 'underline' }}>Tutte le {featureCount} funzioni</Text>
        </Press>
      </View>
    </View>
  );
}
