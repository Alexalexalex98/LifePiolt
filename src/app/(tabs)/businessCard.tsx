import { useLocalSearchParams } from 'expo-router';
import { Pressable, Switch, Text, View } from 'react-native';

import { UserAvatar, openSheet } from '@/components/network';
import { Body, Card, H, Input, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { hashStr, mulberry32 } from '@/lib/format';
import { bioFor } from '@/lib/network';
import { useApp } from '@/store/app';
import { useNet, type MyCard } from '@/store/network';

export default function BusinessCard() {
  const t = useTheme();
  const { name: param } = useLocalSearchParams<{ name?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const name = param || me;
  const isMe = name === me;
  const c = net.myCard;
  const set = (patch: Partial<MyCard>) => net.patch({ myCard: { ...c, ...patch } });

  const rows: [string, string | number][] = [];
  if (isMe) {
    if (c.showResidence) rows.push(['Residenza', c.residence]);
    if (c.showBirthYear) rows.push(['Anno di nascita', c.birthYear]);
    if (c.showProfession) rows.push(['Professione', c.profession]);
    if (c.showPhone) rows.push(['Telefono', c.phone || '—']);
    if (c.showEmail) rows.push(['Email', c.email]);
  } else rows.push(['Professione', bioFor(name, me)]);

  const rng = mulberry32(hashStr('qr' + name));
  const cells = Array.from({ length: 100 }, () => rng() > 0.5);

  const Field = ({ label, k, vis, numeric }: { label: string; k: keyof MyCard; vis: keyof MyCard; numeric?: boolean }) => (
    <Item><Row><Body style={{ flex: 1 }}>{label}</Body>
      <Input keyboardType={numeric ? 'number-pad' : 'default'} defaultValue={String(c[k] ?? '')} style={{ width: 130, padding: 7, marginBottom: 0 }} onChangeText={(v) => set({ [k]: v } as Partial<MyCard>)} />
      <Switch value={!!c[vis]} onValueChange={(v) => set({ [vis]: v } as Partial<MyCard>)} trackColor={{ true: '#4f7cff', false: t.inputBorder }} thumbColor="#fff" />
    </Row></Item>
  );

  return (
    <Page id="businessCard" title="Biglietto da visita" back>
      <Card style={{ alignItems: 'center', borderColor: '#3a2a5c' }}>
        <UserAvatar name={name} size={68} />
        <H>{name}</H>
        <Body small muted>{isMe ? c.profession : bioFor(name, me)}</Body>
        <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
          {rows.map(([l, v], i) => <Item key={l} last={i === rows.length - 1}><Row><Body muted>{l}</Body><Body bold>{String(v)}</Body></Row></Item>)}
          {rows.length === 0 && <Body small muted>Nessun altro dato reso visibile.</Body>}
        </View>
      </Card>
      <Card style={{ alignItems: 'center' }}>
        <Pressable onPress={() => openSheet('cv', { name })}>
          <View style={{ width: 130, height: 130, backgroundColor: '#0e1219', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2c2242', flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((on, i) => <View key={i} style={{ width: '10%', height: '10%', backgroundColor: on ? '#f4f6f8' : 'transparent' }} />)}
          </View>
        </Pressable>
        <Text onPress={() => openSheet('cv', { name })} style={{ color: '#c9b6ff', fontSize: 13, marginTop: 10 }}>Tocca per il CV completo →</Text>
        <Body small muted style={{ marginTop: 6, textAlign: 'center' }}>Il QR è illustrativo: la versione con codice davvero scansionabile richiede un profilo online.</Body>
      </Card>
      {isMe && (
        <Card>
          <H>Modifica biglietto</H>
          <Field label="Residenza" k="residence" vis="showResidence" />
          <Field label="Anno di nascita" k="birthYear" vis="showBirthYear" numeric />
          <Field label="Professione" k="profession" vis="showProfession" />
          <Field label="Telefono" k="phone" vis="showPhone" />
          <Field label="Email" k="email" vis="showEmail" />
          <Body small muted style={{ marginTop: 12, marginBottom: 4 }}>Contenuto visibile solo dietro al QR (formazione, esperienza, commenti aziendali):</Body>
          <Input multiline style={{ minHeight: 60 }} defaultValue={c.schools} onChangeText={(v) => set({ schools: v })} />
          <Input multiline style={{ minHeight: 60 }} defaultValue={c.experience} onChangeText={(v) => set({ experience: v })} />
          <Input multiline style={{ minHeight: 60 }} defaultValue={c.companyComments} onChangeText={(v) => set({ companyComments: v })} />
        </Card>
      )}
      <Text style={{ height: 0 }}>{''}</Text>
    </Page>
  );
}
