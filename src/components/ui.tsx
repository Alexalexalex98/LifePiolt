import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import {
  Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSectionNames } from '@/lib/i18n';
import { areaColors, Icon } from '@/lib/icons';
import { goBack, go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useToast } from '@/store/toast';

/* ---------- stato UI globale (menu) ---------- */
export const useUI = create<{ menuOpen: boolean; setMenu: (v: boolean) => void; badges: { msg: number; notif: number }; setBadges: (b: { msg: number; notif: number }) => void }>((set) => ({
  menuOpen: false,
  setMenu: (v) => set({ menuOpen: v }),
  badges: { msg: 0, notif: 0 },
  setBadges: (badges) => set({ badges }),
}));

function useScale() {
  return useApp((s) => (s.accessibility.textLg ? 1.12 : 1));
}

/* ---------- pagina con barra superiore ---------- */
function TopBar({ page }: { page: string }) {
  const t = useTheme();
  const names = useSectionNames();
  const badges = useUI((s) => s.badges);
  const setMenu = useUI((s) => s.setMenu);
  const tag = names[page === 'index' ? 'home' : page] || '';
  const Badge = ({ n, bg }: { n: number; bg: string }) =>
    n > 0 ? (
      <View style={{ position: 'absolute', top: 4, right: 2, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
        <Text style={{ color: '#fff', fontSize: 10 }}>{n}</Text>
      </View>
    ) : null;
  return (
    <View style={s.top}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
        <Image source={require('../../assets/proto/app-logo.png')} style={{ height: 30, width: 30 }} resizeMode="contain" accessibilityLabel="LifePilot" />
        <Text style={{ color: areaColors[page] ?? t.text, fontSize: 16, fontWeight: '700' }}>{tag}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable style={s.menuBtn} onPress={() => go('messagesPage')} accessibilityLabel="Messaggi">
          <Icon name="send" size={19} color={t.text} /><Badge n={badges.msg} bg="#5b8def" />
        </Pressable>
        <Pressable style={s.menuBtn} onPress={() => go('notificationsPage')} accessibilityLabel="Notifiche">
          <Icon name="bell" size={19} color={t.text} /><Badge n={badges.notif} bg="#ff5d5d" />
        </Pressable>
        <Pressable style={s.menuBtn} onPress={() => setMenu(true)} accessibilityLabel="Menu">
          <Icon name="menu" size={21} color={t.text} />
        </Pressable>
      </View>
    </View>
  );
}

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
  const body = (
    <>
      {!noTop && <TopBar page={id} />}
      {showBack && (
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Indietro" style={{ alignSelf: 'flex-start', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.chip }}><Icon name="arrow-left" size={16} color={t.text} stroke={2.2} /><Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>Indietro</Text></View>
        </Pressable>
      )}
      {title && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 }}>{title}</Text>
          {right}
        </View>
      )}
      {children}
    </>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{body}</ScrollView>
      ) : (
        <View style={{ flex: 1, padding: space.lg, paddingTop: insets.top + 10 }}>{body}</View>
      )}
    </KeyboardAvoidingView>
  );
}

/* ---------- elementi base ---------- */
export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string }) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [s.card, { backgroundColor: t.card, borderColor: t.border }, accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>{children}</Pressable>;
}

export function H({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme(); const k = useScale();
  return <Text style={[{ color: t.text, fontSize: 17 * k, fontWeight: '700', marginBottom: 8 }, style]}>{children}</Text>;
}

export function Body({ children, muted, small, bold, color, style, onPress, numberOfLines }: {
  children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; color?: string; style?: StyleProp<TextStyle>; onPress?: () => void; numberOfLines?: number;
}) {
  const t = useTheme(); const k = useScale();
  return (
    <Text onPress={onPress} numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? t.muted : t.text), fontSize: (small ? 13 : 15) * k, lineHeight: (small ? 18 : 21) * k, fontWeight: bold ? '700' : '400' }, style]}>
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
      <Icon name={icon} size={small ? 16 : 19} color={c} stroke={1.9} />
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
  return <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}><Icon name="x" size={17} color={color ?? t.danger} stroke={2.1} /></Pressable>;
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
  const t = useTheme(); const k = useScale();
  return <Text style={{ color: color ?? t.text, fontSize: (big ? 40 : 24) * k, fontWeight: big ? '800' : '700' }}>{children}</Text>;
}

export function Row({ children, style, gap = 12 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap }, style]}>{children}</View>;
}

export function Item({ children, style, onPress, last }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; last?: boolean }) {
  const t = useTheme();
  const st: StyleProp<ViewStyle> = [{ paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.item }, style];
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [st, pressed && { opacity: 0.6 }]}>{children}</Pressable> : <View style={st}>{children}</View>;
}

