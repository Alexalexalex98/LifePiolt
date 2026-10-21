import { useContext, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Spark } from '@/components/charts';
import { EditCtx } from '@/components/dash/editCtx';
import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';

/** Corpo del numero che sta nella larghezza data: non si affida al ridimensionamento automatico, che non c'è su tutti i dispositivi. */
export const fitFont = (text: string, width: number, max: number, min = 12) => Math.max(min, Math.min(max, Math.floor(width / (Math.max(1, text.length) * 0.66))));

export type TileRow = { label: string; value?: string; color?: string; done?: boolean; /** se c'è, la riga si tocca e porta a quel dato */ onPress?: () => void };
export type TileProps = {
  /** forma in quadratini e dimensione in punti */
  w: number; h: number; pw: number; ph: number;
  icon: string; label: string; color: string;
  value?: string; unit?: string; sub?: string;
  delta?: { text: string; good?: boolean | null };
  series?: number[]; progress?: number; rows?: TileRow[];
  onPress?: () => void;
  /** contenuto proprio per le forme larghe (bottoni, grafici speciali) */
  extra?: ReactNode;
  empty?: string;
};

/** Il telaio di ogni widget: decide da solo cosa mostrare in base alla forma. Un grafico compare solo dalle forme da 4 quadratini in su. */
export function Tile(p: TileProps) {
  const t = useTheme();
  const cells = p.w * p.h;
  const compact = cells === 1;
  const row = p.h === 1 && p.w >= 2;
  const col = p.w === 1 && p.h >= 2;
  const big = cells >= 8;
  const pad = compact ? 8 : 12;
  const narrow = p.pw < 230;
  const val = p.value ?? '–';
  const deltaColor = p.delta?.good == null ? t.muted : p.delta.good ? t.positive : t.danger;
  const bar = (v: number, vertical = false) => (
    <View style={vertical ? { width: 6, flex: 1, borderRadius: 3, backgroundColor: p.color + '33', justifyContent: 'flex-end' } : { height: 6, borderRadius: 3, backgroundColor: p.color + '33', overflow: 'hidden' }}>
      <View style={vertical ? { height: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, borderRadius: 3, backgroundColor: p.color } : { width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, height: '100%', backgroundColor: p.color }} />
    </View>
  );
  const rowsView = (n: number) => (p.rows ?? []).slice(0, n).map((r, i) => (
    <Pressable key={i} disabled={!r.onPress} accessibilityRole={r.onPress ? 'button' : undefined} accessibilityLabel={r.label} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
      {r.done != null ? <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: r.done ? p.color : t.border, backgroundColor: r.done ? p.color : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{r.done ? <Icon name="check" size={10} color="#10151d" stroke={3.4} /> : null}</View> : r.color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color }} /> : null}
      <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, flex: 1 }}>{r.label}</Text>
      {r.value ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5, fontWeight: '700' }}>{r.value}</Text> : null}
    </Pressable>
  ));

  let body: ReactNode;
  if (compact) {
    body = (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <Icon name={p.icon} size={17} color={p.color} stroke={2} />
        <View>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: fitFont(val, p.pw - 16, 22, 11), fontWeight: '800' }}>{val}</Text>
          <Text numberOfLines={1} style={{ color: t.muted, fontSize: 10.5 }}>{p.label}</Text>
        </View>
      </View>
    );
  } else if (row && p.w === 2) {
    body = (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={p.icon} size={16} color={p.color} stroke={2} />
          <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, fontWeight: '700', flex: 1 }}>{p.label}</Text>
          {p.value != null ? p.extra ?? null : null}
        </View>
        {p.value != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: fitFont(`${val}${p.unit ? ` ${p.unit}` : ''}`, p.pw - 24 - (p.delta ? 50 : 0), 22, 12), fontWeight: '800' }}>{val}{p.unit ? <Text style={{ color: t.muted, fontSize: 11, fontWeight: '600' }}>{` ${p.unit}`}</Text> : null}</Text>
            {p.delta ? <Text numberOfLines={1} style={{ color: deltaColor, fontSize: 11, fontWeight: '700' }}>{p.delta.text}</Text> : null}
          </View>
        ) : <View style={{ alignItems: 'flex-start' }}>{p.extra ?? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{p.sub ?? p.empty ?? ''}</Text>}</View>}
        {p.progress != null ? bar(p.progress) : p.sub && p.value != null ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 10.5 }}>{p.sub}</Text> : <View />}
      </View>
    );
  } else if (row) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {narrow && p.extra ? null : <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: p.color + '24', alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={17} color={p.color} stroke={2} /></View>}
          <View style={{ flex: 1, minWidth: 40 }}>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{p.label}</Text>
            {p.sub ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11 }}>{p.sub}</Text> : null}
          </View>
          {p.extra ?? null}
          {p.w >= 3 && p.series && p.series.length > 1 && cells >= 4 ? <Spark data={p.series.slice(-24)} w={Math.min(120, p.pw * 0.28)} h={28} color={p.color} stroke={2} /> : null}
          {p.value == null ? null : <View style={{ alignItems: 'flex-end' }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: fitFont(`${val}${p.unit ? ` ${p.unit}` : ''}`, p.pw * (p.extra ? 0.36 : 0.5), 19, 12), fontWeight: '800' }}>{val}{p.unit ? <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>{` ${p.unit}`}</Text> : null}</Text>
            {p.delta ? <Text numberOfLines={1} style={{ color: deltaColor, fontSize: 11, fontWeight: '700' }}>{p.delta.text}</Text> : null}
          </View>}
        </View>
        {p.progress != null ? bar(p.progress) : null}
      </View>
    );
  } else if (col) {
    body = (
      <View style={{ flex: 1, alignItems: 'flex-start', gap: 6 }}>
        <Icon name={p.icon} size={17} color={p.color} stroke={2} />
        <Text numberOfLines={1} style={{ color: t.text, fontSize: fitFont(val, p.pw - 20, 20, 11), fontWeight: '800' }}>{val}</Text>
        <Text numberOfLines={2} style={{ color: t.muted, fontSize: 10.5 }}>{p.label}</Text>
        {p.progress != null ? <View style={{ flex: 1, alignSelf: 'flex-start' }}>{bar(p.progress, true)}</View> : null}
      </View>
    );
  } else {
    const big2 = big;
    const room = p.ph - pad * 2 - 74;
    body = (
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: p.color + '24', alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={16} color={p.color} stroke={2} /></View>
          <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12, fontWeight: '700', flex: 1 }}>{p.label}</Text>
          {p.extra && !big2 ? p.extra : null}
        </View>
        {p.value != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: fitFont(`${val}${p.unit ? ` ${p.unit}` : ''}`, (p.pw - pad * 2) * (p.delta ? 0.55 : 0.95), big2 ? 34 : 28, 14), fontWeight: '800' }}>{val}{p.unit ? <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>{` ${p.unit}`}</Text> : null}</Text>
            {p.delta ? <Text numberOfLines={1} style={{ color: deltaColor, fontSize: 12.5, fontWeight: '700' }}>{p.delta.text}</Text> : null}
          </View>
        ) : null}
        {p.sub ? <Text numberOfLines={big2 ? 2 : 1} style={{ color: t.muted, fontSize: 12 }}>{p.sub}</Text> : null}
        {p.progress != null ? bar(p.progress) : null}
        {p.series && p.series.length > 1 && room > 40 ? <View style={{ marginTop: 4 }}><Spark data={p.series.slice(big2 ? -60 : -30)} w={p.pw - pad * 2} h={Math.max(30, Math.min(big2 ? 120 : 56, room - (p.rows?.length ? p.rows.length * 22 : 0)))} color={p.color} stroke={2.2} pad={3} /></View> : null}
        {p.extra && big2 ? <View style={{ marginTop: 6 }}>{p.extra}</View> : null}
        {p.rows?.length ? <View style={{ marginTop: 2 }}>{rowsView(Math.max(1, Math.floor((p.ph - pad * 2 - 80 - (p.series?.length ? 50 : 0)) / 24)))}</View> : null}
        {p.empty && !p.value && !p.rows?.length ? <Text style={{ color: t.muted, fontSize: 12.5 }}>{p.empty}</Text> : null}
      </View>
    );
  }
  return <Chrome pw={p.pw} ph={p.ph} color={p.color} pad={pad} label={p.label} onPress={p.onPress}>{body}</Chrome>;
}

/** La cornice comune di tutti i widget: bordo, sfondo, striscia del colore della sezione. */
export function Chrome({ pw, ph, color, pad = 12, label, onPress, children }: { pw: number; ph: number; color: string; pad?: number; label?: string; onPress?: () => void; children: ReactNode }) {
  const t = useTheme();
  const inner = (
    <View style={{ width: pw, height: ph, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, padding: pad, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: color + 'cc' }} />
      {children}
    </View>
  );
  const ed = useContext(EditCtx);
  return onPress || ed ? <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label} onPress={onPress} onLongPress={ed ? ed.enter : undefined} delayLongPress={450}>{inner}</Pressable> : inner;
}
