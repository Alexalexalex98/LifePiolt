import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Item, Pill, Row } from '@/components/ui';
import { fmtDateTime } from '@/i18n/format';
import { t } from '@/i18n/core';
import { itemOf } from '@/lib/dataCatalog';
import { confirmDelete } from '@/lib/confirm';
import { AUDIENCE_LABEL, filterEntries, OUTCOME_LABEL, summarize, type AudienceKind, type Outcome, type PrivacyEntry } from '@/lib/privacyLog';
import { usePrivacyLog } from '@/store/privacyLog';

const AUDIENCES = Object.keys(AUDIENCE_LABEL) as AudienceKind[];
const OUTCOMES = Object.keys(OUTCOME_LABEL) as Outcome[];
const labelOf = (id: string) => (id === 'contacts' ? 'Rubrica' : itemOf(id)?.label ?? id);

/** Registro di uscita: cosa e' uscito (o e' stato negato), verso chi e quando. Mai il contenuto. */
export function OutflowCard() {
  const entries = usePrivacyLog((s) => s.entries);
  const remove = usePrivacyLog((s) => s.remove);
  const restore = usePrivacyLog((s) => s.restore);
  const [aud, setAud] = useState<AudienceKind | ''>('');
  const [out, setOut] = useState<Outcome | ''>('');
  const [limit, setLimit] = useState(20);
  const filter = useMemo(() => ({ ...(aud ? { audience: aud } : {}), ...(out ? { outcome: out } : {}) }), [aud, out]);
  const list = useMemo(() => filterEntries(entries, filter), [entries, filter]);
  const sum = summarize(entries);
  const hasFilter = !!aud || !!out;
  return (
    <Card>
      <H>Cosa è uscito dal tuo telefono</H>
      <Body small muted style={{ marginBottom: 8 }}>Ogni volta che un dato lascia il telefono (assistente AI, chat, biglietto da visita, azienda, club) o viene bloccato dalle tue scelte di &quot;Cosa condivido&quot;, qui resta una riga. Il registro segna quando, verso chi e quanti elementi: mai il contenuto.</Body>
      <Row style={{ marginBottom: 8 }}><Body small bold style={{ flex: 1 }}>{t('{0} uscite · {1} bloccate', sum.sent, sum.denied)}</Body><Body small muted>{t('{0} righe', sum.total)}</Body></Row>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={6}>
        <Pill label="Tutti" on={!aud} onPress={() => setAud('')} />
        {AUDIENCES.map((a) => <Pill key={a} label={AUDIENCE_LABEL[a]} on={aud === a} onPress={() => setAud(aud === a ? '' : a)} />)}
      </Row>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }} gap={6}>
        <Pill label="Ogni esito" on={!out} onPress={() => setOut('')} />
        {OUTCOMES.map((o) => <Pill key={o} label={OUTCOME_LABEL[o]} on={out === o} onPress={() => setOut(out === o ? '' : o)} />)}
      </Row>
      {list.length ? list.slice(0, limit).map((e: PrivacyEntry, i, a) => (
        <Item key={e.id} last={i === a.length - 1}>
          <Row><Body small bold style={{ flex: 1 }} numberOfLines={1}>{labelOf(e.dataId)}</Body><Body small bold color={e.outcome === 'denied' ? '#ff6b6b' : undefined}>{OUTCOME_LABEL[e.outcome]}</Body></Row>
          <Body small muted>{AUDIENCE_LABEL[e.audience]} · {fmtDateTime(e.ts)}{e.outcome !== 'denied' ? ` · ${t('{0} elementi', e.count)}` : ''}</Body>
        </Item>
      )) : <Body small muted>{entries.length ? 'Nessuna riga con questi filtri.' : 'Nulla è ancora uscito dal tuo telefono.'}</Body>}
      <View style={{ gap: 8, marginTop: 10 }}>
        {list.length > limit ? <Btn small ghost title="Mostra più righe" onPress={() => setLimit(limit + 30)} /> : null}
        {list.length ? (
          <Btn small ghost danger icon="trash" title={hasFilter ? 'Elimina le righe filtrate' : 'Elimina tutto il registro'}
            onPress={() => confirmDelete(hasFilter ? `le ${list.length} righe filtrate del registro di uscita` : 'tutto il registro di uscita', () => { removed = remove(filter); }, () => restore(removed))} />
        ) : null}
      </View>
    </Card>
  );
}
let removed: PrivacyEntry[] = [];
