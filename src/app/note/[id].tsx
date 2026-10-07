import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, Screen } from '@/components/ui';
import { useStore } from '@/store';

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useStore((s) => s.notes.find((n) => n.id === id));
  const { saveNote, removeNote } = useStore();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');

  return (
    <Screen title={existing ? 'Modifica nota' : 'Nuova nota'} back>
      <Input placeholder="Titolo" value={title} onChangeText={setTitle} />
      <Input placeholder="Scrivi qui…" value={body} onChangeText={setBody} multiline />
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button
          title="Salva"
          disabled={!title.trim() && !body.trim()}
          onPress={() => {
            saveNote({ id: existing?.id, title: title.trim(), body });
            router.back();
          }}
        />
        {existing && (
          <Button ghost danger title="Elimina" onPress={() => { removeNote(existing.id); router.back(); }} />
        )}
      </View>
    </Screen>
  );
}
