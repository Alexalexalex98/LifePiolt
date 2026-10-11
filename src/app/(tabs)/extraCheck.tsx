import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Countdown, FileList, useNow } from '@/components/jobFiles';
import { Body, Btn, Card, Input, Page, Row } from '@/components/ui';
import { skillLabel } from '@/data/skillBank';
import { deadlineOf, fmtLimit, timeLeftMs } from '@/lib/hiring';
import { pickFiles } from '@/lib/jobFiles';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useJobs } from '@/store/jobs';
import type { FileRef } from '@/data/skillBank';
import { toast } from '@/store/toast';

/** Prova pratica aggiuntiva chiesta dall'azienda: il tempo parte quando il candidato accetta (salvato subito). */
export default function ExtraCheck() {
  const { app: appId = '', check: checkId = '' } = useLocalSearchParams<{ app?: string; check?: string }>();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === appId));
  const c = app?.checks?.find((x) => x.id === checkId);
  const now = useNow(true);
  const [files, setFiles] = useState<FileRef[]>([]);
  const [note, setNote] = useState('');
  if (!app || !c || app.candidate !== me || !c.practical) return <Page id="extraCheck" back><Body muted>Verifica non trovata.</Body></Page>;
  const p = c.practical;
  const left = c.startedAt ? timeLeftMs(c.startedAt, p.limitMin, now) : null;

  return (
    <Page id="extraCheck" back title={c.title}>
      <Card>
        <Body small muted>Valuta: {skillLabel(c.skill)} · tempo {fmtLimit(p.limitMin)} dall’accettazione</Body>
        {c.status === 'accepted' && c.startedAt && left != null && <Countdown leftMs={left} big />}
        <Body style={{ marginTop: 8 }}>{p.instructions}</Body>
        {p.deliverables ? <Body small muted style={{ marginTop: 6 }}>Da consegnare: {p.deliverables}</Body> : null}
        {p.files.length > 0 && <FileList files={p.files} label="Apri / scarica" />}
      </Card>
      {c.status === 'accepted' && (
        <Card>
          <Body bold>La tua consegna</Body>
          <FileList files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} label="Allegato" />
          <Btn small ghost icon="paperclip" style={{ marginVertical: 8, alignSelf: 'flex-start' }} title="Carica file" onPress={async () => { try { const f = await pickFiles(true); if (f.length) setFiles([...files, ...f]); } catch { toast('Impossibile scegliere il file'); } }} />
          <Input multiline style={{ minHeight: 80 }} placeholder="Nota per chi valuta (facoltativa)" value={note} onChangeText={setNote} />
          {left != null && left < 0 && <Body small muted>Il tempo è scaduto: puoi consegnare, ma l’azienda vedrà che è in ritardo.</Body>}
          <Btn title="Consegna" onPress={() => { if (useJobs.getState().submitCheckPractical(app.id, c.id, files, note)) { toast('Consegnato'); go('interviewView', { id: app.id }); } else toast('Aggiungi un file o una nota'); }} />
          <Body small muted style={{ marginTop: 6 }}>Scadenza: {new Date(deadlineOf(c.startedAt ?? now, p.limitMin)).toLocaleTimeString()}</Body>
        </Card>
      )}
      {c.status === 'done' && <Card><Body bold>Consegnata</Body><Body small muted>L’azienda la valuterà: vedrà il tuo nome e il risultato, non altro.</Body></Card>}
      <Row style={{ marginTop: 8 }}><Btn ghost style={{ flex: 1 }} title="Torna alla candidatura" onPress={() => go('interviewView', { id: app.id })} /></Row>
    </Page>
  );
}
