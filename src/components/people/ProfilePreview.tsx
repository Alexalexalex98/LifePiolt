import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Press, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { CONFIDENCE_TEXT, initials, listingsText, scoreText, sinceText, type Card } from '@/lib/people';
import { followPerson, ratePerson, unfollowPerson } from '@/lib/peopleApi';
import { toast } from '@/store/toast';

const Stat = ({ n, l }: { n: number | string; l: string }) => {
  const th = useTheme();
  return <View style={{ alignItems: 'center', minWidth: 64 }}><Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{n}</Text><Body small muted>{tl(l)}</Body></View>;
};

/** Anteprima di un profilo: nome, nome utente, bio, voto con affidabilità, da quando è iscritto, identità verificata e numeri (seguaci, post, annunci).
 *  Post, idee e annunci veri non si vedono da qui: solo quanti sono e solo quelli che puoi già vedere. */
export function ProfilePreview({ card, onClose, onChange }: { card: Card | null; onClose: () => void; onChange?: (c: Card) => void }) {
  const th = useTheme(); const [busy, setBusy] = useState(false); const [rating, setRating] = useState(false);
  if (!card) return null;
  const rep = card.reputation; const ads = listingsText(card.listings); const since = sinceText(card.since);
  const act = async () => {
    setBusy(true);
    if (card.follow) { const r = await unfollowPerson(card.user_id); if (r.ok) { onChange?.({ ...card, follow: null }); toast('Non lo segui più'); } else toast(r.message); }
    else { const r = await followPerson(card.user_id); if (r.ok) { onChange?.({ ...card, follow: r.data }); toast(r.data === 'pending' ? 'Richiesta inviata: deve accettarla' : 'Ora lo segui'); } else toast(r.message); }
    setBusy(false);
  };
  const vote = async (n: number) => {
    setBusy(true); const r = await ratePerson(card.user_id, n); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    onChange?.(r.data); setRating(false); toast('Grazie per il voto');
  };
  return (
    <Sheet visible title="Profilo" onClose={onClose}>
      <View style={{ gap: 12, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.text, fontSize: 26, fontWeight: '800' }}>{initials(card.display_name)}</Text></View>
        <View style={{ alignItems: 'center' }}>
          <Row gap={6} style={{ justifyContent: 'center' }}>
            <Text style={{ color: th.text, fontSize: 20, fontWeight: '800' }}>{card.display_name}</Text>
            {card.verified ? <Icon name="shield" size={18} color={th.positive} /> : null}
          </Row>
          {card.username ? <Body muted>{`@${card.username}`}</Body> : null}
          {card.verified ? <Body small color={th.positive}>{tl('Identità verificata')}</Body> : null}
        </View>
        {card.bio ? <Body style={{ textAlign: 'center' }}>{card.bio}</Body> : null}

        <View style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: th.border, borderRadius: 14, padding: 12, gap: 4, alignItems: 'center' }}>
          <Row gap={6} style={{ justifyContent: 'center' }}>
            <Icon name="star" size={20} color={rep?.score != null ? th.warn : th.muted} />
            <Text style={{ color: th.text, fontSize: 24, fontWeight: '800' }}>{scoreText(rep)}</Text>
            <Body small muted>{tl('su 5')}</Body>
          </Row>
          <Body small muted>{rep ? (rep.votes ? tl('{0} voti · {1}', rep.votes, tl(CONFIDENCE_TEXT[rep.confidence])) : tl(CONFIDENCE_TEXT.nessuna)) : ''}</Body>
          {card.my_vote ? <Body small muted>{tl('Il tuo voto: {0}', card.my_vote)}</Body> : null}
        </View>

        <Row gap={20} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Stat n={card.followers} l="Seguaci" />
          <Stat n={card.following} l="Segue" />
          {card.posts != null ? <Stat n={card.posts} l="Post" /> : null}
        </Row>
        {ads ? <Body small muted style={{ textAlign: 'center' }}>{tl('Annunci: {0}', ads)}</Body> : null}
        {since ? <Body small muted>{tl('Iscritto da {0}', since)}</Body> : null}

        {card.me ? <Body small muted>{tl('Questo è il tuo profilo.')}</Body> : (
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <Btn icon={card.follow ? 'check' : 'plus'} ghost={!!card.follow} disabled={busy} title={card.follow === 'pending' ? 'Richiesta inviata (annulla)' : card.follow ? 'Segui già (smetti)' : card.follow_approval ? 'Chiedi di seguirlo' : 'Segui'} onPress={() => { void act(); }} />
            {card.follow === 'accepted' ? (
              rating ? (
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Body small muted>{tl('Quante stelle gli dai?')}</Body>
                  <Row gap={4} style={{ justifyContent: 'center' }}>{[1, 2, 3, 4, 5].map((n) => <Press key={n} accessibilityLabel={tl('{0} stelle', n)} disabled={busy} onPress={() => { void vote(n); }} style={{ padding: 6 }}><Icon name="star" size={30} color={th.warn} /></Press>)}</Row>
                </View>
              ) : <Btn ghost small icon="star" title={card.my_vote ? 'Cambia il tuo voto' : 'Dai un voto'} onPress={() => setRating(true)} />
            ) : <Body small muted style={{ textAlign: 'center' }}>{tl('Per votare una persona devi seguirla.')}</Body>}
          </View>
        )}
        <Body small muted style={{ textAlign: 'center' }}>{tl('Qui vedi solo le informazioni principali. Post, idee e annunci li trovi se sono pubblici, oppure se lo segui e li ha aperti a chi lo segue.')}</Body>
      </View>
    </Sheet>
  );
}
