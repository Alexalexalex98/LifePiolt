import type { ReactNode } from 'react';

import { Body, Card, Page } from '@/components/ui';
import { useSocialStatus } from '@/social/socialAccess';

/** Se la parte social non è aperta a questa persona (sotto i 16 anni o sospesa) mostra il perché; il resto dell'app resta libero. */
export function SocialGate({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const st = useSocialStatus();
  if (st.allowed) return <>{children}</>;
  return (
    <Page id={id} back title={title}>
      <Card>
        <Body>{st.ageOk ? 'Il social è sospeso per il tuo account. Se pensi sia un errore, scrivici dal centro assistenza.' : `La parte social è disponibile dai ${st.minAge} anni. Tutto il resto dell'app lo puoi usare già da ora.`}</Body>
      </Card>
    </Page>
  );
}
