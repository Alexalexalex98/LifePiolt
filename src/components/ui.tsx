import { DEFAULT_USER_PHOTO, LOGO, LP_ICON_B, LP_ICON_W } from '@/lib/embeddedAssets';
import { onPageRefresh } from '@/lib/pageRefresh';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Text, TextInput } from '@/components/T';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { BOTTOM_CLEARANCE, MIN_HIT, radius, space, type as fs } from '@/constants/theme';
import { KeyboardDock } from '@/components/KeyboardDock';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { growHeight, restingBottom, sheetMaxHeight } from '@/lib/keyboardInset';
import { useTheme } from '@/hooks/use-theme';
import { useSectionNames } from '@/lib/i18n';
import { readable } from '@/lib/a11y';
import { log } from '@/lib/log';
import { areaColors, Icon } from '@/lib/icons';
import { sectionColor } from '@/lib/liveTheme';
import { goBack, go, isFreshForward } from '@/lib/nav';
import { useApp } from '@/store/app';
import { installTextScale } from '@/lib/textScale';
import { translateText } from '@/i18n/core';
import { toast, useToast } from '@/store/toast';

// "Testo più grande" vale per tutti i <Text> dell'app (vedi lib/textScale.ts)
installTextScale();

/* ---------- tocchi sicuri ---------- */
function failed(e: unknown) {
  log.warn('ui', 'Azione fallita in un pulsante', e);
  toast('Qualcosa non ha funzionato');
}
/**
 * Avvolge un handler: se lancia (anche in modo asincrono) l'utente vede un avviso invece di un pulsante "morto".
 */
export function safely<A extends unknown[]>(fn?: (...a: A) => unknown): ((...a: A) => void) | undefined {
  if (!fn) return undefined;
  return (...a: A) => {
    try {
      const r = fn(...a);
      if (r && typeof (r as Promise<unknown>).then === 'function') (r as Promise<unknown>).then(undefined, failed);
    } catch (e) { failed(e); }
  };
}
/** Area tattile allargata per elementi più bassi di 44pt. */
export const hit = (h: number, w = h) => ({ top: Math.max(0, Math.ceil((MIN_HIT - h) / 2)), bottom: Math.max(0, Math.ceil((MIN_HIT - h) / 2)), left: Math.max(0, Math.ceil((MIN_HIT - w) / 2)), right: Math.max(0, Math.ceil((MIN_HIT - w) / 2)) });

/**
 * Pulsante di base di tutta l'app: feedback immediato (opacità), handler protetto da eccezioni, ruolo/stato accessibili.
 * Btn, Pill, Item, Card, XBtn, Seg e TabRow lo usano: cambiare qui cambia ovunque.
 */
export function Press({ children, onPress, onLongPress, style, hitSlop, disabled, accessibilityLabel, selected, role = 'button', feedback = 0.55 }: {
  children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; hitSlop?: { top: number; bottom: number; left: number; right: number };
  disabled?: boolean; accessibilityLabel?: string; selected?: boolean; role?: 'button' | 'tab' | 'link'; feedback?: number;
}) {
  return (
    <Pressable
      onPress={safely(onPress)}
      onLongPress={safely(onLongPress)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel) : accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...(selected != null ? { selected } : null) }}
      style={({ pressed }) => [style, pressed && !disabled && { opacity: feedback }]}>
      {children}
    </Pressable>
  );
}

/* ---------- stato UI globale (menu) ---------- */
export const useUI = create<{ menuOpen: boolean; setMenu: (v: boolean) => void; payOpen: boolean; setPay: (v: boolean) => void; badges: { msg: number; notif: number }; setBadges: (b: { msg: number; notif: number }) => void }>((set) => ({
  menuOpen: false,
  setMenu: (v) => set({ menuOpen: v }),
  payOpen: false,
  setPay: (v) => set({ payOpen: v }),
  badges: { msg: 0, notif: 0 },
  setBadges: (badges) => set({ badges }),
}));

