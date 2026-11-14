import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { initials, type Card } from '@/lib/people';
import { followPerson, unfollowPerson } from '@/lib/peopleApi';
import { toast } from '@/store/toast';

/** Anteprima di un profilo: solo le informazioni principali (nome, nome utente, bio, numeri). Post, idee e annunci non si vedono da qui. */
export function ProfilePreview({ card, onClose, onChange }: { card: Card | null; onClose: () => void; onChange?: (c: Card) => void }) {
  const th = useTheme(); const [busy, setBusy] = useState(false);
  if (!card) return null;
  const act = async () => {
    setBusy(true);
    if (card.follow) { const r = await unfollowPerson(card.user_id); if (r.ok) { onChange?.({ ...card, follow: null }); toast('Non lo segui più'); } else toast(r.message); }
    else { const r = await followPerson(card.user_id); if (r.ok) { onChange?.({ ...card, follow: r.data }); toast(r.data === 'pending' ? 'Richiesta inviata: deve accettarla' : 'Ora lo segui'); } else toast(r.message); }
    setBusy(false);
  };
  return (
    <Sheet visible title="Profilo" onClose={onClose}>
      <View style={{ gap: 12, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.text, fontSize: 26, fontWeight: '800' }}>{initials(card.display_name)}</Text></View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: th.text, fontSize: 20, fontWeight: '800' }}>{card.display_name}</Text>
          {card.username ? <Body muted>{`@${card.username}`}</Body> : null}
        </View>
        {card.bio ? <Body style={{ textAlign: 'center' }}>{card.bio}</Body> : null}
        <Row gap={24}>
          <View style={{ alignItems: 'center' }}><Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{card.followers}</Text><Body small muted>{tl('Seguaci')}</Body></View>
          <View style={{ alignItems: 'center' }}><Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{card.following}</Text><Body small muted>{tl('Segue')}</Body></View>
        </Row>
        {card.me ? <Body small muted>{tl('Questo è il tuo profilo.')}</Body> : (
          <Btn icon={card.follow ? 'check' : 'plus'} ghost={!!card.follow} disabled={busy} title={card.follow === 'pending' ? 'Richiesta inviata (annulla)' : card.follow ? 'Segui già (smetti)' : card.follow_approval ? 'Chiedi di seguirlo' : 'Segui'} onPress={() => { void act(); }} style={{ alignSelf: 'stretch' }} />
        )}
        <Body small muted style={{ textAlign: 'center' }}>{tl('Qui vedi solo le informazioni principali. Post, idee e annunci li trovi se sono pubblici, oppure se lo segui e li ha aperti a chi lo segue.')}</Body>
      </View>
    </Sheet>
  );
}
