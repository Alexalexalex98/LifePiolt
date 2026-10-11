import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Btn, Card, H, Input, Page, Pill, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go, goBack } from '@/lib/nav';
import { BIZ_COLORS, BIZ_KIND_LABEL, can, lockedReason, validateBusiness, type BizKind } from '@/lib/profile/identity';
import { identityStatusOf } from '@/lib/profile/actions';
import { pickImage } from '@/lib/profile/pickImage';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { toast } from '@/store/toast';

/** Crea (o modifica con ?id) un'attività, associazione o azienda collegata al tuo profilo. */
export default function BusinessCreate() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const existing = useIdentity((s) => s.businesses.find((b) => b.id === id));
  const status = identityStatusOf(me, me);
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<BizKind>(existing?.kind ?? 'attivita');
  const [desc, setDesc] = useState(existing?.desc ?? '');
  const [color, setColor] = useState<string>(existing?.color ?? BIZ_COLORS[0]);
  const [logo, setLogo] = useState<string | undefined>(existing?.logo);
  const [email, setEmail] = useState(existing?.contacts.email ?? '');
  const [phone, setPhone] = useState(existing?.contacts.phone ?? '');
  const [web, setWeb] = useState(existing?.contacts.web ?? '');
  const [showEmail, setShowEmail] = useState(existing?.contacts.showEmail ?? false);
  const [showPhone, setShowPhone] = useState(existing?.contacts.showPhone ?? false);
  const [showWeb, setShowWeb] = useState(existing?.contacts.showWeb ?? true);
  const locked = !existing && !can(status, 'business');

  const save = () => {
    const why = validateBusiness({ name, kind });
    if (why) { toast(why); return; }
    const contacts = { email: email.trim(), phone: phone.trim(), web: web.trim(), showEmail, showPhone, showWeb };
    const st = useIdentity.getState();
    if (existing) { st.updateBusiness(existing.id, { name: name.trim(), kind, desc: desc.trim(), color, logo, contacts }); toast('Attività aggiornata'); goBack(); return; }
    const nid = st.addBusiness({ owner: me, name: name.trim(), kind, desc: desc.trim(), color, logo, contacts });
    toast('Attività creata');
    go('businessPage', { id: nid });
  };

  if (locked) {
    return (
      <Page id="businessCreate" back title="Nuova attività">
        <Card>
          <Body bold>Prima verifica la tua identità</Body>
          <Body small muted style={{ marginTop: 6 }}>{lockedReason(status, 'business')} Ogni attività è collegata alla persona che la crea e mostra il suo nome.</Body>
          <Btn style={{ marginTop: 12 }} icon="lock" title="Verifica identità" onPress={() => go('identityVerify')} />
        </Card>
      </Page>
    );
  }

  return (
    <Page id="businessCreate" back title={existing ? 'Modifica attività' : 'Nuova attività'}>
      <Card>
        <Row style={{ justifyContent: 'flex-start' }} gap={12}>
          <Pressable onPress={async () => { const r = await pickImage('gallery', { aspect: [1, 1] }); if (r.error) toast(r.error); else if (r.uri) setLogo(r.uri); }} accessibilityRole="button" accessibilityLabel="Scegli il logo" style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: color, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {logo ? <Image source={{ uri: logo }} style={{ width: 64, height: 64 }} contentFit="cover" /> : <Body bold color="#fff" style={{ fontSize: 24 }}>{(name.trim().charAt(0) || '+').toUpperCase()}</Body>}
          </Pressable>
          <View style={{ flex: 1 }}><Body bold>Logo</Body><Body small muted>Tocca per scegliere un’immagine, oppure usa un colore.</Body>{logo ? <Btn small ghost style={{ marginTop: 6, alignSelf: 'flex-start' }} title="Togli logo" onPress={() => setLogo(undefined)} /> : null}</View>
        </Row>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 12 }} gap={10}>
          {BIZ_COLORS.map((c) => <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="button" accessibilityLabel={`Colore ${c}`} accessibilityState={{ selected: color === c }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: t.text }} />)}
        </Row>
      </Card>
      <Input placeholder="Nome (es. Panificio Rossi)" value={name} onChangeText={setName} maxLength={60} />
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }} gap={8}>
        {(Object.keys(BIZ_KIND_LABEL) as BizKind[]).map((k) => <Pill key={k} label={BIZ_KIND_LABEL[k]} on={kind === k} onPress={() => setKind(k)} />)}
      </Row>
      <Input multiline style={{ minHeight: 80 }} placeholder="Descrizione: cosa fate" value={desc} onChangeText={setDesc} maxLength={400} />

      <H style={{ marginTop: 8 }}>Contatti pubblici</H>
      <Body small muted style={{ marginBottom: 6 }}>Scegli quali mostrare sulla pagina. Quelli spenti restano privati.</Body>
      {([['Email', email, setEmail, showEmail, setShowEmail, 'email-address'], ['Telefono', phone, setPhone, showPhone, setShowPhone, 'phone-pad'], ['Sito web', web, setWeb, showWeb, setShowWeb, 'url']] as const).map(([l, v, set, on, setOn, kb]) => (
        <Row key={l} style={{ marginBottom: 4 }}><Input flex={1} keyboardType={kb} autoCapitalize="none" placeholder={l} value={v} onChangeText={set} /><Switch value={on} onValueChange={setOn} accessibilityLabel={`Mostra ${l.toLowerCase()}`} /></Row>
      ))}
      <Card style={{ marginTop: 6 }}>
        <Body small muted>Sulla pagina dell’attività comparirà sempre il tuo nome come titolare, con il badge dell’identità: non si può nascondere. L’attività la puoi invece togliere dal tuo profilo quando vuoi.</Body>
      </Card>
      <Btn style={{ marginTop: 12 }} title={existing ? 'Salva' : 'Crea attività'} onPress={save} />
    </Page>
  );
}