/* ---------- pagina con barra superiore ---------- */
function TopBar({ page, fallback }: { page: string; /** nome da mostrare accanto al logo se la sezione non ne ha uno suo */ fallback?: string }) {
  const t = useTheme();
  const names = useSectionNames();
  const badges = useUI((s) => s.badges);
  const setMenu = useUI((s) => s.setMenu);
  const tag = names[page === 'index' ? 'home' : page] || fallback || '';
  const Badge = ({ n, bg }: { n: number; bg: string }) =>
    n > 0 ? (
      <View style={{ position: 'absolute', top: 4, end: 2, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }} pointerEvents="none">
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{n}</Text>
      </View>
    ) : null;
  return (
    <View style={s.top}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
        <Image source={LOGO} style={{ height: 30, width: 30, ...(t.mode === 'light' ? { tintColor: '#10151d' } : null) }} resizeMode="contain" accessibilityLabel="LifePilot" />
        <Text accessibilityRole="header" numberOfLines={1} style={{ color: t.mode === 'light' ? t.text : sectionColor(areaColors[page], t.text), fontSize: 16, fontWeight: '700', flexShrink: 1 }}>{tag}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Press style={s.menuBtn} onPress={() => go('messagesPage')} accessibilityLabel={badges.msg > 0 ? `Messaggi, ${badges.msg} da leggere` : 'Messaggi'}>
          <Icon name="send" size={19} color={t.text} /><Badge n={badges.msg} bg="#2f5fd0" />
        </Press>
        <Press style={s.menuBtn} onPress={() => go('notificationsPage')} accessibilityLabel={badges.notif > 0 ? `Notifiche, ${badges.notif} nuove` : 'Notifiche'}>
          <Icon name="bell" size={19} color={t.text} /><Badge n={badges.notif} bg="#d23535" />
        </Press>
        <Press style={s.menuBtn} onPress={() => setMenu(true)} accessibilityLabel="Menu">
          <Icon name="menu" size={21} color={t.text} />
        </Press>
      </View>
    </View>
  );
}

/** posizione di scorrimento per pagina+parametri: aprendo una pagina si parte dall'alto, tornando indietro si ritrova il punto */
const scrollMemory = new Map<string, number>();
/** nelle chat (con persone e con l'AI) si resta dove si era */
const KEEP_SCROLL = ['ai', 'conversationPage'];

const MAIN_TABS = ['index', 'home', 'ai', 'lifenetwork', 'lifefinance', 'profile'];

export function Page({ id, title, back, children, right, scroll = true, noTop }: {
  id: string; title?: string; back?: boolean; children: ReactNode; right?: ReactNode; scroll?: boolean; noTop?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const trackVisit = useApp((a) => a.trackVisit);
  useEffect(() => { trackVisit(id === 'index' ? 'home' : id); }, [id, trackVisit]);
  // il pulsante indietro compare da solo su ogni pagina aperta con go() (non sulle 5 tab principali)
  const showBack = !MAIN_TABS.includes(id) && (back ?? !noTop);
  // il nome della sezione sta già accanto al logo: non lo ripeto come titolo grande
  const names = useSectionNames();
  const tag = names[id === 'index' ? 'home' : id] || (title ? translateText(title) : '');
  const sameAsTag = !!title && !!tag && translateText(title).trim().toLowerCase() === tag.trim().toLowerCase();
  const params = useLocalSearchParams();
  const memKey = id + JSON.stringify(params);
  const scrollRef = useRef<ScrollView>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  /* doppio tocco sull'icona della barra: in cima e pagina ricaricata */
  useEffect(() => onPageRefresh(id, () => { scrollRef.current?.scrollTo({ y: 0, animated: true }); scrollMemory.set(memKey, 0); setRefreshTick((n) => n + 1); }), [id, memKey]);
  const keep = KEEP_SCROLL.includes(id);
  useFocusEffect(useCallback(() => {
    if (keep) return;
    const y = isFreshForward() ? 0 : scrollMemory.get(memKey) ?? 0;
    const tm = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(tm);
  }, [memKey, keep]));
  const body = (
    <>
      {!noTop && <TopBar page={id} fallback={title ? translateText(title) : undefined} />}
      {(showBack || (sameAsTag && right)) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: sameAsTag ? 10 : 0, gap: 10 }}>
          {showBack ? (
            <Press onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 14 }} accessibilityLabel="Indietro" style={{ alignSelf: 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: t.chip }}><Icon name="arrow-left" size={16} color={t.text} stroke={2.2} /><Text style={{ color: t.text, fontSize: fs.small, fontWeight: '600' }}>Indietro</Text></View>
            </Press>
          ) : <View />}
          {sameAsTag ? right : null}
        </View>
      )}
      {title && !sameAsTag && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: fs.title, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 }}>{title}</Text>
          {right}
        </View>
      )}
      <Fragment key={refreshTick}>{children}</Fragment>
    </>
  );
  return (
    <KeyboardDock style={{ backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView ref={scrollRef} onScroll={keep ? undefined : (e) => scrollMemory.set(memKey, e.nativeEvent.contentOffset.y)} scrollEventThrottle={100} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + 10, paddingBottom: BOTTOM_CLEARANCE }} keyboardShouldPersistTaps="handled">{body}</ScrollView>
      ) : (
        <View style={{ flex: 1, padding: space.lg, paddingTop: insets.top + 10 }}>{body}</View>
      )}
    </KeyboardDock>
  );
}

