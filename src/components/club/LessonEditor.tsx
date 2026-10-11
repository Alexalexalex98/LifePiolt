import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Input, Pill, Row, Sheet, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtSize } from '@/lib/chatMedia';
import { kindFromFile, type Lesson, type LessonKind } from '@/lib/club';
import { toast } from '@/store/toast';
import { KIND_LABEL } from './LessonRow';
import { pickClubFile } from './pickFile';

type Draft = Omit<Lesson, 'id' | 'order'>;
const KINDS: LessonKind[] = ['video', 'audio', 'pdf', 'testo', 'file', 'link'];

/** Crea o modifica una lezione: tipo, file dal telefono, free/premium, anteprima gratuita. */
export function LessonEditor({ visible, onClose, sectionId, lesson, onSave }: { visible: boolean; onClose: () => void; sectionId: string; lesson?: Lesson; onSave: (d: Draft) => void }) {
  const t = useTheme();
  const blank = (): Draft => ({ title: '', kind: 'video', sectionId, tier: 'free', preview: false });
  const [d, setD] = useState<Draft>(blank());
  const [busy, setBusy] = useState(false);
  const [mins, setMins] = useState('');
  useEffect(() => {
    if (!visible) return;
    setD(lesson ? { ...lesson } : blank());
    setMins(lesson?.durationSec ? String(Math.round(lesson.durationSec / 60)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lesson?.id]);
  const needsFile = d.kind === 'video' || d.kind === 'audio' || d.kind === 'pdf' || d.kind === 'file';

  async function pick() {
    if (busy) return;
    setBusy(true);
    try {
      const f = await pickClubFile(d.kind);
      if (f) {
        const k = d.kind === 'file' ? kindFromFile(f.fileName, f.mime) : d.kind;
        setD((x) => ({ ...x, kind: k === 'file' || k === x.kind ? x.kind : k, uri: f.uri, fileName: f.fileName, size: f.size, mime: f.mime, durationSec: f.durationSec ?? x.durationSec, title: x.title || f.fileName.replace(/\.[a-z0-9]+$/i, '') }));
        if (f.durationSec) setMins(String(Math.max(1, Math.round(f.durationSec / 60))));
      }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire il file'); } finally { setBusy(false); }
  }

  function save() {
    if (!d.title.trim()) return toast('Dai un titolo alla lezione');
    if (needsFile && !d.uri) return toast('Scegli prima il file dal telefono');
    if (d.kind === 'testo' && !(d.text ?? '').trim()) return toast('Scrivi il testo della lezione');
    if (d.kind === 'link' && !/^https?:\/\//i.test(d.url ?? '')) return toast('Inserisci un link che inizia con https://');
    const m = Number(mins.replace(',', '.'));
    onSave({ ...d, title: d.title.trim().slice(0, 90), durationSec: (d.kind === 'video' || d.kind === 'audio') && m > 0 ? Math.round(m * 60) : d.durationSec, preview: d.tier === 'premium' ? d.preview : false });
    onClose();
  }

  return (
    <Sheet visible={visible} title={lesson ? 'Modifica lezione' : 'Nuova lezione'} onClose={onClose}>
      <Input placeholder="Titolo della lezione" value={d.title} onChangeText={(v) => setD({ ...d, title: v })} maxLength={90} />
      <Body small muted style={{ marginBottom: 6 }}>Tipo di contenuto</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={6}>
        {KINDS.map((k) => <Pill key={k} label={KIND_LABEL[k]} on={d.kind === k} onPress={() => setD({ ...d, kind: k, uri: k === d.kind ? d.uri : undefined, fileName: k === d.kind ? d.fileName : undefined })} />)}
      </Row>
      {needsFile && (
        <View style={{ marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: t.chip }}>
          {d.uri ? <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>{`${d.fileName ?? 'File scelto'}${d.size ? ` · ${fmtSize(d.size)}` : ''}`}</Text> : <Body small muted>Nessun file scelto.</Body>}
          <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={8}>
            <Btn small icon="paperclip" title={d.uri ? 'Cambia file' : 'Scegli dal telefono'} disabled={busy} onPress={() => void pick()} />
          </Row>
          <Body small muted style={{ marginTop: 6 }}>Il file viene copiato nella memoria dell&apos;app (nessun upload). Limiti: video 200 MB, audio 60 MB, PDF e altri file 50 MB.</Body>
        </View>
      )}
      {(d.kind === 'video' || d.kind === 'audio') && <Input placeholder="Durata in minuti (facoltativa)" keyboardType="decimal-pad" value={mins} onChangeText={setMins} />}
      {d.kind === 'pdf' && <Input placeholder="Numero di pagine (facoltativo)" keyboardType="number-pad" value={d.pages ? String(d.pages) : ''} onChangeText={(v) => setD({ ...d, pages: Number(v) > 0 ? Math.min(2000, Math.round(Number(v))) : undefined })} />}
      {d.kind === 'testo' && <Input placeholder="Scrivi il testo (una riga vuota separa i paragrafi)" multiline maxLines={12} value={d.text ?? ''} onChangeText={(v) => setD({ ...d, text: v })} />}
      {d.kind === 'link' && <Input placeholder="https://…" autoCapitalize="none" keyboardType="url" value={d.url ?? ''} onChangeText={(v) => setD({ ...d, url: v })} />}
      <Input placeholder="Descrizione breve (facoltativa)" value={d.description ?? ''} onChangeText={(v) => setD({ ...d, description: v })} maxLength={240} />
      <Body small muted style={{ marginBottom: 6 }}>Chi la può vedere</Body>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 10 }} gap={6}>
        <Pill icon="unlock" label="Free" on={d.tier === 'free'} onPress={() => setD({ ...d, tier: 'free' })} />
        <Pill icon="lock" label="Premium" on={d.tier === 'premium'} onPress={() => setD({ ...d, tier: 'premium' })} />
      </Row>
      {d.tier === 'premium' && (
        <Row style={{ marginBottom: 10 }}>
          <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '600' }}>Anteprima gratuita</Text><Body small muted>Anche chi non è abbonato può aprirla.</Body></View>
          <Switch value={!!d.preview} onValueChange={(v) => setD({ ...d, preview: v })} accessibilityLabel="Anteprima gratuita" />
        </Row>
      )}
      <Btn title={lesson ? 'Salva le modifiche' : 'Aggiungi la lezione'} onPress={save} />
    </Sheet>
  );
}
