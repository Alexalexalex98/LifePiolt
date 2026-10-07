import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ title, back, children, right, scroll = true }: {
  title?: string; back?: boolean; children: ReactNode; right?: ReactNode; scroll?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <>
      {(title || back) && (
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            {back && (
              <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Indietro">
                <Text style={{ color: t.muted, fontSize: 14, marginBottom: 4 }}>← Indietro</Text>
              </Pressable>
            )}
            {title && <Text style={[s.title, { color: t.text }]}>{title}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: space.lg, paddingTop: insets.top + space.md }}>{body}</View>
      )}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const base = [s.card, { backgroundColor: t.card, borderColor: t.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

export function H({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: space.sm }}>{children}</Text>;
}

export function Body({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.muted : t.text, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21 }, style]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>{children}</Text>;
}

export function Metric({ children, big }: { children: ReactNode; big?: boolean }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: big ? 44 : 24, fontWeight: '800' }}>{children}</Text>;
}

export function Button({ title, onPress, ghost, small, danger, disabled }: {
  title: string; onPress: () => void; ghost?: boolean; small?: boolean; danger?: boolean; disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        ghost ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.border } : { backgroundColor: danger ? t.danger : t.text },
        (pressed || disabled) && { opacity: 0.55 },
      ]}>
      <Text style={{ color: ghost ? (danger ? t.danger : t.text) : t.onText, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[s.pill, { backgroundColor: on ? t.text : t.cardAlt, borderColor: t.border }]}>
      <Text style={{ color: on ? t.onText : t.text, fontSize: 13, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[s.input, { backgroundColor: t.input, borderColor: t.inputBorder, color: t.text }, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, props.style]}
    />
  );
}

export function Progress({ value }: { value: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 7, borderRadius: 8, backgroundColor: t.border, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: t.accent }} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }, style]}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: space.lg }}>{text}</Text>;
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{label}</Text>
      <Ionicons name={value ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={value ? t.accent : t.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space.md },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  btn: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, marginRight: 6, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 13, fontSize: 16, marginBottom: space.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