/* ---------- elementi base ---------- */
export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string }) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [s.card, { backgroundColor: t.card, borderColor: t.border }, accent ? { borderStartWidth: 3, borderStartColor: accent } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Press onPress={onPress} style={base}>{children}</Press>;
}

export function H({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ color: t.text, fontSize: fs.lead, fontWeight: '700', marginBottom: 8 }, style]}>{children}</Text>;
}

export function Body({ children, muted, small, bold, color, style, onPress, numberOfLines }: {
  children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; color?: string; style?: StyleProp<TextStyle>; onPress?: () => void; numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text onPress={safely(onPress)} numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.text), fontSize: small ? fs.small : fs.body, lineHeight: small ? 18 : 21, fontWeight: bold ? '700' : '400' }, style]}>
      {children}
    </Text>
  );
}

/** Riga con icona SVG + testo (al posto delle emoji). */
export function IL({ icon, children, color, small, bold, muted }: { icon: string; children: ReactNode; color?: string; small?: boolean; bold?: boolean; muted?: boolean }) {
  const t = useTheme();
  const c = color ?? (muted ? t.muted : t.text);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
      {icon === 'lp'
        ? <Image source={t.mode === 'light' ? LP_ICON_B : LP_ICON_W} style={{ width: small ? 14 : 17, height: small ? 17 : 21 }} resizeMode="contain" accessibilityLabel="LifePoints" />
        : <Icon name={icon} size={small ? 16 : 19} color={c} stroke={1.9} />}
      <Body small={small} bold={bold} color={c} style={{ flexShrink: 1 }}>{children}</Body>
    </View>
  );
}

/** Freccia "vai" a destra (al posto del carattere ›). */
export function Chev({ color }: { color?: string }) {
  const t = useTheme();
  return <Icon name="chevron-right" size={16} color={color ?? t.muted} stroke={2} />;
}

/** Pulsante "rimuovi" con icona X (al posto del carattere ×). */
export function XBtn({ onPress, label = 'Rimuovi', color }: { onPress: () => void; label?: string; color?: string }) {
  const t = useTheme();
  return <Press onPress={onPress} hitSlop={hit(17)} accessibilityLabel={label}><Icon name="x" size={17} color={color ?? t.danger} stroke={2.1} /></Press>;
}

type Tone = 'default' | 'danger' | 'warn' | 'accent';
const toneColor = (t: ReturnType<typeof useTheme>, tone: Tone | undefined, active?: boolean) => (tone === 'danger' ? t.danger : tone === 'warn' || active ? '#ffb84f' : tone === 'accent' ? t.accent : t.text);

/** Pulsante tondo con icona (stella, campanella, cestino...): al posto dei link di testo nelle righe. */
export function IconBtn({ icon, onPress, label, tone, active, size = 38, fill }: { icon: string; onPress: () => void; label: string; tone?: Tone; active?: boolean; size?: number; fill?: boolean }) {
  const t = useTheme();
  const col = toneColor(t, tone, active);
  const bg = tone === 'danger' ? t.danger + '1f' : active ? col + '26' : t.chip;
  return (
    <Press onPress={onPress} accessibilityLabel={translateText(label)} hitSlop={hit(size)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.47)} color={col} fill={fill || active ? col : 'none'} stroke={2} />
    </Press>
  );
}

