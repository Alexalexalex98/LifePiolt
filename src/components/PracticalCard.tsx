import { useState } from 'react';
import { View } from 'react-native';

import { Countdown, FileChip, FileList, useNow } from '@/components/jobFiles';
import { Body, Btn, Card, Input, Row, Sheet } from '@/components/ui';
import type { FileRef } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { deadlineOf, fmtDuration, fmtLimit, timeLeftMs } from '@/lib/hiring';
import { openFile, pickFiles, pickImages } from '@/lib/jobFiles';
import { useJobs, type Job, type PracticalRun } from '@/store/jobs';
import { toast } from '@/store/toast';
import { fmtDateTime } from '@/i18n/format';

const when = (ts: number) => fmtDateTime(ts);

/** Stato sintetico della prova pratica, per le liste di chi assume. */
export function runLabel(job: Job, run: PracticalRun | undefined, hasApp = true): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted' } | null {
  if (!job.practical || !hasApp) return null;
  if (!run) return { text: 'Prova pratica non ancora scaricata', tone: 'muted' };
  if (run.submittedAt) return run.late ? { text: 'Prova pratica consegnata in ritardo', tone: 'warn' } : { text: 'Prova pratica consegnata', tone: 'ok' };
  return Date.now() > deadlineOf(run.startedAt, job.practical.limitMin) ? { text: 'Prova pratica scaduta, non consegnata', tone: 'bad' } : { text: 'Prova pratica in corso', tone: 'muted' };
}

