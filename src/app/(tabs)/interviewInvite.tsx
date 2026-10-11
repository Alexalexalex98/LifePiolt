import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Fact, ServerNote } from '@/components/jobs/InterviewParts';
import { Body, Btn, Card, Input, Page, Row, Select, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { canInvite, displayName, SLOT_DURATIONS, SLOT_MAX_COUNT, validateSlots, type Slot } from '@/lib/interview';
import { fmtSlot, inviteCandidate, LANGS, tzNow } from '@/lib/interviewActions';
import { go, goBack } from '@/lib/nav';
import { findConflicts } from '@/lib/planBooking';
import { fmtDuration, nextDays, timeOptions, tsOf } from '@/lib/when';
import { useApp } from '@/store/app';
import { useJobs } from '@/store/jobs';
import { toast } from '@/store/toast';

type Draft = { day: string; time: string; dur: number };
const TZS = [tzNow(), 'Europe/Zurich', 'Europe/Rome', 'Europe/London', 'UTC'].filter((x, i, a) => a.indexOf(x) === i);

export default function InterviewInvite() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === id));
  const job = useJobs((s) => s.jobs.find((j) => j.id === app?.jobId));
  const days = nextDays(21);
  const [slots, setSlots] = useState<Draft[]>([{ day: days[1].key, time: '10:00', dur: 30 }]);
  const [tz, setTz] = useState(tzNow());
  const [lang, setLang] = useState('Italiano');
  const [msg, setMsg] = useState('');
  if (!app || !job || job.owner !== me) return <Page id="interviewInvite" back><Body muted>Candidatura non trovata.</Body></Page>;
  if (!canInvite(app.status, app.iv)) return <Page id="interviewInvite" back title="Invita al colloquio"><Body>Questa candidatura ha già un colloquio in corso o chiuso.</Body><Btn style={{ marginTop: 12 }} title="Torna al candidato" onPress={goBack} /></Page>;

  const name = displayName(app.candidate);
  const asSlots: Slot[] = slots.map((s) => ({ start: tsOf(s.day, s.time), durationMin: s.dur }));
  const set = (i: number, p: Partial<Draft>) => setSlots((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const dayLabel = (k: string) => days.find((d) => d.key === k)?.label ?? days[0].label;
  const addSlot = () => setSlots((cur) => (cur.length >= SLOT_MAX_COUNT ? cur : [...cur, { day: cur[cur.length - 1].day, time: '15:00', dur: cur[cur.length - 1].dur }]));

  const send = () => {
    const err = validateSlots(asSlots, Date.now());
    if (err) { toast(err); return; }
    if (inviteCandidate(app.id, { slots: asSlots, tz, lang, message: msg })) { toast(`Invito inviato a ${name}`); go('applicantView', { id: app.id }); }
    else toast('Non riesco a inviare l’invito');
  };

  return (
    <Page id="interviewInvite" back title="Invita a un colloquio">
      <Card>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}><Body bold>{name}</Body><Body small muted>· {job.title}</Body></Row>
        <Body small muted style={{ marginTop: 6 }}>Colloquio conoscitivo in videochiamata. Con l’invito non ricevi nessun dato in più: vedi ancora solo il nome. Il contatto si sblocca solo se {name} accetta e risponde alla tua chiamata, e solo ciò che sceglie di condividere.</Body>
      </Card>

      <Body bold style={{ marginTop: 10, marginBottom: 6 }}>Proponi da 1 a 3 fasce orarie</Body>
      {slots.map((s, i) => {
        const conflict = findConflicts(s.day, s.time, s.dur)[0];
        return (
          <Card key={i}>
            <Row><Body bold style={{ flex: 1 }}>Fascia {i + 1}</Body>{slots.length > 1 && <XBtn label="Rimuovi la fascia" onPress={() => setSlots((cur) => cur.filter((_, j) => j !== i))} />}</Row>
            <Select title="Giorno" value={dayLabel(s.day)} options={days.map((d) => d.label)} onChange={(l) => set(i, { day: days.find((d) => d.label === l)!.key })} />
            <Row gap={8}>
              <View style={{ flex: 1 }}><Select title="Ora" value={s.time} options={timeOptions(7, 21)} onChange={(v) => set(i, { time: v })} /></View>
              <View style={{ flex: 1 }}><Select title="Durata" value={fmtDuration(s.dur)} options={SLOT_DURATIONS.map((d) => fmtDuration(d))} onChange={(v) => set(i, { dur: SLOT_DURATIONS.find((d) => fmtDuration(d) === v) ?? 30 })} /></View>
            </Row>
            {conflict && <Fact icon="alert" tone={t.warn}>Nel tuo Plan hai già “{conflict.ev.title}” alle {conflict.ev.time}.</Fact>}
          </Card>
        );
      })}
      {slots.length < SLOT_MAX_COUNT && <Btn small ghost icon="plus" title="Aggiungi un’altra fascia" onPress={addSlot} />}

      <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Fuso orario e lingua</Body>
      <Select title="Fuso orario" value={tz} options={TZS} onChange={setTz} />
      <Select title="Lingua del colloquio" value={lang} options={LANGS} onChange={setLang} />

      <Body bold style={{ marginTop: 6, marginBottom: 6 }}>Messaggio (facoltativo)</Body>
      <Input multiline style={{ minHeight: 80 }} maxLength={300} placeholder="Due righe di presentazione, senza chiedere documenti" value={msg} onChangeText={setMsg} />
      <Body small muted style={{ marginBottom: 10 }}>Non puoi chiedere CV, foto o documenti: il colloquio è solo una conversazione.</Body>

      <Card><Body small bold>Riepilogo</Body>{asSlots.map((s, i) => <Fact key={i} icon="calendar">{fmtSlot(s)}</Fact>)}<Fact icon="clock">Fuso: {tz} · Lingua: {lang}</Fact></Card>
      <Btn icon="video" title="Invia l’invito" onPress={send} />
      <ServerNote call />
    </Page>
  );
}
