import { Body, Btn, Card, H } from '@/components/ui';
import { go } from '@/lib/nav';

/** Nessun workspace ancora: due strade separate, creare il proprio oppure entrare in quello di un'altra persona con un codice. */
export function NoWorkspace({ what = 'pianifichi progetti e task con la squadra' }: { what?: string }) {
  return (
    <Card>
      <H>Nessun workspace di lavoro</H>
      <Body small muted style={{ marginTop: 4 }}>{`Crea il tuo workspace oppure entra in quello della tua azienda con un codice di invito: poi ${what}.`}</Body>
      <Btn style={{ marginTop: 10 }} icon="plus" title="Crea il mio workspace" onPress={() => go('teams', { mode: 'create' })} />
      <Btn style={{ marginTop: 8 }} ghost icon="users" title="Entro in un workspace con un codice" onPress={() => go('teams', { mode: 'join' })} />
    </Card>
  );
}