export function Btn({ title, onPress, ghost, small, danger, disabled, style, tone, icon }: {
  title: string; icon?: string; onPress: () => void; ghost?: boolean; small?: boolean; danger?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; tone?: 'buy' | 'sell';
}) {
  const t = useTheme();
  let bg = t.text, fg = t.onText, border: string | undefined;
  if (ghost) { bg = 'transparent'; fg = danger ? t.danger : t.text; border = t.border; }
  else if (danger) { bg = t.dangerBg; fg = t.danger; }
  if (tone === 'buy') { bg = t.positiveBg; fg = t.positive; }
  if (tone === 'sell') { bg = t.dangerBg; fg = t.danger; }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        { backgroundColor: bg, borderRadius: small ? 12 : 16, paddingVertical: small ? 8 : 12, paddingHorizontal: small ? 12 : 14, alignItems: 'center', justifyContent: 'center' },
        border ? { borderWidth: 1, borderColor: border } : null,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.6 },
        style,
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={small ? 14 : 17} color={fg} stroke={2.1} /> : null}
        {title ? <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 12 : 15 }}>{title}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Pill({ label, on, onPress, off, color, icon }: { label: string; icon?: string; on?: boolean; onPress?: () => void; off?: boolean; color?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={off ? undefined : onPress} style={[s.pill, { backgroundColor: on ? t.text : t.chip, opacity: off ? 0.4 : 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon ? <Icon name={icon} size={13} color={on ? t.bg : (color ?? t.text)} stroke={2} /> : null}
        <Text style={{ color: on ? t.bg : (color ?? t.text), fontSize: 12, fontWeight: on ? '700' : '500' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Link({ children, onPress, danger, color }: { children: ReactNode; onPress: () => void; danger?: boolean; color?: string }) {
  const t = useTheme();
  return <Text onPress={onPress} suppressHighlighting style={{ color: color ?? (danger ? t.danger : t.muted), fontSize: 13, textDecorationLine: danger ? 'none' : 'underline' }}>{children}</Text>;
}

export function Input(props: TextInputProps & { flex?: number }) {
  const t = useTheme();
  const { flex, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...rest}
      style={[{ backgroundColor: t.input, borderColor: t.inputBorder, color: t.text, borderWidth: 1, borderRadius: 14, padding: 13, fontSize: 16, marginBottom: 8 }, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, flex != null && { flex }, style]}
    />
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
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#4f7cff', false: t.inputBorder }} thumbColor="#fff" />
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 7, borderRadius: 10, backgroundColor: t.border, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: color ?? t.accent, borderRadius: 10 }} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 22, fontSize: 14, lineHeight: 20 }}>{text}</Text>;
}

export function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.input, borderRadius: 14, padding: 4, gap: 4, marginBottom: 14 }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: value === o ? t.text : 'transparent' }}>
          <Text style={{ color: value === o ? t.bg : t.muted, fontWeight: '700', fontSize: 13 }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TabRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: t.border, marginBottom: 14, flexGrow: 0 }} contentContainerStyle={{ gap: 18 }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={{ paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: value === o ? t.text : 'transparent' }}>
          <Text style={{ color: value === o ? t.text : t.muted, fontSize: 13, fontWeight: value === o ? '700' : '400' }}>{o}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Avatar({ name, size = 30, uri }: { name: string; size?: number; uri?: any }) {
  const hash = Math.abs([...name].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)) % 360;
  if (uri) return <Image source={uri} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hash},45%,32%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name[0]}</Text>
    </View>
  );
}

/* ---------- sheet modale ---------- */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={onClose} accessibilityLabel="Chiudi" />
        <View style={{ backgroundColor: t.sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderTopColor: t.sheetBorder, maxHeight: '82%', paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 }}>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', flex: 1, marginRight: 10 }} numberOfLines={2}>{title}</Text>
            <Btn small ghost title="Chiudi" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
        <ModalToast />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Selettore a tendina (apre una sheet con le opzioni). */
export function Select({ value, options, onChange, title }: { value: string; options: string[]; onChange: (v: string) => void; title?: string }) {
  const t = useTheme();
  const [open, setOpen] = useOpen();
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ backgroundColor: t.input, borderColor: t.inputBorder, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{value}</Text>
        <Icon name="chevron" size={16} color={t.muted} stroke={2} />
      </Pressable>
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

import { useState } from 'react';
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
  const { msg, undo, hide } = useToast();
  if (!msg) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center', zIndex: 50 }}>
      <View accessibilityRole="alert" style={{ backgroundColor: '#1c2431', borderWidth: 1, borderColor: '#2c3644', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11, maxWidth: '88%', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={{ color: '#f4f6f8', fontSize: 13, flexShrink: 1, textAlign: 'center' }}>{msg}</Text>
        {undo && (
          <Text suppressHighlighting onPress={() => { undo(); hide(); }} style={{ color: '#f4f6f8', fontWeight: '700', textDecorationLine: 'underline', fontSize: 13 }}>Annulla</Text>
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
  menuBtn: { padding: 8 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 17, marginVertical: 5 },
  pill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, marginRight: 6, marginBottom: 6 },
});
