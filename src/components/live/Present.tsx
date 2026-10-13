import * as DocumentPicker from 'expo-document-picker';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { DocView } from '@/components/doc/DocView';
import { Body, Btn, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { kindOfFile, presentHelp, type Presentation } from '@/lib/presentation';
import { ACCESS_LABEL, type LiveRecording, type RecAccess } from '@/lib/recordings';
import { useClub, clubsOf } from '@/store/club';
import { useApp } from '@/store/app';
import { toast } from '@/store/toast';
import { RoundBtn } from './Overlay';

export const SCREEN_NOTE = 'Condividere lo schermo richiede il servizio di streaming, che non è ancora collegato: finché non lo è, puoi presentare PDF e immagini.';

/** Schermo intero con il file presentato (PDF o immagine), sopra il video. */
export function Presenter({ pres, isHost, onStop, topInset }: { pres: Presentation; isHost: boolean; onStop: () => void; topInset: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0e14', paddingTop: topInset + 96 }}>
      <View style={{ flex: 1 }}><DocView uri={pres.uri} name={pres.name} /></View>
      <View style={{ position: 'absolute', start: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, maxWidth: '70%' }}>
        <Icon name="file" size={14} color="#fff" />
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12.5, fontWeight: '700', flexShrink: 1 }}>{isHost ? pres.name : `${pres.by} sta presentando · ${pres.name}`}</Text>
      </View>
      {isHost ? <View style={{ position: 'absolute', end: 12, bottom: 12 }}><RoundBtn icon="x" label="Smetti di presentare" danger size={44} onPress={onStop} /></View> : null}
    </View>
  );
}

/** Scelta di cosa condividere (come in Teams): un file, lo schermo. */
export function ShareSheet({ visible, onClose, onPick, by }: { visible: boolean; onClose: () => void; onPick: (p: Presentation) => void; by: string }) {
  const t = useTheme();
  async function pickFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      const kind = kindOfFile(a.name, a.mimeType);
      if (kind !== 'pdf' && kind !== 'image') { toast(presentHelp(kind) ?? 'Tipo di file non supportato'); return; }
      onPick({ kind, uri: a.uri, name: a.name, by, startedAt: Date.now() });
      onClose();
    } catch { toast('Impossibile aprire i file'); }
  }
  return (
    <Sheet visible={visible} title="Condividi" onClose={onClose}>
      <Item onPress={() => void pickFile()}>
        <Row gap={12}><Icon name="file" size={22} color={t.accent} /><View style={{ flex: 1 }}><Body bold>Un file</Body><Body small muted>PDF o immagine, da leggere insieme. Le presentazioni PowerPoint o Keynote vanno esportate in PDF.</Body></View></Row>
      </Item>
      <Item last onPress={() => { toast(SCREEN_NOTE); }}>
        <Row gap={12}><Icon name="video" size={22} color={t.muted} /><View style={{ flex: 1 }}><Body bold>Il tuo schermo</Body><Body small muted>{Platform.OS === 'web' ? 'Disponibile nell\'app sul telefono con il servizio di streaming.' : 'Mostra tutto ciò che vedi sul telefono. Si attiva con il servizio di streaming.'}</Body></View></Row>
      </Item>
    </Sheet>
  );
}

/** A fine diretta: cosa fare della registrazione. */
export function RecordingChoice({ rec, onSet, onDelete }: { rec: LiveRecording; onSet: (access: RecAccess, clubId?: string) => void; onDelete: () => void }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const clubs = useClub((s) => clubsOf({ clubs: s.clubs }, me));
  const opts: { label: string; hint: string; on: boolean; press: () => void }[] = [
    { label: ACCESS_LABEL.buyers, hint: 'La rivede chi ha pagato, dal tuo profilo', on: rec.access === 'buyers', press: () => onSet('buyers') },
    ...clubs.map((c) => ({ label: `Nel LifeClub «${c.name}»`, hint: 'La rivedono gli iscritti e chi ha pagato', on: rec.access === 'club' && rec.clubId === c.id, press: () => onSet('club', c.id) })),
    { label: ACCESS_LABEL.private, hint: 'Resta solo sul tuo telefono', on: rec.access === 'private', press: () => onSet('private') },
  ];
  return (
    <View style={{ gap: 6, marginTop: 4 }}>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>Registrazione</Text>
      <Text style={{ color: t.muted, fontSize: 12.5 }}>Scegli chi può rivedere la diretta.</Text>
      {opts.map((o) => (
        <Pressable key={o.label} accessibilityRole="button" accessibilityState={{ selected: o.on }} onPress={o.press} style={{ borderWidth: 1.5, borderColor: o.on ? t.accent : t.border, borderRadius: 14, padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: o.on ? t.chip : 'transparent' }}>
          <Icon name={o.on ? 'check' : 'circle'} size={18} color={o.on ? t.accent : t.muted} stroke={2.2} />
          <View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{o.label}</Text><Text style={{ color: t.muted, fontSize: 12 }}>{o.hint}</Text></View>
        </Pressable>
      ))}
      <Btn small ghost icon="trash" title="Elimina la registrazione" onPress={onDelete} />
    </View>
  );
}
