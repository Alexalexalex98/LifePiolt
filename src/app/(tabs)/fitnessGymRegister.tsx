import { FitHero } from '@/components/fitness/kit';
import { useState } from 'react';

import { Body, Btn, Card, H, Input, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { GymKind } from '@/lib/fitness/data';
import { useApp } from '@/store/app';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** Per palestre e centri: si registrano gratis e chiedono di entrare nel programma. Offrono il servizio e ricevono una parte dei ricavi. */
export default function FitnessGymRegister() {
  const t = useTheme();
  const demo = useApp((s) => s.demo);
  const fit = useFitness();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GymKind>('palestra');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [services, setServices] = useState('');
  const send = () => {
    if (name.trim().length < 3 || city.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim())) { toast('Scrivi nome, città e un\'email valida'); return; }
    fit.requestGym({ name: name.trim(), kind, city: city.trim(), address: address.trim(), email: email.trim(), services: services.trim() });
    setName(''); setCity(''); setAddress(''); setEmail(''); setServices('');
    toast('Richiesta inviata: ti rispondiamo dopo la verifica');
  };
  return (
    <Page id="fitnessGymRegister" back title="Registra il tuo centro">
      <FitHero eyebrow="Per i centri" title="Entra nel programma" sub="Registrati gratis: offri un servizio e ricevi una parte dei ricavi." />
      <Card>
        <H>Entra nel programma LifeFitness</H>
        <Body small muted style={{ marginVertical: 6 }}>Registrarsi è gratuito. Il centro offre l'accesso agli titolari del LifePass e riceve una parte dei ricavi, in base agli ingressi. La percentuale si stabilisce insieme, prima dell'attivazione.</Body>
        <Input placeholder="Nome del centro" value={name} onChangeText={setName} maxLength={60} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>
          {(['palestra', 'piscina', 'centro'] as const).map((k) => <Pill key={k} label={k === 'centro' ? 'Centro sportivo' : k.charAt(0).toUpperCase() + k.slice(1)} on={kind === k} onPress={() => setKind(k)} />)}
        </Row>
        <Input placeholder="Città" value={city} onChangeText={setCity} maxLength={40} />
        <Input placeholder="Indirizzo" value={address} onChangeText={setAddress} maxLength={80} />
        <Input placeholder="Email di contatto" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={80} />
        <Input placeholder="Servizi (separati da virgola)" value={services} onChangeText={setServices} maxLength={160} />
        <Btn style={{ marginTop: 8 }} title="Invia la richiesta" onPress={send} />
        <Body small muted style={{ marginTop: 8 }}>Finché non c'è il server, la richiesta resta su questo telefono come anteprima: la verifica vera avverrà dal nostro team.</Body>
      </Card>
      {fit.requests.length ? (
        <Card>
          <H>Le tue richieste</H>
          {fit.requests.map((r, i) => (
            <Item key={r.id} last={i === fit.requests.length - 1}>
              <Row><Body style={{ flex: 1 }} bold>{r.name}</Body><Pill label={r.status === 'approvata' ? 'Approvata' : 'In verifica'} off color={r.status === 'approvata' ? t.positive : undefined} /></Row>
              <Body small muted>{r.city}{r.services ? ` · ${r.services}` : ''}</Body>
              {demo && r.status !== 'approvata' ? <Btn small ghost style={{ marginTop: 6 }} title="Prova (demo): approva" onPress={() => { fit.approveGym(r.id); toast(tl('Centro approvato: compare tra i convenzionati')); }} /> : null}
            </Item>
          ))}
        </Card>
      ) : null}
    </Page>
  );
}
