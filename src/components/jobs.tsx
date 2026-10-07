import { Pressable, Text, View } from 'react-native';

import { Body, Card, Row } from '@/components/ui';
import { skillLabel, traitLabel, traits } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { levelOf, type Trust } from '@/lib/hiring';
import type { Profile } from '@/store/jobs';

export const scoreTone = (v: number | null, t: { positive: string; warn: string; danger: string; muted: string }) => (v == null ? t.muted : v >= 70 ? t.positive : v >= 50 ? t.warn : t.danger);

export function Bar({ value, min, color }: { value: number | null; min?: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: t.item, overflow: 'hidden' }}>
      {value != null && <View style={{ height: 8, width: `${value}%`, backgroundColor: color, borderRadius: 4 }} />}
      {min != null && <View style={{ position: 'absolute', left: `${min}%`, top: 0, bottom: 0, width: 2, backgroundColor: t.text, opacity: 0.6 }} />}
    </View>
  );
}

export function SkillRow({ skill, value, min, note, onPress }: { skill: string; value: number | null; min?: number; note?: string; onPress?: () => void }) {
  const t = useTheme();
  const c = scoreTone(value, t);
  const unmet = min != null && (value ?? 0) < min;
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      <Row style={{ marginBottom: 4 }}>
        <Body small bold style={{ flex: 1 }}>{skillLabel(skill)}</Body>
        <Text style={{ color: c, fontWeight: '800', fontSize: 14 }}>{value == null ? 'non verificata' : `${value} · ${levelOf(value)}`}</Text>
      </Row>
      <Bar value={value} min={min} color={c} />
      {(note || (min != null)) && <Body small muted style={{ marginTop: 3 }}>{min != null ? `Richiesto almeno ${min}${unmet ? ' · sotto la soglia' : ' · soglia raggiunta'}` : ''}{note ? `${min != null ? ' · ' : ''}${note}` : ''}</Body>}
    </Pressable>
  );
}

const confLabel = { alta: 'affidabilità del dato alta', media: 'affidabilità del dato media', bassa: 'pochi dati: indicativo', nessuna: 'nessun dato' } as const;

export function TrustCard({ trust, profile, compact }: { trust: Trust; profile: Profile; compact?: boolean }) {
  const t = useTheme();
  const c = scoreTone(trust.score, t);
  return (
    <Card>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Body small muted style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>Indice di affidabilità</Body>
          <Text style={{ color: c, fontSize: 34, fontWeight: '800' }}>{trust.score == null ? '—' : trust.score}<Text style={{ fontSize: 14, color: t.muted }}>{trust.score == null ? '' : ' /100'}</Text></Text>
          <Body small muted>{confLabel[trust.confidence]}</Body>
        </View>
      </Row>
      {!compact && (
        <>
          <View style={{ marginTop: 10 }}>
            {trust.components.map((x) => (
              <View key={x.id} style={{ marginBottom: 8 }}>
                <Row><Body small style={{ flex: 1 }}>{x.label} <Text style={{ color: t.muted }}>({x.weight}%)</Text></Body><Body small bold color={scoreTone(x.value, t)}>{x.value == null ? 'n/d' : x.value}</Body></Row>
                <Bar value={x.value} color={scoreTone(x.value, t)} />
                <Body small muted>{x.note}</Body>
              </View>
            ))}
            {trust.penalty > 0 && <Body small color={t.danger}>Penalità per segnalazioni ricevute: −{trust.penalty}</Body>}
          </View>
          {traits.some((x) => profile.traits[x] != null) && (
            <View style={{ marginTop: 6 }}>
              <Body small bold style={{ marginBottom: 4 }}>Atteggiamento (da scenari)</Body>
              <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={8}>
                {traits.map((x) => profile.traits[x] != null ? <View key={x} style={{ backgroundColor: t.item, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: t.text, fontSize: 12 }}>{traitLabel[x]}: <Text style={{ fontWeight: '800' }}>{profile.traits[x]}</Text></Text></View> : null)}
              </Row>
            </View>
          )}
          <Body small muted style={{ marginTop: 10 }}>L’indice combina segnali verificabili nella rete (voti, LifePoints, identità, segnalazioni) e risposte a scenari, che sono auto-dichiarate. Non misura la “personalità” e non sostituisce un colloquio: decide sempre una persona.</Body>
        </>
      )}
    </Card>
  );
}