/** Pillola con icona e testo breve («Modifica», «Elimina»), al posto dei link di testo. */
export function ChipBtn({ icon, title, onPress, tone }: { icon?: string; title: string; onPress: () => void; tone?: Tone }) {
  const t = useTheme();
  const col = toneColor(t, tone);
  return (
    <Press onPress={onPress} accessibilityLabel={translateText(title)} hitSlop={hit(34)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: tone === 'danger' ? t.danger + '1f' : t.chip }}>
      {icon ? <Icon name={icon} size={15} color={col} stroke={2} /> : null}
      <Text style={{ color: col, fontSize: 13, fontWeight: '700' }}>{title}</Text>
    </Press>
  );
}

/** Riga-scheda arrotondata con una barra colorata a sinistra: per impegni, vacanze e simili. */
export function RowCard({ color, children, style, onPress }: { color?: string; children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const st: StyleProp<ViewStyle> = [{ flexDirection: 'row', borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, overflow: 'hidden', marginBottom: 10 }, style];
  const body = (<><View style={{ width: 5, backgroundColor: color ?? t.accent }} /><View style={{ flex: 1, padding: 12 }}>{children}</View></>);
  return onPress ? <Press onPress={onPress} style={st} feedback={0.6}>{body}</Press> : <View style={st}>{body}</View>;
}

export function Tag({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.item }}>{children}</Text>
  );
}

export function Metric({ children, big, color }: { children: ReactNode; big?: boolean; color?: string }) {
  const t = useTheme();
  return <Text style={{ color: color ?? t.text, fontSize: big ? 40 : fs.title, fontWeight: big ? '800' : '700' }}>{children}</Text>;
}

export function Row({ children, style, gap = 12 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap }, style]}>{children}</View>;
}

export function Item({ children, style, onPress, last }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; last?: boolean }) {
  const t = useTheme();
  const st: StyleProp<ViewStyle> = [{ paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.item }, style];
  return onPress ? <Press onPress={onPress} style={st} feedback={0.5}>{children}</Press> : <View style={st}>{children}</View>;
}

export function Btn({ title, onPress, ghost, small, danger, disabled, style, tone, icon, label }: {
  title: string; icon?: string; label?: string; onPress: () => void; ghost?: boolean; small?: boolean; danger?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; tone?: 'buy' | 'sell';
}) {
  const t = useTheme();
  let bg = t.text, fg = t.onText, border: string | undefined;
  if (ghost) { bg = 'transparent'; fg = danger ? t.danger : t.text; border = t.border; }
  else if (danger) { bg = t.dangerBg; fg = t.danger; }
  if (tone === 'buy') { bg = t.positiveBg; fg = t.positive; }
  if (tone === 'sell') { bg = t.dangerBg; fg = t.danger; }
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={title || label}
      hitSlop={small ? hit(36) : undefined}
      style={[
        { backgroundColor: bg, borderRadius: small ? radius.sm : radius.md, minHeight: small ? 36 : MIN_HIT, paddingVertical: small ? 8 : 12, paddingHorizontal: small ? 12 : 14, alignItems: 'center', justifyContent: 'center' },
        border ? { borderWidth: 1, borderColor: border } : null,
        disabled && { opacity: 0.4 },
        style,
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={small ? 14 : 17} color={fg} stroke={2.1} /> : null}
        {title ? <Text numberOfLines={1} style={{ color: fg, fontWeight: '700', fontSize: small ? 12 : fs.body, flexShrink: 1 }}>{title}</Text> : null}
      </View>
    </Press>
  );
}

