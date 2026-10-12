import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { ProfileClubSection } from '@/components/club/ProfileClubSection';
import { IdBadge, removeBusinessFlow } from '@/components/profile/ProfileParts';
import { Body, Btn, Card, Chev, Empty, Item, Page, Row, Switch } from '@/components/ui';
import { LpTag, UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { BIZ_KIND_LABEL, businessView, publicContacts, roleIn, teamOf } from '@/lib/profile/identity';
import { identityStatusOf } from '@/lib/profile/actions';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

/** Pagina pubblica di un'attività: il titolare (persona verificata) è SEMPRE mostrato e non è oscurabile. */
export default function BusinessPage() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const b = useIdentity((s) => s.businesses.find((x) => x.id === id));
  const jobs = useJobs((s) => s.jobs);
  const net = useNet();
  if (!b) {
    return <Page id="businessPage" back title="Attività"><Empty text="Questa attività non esiste più." /></Page>;
  }
  const isOwner = b.owner === me;
  const v = businessView(b, identityStatusOf(b.owner, me) === 'verified');
  const contacts = publicContacts(b.contacts);
  const offers = jobs.filter((j) => j.owner === b.owner && j.status === 'open' && j.company.trim().toLowerCase() === b.name.trim().toLowerCase());
  const ads = (net.products ?? []).filter((p) => p.shop === b.owner);
  const provider = net.providers.find((x) => x.name === b.owner);
  const seminars = net.seminars.filter((x) => x.host === b.owner);
  const open = (c: { kind: 'email' | 'phone' | 'web'; value: string }) => {
    const url = c.kind === 'email' ? `mailto:${c.value}` : c.kind === 'phone' ? `tel:${c.value}` : /^https?:/.test(c.value) ? c.value : `https://${c.value}`;
    Linking.openURL(url).catch(() => toast('Non riesco ad aprire questo contatto'));
  };
  return (
    <Page id="businessPage" back title={b.name}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: b.color, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {b.logo ? <Image source={{ uri: b.logo }} style={{ width: 72, height: 72 }} contentFit="cover" /> : <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{b.name.trim().charAt(0).toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>{BIZ_KIND_LABEL[b.kind]}</Text>
          <Pressable onPress={() => go('userProfile', { name: v.owner })} accessibilityRole="link" accessibilityLabel={tl('Titolare: {0}', v.owner)}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{v.ownerLine}</Text>
          </Pressable>
          <Text style={{ color: t.muted, fontSize: 13 }}>{roleIn(b, b.owner)}</Text>
          <IdBadge status={v.ownerVerified ? 'verified' : 'none'} />
        </View>
      </View>
      {b.desc ? <Text style={{ color: t.text, fontSize: 15, lineHeight: 22, marginTop: 14 }}>{b.desc}</Text> : null}

      {contacts.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          {contacts.map((c, i) => (
            <Item key={c.kind} last={i === contacts.length - 1} onPress={() => open(c)}>
              <Row><Icon name={c.kind === 'email' ? 'send' : c.kind === 'phone' ? 'phone' : 'link'} size={18} color={t.muted} /><Body style={{ flex: 1 }}>{c.value}</Body><Chev /></Row>
            </Item>
          ))}
        </Card>
      )}

      {teamOf(b).length > 1 && (
        <View style={{ marginTop: 18 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginBottom: 8 }}>Le persone della pagina</Text>
          <Card>
            {teamOf(b).map((m, i, arr) => (
              <Item key={m.name} last={i === arr.length - 1} onPress={() => go('userProfile', { name: m.name })}>
                <Row><UserAvatar name={m.name} size={36} /><View style={{ flex: 1, marginStart: 10 }}><Body bold>{m.name}{m.name === me ? ' (tu)' : ''}</Body><Body small muted>{m.role}</Body></View><Chev /></Row>
              </Item>
            ))}
          </Card>
        </View>
      )}

      <View style={{ marginTop: 18 }}>
        <Row style={{ marginBottom: 8 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1 }}>Annunci di prodotti</Text>
          {isOwner && <Btn small icon="plus" title="Crea annuncio" onPress={() => go('shopPage', { name: me, new: '1' })} />}
        </Row>
        {ads.length === 0 ? <Card><Body small muted>{isOwner ? 'Non hai ancora annunci. Crea il primo: foto, descrizione e prezzo in LifePoints. Lo vedono tutti nel Marketplace.' : 'Nessun annuncio al momento.'}</Body></Card> : (
          <Card>
            {ads.map((p, i) => (
              <Item key={p.id} last={i === ads.length - 1} onPress={() => go('shopPage', { name: b.owner })}>
                <Row>
                  <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: p.color, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={{ width: 54, height: 54 }} contentFit="cover" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>{p.name.charAt(0)}</Text>}
                  </View>
                  <View style={{ flex: 1, marginStart: 10 }}><Body bold numberOfLines={1}>{p.name}</Body><Body small muted>{p.stock > 0 ? tl('{0} disponibili', p.stock) : 'Esaurito'}</Body></View>
                  <Row gap={2}><Body bold>{p.price}</Body><LpTag size={13} /></Row>
                </Row>
              </Item>
            ))}
          </Card>
        )}
      </View>

      {offers.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginBottom: 8 }}>Offerte di lavoro</Text>
          <Card>{offers.map((j, i) => <Item key={j.id} last={i === offers.length - 1} onPress={() => go('jobDetail', { id: j.id })}><Row><View style={{ flex: 1 }}><Body bold>{j.title}</Body><Body small muted>{j.location} · {j.kind}</Body></View><Chev /></Row></Item>)}</Card>
        </View>
      )}
      {(provider || seminars.length > 0) && (
        <View style={{ marginTop: 18 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginBottom: 8 }}>Servizi e seminari</Text>
          <Card>
            {provider && <Item last={!seminars.length} onPress={() => go('servicePage', { name: b.owner })}><Row><View style={{ flex: 1 }}><Body bold>{provider.role}</Body><Body small muted>{tl('Servizio · {0} LP a sessione', provider.price)}</Body></View><Chev /></Row></Item>}
            {seminars.map((s, i) => <Item key={s.id} last={i === seminars.length - 1} onPress={() => go('seminarPage', { id: String(s.id) })}><Row><View style={{ flex: 1 }}><Body bold>{s.title}</Body><Body small muted>Seminario</Body></View><Chev /></Row></Item>)}
          </Card>
        </View>
      )}
      <View style={{ marginTop: 18 }}><ProfileClubSection owner={b.owner} /></View>

      {isOwner && (
        <Card style={{ marginTop: 18 }}>
          <Row><View style={{ flex: 1 }}><Body bold>Mostra sul mio profilo</Body><Body small muted>Se la togli, l’attività esiste ancora ma non è elencata sul tuo profilo. Il tuo nome resta sulla sua pagina.</Body></View>
            <Switch value={!b.hiddenOnProfile} onValueChange={(on) => useIdentity.getState().updateBusiness(b.id, { hiddenOnProfile: !on })} accessibilityLabel="Mostra sul mio profilo" /></Row>
          <Row style={{ marginTop: 12 }} gap={8}>
            <Btn small ghost style={{ flex: 1 }} icon="edit" title="Modifica" onPress={() => go('businessCreate', { id: b.id })} />
            <Btn small ghost danger style={{ flex: 1 }} icon="trash" title="Elimina" onPress={() => removeBusinessFlow(b.id, () => go('userProfile'))} />
          </Row>
        </Card>
      )}
    </Page>
  );
}
