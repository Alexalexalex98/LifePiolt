import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Input, Item, Press, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tr } from '@/i18n/core';
import { MAX_ATTACHMENTS, type Att } from '@/lib/attachments';
import { PermissionError, explainDenied } from '@/lib/chatMedia';
import { Icon } from '@/lib/icons';
import { notePreview, noteTitle } from '@/lib/notes';
import { dayKey } from '@/lib/format';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { addContact, addFiles, addGallery, addLocation, addPasted, addPhoto, driveAtt, eventAtt, noteAtt, type Added } from './attachActions';

type View_ = 'menu' | 'paste' | 'notes' | 'drive' | 'events';

/** Foglio "Allega" come in Claude: foto, galleria, file, testo incollato, posizione, contatto, nota, LifeDrive, impegno. */
export function AttachSheet({ visible, onClose, current, onAdd }: { visible: boolean; onClose: () => void; current: Att[]; onAdd: (atts: Att[]) => void }) {
  const t = useTheme();
  const [view, setView] = useState<View_>('menu');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const notes = useLife((s) => s.notes);
  const drive = useLife((s) => s.drive);
  const events = useLife((s) => s.events);
  const full = current.length >= MAX_ATTACHMENTS;

  const upcoming = useMemo(() => {
    if (!visible || view !== 'events') return [];
    const today = dayKey(new Date());
    return Object.entries(events).filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b)).slice(0, 14).flatMap(([d, list]) => list.map((e) => ({ d, e }))).slice(0, 40);
  }, [events, visible, view]);

  function close() { setView('menu'); setText(''); onClose(); }
  function finish(r: Added) {
    if (r.notice) toast(r.notice);
    if (r.atts.length) { onAdd(r.atts); close(); } else if (!r.notice) close();
  }
  async function run(fn: () => Promise<Added>) {
    if (busy) return;
    setBusy(true);
    try { finish(await fn()); }
    catch (e) {
      if (e instanceof PermissionError) explainDenied(e.message, e.canAskAgain);
      else toast(e instanceof Error && e.message ? e.message : tr('Non sono riuscita ad aprire questo allegato.'));
    } finally { setBusy(false); }
  }

  const tile = (icon: string, label: string, fn: () => void, off?: boolean) => (
    <Press key={label} onPress={fn} disabled={off || busy} accessibilityLabel={label} style={{ width: '33.3%', alignItems: 'center', paddingVertical: 12, opacity: off ? 0.4 : 1 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={23} color={t.accent} stroke={1.9} /></View>
      <Text style={{ color: t.text, fontSize: 12, marginTop: 6, textAlign: 'center' }}>{label}</Text>
    </Press>
  );

  const title = view === 'menu' ? 'Allega' : view === 'paste' ? 'Incolla un testo' : view === 'notes' ? 'Una nota di LifePilot' : view === 'drive' ? 'Un file di LifeDrive' : 'Un impegno';
  return (
    <Sheet visible={visible} title={title} onClose={close}>
      {view === 'menu' ? (
        <>
          <Body small muted style={{ marginBottom: 4 }}>{full ? tr('Hai già {0} allegati: togline uno per aggiungerne altri.', MAX_ATTACHMENTS) : tr('Fino a {0} allegati, ognuno al massimo 20 MB. Restano sul tuo telefono: nessun upload.', MAX_ATTACHMENTS)}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {tile('camera', 'Scatta una foto', () => void run(() => addPhoto(current)), full)}
            {tile('image', 'Galleria', () => void run(() => addGallery(current)), full)}
            {tile('file', 'Scegli un file', () => void run(() => addFiles(current)), full)}
            {tile('edit', 'Incolla testo', () => setView('paste'), full)}
            {tile('location', 'Posizione', () => void run(() => addLocation(current)), full)}
            {tile('contact', 'Contatto', () => void run(() => addContact(current)), full)}
            {tile('note', 'Nota', () => setView('notes'), full)}
            {tile('lifedrive', 'Da LifeDrive', () => setView('drive'), full)}
            {tile('calendar', 'Impegno', () => setView('events'), full)}
          </View>
        </>
      ) : (
        <Btn small ghost icon="arrow-left" title="Indietro" onPress={() => setView('menu')} style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
      )}

      {view === 'paste' && (
        <>
          <Input placeholder="Scrivi o incolla qui il testo…" value={text} onChangeText={setText} multiline style={{ minHeight: 140 }} />
          <Row style={{ marginBottom: 8 }} gap={8}>
            <Btn small ghost icon="copy" title="Incolla dagli appunti" onPress={() => { void Clipboard.getStringAsync().then((v) => { if (v?.trim()) setText((p) => (p ? `${p}\n${v}` : v)); else toast('Gli appunti sono vuoti'); }).catch(() => toast('Non riesco a leggere gli appunti')); }} />
          </Row>
          <Btn icon="paperclip" title="Allega il testo" disabled={!text.trim()} onPress={() => finish(addPasted(current, text))} />
        </>
      )}

      {view === 'notes' && (notes.length === 0 ? <Body small muted>Non hai ancora note.</Body> : notes.map((n, i) => (
        <Item key={n.id} last={i === notes.length - 1} onPress={() => finish({ atts: [noteAtt(n)] })}>
          <Body bold numberOfLines={1}>{noteTitle(n.text)}</Body><Body small muted numberOfLines={2}>{notePreview(n.text)}</Body>
        </Item>
      )))}

      {view === 'drive' && (drive.length === 0 ? <Body small muted>LifeDrive è vuoto.</Body> : drive.map((f, i) => (
        <Item key={f.id} last={i === drive.length - 1} onPress={() => void run(async () => ({ atts: [await driveAtt(f)] }))}>
          <Row style={{ justifyContent: 'flex-start' }} gap={10}><Icon name="file" size={20} color="#e5484d" /><View style={{ flex: 1 }}><Body numberOfLines={1}>{f.n}</Body><Body small muted>{f.folder} · {f.s}</Body></View></Row>
        </Item>
      )))}

      {view === 'events' && (upcoming.length === 0 ? <Body small muted>Non hai impegni nei prossimi giorni.</Body> : upcoming.map(({ d, e }, i) => (
        <Item key={d + e.time + e.title + i} last={i === upcoming.length - 1} onPress={() => finish({ atts: [eventAtt(d, e)] })}>
          <Body bold numberOfLines={1}>{e.title}</Body><Body small muted>{d} · {e.time}{e.place ? ` · ${e.place}` : ''}</Body>
        </Item>
      )))}
    </Sheet>
  );
}