export function Pill({ label, on, onPress, off, color, icon }: { label: string; icon?: string; on?: boolean; onPress?: () => void; off?: boolean; color?: string }) {
  const t = useTheme();
  const tone = color ? readable(color, t.chip) : t.text;
  return (
    <Press onPress={off ? undefined : onPress} disabled={off} accessibilityLabel={label} selected={on} hitSlop={{ top: 7, bottom: 7, left: 3, right: 3 }} style={[s.pill, { backgroundColor: on ? t.text : t.chip, opacity: off ? 0.4 : 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon ? <Icon name={icon} size={13} color={on ? t.bg : tone} stroke={2} /> : null}
        <Text style={{ color: on ? t.bg : tone, fontSize: 12, fontWeight: on ? '700' : '500' }}>{label}</Text>
      </View>
    </Press>
  );
}

export function Link({ children, onPress, danger, color }: { children: ReactNode; onPress: () => void; danger?: boolean; color?: string }) {
  const t = useTheme();
  const [down, setDown] = useState(false);
  return (
    <Text
      onPress={safely(onPress)} onPressIn={() => setDown(true)} onPressOut={() => setDown(false)} suppressHighlighting accessibilityRole="link"
      style={{ color: color ?? (danger ? t.danger : t.muted), fontSize: fs.small, textDecorationLine: danger ? 'none' : 'underline', opacity: down ? 0.5 : 1, paddingVertical: 4 }}>
      {children}
    </Text>
  );
}

export function Input(props: TextInputProps & { flex?: number; /** se presente il campo cresce con il testo fino a questo numero di righe */ maxLines?: number }) {
  const t = useTheme();
  const { flex, style, maxLines, onContentSizeChange, ...rest } = props;
  const [contentH, setContentH] = useState<number | null>(null);
  const grow = maxLines != null && maxLines > 1;
  return (
    <TextInput
      placeholderTextColor={t.muted}
      accessibilityLabel={(() => { const l = rest.accessibilityLabel ?? rest.placeholder; return l ? translateText(l) : l; })()}
      {...rest}
      multiline={grow ? true : rest.multiline}
      onContentSizeChange={grow ? (e) => { setContentH(e.nativeEvent.contentSize.height); onContentSizeChange?.(e); } : onContentSizeChange}
      style={[{ backgroundColor: t.input, borderColor: t.inputBorder, color: t.text, borderWidth: 1, borderRadius: radius.field, padding: 13, fontSize: 16, marginBottom: 8 }, props.multiline && !grow && { minHeight: 110, textAlignVertical: 'top' }, grow && { textAlignVertical: 'top', height: growHeight(contentH ?? 0, 21, 28, 1, maxLines) }, flex != null && { flex }, style]}
    />
  );
}

/** Interruttore dell'app: stesso aspetto su iPhone e Android, colori del tema (nessun verde di sistema). */
export function Switch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange?: (v: boolean) => void; accessibilityLabel?: string }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) x.setValue(value ? 1 : 0);
    else Animated.timing(x, { toValue: value ? 1 : 0, duration: 140, useNativeDriver: false }).start();
  }, [value, reduce, x]);
  const left = x.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const handler = safely(onValueChange);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => handler?.(!value)}
      hitSlop={8}
      style={{ width: 52, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: value ? t.accent : t.inputBorder, direction: 'ltr' }}
    >
      <Animated.View style={{ position: 'absolute', left, width: 26, height: 26, borderRadius: 13, backgroundColor: value ? t.onText : (t.mode === 'light' ? '#ffffff' : t.muted) }} />
    </Pressable>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: ReactNode; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 }}>
      <View style={{ flex: 1 }}>
        {typeof label === 'string' ? <Body>{label}</Body> : label}
        {hint ? <Body small muted>{hint}</Body> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={typeof label === 'string' ? translateText(label) : undefined} />
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(100, value))) }} style={{ height: 7, borderRadius: 10, backgroundColor: t.border, overflow: 'hidden', marginTop: 8, direction: 'ltr' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: color ?? t.accent, borderRadius: 10 }} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 22, fontSize: 14, lineHeight: 20 }}>{text}</Text>;
}

/** Icona di ogni scheda nota: se ogni voce ne ha una, `Seg` si disegna con le icone (la scelta mostra anche il nome). */
const LABEL_ICONS: Record<string, string> = {
  Quadro: 'chart', Budget: 'wallet', Bollette: 'file', Investi: 'trend-up', LP: 'coin', LifePoints: 'coin',
  Tutti: 'grid', Attivi: 'activity', Completati: 'check',
  Offerte: 'briefcase', Candidature: 'file', 'Le mie offerte': 'profile',
  Giorno: 'clock', Settimana: 'calendar', Mese: 'grid', Elenco: 'tasks',
  Paga: 'send', Versa: 'plus', LifePass: 'lifefitness', Carta: 'wallet', Cripto: 'coin',
  Free: 'unlock', Premium: 'star', Chat: 'comment', Contenuti: 'file', Prezzi: 'coin', Iscritti: 'users',
  Ricevi: 'arrow-down', Invia: 'arrow-up', Movimenti: 'repeat',
  Fronte: 'image', Retro: 'file', Sposta: 'forward', Disegna: 'edit',
  Acquisti: 'orders', Guadagnati: 'trend-up', 'LifePoint giornaliero': 'coin',
  File: 'file', Foto: 'image', Minuti: 'clock', Ore: 'timer', Barre: 'chart', Linee: 'activity', Torta: 'circle',
  Scelta: 'checksquare', Numero: 'poll', Aperta: 'edit',
  Oggi: 'sun', Allenarsi: 'lifefitness', Cibo: 'meal', 'LifePass e centri': 'award',
  Scelte: 'settings', Limiti: 'timer', Fornitori: 'users', Prova: 'play', Cronologia: 'clock',
  Media: 'image', Documenti: 'file', Link: 'link',
};
const baseLabel = (o: string) => o.replace(/\s·\s.*$/, '');

