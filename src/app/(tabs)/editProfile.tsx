import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, H, Input, Page, Row, Seg, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { goBack } from '@/lib/nav';
import { ACCENTS, BANNERS, DEFAULT_LOOK, PILL_IDS, PILL_LABEL, SECTION_LABEL, TAB_IDS, moveSection, type SectionId } from '@/lib/profile/look';
import { pickImage } from '@/lib/profile/pickImage';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const SIZE_LABEL = { S: 'Piccolo', M: 'Medio', L: 'Grande' } as const;

/** Modifica del profilo: ogni parte (foto, copertina, testi, colori, sezioni) si cambia da qui. Le modifiche si salvano subito. */
export default function EditProfile() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const photo = useApp((s) => s.account.photo);
  const look = useIdentity((s) => s.look) ?? DEFAULT_LOOK;
  const patch = useIdentity((s) => s.patchLook);
  const bio = useNet((s) => s.bio);
  const patchNet = useNet((s) => s.patch);
  const [bioDraft, setBioDraft] = useState(bio);

  async function choosePhoto(source: 'gallery' | 'camera') {
    const r = await pickImage(source, { aspect: [1, 1] });
    if (r.error) toast(r.error);
    if (r.uri) useApp.setState((s) => ({ account: { ...s.account, photo: r.uri ?? undefined } }));
  }
  async function chooseBanner() {
    const r = await pickImage('gallery', { aspect: [3, 1] });
    if (r.error) toast(r.error);
    if (r.uri) patch({ banner: { uri: r.uri, c1: look.banner?.c1 ?? BANNERS[0].c1, c2: look.banner?.c2 ?? BANNERS[0].c2 } });
  }
  const label = (txt: string) => <Text style={{ color: t.muted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 4 }}>{txt}</Text>;

  return (
    <Page id="editProfile" back title="Modifica profilo">
      <Card>
        <H>Foto</H>
        <Row style={{ justifyContent: 'flex-start' }} gap={14}>
          <UserAvatar name={me} size={72} />
          <View style={{ flex: 1, gap: 8 }}>
            <Btn small ghost icon="image" title="Scegli dalla galleria" onPress={() => choosePhoto('gallery')} />
            <Btn small ghost icon="camera" title="Scatta una foto" onPress={() => choosePhoto('camera')} />
            {photo ? <Btn small ghost danger icon="trash" title="Rimuovi la foto" onPress={() => useApp.setState((s) => ({ account: { ...s.account, photo: undefined } }))} /> : null}
          </View>
        </Row>
        {label('Copertina')}
        <View style={{ height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: t.item }}>
          {look.banner ? (look.banner.uri ? <Image source={{ uri: look.banner.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <LinearGradient colors={[look.banner.c1, look.banner.c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />) : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Body small muted>Nessuna copertina</Body></View>}
        </View>
        <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
          {BANNERS.map((b) => (
            <Pressable key={b.c1 + b.c2} onPress={() => patch({ banner: b })} accessibilityRole="button" accessibilityLabel="Colori della copertina" style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', borderWidth: look.banner && !look.banner.uri && look.banner.c1 === b.c1 ? 2 : 0, borderColor: t.text }}>
              <LinearGradient colors={[b.c1, b.c2]} style={{ flex: 1 }} />
            </Pressable>
          ))}
          <Btn small ghost icon="image" title="Foto" onPress={chooseBanner} />
          {look.banner ? <Btn small ghost danger icon="trash" title="Togli" onPress={() => patch({ banner: null })} /> : null}
        </Row>
      </Card>

      <Card>
        <H>Testi</H>
        <Body small muted>Nome e cognome si cambiano da Impostazioni, sezione Account.</Body>
        {label('Titolo sotto il nome')}
        <Input placeholder="Es. Fotografa · Milano" maxLength={60} value={look.headline} onChangeText={(v) => patch({ headline: v })} />
        {label('Biografia')}
        <Input multiline maxLines={6} style={{ minHeight: 80 }} placeholder="Racconta chi sei…" value={bioDraft} onChangeText={(v) => { setBioDraft(v); patchNet({ bio: v.trim() }); }} />
        {label('Luogo')}
        <Input placeholder="Dove vivi o lavori" maxLength={40} value={look.place} onChangeText={(v) => patch({ place: v })} />
        {label('Link')}
        <Input autoCapitalize="none" keyboardType="url" placeholder="Il tuo sito" maxLength={120} value={look.link} onChangeText={(v) => patch({ link: v })} />
        {label('Grandezza del nome')}
        <Seg options={['Piccolo', 'Medio', 'Grande']} value={SIZE_LABEL[look.nameSize]} onChange={(v) => patch({ nameSize: v === 'Piccolo' ? 'S' : v === 'Grande' ? 'L' : 'M' })} />
      </Card>

      <Card>
        <H>Colore del profilo</H>
        <Row gap={10} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <Pressable onPress={() => patch({ accent: null })} accessibilityRole="button" accessibilityLabel="Colore dell'app" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: look.accent ? t.border : t.text, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} color={t.muted} /></Pressable>
          {ACCENTS.map((c) => (
            <Pressable key={c} onPress={() => patch({ accent: c })} accessibilityRole="button" accessibilityLabel={`Colore ${c}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: look.accent === c ? 3 : 0, borderColor: t.text }} />
          ))}
        </Row>
        <Body small muted style={{ marginTop: 8 }}>Colora l'anello della foto, le pillole, le schede e il link.</Body>
      </Card>

      <Card>
        <H>Sezioni del profilo</H>
        <Body small muted style={{ marginBottom: 6 }}>Scegli cosa mostrare e in quale ordine.</Body>
        {look.order.map((id: SectionId, i) => {
          const on = !look.hidden.includes(id);
          return (
            <Row key={id} style={{ paddingVertical: 6 }} gap={6}>
              <View style={{ flex: 1 }}><Toggle label={SECTION_LABEL[id]} value={on} onChange={() => patch({ hidden: toggleIn(look.hidden, id) as SectionId[] })} /></View>
              <Pressable disabled={i === 0} onPress={() => patch({ order: moveSection(look.order, id, -1) })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Sposta su: ${SECTION_LABEL[id]}`} style={{ opacity: i === 0 ? 0.3 : 1, padding: 6 }}><Icon name="arrow-up" size={18} color={t.text} /></Pressable>
              <Pressable disabled={i === look.order.length - 1} onPress={() => patch({ order: moveSection(look.order, id, 1) })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Sposta giù: ${SECTION_LABEL[id]}`} style={{ opacity: i === look.order.length - 1 ? 0.3 : 1, padding: 6 }}><Icon name="arrow-down" size={18} color={t.text} /></Pressable>
            </Row>
          );
        })}
      </Card>

      <Card>
        <H>Pillole</H>
        {PILL_IDS.map((id) => <Toggle key={id} label={PILL_LABEL[id]} value={!look.hiddenPills.includes(id)} onChange={() => patch({ hiddenPills: toggleIn(look.hiddenPills, id) })} />)}
        <H style={{ marginTop: 12 }}>Schede dei contenuti</H>
        {TAB_IDS.map((id) => <Toggle key={id} label={id} value={!look.hiddenTabs.includes(id)} onChange={() => patch({ hiddenTabs: toggleIn(look.hiddenTabs, id) })} />)}
      </Card>

      <Card>
        <Toggle label="Mostra l'icona di verifica accanto al nome" hint="Toccandola compare «Identità verificata»." value={look.showVerified} onChange={(v) => patch({ showVerified: v })} />
      </Card>

      <Row gap={10} style={{ marginTop: 4 }}>
        <Btn style={{ flex: 1 }} ghost title="Ripristina" onPress={() => { patch({ ...DEFAULT_LOOK }); toast('Aspetto ripristinato'); }} />
        <Btn style={{ flex: 1 }} title="Fatto" onPress={goBack} />
      </Row>
    </Page>
  );
}
