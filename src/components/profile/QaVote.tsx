import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { QA_HINT } from '@/lib/profile/qa';
import { useIdentity } from '@/store/identity';
import { toast } from '@/store/toast';
import { myStatus } from '@/lib/profile/actions';
import { can } from '@/lib/profile/identity';

/** Voto a una risposta: lo vede e lo dà solo chi ha fatto la domanda. */
export function QaVote({ from, to, refId }: { from: string; to: string; refId: string }) {
  const t = useTheme();
  const voted = useIdentity((s) => s.qaVotes.some((v) => v.from === from && v.to === to && (v.ref ?? '') === refId));
  const [open, setOpen] = useState(false);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [stars, setStars] = useState(0);
  if (voted) return <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 4 }}>Hai votato questa risposta</Text>;
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Vota questa risposta" hitSlop={{ top: 10, bottom: 10, left: 6, right: 20 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
        <Icon name="star" size={14} color={t.warn} /><Text style={{ color: t.warn, fontSize: 13, fontWeight: '700' }}>Vota la risposta</Text>
      </Pressable>
    );
  }
  const send = () => {
    if (!can(myStatus(), 'vote')) { toast('Per votare serve prima verificare la tua identità'); return; }
    if (helpful == null || !stars) { toast('Scegli utile o non utile e le stelle'); return; }
    const why = useIdentity.getState().castQa({ from, to, stars, helpful, ts: Date.now(), ref: refId });
    if (why) { toast(why); return; }
    toast('Voto inviato, grazie');
  };
  return (
    <View style={{ marginTop: 6, padding: 10, borderRadius: 12, backgroundColor: t.chip, gap: 8 }}>
      <Text style={{ color: t.muted, fontSize: 12.5 }}>{QA_HINT}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([[true, 'Utile'], [false, 'Non utile']] as const).map(([v, l]) => (
          <Pressable key={l} onPress={() => setHelpful(v)} accessibilityRole="button" accessibilityState={{ selected: helpful === v }} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: helpful === v ? t.text : 'transparent', borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: helpful === v ? t.onText : t.text, fontWeight: '700', fontSize: 13 }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)} accessibilityRole="button" accessibilityLabel={`${n} stelle`} hitSlop={6}><Icon name="star" size={26} color={t.warn} fill={n <= stars ? t.warn : 'none'} /></Pressable>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Pressable onPress={send} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ color: t.accent, fontWeight: '800' }}>Invia voto</Text></Pressable>
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ color: t.muted }}>Annulla</Text></Pressable>
      </View>
    </View>
  );
}
