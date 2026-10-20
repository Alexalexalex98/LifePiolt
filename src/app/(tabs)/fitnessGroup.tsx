import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { FIT, FitHero } from '@/components/fitness/kit';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, H, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PARTNER_GYMS } from '@/lib/fitness/data';
import { SMALL_GROUP, daysLeft, gymSlots, groupState, scheduleLabel, slotLabel } from '@/lib/fitness/groups';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useFitGroups } from '@/store/fitGroups';
import { useFitness } from '@/store/fitness';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Un gruppo di allenamento: chi c'è, quando e dove ci si allena, come entrare; la community del gruppo è un tocco più in là. */
export default function FitnessGroup() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const fg = useFitGroups();
  const fit = useFitness();
  const lp = useNet((s) => s.lifePoints);
  const g = fg.groups.find((x) => x.id === id);
  if (!g) return <Page id="fitnessGroup" back title="Gruppo"><Card><Empty text="Gruppo non trovato." /></Card></Page>;
  const st = groupState(g, me);
  const gym = [...PARTNER_GYMS, ...fit.approved].find((x) => x.id === g.gymId);
  const inside = st === 'owner' || st === 'member';
  return (
    <Page id="fitnessGroup" back title={g.name}>
      <FitHero eyebrow={g.kind === 'paid' ? `${g.priceLP} LP ${tl('al mese')}` : 'Gratuito'} title={g.name} sub={`${tl('di {0}', g.owner)} · ${tl('{0} di {1} persone', g.members.length, g.max)}`} />
      <Card>
        <Row gap={10} style={{ justifyContent: 'flex-start' }}><Icon name="clock" size={18} color={FIT} /><Body>{scheduleLabel(g)}</Body></Row>
        <Row gap={10} style={{ justifyContent: 'flex-start', marginTop: 6 }}><Icon name="location" size={18} color={FIT} /><Body>{gym ? `${gym.name}, ${gym.city}` : g.city || 'Luogo da concordare nel gruppo'}</Body></Row>
        {gym ? <Body small muted style={{ marginTop: 8 }}>Ognuno entra con il proprio LifePass. {g.max > SMALL_GROUP ? `Gruppo grande: il centro lo accetta solo in queste fasce (${gymSlots(gym).map(slotLabel).join(' · ')}) e un solo gruppo grande alla volta.` : ''}</Body> : null}
        {g.desc ? <Body style={{ marginTop: 10 }}>{g.desc}</Body> : null}
        {g.demo ? <Body small muted style={{ marginTop: 8 }}>Gruppo di esempio (modalità demo).</Body> : null}
      </Card>

      <Card accent={FIT}>
        {st === 'owner' ? <Body bold>Questo gruppo lo organizzi tu.</Body> : null}
        {st === 'member' ? <Body bold>{g.kind === 'paid' ? tl('Sei dentro: ancora {0} giorni', daysLeft(g.paidUntil[me] ?? 0)) : 'Sei dentro il gruppo.'}</Body> : null}
        {st === 'expired' ? <><Body bold>Il tuo mese è scaduto.</Body><Btn style={{ marginTop: 8 }} title={`Rinnova · ${g.priceLP} LP`} onPress={() => toast(fg.payJoin(g.id, me).message)} /></> : null}
        {st === 'pending' ? <Body bold>Richiesta inviata: aspetta la risposta di {g.owner}.</Body> : null}
        {st === 'declined' ? <><Body bold>La tua richiesta non è stata accettata.</Body><Body small muted>Puoi riprovare più avanti.</Body><Btn small ghost style={{ marginTop: 8 }} title="Chiedi di nuovo" onPress={() => toast(fg.requestJoin(g.id, me).message)} /></> : null}
        {st === 'full' ? <Body bold>Il gruppo è al completo.</Body> : null}
        {st === 'open' && g.kind === 'free' ? <><Body small muted style={{ marginBottom: 8 }}>{g.owner} decide se accettarti: ti avvisa qui.</Body><Btn title="Chiedi di entrare" onPress={() => toast(fg.requestJoin(g.id, me).message)} /></> : null}
        {st === 'open' && g.kind === 'paid' ? <><Body small muted style={{ marginBottom: 8 }}>{tl('Paghi {0} LP per 30 giorni e sei dentro subito. Hai {1} LP.', g.priceLP, lp)}</Body><Btn title={`Entra · ${g.priceLP} LP`} onPress={() => toast(fg.payJoin(g.id, me).message)} /></> : null}
        <Btn ghost style={{ marginTop: 8 }} icon="users" title={inside ? 'Apri la community del gruppo' : 'Guarda la community del gruppo'} onPress={() => go('communityProfile', { id: String(g.communityId) })} />
        {st === 'member' || st === 'expired' ? <Btn small ghost style={{ marginTop: 6 }} title="Esci dal gruppo" onPress={() => { fg.leave(g.id, me); toast('Sei uscito dal gruppo'); }} /> : null}
      </Card>

      {st === 'owner' && g.requests.length ? (
        <Card>
          <H>{tl('Richieste ({0})', g.requests.length)}</H>
          {g.requests.map((r, i) => (
            <Item key={r.name} last={i === g.requests.length - 1}>
              <Row gap={10}><UserAvatar name={r.name} size={36} /><Body bold style={{ flex: 1 }}>{r.name}</Body>
                <Btn small title="Accetta" onPress={() => { fg.decide(g.id, r.name, true); toast(tl('{0} è nel gruppo', r.name)); }} />
                <Btn small ghost title="Rifiuta" onPress={() => { fg.decide(g.id, r.name, false); toast('Richiesta rifiutata'); }} /></Row>
            </Item>
          ))}
        </Card>
      ) : null}

      <Card>
        <H>{tl('Chi c’è ({0})', g.members.length)}</H>
        {g.members.map((m, i) => (
          <Item key={m} last={i === g.members.length - 1} onPress={() => go('userProfile', { name: m })}>
            <Row gap={10}><UserAvatar name={m} size={34} /><Body style={{ flex: 1 }}>{m}</Body>{m === g.owner ? <Pill label="Organizza" off /> : null}</Row>
          </Item>
        ))}
      </Card>
      {st === 'owner' ? <Btn ghost danger title="Elimina il gruppo" onPress={() => { fg.remove(g.id); toast('Gruppo eliminato'); go('fitnessGroups'); }} /> : null}
      <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 8 }}>{tl('I pagamenti sono solo in LifePoints.')}</Text>
    </Page>
  );
}
