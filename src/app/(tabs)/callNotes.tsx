import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Item, Page, Row } from '@/components/ui';
import { whenLabel } from '@/lib/callActions';
import { buildNotes, hasNotes, notesToText, transcriptText } from '@/lib/callNotes';
import { confirmDelete } from '@/lib/confirm';
import { goBack } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

/** Gli appunti presi da Theia in una call: decisioni, cose da fare, domande e numeri. Si salvano nelle note, si trasformano in task, si mandano nella chat. */
export default function CallNotesPage() {
  const { chat: chatId = '', mid = '' } = useLocalSearchParams<{ chat?: string; mid?: string }>();
  const me = useApp((s) => s.account.name);
  const msg = useChat((s) => s.messages[chatId]?.find((m) => m.id === mid));
  const call = msg?.call, rec = msg?.callRecord;
  const notes = useMemo(() => rec?.notes ?? buildNotes(rec?.transcript ?? []), [rec]);
  const [showAll, setShowAll] = useState(false);
  const [added, setAdded] = useState<number[]>([]);
  if (!call || !rec) return <Page id="callNotes" back title="Appunti"><Body muted>Appunti non trovati.</Body></Page>;
  const text = notesToText({ title: call.title, date: whenLabel(call.startsAt), participants: [...new Set([...call.joined, ...Object.keys(call.rsvp).filter((n) => call.rsvp[n] === 'yes'), call.by])], notes });
  const saveNote = () => { useLife.getState().saveNote(null, text); toast('Salvato nelle tue note'); };
  const addTask = (i: number) => {
    const a = notes.actions[i];
    useLife.getState().addTask({ t: `${a.text}${a.due ? ` (${a.due})` : ''}` });
    setAdded((l) => [...l, i]);
    toast('Aggiunto ai tuoi task');
  };
  const share = () => {
    useChat.getState().send(chatId, me, { kind: 'note', noteShare: { title: tl('Appunti: {0}', call.title), text } });
    toast('Appunti mandati nella chat'); 
  };
  const sec = (title: string, rows: React.ReactNode[]) => rows.length ? <Card><H>{title}</H>{rows}</Card> : null;
  return (
    <Page id="callNotes" back title={tl('Appunti: {0}', call.title)}>
      <Body small muted>{whenLabel(call.startsAt)} · presi da Theia sul telefono, solo con il consenso di chi parlava. Controllali prima di condividerli: Theia può sbagliare.</Body>
      {!hasNotes(notes) ? <Card style={{ marginTop: 12 }}><Body muted>Nessun punto importante rilevato.</Body></Card> : null}
      <View style={{ gap: 12, marginTop: 12 }}>
        {sec('Decisioni', notes.decisions.map((d, i) => <Item key={i} last={i === notes.decisions.length - 1}><Body>{d.text}</Body><Body small muted>{d.speaker}</Body></Item>))}
        {sec('Da fare', notes.actions.map((a, i) => (
          <Item key={i} last={i === notes.actions.length - 1}>
            <Row gap={8}><View style={{ flex: 1 }}><Body>{a.text}</Body><Body small muted>{a.owner}{a.due ? ` · ${a.due}` : ''}</Body></View>
              <Btn small ghost={added.includes(i)} icon={added.includes(i) ? 'check' : 'plus'} title={added.includes(i) ? 'Aggiunto' : 'Task'} onPress={() => (added.includes(i) ? undefined : addTask(i))} /></Row>
          </Item>
        )))}
        {sec('Domande aperte', notes.questions.map((q, i) => <Item key={i} last={i === notes.questions.length - 1}><Body>{q.text}</Body><Body small muted>{q.speaker}</Body></Item>))}
        {sec('Date e numeri', notes.facts.map((f, i) => <Item key={i} last={i === notes.facts.length - 1}><Body>{f.text}</Body><Body small muted>{f.speaker}</Body></Item>))}
      </View>
      <Row gap={8} style={{ marginTop: 14, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <Btn small icon="note" title="Salva nelle note" onPress={saveNote} />
        <Btn small ghost icon="send" title="Manda nella chat" onPress={share} />
      </Row>
      {rec.transcript.length ? (
        <>
          <Btn small ghost style={{ marginTop: 14, alignSelf: 'flex-start' }} title={showAll ? 'Nascondi la trascrizione' : 'Mostra la trascrizione'} onPress={() => setShowAll((v) => !v)} />
          {showAll ? <Card style={{ marginTop: 8 }}><Body small>{transcriptText(rec.transcript)}</Body></Card> : null}
          <Btn small ghost icon="trash" style={{ marginTop: 10, alignSelf: 'flex-start' }} title="Elimina trascrizione e appunti" onPress={() => confirmDelete('la trascrizione e gli appunti di questa call', () => { useChat.getState().patchMsg(chatId, mid, { callRecord: { theia: rec.theia, transcript: [] } }); goBack(); })} />
        </>
      ) : null}
    </Page>
  );
}