/** La prova pratica vista dal candidato: scarica (il tempo parte), poi consegna. Una sola prova. */
export function PracticalCard({ job, me, hasApp }: { job: Job; me: string; hasApp: boolean }) {
  const t = useTheme();
  const p = job.practical!;
  const run = useJobs((s) => (s.practicals ?? []).find((x) => x.jobId === job.id && x.candidate === me));
  const [confirm, setConfirm] = useState(false);
  const [files, setFiles] = useState<FileRef[]>([]);
  const [note, setNote] = useState('');
  const [sure, setSure] = useState(false);
  const running = !!run && !run.submittedAt;
  const now = useNow(running);
  const left = run ? timeLeftMs(run.startedAt, p.limitMin, now) : p.limitMin * 60000;

  async function start() {
    setConfirm(false);
    if (!useJobs.getState().startPractical(job.id, me)) { toast('Prima completa il test a domande'); return; }
    for (let i = 0; i < p.files.length; i++) { await openFile(p.files[i]); if (i < p.files.length - 1) await new Promise((r) => setTimeout(r, 400)); }
    toast('Il tempo è partito');
  }
  function deliver() {
    setSure(false);
    if (!useJobs.getState().submitPractical(job.id, me, files, note)) { toast('Aggiungi almeno un file o una nota'); return; }
    toast('Prova consegnata');
  }

  return (
    <Card>
      <Body bold>Prova pratica: {p.title}</Body>
      <Body small muted style={{ marginTop: 2 }}>Tempo massimo {fmtLimit(p.limitMin)} dal momento in cui scarichi il test. Una sola prova, non si può ripetere.</Body>
      {p.instructions ? <Body style={{ marginTop: 10 }}>{p.instructions}</Body> : null}
      {p.deliverables ? <View style={{ backgroundColor: t.item, borderRadius: 12, padding: 10, marginTop: 10 }}><Body small bold>Cosa va consegnato</Body><Body small style={{ marginTop: 2 }}>{p.deliverables}</Body></View> : null}

      {!hasApp ? (
        <Body small muted style={{ marginTop: 10 }}>Si sblocca dopo aver completato il test a domande.</Body>
      ) : !run ? (
        <View style={{ marginTop: 8 }}>
          {p.files.map((f, i) => <Row key={i} style={{ justifyContent: 'flex-start', marginTop: 4 }} gap={8}><Body small>{f.name}</Body></Row>)}
          <Btn icon="share" style={{ marginTop: 12 }} title={p.files.length ? 'Scarica il test' : 'Inizia la prova'} onPress={() => setConfirm(true)} />
          <Body small muted style={{ marginTop: 6 }}>Quando scarichi il test parte il conto alla rovescia: continua anche se chiudi l’app.</Body>
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <FileList files={p.files} label="Scarica di nuovo" />
          {!run.submittedAt ? (
            <>
              <View style={{ marginTop: 12, alignItems: 'center', backgroundColor: t.item, borderRadius: 14, paddingVertical: 12 }}>
                <Body small muted>{left > 0 ? 'Tempo rimasto' : 'Tempo scaduto'}</Body>
                <Countdown leftMs={left} big />
                <Body small muted style={{ marginTop: 2 }}>Scarica avviata {when(run.startedAt)} · scadenza {when(deadlineOf(run.startedAt, p.limitMin))}</Body>
              </View>
              {left <= 0 && <Body small color={t.warn} style={{ marginTop: 8 }}>Il tempo è finito: puoi consegnare comunque, ma la consegna sarà segnalata a {job.owner} come “consegnata in ritardo”. Decide lui.</Body>}
              <Body bold style={{ marginTop: 14, marginBottom: 4 }}>La tua consegna</Body>
              <FileList files={files} onRemove={(k) => setFiles(files.filter((_, j) => j !== k))} label="Da consegnare" />
              <Row style={{ justifyContent: 'flex-start', marginTop: 8, marginBottom: 8, flexWrap: 'wrap' }} gap={8}>
                <Btn small ghost icon="paperclip" title="Aggiungi file" onPress={async () => { try { const f = await pickFiles(true); if (f.length) setFiles([...files, ...f]); } catch { toast('Impossibile scegliere il file'); } }} />
                <Btn small ghost icon="image" title="Aggiungi immagine" onPress={async () => { try { const f = await pickImages(true); if (f.length) setFiles([...files, ...f]); } catch { toast('Impossibile scegliere l’immagine'); } }} />
              </Row>
              <Input multiline style={{ minHeight: 80 }} placeholder="Nota per chi valuta (facoltativa)" value={note} onChangeText={setNote} />
              <Btn title="Consegna la prova" disabled={!files.length && !note.trim()} onPress={() => setSure(true)} />
            </>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Body bold color={run.late ? t.warn : t.positive}>{run.late ? 'Consegnata in ritardo' : 'Consegnata nei tempi'}</Body>
              <Body small muted style={{ marginTop: 2 }}>Scaricata {when(run.startedAt)} · consegnata {when(run.submittedAt)} · impiegato {fmtDuration(run.submittedAt - run.startedAt)} su {fmtLimit(p.limitMin)}</Body>
              {run.files.length > 0 && <Body small bold style={{ marginTop: 10 }}>Hai consegnato</Body>}
              {run.files.map((f, i) => <FileChip key={i} f={f} />)}
              {run.note ? <Body small style={{ marginTop: 8 }}>Nota: {run.note}</Body> : null}
              <Body small muted style={{ marginTop: 8 }}>{job.owner} valuterà la consegna.</Body>
            </View>
          )}
        </View>
      )}

      <Sheet visible={confirm} title={p.files.length ? 'Scaricare il test?' : 'Iniziare la prova?'} onClose={() => setConfirm(false)}>
        <Body style={{ marginBottom: 10 }}>Appena {p.files.length ? 'scarichi il test' : 'inizi'} parte il conto alla rovescia di {fmtLimit(p.limitMin)}. Non si può fermare né ripetere.</Body>
        <Btn title={p.files.length ? 'Scarica e avvia il tempo' : 'Avvia il tempo'} onPress={() => void start()} />
      </Sheet>
      <Sheet visible={sure} title="Consegnare la prova?" onClose={() => setSure(false)}>
        <Body style={{ marginBottom: 10 }}>{files.length} {files.length === 1 ? 'file' : 'file'}{note.trim() ? ' e una nota' : ''}. Dopo la consegna non potrai modificarla.{left <= 0 ? ' Sarà segnalata come consegnata in ritardo.' : ''}</Body>
        <Btn title="Consegna" onPress={deliver} />
      </Sheet>
    </Card>
  );
}
