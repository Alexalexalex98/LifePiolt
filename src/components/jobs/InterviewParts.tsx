import { isValidElement, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Input, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { consentNotSees, consentSees, consentWhen, contactText, type Contact, type Share, type TimelineItem } from '@/lib/interview';
import { Icon } from '@/lib/icons';
import { fmtDateTime } from '@/lib/when';
import { useNet } from '@/store/network';

/** "Cosa vede l'azienda e cosa no": sempre uguale, prima di candidarsi e nelle schermate del colloquio. */
export function PrivacyCard({ withWhen = true }: { withWhen?: boolean }) {
  const t = useTheme();
  return (
    <Card>
      <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }} gap={10}>
        <Icon name="shield" size={20} color={t.positive} />
        <View style={{ flex: 1 }}>
          <Body small>{consentSees()}</Body>
          <Body small muted style={{ marginTop: 4 }}>{consentNotSees()}</Body>
          {withWhen && <Body small muted style={{ marginTop: 4 }}>{consentWhen()}</Body>}
        </View>
      </Row>
    </Card>
  );
}

/** Messaggio onesto: senza server inviti e chiamate funzionano solo tra utenti demo su questo telefono. */
export function ServerNote({ call }: { call?: boolean }) {
  return (
    <Body small muted style={{ marginTop: 10 }}>
      {call ? 'Videochiamata: anteprima, la trasmissione reale si attiva col server. ' : ''}Finché non c’è il server, candidature e inviti funzionano solo tra utenti demo su questo telefono.
    </Body>
  );
}

/** Riga con icona + testo (per le fasce, lo stato, ecc.). */
export function Fact({ icon, children, tone }: { icon: string; children: React.ReactNode; tone?: string }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginTop: 6 }} gap={8}>
      <Icon name={icon} size={16} color={tone ?? t.muted} />
      <View style={{ flex: 1 }}>{isValidElement(children) ? children : <Body small>{children}</Body>}</View>
    </Row>
  );
}

/** Scelta del contatto da sbloccare alla risposta: default nessuno extra. */
export function ContactPicker({ value, onChange }: { value: Share; onChange: (s: Share) => void }) {
  const t = useTheme();
  const card = useNet((s) => s.myCard);
  const [email, setEmail] = useState(value.email || card.email || '');
  const [phone, setPhone] = useState(value.phone || card.phone || '');
  const row = (label: string, on: boolean, flip: () => void) => (
    <Pressable onPress={flip} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <Icon name={on ? 'checksquare' : 'square'} size={20} color={on ? t.accent : t.muted} />
      <Text style={{ color: t.text, flex: 1 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View>
      <Body small muted style={{ marginBottom: 4 }}>Di base non condividi nulla oltre al canale della videochiamata. Puoi cambiare idea fino al momento in cui rispondi.</Body>
      {row('Il mio nome completo', value.fullName, () => onChange({ ...value, fullName: !value.fullName }))}
      {row('La mia email', !!value.email, () => onChange({ ...value, email: value.email ? '' : email.trim() }))}
      <Input placeholder="Email da condividere" value={email} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => { setEmail(v); if (value.email) onChange({ ...value, email: v.trim() }); }} />
      {row('Il mio telefono', !!value.phone, () => onChange({ ...value, phone: value.phone ? '' : phone.trim() }))}
      <Input placeholder="Telefono da condividere" value={phone} keyboardType="phone-pad" onChangeText={(v) => { setPhone(v); if (value.phone) onChange({ ...value, phone: v.trim() }); }} />
    </View>
  );
}

/** Contatto sbloccato, visto dall'azienda. */
export function ContactBox({ contact, unlockedAt }: { contact: Contact; unlockedAt: number }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.item, borderRadius: 12, padding: 12, marginTop: 10 }}>
      <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="lock" size={16} color={t.positive} /><Body bold>Contatto sbloccato</Body></Row>
      <Body small muted style={{ marginTop: 2 }}>Contatto sbloccato il {fmtDateTime(unlockedAt)} durante il colloquio.</Body>
      <Body style={{ marginTop: 6 }}>{contactText(contact)}</Body>
    </View>
  );
}

/** Cronologia "Cosa ha visto l'azienda e quando". */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const t = useTheme();
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent, marginTop: 5 }} />
            {i < items.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: t.border, marginTop: 2 }} />}
          </View>
          <View style={{ flex: 1 }}>
            <Body bold>{it.title}</Body>
            <Body small muted>{fmtDateTime(it.ts)}</Body>
            {it.sees ? <Body small style={{ marginTop: 2 }}>{it.sees}</Body> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Piccola etichetta colorata di stato. */
export function StatusTag({ text, tone }: { text: string; tone?: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const t = useTheme();
  const c = tone === 'ok' ? t.positive : tone === 'warn' ? t.warn : tone === 'bad' ? t.danger : t.muted;
  return <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>{text}</Text>;
}

/** Voto 0-100 a 5 scatti + campo libero, usato per valutare risposte aperte e prove. */
export function GradeBox({ score, onGive, label = 'Il tuo voto (0-100)' }: { score: number | undefined; onGive: (v: number) => void; label?: string }) {
  const [txt, setTxt] = useState('');
  return (
    <View>
      <Body small style={{ marginTop: 8, marginBottom: 4 }}>{label}: {score != null ? score : 'da dare'}</Body>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={6}>
        {[0, 25, 50, 75, 100].map((v) => <Pill key={v} label={String(v)} on={score === v} onPress={() => onGive(v)} />)}
      </Row>
      <Row style={{ marginTop: 8 }} gap={8}>
        <Input flex={1} keyboardType="numeric" placeholder="Altro voto, es. 85" value={txt} onChangeText={setTxt} style={{ marginBottom: 0 }} />
        <Btn small ghost title="Dai voto" onPress={() => { const n = Number(txt.replace(',', '.')); if (!Number.isFinite(n) || n < 0 || n > 100 || !txt.trim()) return; onGive(Math.round(n)); setTxt(''); }} />
      </Row>
    </View>
  );
}
