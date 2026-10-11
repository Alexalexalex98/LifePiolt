import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Btn, Input, Pill, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { canRate, thumbToStars } from '@/lib/club';
import { useApp } from '@/store/app';
import { mkey, useClub } from '@/store/club';
import { toast } from '@/store/toast';
import { Stars } from './parts';

/**
 * Botta e risposta votabile: chi ha fatto la domanda (o un altro iscritto) dice se la risposta e' stata utile.
 * Il voto alimenta il punteggio del rispondente (vedi src/lib/club/reputation.ts). Un voto per scambio, non si vota se stessi,
 * solo dopo l'iscrizione, limite giornaliero.
 */
export function AnswerVote({ clubId, answerId, questionId, asker, answerer }: { clubId: string; answerId: string; questionId: string; asker: string; answerer: string }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const votes = useClub((s) => s.votes);
  const m = useClub((s) => s.memberships[mkey(clubId, me)]);
  const mine = useMemo(() => votes.find((v) => v.answerId === answerId && v.voter === me), [votes, answerId, me]);
  const [sheet, setSheet] = useState(false);
  const [stars, setStars] = useState(4);
  const [note, setNote] = useState('');
  if (me === answerer) return null;
  if (mine) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <Stars value={mine.stars} size={13} />
        <Text style={{ color: t.muted, fontSize: 12 }}>{mine.note ? `Hai votato: «${mine.note}»` : 'Hai votato questa risposta'}</Text>
      </View>
    );
  }
  if (!canRate(m)) return null;
  const vote = (s: number, n?: string) => {
    const r = useClub.getState().voteAnswer({ clubId, answerId, questionId, asker, answerer, voter: me, stars: s, note: n });
    if (!r.ok) toast(r.reason ?? 'Non posso salvare il voto'); else { toast('Grazie: il tuo voto aiuta a trovare le risposte migliori'); setSheet(false); }
  };
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text style={{ color: t.muted, fontSize: 12 }}>{me === asker ? 'Ti è stata utile?' : 'Utile?'}</Text>
        <Pill icon="like" label="Utile" onPress={() => vote(thumbToStars(true))} />
        <Pill label="Non utile" onPress={() => vote(thumbToStars(false))} />
        <Pill label="Stelle e nota" onPress={() => setSheet(true)} />
      </View>
      <Sheet visible={sheet} title={`Valuta la risposta di ${answerer}`} onClose={() => setSheet(false)}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}><Stars value={stars} onChange={setStars} size={34} /></View>
        <Input placeholder="Una riga facoltativa" value={note} onChangeText={setNote} maxLength={140} />
        <Btn title="Invia il voto" onPress={() => vote(stars, note)} />
      </Sheet>
    </View>
  );
}