export function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const icons = options.map((o) => LABEL_ICONS[baseLabel(o)]);
  /* con 2-5 voci che hanno tutte un'icona: scheda a icone, la scelta mostra anche il nome */
  if (options.length >= 2 && options.length <= 5 && icons.every(Boolean)) {
    return <IconSeg value={value} onChange={onChange} options={options.map((o, i) => ({ id: o, icon: icons[i], label: o }))} />;
  }
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.input, borderRadius: radius.field, padding: 4, gap: 4, marginBottom: 14 }}>
      {options.map((o) => (
        <Press key={o} onPress={() => onChange(o)} accessibilityLabel={o} selected={value === o} role="tab" style={{ flex: 1, minHeight: 40, paddingVertical: 10, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: value === o ? t.text : 'transparent' }}>
          <Text style={{ color: value === o ? t.bg : t.muted, fontWeight: '700', fontSize: fs.small }}>{o}</Text>
        </Press>
      ))}
    </View>
  );
}

/** Schede con sole icone: quella scelta mostra anche il nome. Più pulita e non serve leggere sigle. */
export function IconSeg({ options, value, onChange }: { options: { id: string; icon: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.input, borderRadius: radius.field, padding: 4, gap: 4, marginBottom: 14 }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Press key={o.id} onPress={() => onChange(o.id)} accessibilityLabel={o.label} selected={on} role="tab" style={{ flex: on ? 2.4 : 1, minHeight: 44, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.text : 'transparent', flexDirection: 'row', gap: 6 }}>
            <Icon name={o.icon} size={19} color={on ? t.bg : t.muted} stroke={on ? 2.2 : 1.9} />
            {on ? <Text numberOfLines={1} style={{ color: t.bg, fontWeight: '800', fontSize: fs.small }}>{o.label}</Text> : null}
          </Press>
        );
      })}
    </View>
  );
}

export function TabRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const icons = options.map((o) => LABEL_ICONS[baseLabel(o)]);
  /* con 2-5 voci che hanno tutte un'icona: stessa scheda a icone di tutta l'app (la scelta mostra anche il nome) */
  if (options.length >= 2 && options.length <= 5 && icons.every(Boolean)) {
    return <IconSeg value={value} onChange={onChange} options={options.map((o, i) => ({ id: o, icon: icons[i], label: o }))} />;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ borderBottomWidth: 1, borderBottomColor: t.border, marginBottom: 14, flexGrow: 0 }} contentContainerStyle={{ gap: 18 }}>
      {options.map((o) => (
        <Press key={o} onPress={() => onChange(o)} accessibilityLabel={o} selected={value === o} role="tab" style={{ paddingTop: 8, paddingBottom: 11, borderBottomWidth: 2, borderBottomColor: value === o ? t.text : 'transparent' }}>
          <Text style={{ color: value === o ? t.text : t.muted, fontSize: fs.small, fontWeight: value === o ? '700' : '400' }}>{o}</Text>
        </Press>
      ))}
    </ScrollView>
  );
}

