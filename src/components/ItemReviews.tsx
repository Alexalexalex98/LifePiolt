import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Stars } from '@/components/club/parts';
import { Body, Btn, Card, H, Input, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { demoAttend, itemRateBlock, rateItem } from '@/lib/profile/actions';
import { averageOf, demoItemReviews, mergeReviews, type ItemReview } from '@/lib/profile/itemReviews';
import { useApp } from '@/store/app';
import { useClub } from '@/store/club';
import { useIdentity } from '@/store/identity';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Recensioni di un seminario, una seduta o un LifeClub: media, elenco con motivazioni e, se hai partecipato, il tuo voto. */
export function ItemReviews({ refKey, title = 'Recensioni', readOnly }: { refKey: string; title?: string; /** solo elenco: il voto si dà altrove */ readOnly?: boolean }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const votes = useIdentity((s) => s.itemVotes);
  const clubRatings = useClub((s) => (refKey.startsWith('club:') ? s.ratings[refKey.slice(5)] : undefined));
  useNet((s) => s.enrollments);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');

  const reviews: ItemReview[] = useMemo(() => {
    const real: ItemReview[] = refKey.startsWith('club:')
      ? Object.entries(clubRatings ?? {}).map(([from, r]) => ({ from, stars: r.stars, text: r.text, ts: r.ts }))
      : (votes ?? []).filter((v) => v.ref === refKey).map((v) => ({ from: v.from, stars: v.stars, text: v.text, ts: v.ts }));
    return mergeReviews(real, demo ? demoItemReviews(refKey, Date.now()) : []);
  }, [refKey, votes, clubRatings, demo]);
  const avg = averageOf(reviews);
  const isClub = refKey.startsWith('club:');
  const block = isClub ? null : itemRateBlock(me, refKey);
  const mine = reviews.find((r) => r.from === me);
  const shown = all ? reviews : reviews.slice(0, 3);

  const send = () => {
    if (isClub) { const r = useClub.getState().rateClub(refKey.slice(5), me, stars, text); if (!r.ok) { toast(r.reason ?? 'Non posso salvare il voto'); return; } toast('Grazie per la recensione'); }
    else { const why = rateItem(me, refKey, stars, text); if (why) { toast(why); return; } toast('Recensione pubblicata'); }
    setOpen(false); setText('');
  };

  return (
    <Card>
      <Row>
        <H>{title}</H>
        {avg ? <Row gap={6}><Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{avg.toFixed(1)}</Text><Body small muted>/5 · {reviews.length}</Body></Row> : null}
      </Row>
      {reviews.length === 0 ? <Body muted>Ancora nessuna recensione.</Body> : shown.map((r, i) => (
        <View key={r.from} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
          <Row>
            <Body bold style={{ flex: 1 }}>{r.from === me ? 'Tu' : r.from}</Body>
            <Stars value={r.stars} size={14} />
          </Row>
          {r.text ? <Body small style={{ marginTop: 3 }}>{r.text}</Body> : null}
          <Body small muted style={{ marginTop: 2 }}>{fmtDate(new Date(r.ts), { day: 'numeric', month: 'short', year: 'numeric' })}</Body>
        </View>
      ))}
      {reviews.length > 3 ? <Btn small ghost style={{ marginTop: 6 }} title={all ? 'Mostra meno' : `Vedi tutte le ${reviews.length} recensioni`} onPress={() => setAll(!all)} /> : null}

      {readOnly ? null : mine && !isClub ? <Body small muted style={{ marginTop: 8 }}>Hai già lasciato la tua recensione.</Body>
        : !block || isClub ? <Btn style={{ marginTop: 10 }} icon="award" title={mine ? 'Modifica la tua recensione' : 'Scrivi una recensione'} onPress={() => { setStars(mine?.stars ?? 5); setText(mine?.text ?? ''); setOpen(true); }} />
        : (
          <View style={{ marginTop: 10 }}>
            <Body small muted>{block}</Body>
            {demo && block.includes('partecipato') ? <Btn small ghost style={{ marginTop: 8 }} icon="timer" title="Solo demo: segna come frequentato" onPress={() => { demoAttend(me, refKey); toast('Ora puoi lasciare la recensione'); }} /> : null}
          </View>
        )}

      <Sheet visible={open} title="La tua recensione" onClose={() => setOpen(false)}>
        <Body small muted>La recensione riguarda questo contenuto, non la persona: pesa un terzo di un voto al profilo.</Body>
        <View style={{ alignItems: 'center', marginVertical: 14 }}><Stars value={stars} onChange={setStars} size={34} /></View>
        <Input placeholder="Cosa ti è piaciuto o no? (facoltativo)" value={text} onChangeText={setText} maxLength={240} multiline />
        <Btn title="Pubblica" onPress={send} />
      </Sheet>
    </Card>
  );
}
