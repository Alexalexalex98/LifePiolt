import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SkillRow, TrustCard } from '@/components/jobs';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Item, Page, Row, Sheet } from '@/components/ui';
import { skills } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { trustFor } from '@/lib/trust';
import { useApp } from '@/store/app';
import { PRACTICE_COOLDOWN, profileOf, useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function SkillProfile() {
  const t = useTheme();
  const params = useLocalSearchParams<{ name?: string }>();
  const me = useApp((s) => s.account.name);
  const name = params.name || me;
  const isMe = name === me;
  const applications = useJobs((s) => s.applications), practice = useJobs((s) => s.practice);
  useNet((s) => s.votes);
  const [del, setDel] = useState(false);
  const profile = useMemo(() => profileOf(name), [name, applications, practice]);
  const trust = trustFor(name, me);
  const entries = Object.entries(profile.skills).sort((a, b) => b[1].score - a[1].score);
  const lastTry = (sk: string) => Math.max(0, ...practice.filter((p) => p.person === name && p.skill === sk).map((p) => p.ts));
  const days = (sk: string) => Math.ceil((lastTry(sk) + PRACTICE_COOLDOWN - Date.now()) / 86400000);

  return (
    <Page id="skillProfile" back title={isMe ? 'Il tuo profilo competenze' : 'Competenze'}>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 10 }} gap={10}><UserAvatar name={name} size={44} /><View><Body bold style={{ fontSize: 17 }}>{name}</Body><Body small muted>{profile.tests} {profile.tests === 1 ? 'test svolto' : 'test svolti'}</Body></View></Row>
      <Body small muted style={{ marginBottom: 8 }}>Qui non c’è un curriculum: contano cosa sai fare, misurato con prove pratiche, e i segnali di affidabilità che la rete conosce.</Body>

      <Body bold style={{ marginTop: 6, marginBottom: 8 }}>Cosa sa fare</Body>
      <Card>
        {entries.length === 0 ? <Body small muted>{isMe ? 'Nessuna competenza verificata. Fai una prova qui sotto: bastano 5 minuti.' : 'Nessuna competenza verificata.'}</Body> : entries.map(([sk, r]) => (
          <SkillRow key={sk} skill={sk} value={r.score} note={`${r.attempts} ${r.attempts === 1 ? 'prova' : 'prove'} · ${r.source}${r.provisional ? ' · in valutazione' : ''}`} />
        ))}
      </Card>

      <Body bold style={{ marginTop: 6, marginBottom: 8 }}>Che persona è</Body>
      <TrustCard trust={trust} profile={profile} />

      {isMe && (
        <>
          <Body bold style={{ marginTop: 6, marginBottom: 8 }}>Verifica le tue competenze</Body>
          <Card>
            {[...skills, { id: 'atteggiamento', label: 'Atteggiamento (affidabilità, onestà, collaborazione)', icon: '🧭', desc: '9 scenari di lavoro reale.' }].map((s, i, arr) => {
              const wait = days(s.id);
              return (
                <Item key={s.id} last={i === arr.length - 1} onPress={() => (wait > 0 ? toast(`Potrai ripetere questa prova tra ${wait} ${wait === 1 ? 'giorno' : 'giorni'}`) : go('jobTest', { skill: s.id }))}>
                  <Row><View style={{ flex: 1 }}><Body>{s.icon} {s.label}</Body><Body small muted>{wait > 0 ? `Ripetibile tra ${wait} gg` : s.desc}</Body></View><Body color={wait > 0 ? t.muted : t.accent}>{wait > 0 ? '⏳' : 'Inizia ›'}</Body></Row>
                </Item>
              );
            })}
          </Card>
          <Body small muted style={{ marginTop: 8 }}>Il risultato più recente vale per ogni competenza. Le prove si ripetono dopo 7 giorni, per evitare di “allenarsi sulle risposte”. Chi assume vede solo i risultati e gli indici qui sopra, mai le tue risposte a domande a scelta.</Body>
          <Btn small ghost danger style={{ marginTop: 12 }} title="Elimina i miei risultati" onPress={() => setDel(true)} />
          <Sheet visible={del} title="Eliminare i risultati?" onClose={() => setDel(false)}>
            <Body small muted style={{ marginBottom: 10 }}>Verranno cancellati tutti i test e le candidature da questo dispositivo. Non si può annullare.</Body>
            <Btn danger title="Elimina" onPress={() => { useJobs.getState().deleteResults(me); setDel(false); toast('Risultati eliminati'); }} />
          </Sheet>
        </>
      )}
    </Page>
  );
}
