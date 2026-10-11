import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Body, Btn, Input, Press, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import { pickFile, pickPhoto } from '@/lib/bills/files';
import { setPendingText } from '@/lib/bills/pending';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { toast } from '@/store/toast';

function Choice({ icon, title, hint, onPress }: { icon: string; title: string; hint?: string; onPress: () => void }) {
  const th = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: th.item }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color={th.text} stroke={1.9} /></View>
      <View style={{ flex: 1 }}>
        <Body bold>{title}</Body>
        {hint ? <Body small muted>{hint}</Body> : null}
      </View>
      <Icon name="chevron-right" size={16} color={th.muted} stroke={2} />
    </Press>
  );
}

/** Punto d'ingresso unico: foto, galleria, file, testo incollato o inserimento a mano. Nulla viene inviato in rete. */
export function AddBillSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => { setPaste(false); setText(''); onClose(); };
  const open = (params: Record<string, string>) => { close(); go('billReview', params); };

  async function viaPicker(kind: 'file' | 'camera' | 'gallery') {
    if (busy) return;
    setBusy(true);
    try {
      const r = kind === 'file' ? await pickFile() : await pickPhoto(kind === 'camera');
      if (r.ok) open({ uri: r.file.uri, name: r.file.name, mime: r.file.mime ?? '' });
      else if (!r.canceled && r.message) toast(r.message);
    } finally { setBusy(false); }
  }
  async function clip() {
    try {
      const v = (await Clipboard.getStringAsync()) ?? '';
      if (v.trim()) setText(v); else toast(t('Gli appunti sono vuoti'));
    } catch { toast(t('Non riesco a leggere gli appunti')); }
  }

  return (
    <Sheet visible={visible} title={paste ? 'Incolla il testo' : 'Aggiungi bolletta o fattura'} onClose={close}>
      {paste ? (
        <>
          <Body small muted style={{ marginBottom: 8 }}>Incolla il testo della bolletta (da un'email, da un PDF o da un'app). Lo leggo qui sul telefono e ti mostro cosa ho capito: tu controlli e confermi.</Body>
          <Input multiline style={{ minHeight: 190 }} placeholder="Incolla qui il testo della bolletta o della fattura" value={text} onChangeText={setText} maxLength={40000} />
          <Row style={{ justifyContent: 'flex-start' }}>
            <Btn small ghost icon="copy" title="Incolla dagli appunti" onPress={clip} />
            {text ? <Btn small ghost title="Svuota" onPress={() => setText('')} /> : null}
          </Row>
          <Btn style={{ marginTop: 12 }} title="Analizza il testo" disabled={text.trim().length < 15} onPress={() => { setPendingText(text); open({ p: '1' }); }} />
          <Btn style={{ marginTop: 8 }} ghost title="Indietro" onPress={() => setPaste(false)} />
        </>
      ) : (
        <>
          <Body small muted style={{ marginBottom: 6 }}>Il documento resta sul telefono (anche in LifeDrive, cartella «Bollette e fatture»). L'analisi è fatta qui, senza inviare nulla a nessuno.</Body>
          {Platform.OS !== 'web' && <Choice icon="camera" title="Scatta una foto" hint="Fotografa la bolletta" onPress={() => viaPicker('camera')} />}
          <Choice icon="image" title="Scegli dalla galleria" hint="Una foto già scattata" onPress={() => viaPicker('gallery')} />
          <Choice icon="file" title="Scegli un file" hint="PDF, immagine, CSV o testo" onPress={() => viaPicker('file')} />
          <Choice icon="copy" title="Incolla il testo" hint="Da un'email o da un'altra app" onPress={() => setPaste(true)} />
          <Choice icon="edit" title="Inserisci a mano" hint="Compili tu i campi" onPress={() => open({ mode: 'manual' })} />
        </>
      )}
    </Sheet>
  );
}
