import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Item, Pill, Row } from '@/components/ui';
import { fmtDateTime } from '@/i18n/format';
import { confirmDelete } from '@/lib/confirm';
import { categories, clearLog, counts, getEntries, logVersion, subscribeLog, type Level } from '@/lib/log';

const LEVEL_LABEL: Record<Level, string> = { debug: 'Tutto', info: 'Info', warn: 'Avvisi', error: 'Errori' };

/** Log recente con filtro per livello, categoria e testo. Redatto alla fonte: nessun dato personale. */
export function LogCard() {
  useSyncExternalStore(subscribeLog, logVersion, logVersion);
  const [level, setLevel] = useState<Level>('info');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [more, setMore] = useState(false);
  const list = getEntries({ level, cat: cat || undefined, text: q, limit: more ? 200 : 25 });
  const c = counts();
  return (
    <Card>
      <H>Log recente</H>
      <Body small muted style={{ marginBottom: 8 }}>{c.error} errori · {c.warn} avvisi · {c.info + c.debug} altre voci. Email, IBAN, carte e telefoni sono oscurati.</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={6}>
        {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <Pill key={l} label={LEVEL_LABEL[l]} on={level === l} onPress={() => setLevel(l)} />)}
      </Row>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={6}>
        <Pill label="Tutte le categorie" on={!cat} onPress={() => setCat('')} />
        {categories().map((k) => <Pill key={k} label={k} on={cat === k} onPress={() => setCat(cat === k ? '' : k)} />)}
      </Row>
      <Input value={q} onChangeText={setQ} placeholder="Cerca nel log" style={{ marginBottom: 8 }} />
      {list.length ? list.map((e, i) => (
        <Item key={e.id + ':' + i} last={i === list.length - 1}>
          <Body small bold color={e.level === 'error' ? '#ff6b6b' : e.level === 'warn' ? '#ffb84f' : undefined}>{e.level.toUpperCase()} · {e.cat} · {fmtDateTime(e.ts)}</Body>
          <Body small>{e.msg}</Body>
          {e.data ? <Body small muted numberOfLines={3}>{e.data}</Body> : null}
        </Item>
      )) : <Body small muted>Nessuna voce con questi filtri.</Body>}
      <View style={{ gap: 8, marginTop: 10 }}>
        {!more && list.length >= 25 ? <Btn small ghost title="Mostra più voci" onPress={() => setMore(true)} /> : null}
        <Btn small ghost danger icon="trash" title="Cancella log" onPress={() => confirmDelete('il log dell\'app su questo telefono', () => clearLog())} />
      </View>
    </Card>
  );
}
