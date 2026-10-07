import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Body, Btn, Input, Page, Sheet } from '@/components/ui';
import { goBack, go } from '@/lib/nav';
import { useLife } from '@/store/life';
import { showUndoToast, toast } from '@/store/toast';

export default function NoteEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useLife((s) => (id && id !== 'new' ? s.notes.find((n) => n.id === id) : undefined));
  const { saveNote, delNote, restoreNote } = useLife();
  const [text, setText] = useState(existing?.text ?? '');
  const [summary, setSummary] = useState(false);
  useEffect(() => { setText(existing?.text ?? ''); }, [existing?.id]);

  return (
    <Page id="noteedit" title={existing ? 'Modifica nota' : 'Nuova nota'} back>
      <Input multiline style={{ minHeight: 320 }} placeholder="Scrivi o detta un pensiero…" value={text} onChangeText={setText} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Btn style={{ flex: 1 }} title="Salva" onPress={() => { const v = text.trim(); if (!v) return; saveNote(existing?.id ?? null, v); toast(existing ? 'Nota aggiornata' : 'Nota salvata'); go('lifenotes'); }} />
        <Btn ghost title="Condividi" onPress={() => Share.share({ message: text })} />
        {existing && <Btn ghost danger title="Elimina" onPress={() => { const r = delNote(existing.id); go('lifenotes'); if (r) showUndoToast('Nota eliminata', () => restoreNote(r.note, r.idx)); }} />}
      </View>
      {existing && <Btn small ghost style={{ marginTop: 8 }} title="Riassumi con AI" onPress={() => setSummary(true)} />}
      <Sheet visible={summary} title="Sintesi AI" onClose={() => setSummary(false)}>
        <Body small muted>Sintesi di anteprima (il riassunto con un modello AI reale richiede il collegamento al server):</Body>
        <Body style={{ marginTop: 8 }}>{text.slice(0, 140)}{text.length > 140 ? '…' : ''}</Body>
      </Sheet>
    </Page>
  );
}
void goBack;
