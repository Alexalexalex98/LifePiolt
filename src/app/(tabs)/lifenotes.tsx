import { useState } from 'react';

import { Body, Btn, Card, Empty, Input, Page, Row } from '@/components/ui';
import { go } from '@/lib/nav';
import { noteTitle, notePreview } from '@/lib/notes';
import { useLife } from '@/store/life';

export default function LifeNotes() {
  const notes = useLife((s) => s.notes);
  const [q, setQ] = useState('');
  const list = notes.filter((n) => n.text.toLowerCase().includes(q.toLowerCase())).slice().reverse();
  return (
    <Page id="lifenotes" title="LifeNotes" back>
      <Input placeholder="Cerca nelle note…" value={q} onChangeText={setQ} />
      <Btn small ghost style={{ marginBottom: 14 }} title="+ Nuova nota" onPress={() => go('noteedit', { id: 'new' })} />
      {list.length === 0 ? (
        <Card><Empty text="Nessuna nota trovata: scrivi il primo pensiero, anche al volo." /><Btn small ghost title="+ Nuova nota" onPress={() => go('noteedit', { id: 'new' })} /></Card>
      ) : list.map((n) => (
        <Card key={n.id} onPress={() => go('noteedit', { id: n.id })}>
          <Row><Body bold style={{ flex: 1 }}>{noteTitle(n.text)}</Body><Body small muted>{n.date}</Body></Row>
          <Body small muted style={{ marginTop: 6 }}>{notePreview(n.text)}</Body>
        </Card>
      ))}
    </Page>
  );
}