/** La foto della persona (la sua, scelta dal profilo; altrimenti quella predefinita) compare ovunque il suo nome ha un avatar. */
const DEFAULT_PHOTO = DEFAULT_USER_PHOTO;
export function Avatar({ name, size = 30, uri }: { name: string; size?: number; uri?: any }) {
  const me = useApp((a) => a.account.name);
  const photo = useApp((a) => a.account.photo);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [photo, uri]);
  /* se la foto scelta non compare entro 2,5 secondi (file sparito o illeggibile, senza errore) si usa quella predefinita */
  useEffect(() => { if (loaded || failed || !photo || uri) return; const h = setTimeout(() => setFailed(true), 2500); return () => clearTimeout(h); }, [loaded, failed, photo, uri]);
  // se la foto scelta non si carica più (file temporaneo sparito) si ripiega su quella predefinita o sulle iniziali
  const mine = !!name && name === me;
  const src = !failed ? (uri ?? (mine ? (photo ? { uri: photo } : DEFAULT_PHOTO) : undefined)) : (mine ? DEFAULT_PHOTO : undefined);
  const hash = Math.abs([...name].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)) % 360;
  // sotto c'è sempre il cerchio con l'iniziale: se la foto non si carica (o sta ancora caricando) non resta mai un buco vuoto
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hash},45%,32%)`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name[0]}</Text>
      {src ? <Image source={src} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ position: 'absolute', top: 0, start: 0, width: size, height: size, borderRadius: size / 2 }} /> : null}
    </View>
  );
}

/* ---------- sheet modale ---------- */
/** iOS non presenta un Modal se parte mentre un altro si sta ancora chiudendo: si attende la fine della chiusura. */
let lastModalClose = 0;
const MODAL_GAP = 420;

export function Sheet({ visible, title, onClose, children, lowerable }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; /** si può abbassare per continuare a guardare il contenuto dietro */ lowerable?: boolean }) {
  const t = useTheme();
  const ty = useRef(new Animated.Value(0)).current;
  const sheetH = useRef(0);
  const lowered = useRef(false);
  const settle = (low: boolean) => { lowered.current = low; Animated.spring(ty, { toValue: low ? Math.max(0, sheetH.current - 120) : 0, useNativeDriver: true, bounciness: 0 }).start(); };
  useEffect(() => { if (!visible) { lowered.current = false; ty.setValue(0); } }, [visible, ty]);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !!lowerable,
    onMoveShouldSetPanResponder: (_e, g) => !!lowerable && Math.abs(g.dy) > 6,
    onPanResponderMove: (_e, g) => { const base = lowered.current ? Math.max(0, sheetH.current - 120) : 0; ty.setValue(Math.max(0, Math.min(sheetH.current - 120, base + g.dy))); },
    onPanResponderRelease: (_e, g) => { if (Math.abs(g.dy) < 6) { settle(!lowered.current); return; } settle(g.dy > 0); },
  })).current;
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const kb = useKeyboardInset();
  const win = useWindowDimensions();
  const [shown, setShown] = useState(visible);
  useEffect(() => {
    if (!visible) {
      setShown((was) => { if (was) lastModalClose = Date.now(); return false; });
      return;
    }
    const wait = Platform.OS === 'ios' ? Math.max(0, MODAL_GAP - (Date.now() - lastModalClose)) : 0;
    if (wait === 0) { setShown(true); return; }
    const h = setTimeout(() => setShown(true), wait);
    return () => clearTimeout(h);
  }, [visible]);
  const close = safely(onClose) ?? onClose;
  return (
    <Modal visible={shown} transparent animationType={reduce ? 'none' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <KeyboardDock>
        <Pressable style={{ flex: 1, backgroundColor: lowerable ? 'transparent' : t.overlay }} onPress={() => { if (lowerable && lowered.current) settle(false); else close(); }} accessibilityRole="button" accessibilityLabel={translateText('Chiudi')} />
        <Animated.View accessibilityViewIsModal onLayout={(e) => { sheetH.current = e.nativeEvent.layout.height; }} style={{ transform: [{ translateY: ty }], backgroundColor: t.sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderTopColor: t.sheetBorder, maxHeight: sheetMaxHeight(win.height, insets.top, kb.height), paddingTop: lowerable ? 8 : 20 }}>
          <View {...(lowerable ? pan.panHandlers : {})} style={{ paddingTop: lowerable ? 4 : 0 }}>
            {lowerable ? <View accessibilityRole="adjustable" accessibilityLabel={translateText('Abbassa o alza i commenti')} style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: t.muted, opacity: 0.6, marginBottom: 10 }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 }}>
            <Text accessibilityRole="header" style={{ color: t.text, fontSize: fs.lead, fontWeight: '700', flex: 1, marginEnd: 10 }} numberOfLines={2}>{title}</Text>
            <Btn small ghost title="Chiudi" onPress={onClose} />
          </View>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: restingBottom(kb, insets.bottom) + 24 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {children}
          </ScrollView>
        </Animated.View>
        <ModalToast />
      </KeyboardDock>
    </Modal>
  );
}

/** Selettore a tendina (apre una sheet con le opzioni). */
export function Select({ value, options, onChange, title }: { value: string; options: string[]; onChange: (v: string) => void; title?: string }) {
  const t = useTheme();
  const [open, setOpen] = useOpen();
  return (
    <>
      <Press onPress={() => setOpen(true)} accessibilityLabel={`${translateText(title ?? 'Scegli')}: ${translateText(value)}`} style={{ backgroundColor: t.input, borderColor: t.inputBorder, borderWidth: 1, borderRadius: radius.field, padding: 13, minHeight: MIN_HIT, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{value}</Text>
        <Icon name="chevron" size={16} color={t.muted} stroke={2} />
      </Press>
      <Sheet visible={open} title={title ?? 'Scegli'} onClose={() => setOpen(false)}>
        {options.map((o, i) => (
          <Item key={o} last={i === options.length - 1} onPress={() => { onChange(o); setOpen(false); }}>
            <Row><Body>{o}</Body>{o === value ? <Icon name="check" size={17} color={t.positive} stroke={2.4} /> : null}</Row>
          </Item>
        ))}
      </Sheet>
    </>
  );
}

function useOpen(): [boolean, (v: boolean) => void] {
  const [o, set] = useState(false);
  return [o, set];
}
export { useOpen };

/* ---------- toast ---------- */
/** Modal nativi aperti (in ordine): il toast globale sta sotto i Modal, quindi viene ridisegnato nel Modal in cima. */
const useModalStack = create<{ ids: number[]; push: (id: number) => void; pop: (id: number) => void }>((set) => ({
  ids: [],
  push: (id) => set((st) => ({ ids: [...st.ids, id] })),
  pop: (id) => set((st) => ({ ids: st.ids.filter((x) => x !== id) })),
}));
let modalSeq = 0;

function ToastBubble({ bottom }: { bottom: number }) {
  const t = useTheme();
  const { msg, undo, hide } = useToast();
  if (!msg) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 0, end: 0, bottom, alignItems: 'center', zIndex: 50 }}>
      {/* senza "Annulla" il toast non intercetta i tocchi: non deve mai coprire pulsanti sotto di sé */}
      <View pointerEvents={undo ? 'auto' : 'none'} accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: t.toastBg, borderWidth: 1, borderColor: t.toastBorder, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11, maxWidth: '88%', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={{ color: t.toastText, fontSize: fs.small, flexShrink: 1, textAlign: 'center' }}>{translateText(msg)}</Text>
        {undo && (
          <Text suppressHighlighting accessibilityRole="button" onPress={() => { undo(); hide(); }} style={{ color: t.toastText, fontWeight: '700', textDecorationLine: 'underline', fontSize: fs.small, paddingVertical: 8 }}>Annulla</Text>
        )}
      </View>
    </View>
  );
}

/** Da mettere DENTRO ogni <Modal>: mostra il toast sopra il Modal (solo in quello più in alto). */
export function ModalToast() {
  const insets = useSafeAreaInsets();
  const [id] = useState(() => ++modalSeq);
  const push = useModalStack((m) => m.push), pop = useModalStack((m) => m.pop);
  const top = useModalStack((m) => m.ids[m.ids.length - 1]);
  useEffect(() => { push(id); return () => pop(id); }, [id, push, pop]);
  return top === id ? <ToastBubble bottom={insets.bottom + 90} /> : null;
}

export function ToastHost() {
  const { msg, undo, id, hide } = useToast();
  const inModal = useModalStack((m) => m.ids.length > 0);
  useEffect(() => {
    if (!msg) return;
    const h = setTimeout(hide, undo ? 4500 : 2200);
    return () => clearTimeout(h);
  }, [id, msg, undo, hide]);
  if (!msg || inModal) return null;
  return <ToastBubble bottom={96} />;
}

/** Per i punti dove serve tornare indietro da una route esterna al gruppo tab. */
export const back = () => router.back();

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuBtn: { padding: 10 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 17, marginVertical: 5 },
  pill: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11, marginEnd: 6, marginBottom: 6 },
});
