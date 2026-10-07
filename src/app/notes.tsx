import { router } from 'expo-router';

import { Body, Button, Card, Empty, H, Screen } from '@/components/ui';
import { useStore } from '@/store';

export default function Notes() {
  const notes = useStore((s) => s.notes);
  return (
    <Screen title="LifeNotes" back right={<Button small title="+ Nuova" onPress={() => router.push('/note/new')} />}>
      {notes.length === 0 && <Empty text="Nessuna nota. Creane una." />}
      {notes.map((n) => (
        <Card key={n.id} onPress={() => router.push({ pathname: '/note/[id]', params: { id: n.id } })}>
          <H>{n.title || 'Senza titolo'}</H>
          <Body muted small>{n.body.slice(0, 120)}</Body>
        </Card>
      ))}
    </Screen>
  );
}
