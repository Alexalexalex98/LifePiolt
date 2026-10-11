import { useState } from 'react';
import { View } from 'react-native';

import { SkillChip } from '@/components/profile/ProfileParts';
import { Body, Btn, Card, H, Input, Item, Page, Pill, Row } from '@/components/ui';
import { skills as bank, skillLabel } from '@/data/skillBank';
import { confirmDelete } from '@/lib/confirm';
import { go } from '@/lib/nav';
import { skillIdFor, skillStatesOf } from '@/lib/profile/actions';
import { CONFIRM_MIN, HONESTY_NOTICE } from '@/lib/profile/skills';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

/** Dichiara le tue competenze, rispondi alle richieste di verifica e segui quelle che hai inviato. */
export default function SkillVerify() {
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const declared = useIdentity((s) => s.declared);
  const requests = useIdentity((s) => s.requests);
  useJobs((s) => s.practice);
  const [label, setLabel] = useState('');
  const states = skillStatesOf(me, me);
  const incoming = requests.filter((r) => r.to === me);
  const sent = requests.filter((r) => r.by === me);

  const add = (l: string, id?: string) => {
    const why = useIdentity.getState().declare(l, id ?? skillIdFor(l));
    if (why) { toast(why); return; }
    setLabel('');
    toast(tl('Competenza dichiarata: «{0}»', l.trim()));
  };
  const respond = (rid: string, ok: boolean, skill: string) => {
    useIdentity.getState().respondVerification(rid, ok);
    toast(ok ? 'Verifica accettata: ora svolgi la prova' : 'Verifica rifiutata: la competenza resta non verificata');
    if (ok && !skill.startsWith('custom:')) go('jobTest', { skill });
  };
  const preview = (by: string, to: string, skill: string) => {
    // solo demo: recapita sul telefono la richiesta come se la ricevesse il titolare
    useNet.getState().notify('system', tl('{0} ti chiede di verificare la competenza «{1}»', by, skillLabel(skill)), false, { kind: 'system', ref: 'system' });
    void to;
  };

  return (
    <Page id="skillVerify" back title="Le mie competenze">
      <Card>
        <Body bold>{HONESTY_NOTICE}</Body>
        <Body small muted style={{ marginTop: 6 }}>Chi assume può chiederti di verificare qualunque competenza dichiarata. Se una prova va sotto {CONFIRM_MIN}/100, o rifiuti la verifica, la competenza resta visibile ma come «non verificata». Dichiarare ciò che non si sa fare è sanzionabile.</Body>
      </Card>

      <H style={{ marginTop: 14 }}>Dichiara una competenza</H>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 8 }} gap={8}>
        {bank.filter((b) => !declared.some((d) => d.id === b.id)).map((b) => <Pill key={b.id} label={`+ ${b.label}`} onPress={() => add(b.label, b.id)} />)}
      </Row>
      <Row><Input flex={1} placeholder="Un’altra competenza (es. Saldatura)" value={label} onChangeText={setLabel} maxLength={40} /><Btn small title="Aggiungi" onPress={() => add(label)} /></Row>

      <H style={{ marginTop: 14 }}>Dichiarate ({states.length})</H>
      <Card>
        {states.length === 0 ? <Body small muted>Ancora nessuna competenza.</Body> : states.map((s, i) => (
          <Item key={s.id} last={i === states.length - 1}>
            <Row>
              <View style={{ flex: 1, gap: 4 }}><Body bold>{s.label}</Body><View style={{ flexDirection: 'row' }}><SkillChip s={s} /></View></View>
              {!s.id.startsWith('custom:') && s.status !== 'verified_test' && s.status !== 'verified_live' && <Btn small ghost title="Verifica" onPress={() => go('jobTest', { skill: s.id })} />}
              <Btn small ghost danger icon="trash" title="" label="Togli" onPress={() => { const d = useIdentity.getState().declared.find((x) => x.id === s.id); if (d) confirmDelete(tl('la competenza «{0}»', s.label), () => useIdentity.getState().undeclare(s.id), () => useIdentity.getState().restoreDeclared(d)); }} />
            </Row>
          </Item>
        ))}
      </Card>

      <H style={{ marginTop: 14 }}>Richieste ricevute</H>
      <Card>
        {incoming.length === 0 ? <Body small muted>Nessuna richiesta.</Body> : incoming.map((r, i) => (
          <Item key={r.id} last={i === incoming.length - 1}>
            <Body bold>{skillLabel(r.skill)}</Body>
            <Body small muted>{tl('Richiesta di {0}', r.by)} · {r.status === 'requested' ? 'in attesa di risposta' : r.status === 'accepted' ? 'accettata' : 'rifiutata'}</Body>
            {r.status === 'requested' && <Row style={{ marginTop: 8 }} gap={8}><Btn small style={{ flex: 1 }} title="Accetta" onPress={() => respond(r.id, true, r.skill)} /><Btn small ghost style={{ flex: 1 }} title="Rifiuta" onPress={() => respond(r.id, false, r.skill)} /></Row>}
          </Item>
        ))}
      </Card>

      <H style={{ marginTop: 14 }}>Richieste inviate</H>
      <Card>
        {sent.length === 0 ? <Body small muted>Dal profilo di una persona, accanto a una competenza, trovi «Richiedi verifica».</Body> : sent.map((r, i) => (
          <Item key={r.id} last={i === sent.length - 1}>
            <Body bold>{skillLabel(r.skill)} · {r.to}</Body>
            <Body small muted>{r.status === 'requested' ? 'In attesa di risposta' : r.status === 'accepted' ? 'Accettata' : 'Rifiutata: verifica non effettuata'}</Body>
            {demo && r.status === 'requested' && (
              <Row style={{ marginTop: 8 }} gap={8}>
                <Btn small ghost style={{ flex: 1 }} title="Anteprima: accetta" onPress={() => { preview(r.by, r.to, r.skill); useIdentity.getState().respondVerification(r.id, true); }} />
                <Btn small ghost style={{ flex: 1 }} title="Anteprima: rifiuta" onPress={() => useIdentity.getState().respondVerification(r.id, false)} />
              </Row>
            )}
          </Item>
        ))}
      </Card>
    </Page>
  );
}
