import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Text, TextInput } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { NATIVE, PressScale } from './parts';

/** Testata minimale: titolo, ricerca (icona -> campo che si espande) e saldo LifePoints come pillola cliccabile. */
export function NetHeader({ balance, query, onQuery, placeholder }: { balance: number; query: string; onQuery: (v: string) => void; placeholder: string }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const narrow = useWindowDimensions().width < 360;
  const [open, setOpen] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) a.setValue(open ? 1 : 0);
    else Animated.timing(a, { toValue: open ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [open, reduce, a]);
  const close = () => { setOpen(false); onQuery(''); };
  if (open) {
    return (
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.input, borderRadius: 999, paddingHorizontal: 16, minHeight: 46, borderWidth: 1, borderColor: t.inputBorder }}>
          <Icon name="search" size={18} color={t.muted} />
          <TextInput autoFocus value={query} onChangeText={onQuery} placeholder={placeholder} placeholderTextColor={t.muted} accessibilityLabel={translateText('Cerca persone su LifeNetwork…')} style={{ flex: 1, color: t.text, fontSize: 16, paddingVertical: 8, outlineStyle: 'none' } as never} returnKeyType="search" />
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={translateText('Chiudi la ricerca')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={22} color={t.text} stroke={2.1} /></Pressable>
      </Animated.View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 8 }}>
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: t.text, fontSize: narrow ? 23 : 28, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 }}>LifeNetwork</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={translateText('Cerca persone su LifeNetwork…')} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Icon name="search" size={23} color={t.text} stroke={2} /></Pressable>
        <PressScale onPress={() => go('lifepointsPage')} label={`${translateText('Il tuo saldo')}: ${formatCHF(balance)} LifePoints`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: narrow ? 10 : 13, borderRadius: 999, backgroundColor: t.chip }}>
          <Icon name="coin" size={18} color={t.accent} stroke={1.9} />
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{formatCHF(balance)}</Text>
        </PressScale>
      </View>
    </View>
  );
}

/** Schede come segmented control scorrevole, con indicatore attivo animato e aree di tocco di 44px. */
export function NetTabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const pos = useRef<Record<string, { x: number; w: number }>>({}).current;
  const sv = useRef<ScrollView>(null);
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const move = (k: string) => {
    const p = pos[k];
    if (!p) return;
    if (!ready || reduce) { x.setValue(p.x); w.setValue(p.w); setReady(true); }
    else Animated.parallel([
      Animated.timing(x, { toValue: p.x, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(w, { toValue: p.w, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    sv.current?.scrollTo({ x: Math.max(0, p.x - 40), animated: !reduce });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { move(value); }, [value]);
  const onLay = (k: string) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    pos[k] = { x: lx, w: width };
    if (k === value) { x.setValue(lx); w.setValue(width); setReady(true); }
  };
  return (
    <View style={{ borderRadius: 999, backgroundColor: t.chip, overflow: 'hidden', marginTop: 8 }}>
      <ScrollView ref={sv} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" accessibilityRole="tablist" contentContainerStyle={{ padding: 3 }}>
        <View style={{ flexDirection: 'row' }}>
          {ready && <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: x, width: w, borderRadius: 999, backgroundColor: t.text }} />}
          {tabs.map((tab) => {
            const on = tab.key === value;
            return (
              <Pressable key={tab.key} onLayout={onLay(tab.key)} onPress={() => onChange(tab.key)} accessibilityRole="tab" accessibilityLabel={translateText(tab.label)} accessibilityState={{ selected: on }} style={{ minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: on ? t.onText : t.muted, fontSize: 14, fontWeight: on ? '800' : '600' }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** Riga "Cosa vuoi condividere?" con avatar, in stile compositore. Il tocco apre il compositore esistente. */
export function Composer({ me, onPress, onPhoto }: { me: string; onPress: () => void; onPhoto?: () => void }) {
  const t = useTheme();
  const narrow = useWindowDimensions().width < 340;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
      <UserAvatar name={me} size={38} />
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={translateText('Cosa vuoi condividere?')} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: t.border, backgroundColor: t.cardAlt, justifyContent: 'center', paddingHorizontal: 16, opacity: pressed ? 0.7 : 1 })}>
        <Text numberOfLines={1} style={{ color: t.muted, fontSize: 15 }}>Cosa vuoi condividere?</Text>
      </Pressable>
      {!narrow && <Pressable onPress={onPhoto ?? onPress} accessibilityRole="button" accessibilityLabel={translateText('Nuovo post')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={24} color={t.accent} stroke={1.9} /></Pressable>}
    </View>
  );
}

/** Interruttore discreto "Per te / Seguiti". */
export function FilterToggle({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 18, paddingHorizontal: 16 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityLabel={translateText(o.label)} accessibilityState={{ selected: on }} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: on ? t.text : t.muted, fontSize: 15, fontWeight: on ? '800' : '600' }}>{o.label}</Text>
            <View style={{ height: 2.5, borderRadius: 2, marginTop: 4, backgroundColor: on ? t.accent : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Scheletro di caricamento (finché i dati salvati non sono pronti): forma del post, pulsazione dolce. */
export function FeedSkeleton({ width }: { width: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const a = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: NATIVE }), Animated.timing(a, { toValue: 0.55, duration: 800, useNativeDriver: NATIVE })]));
    loop.start();
    return () => loop.stop();
  }, [reduce, a]);
  const bone = (wd: number | string, h: number, r = 8) => <View style={{ width: wd as number, height: h, borderRadius: r, backgroundColor: t.item }} />;
  return (
    <Animated.View accessibilityLabel={translateText('Caricamento in corso')} accessibilityRole="progressbar" style={{ opacity: a }}>
      {[0, 1].map((i) => (
        <View key={i} style={{ marginBottom: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 }}>
            {bone(48, 48, 24)}
            <View style={{ gap: 7 }}>{bone(130, 13)}{bone(80, 10)}</View>
          </View>
          <View style={{ width, height: width * (i ? 0.86 : 1), backgroundColor: t.item }} />
          <View style={{ padding: 14, gap: 9 }}>{bone(110, 13)}{bone('90%', 12)}{bone('60%', 12)}</View>
        </View>
      ))}
    </Animated.View>
  );
}

/** Stato vuoto del feed, con un'azione chiara. */
export function EmptyFeed({ following, onCompose }: { following: boolean; onCompose: () => void }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 10 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}><Icon name={following ? 'users' : 'sparkle'} size={34} color={t.accent} stroke={1.7} /></View>
      <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', textAlign: 'center' }}>{following ? 'Nessun post da chi segui, per ora.' : 'Ancora nessun post'}</Text>
      <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{following ? 'Torna su "Per te" per scoprire nuove persone da seguire.' : 'Segui qualcuno o scrivi il primo.'}</Text>
      <Pressable onPress={onCompose} accessibilityRole="button" accessibilityLabel={translateText('Nuovo post')} style={({ pressed }) => ({ marginTop: 10, minHeight: 48, paddingHorizontal: 24, borderRadius: 16, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1 })}>
        <Icon name="plus" size={18} color={t.onText} stroke={2.4} /><Text style={{ color: t.onText, fontSize: 15, fontWeight: '800' }}>Nuovo post</Text>
      </Pressable>
    </View>
  );
}
