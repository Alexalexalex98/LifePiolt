import { View } from 'react-native';

import { Body, Card, H, IL, Pill, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { SENSITIVITY_LABEL } from '@/lib/dataCatalog';
import { Icon } from '@/lib/icons';
import { useSync, useSyncData } from '@/store/sync';
import { setCategory } from '@/sync/bindings';
import { EXCLUDED, syncCategories } from '@/sync/registry';
import { toast } from '@/store/toast';

/** Opt-in per categoria: "Sincronizza tra i miei dispositivi". Predefinito per tutto: solo sul telefono. */
export function SyncCategories() {
  const t = useTheme();
  const enabled = useSync((s) => s.enabled);
  const outbox = useSyncData((s) => s.outbox);
  const cats = syncCategories();
  const pendingBy = (cat: string) => outbox.filter((r) => cats.find((c) => c.id === cat)?.collections.some((x) => x.name === r.collection)).length;
  return (
    <Card>
      <H>Sincronizza tra i miei dispositivi</H>
      <Body small muted style={{ marginTop: 6, marginBottom: 6 }}>
        Di predefinito tutto resta solo sul telefono. Se abiliti una categoria, le sue modifiche (non il resto) vengono inviate al tuo server per allinearle sugli altri tuoi dispositivi. Puoi disattivarla quando vuoi: l’elenco locale delle modifiche in attesa viene cancellato.
      </Body>
      {cats.map((c, i) => {
        const on = !!enabled[c.id];
        return (
          <View key={c.id} testID={'sync-cat-' + c.id} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.item }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Body bold>{c.label}</Body>
                <Body small muted>{c.what}</Body>
              </View>
              <Switch value={on} accessibilityLabel={`Sincronizza ${c.label}`} onValueChange={(v) => { void setCategory(c.id, v).then((r) => { if (!r.ok) toast(r.error ?? 'Non si puo’ abilitare'); }); }} />
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <Pill label={on ? 'Sincronizza tra i miei dispositivi' : 'Solo sul telefono'} icon={on ? 'repeat' : 'phone'} />
              <Pill label={SENSITIVITY_LABEL[c.sensitivity]} icon="shield" />
              {c.requiresE2E && <Pill label="Richiede cifratura end-to-end (non ancora attiva)" icon="lock" />}
              {on && pendingBy(c.id) > 0 && <Pill label={`${pendingBy(c.id)} in attesa`} icon="clock" />}
            </View>
            {on && <Body small style={{ marginTop: 8 }}>{c.requiresE2E ? 'Abilitata, ma nulla viene inviato finche’ non c’e’ la cifratura end-to-end.' : 'Il contenuto lascia il telefono verso il tuo server. Oggi non e’ ancora cifrato end-to-end.'}</Body>}
            {i === cats.length - 1 ? null : null}
          </View>
        );
      })}
      <View style={{ borderTopWidth: 1, borderTopColor: t.item, paddingTop: 12, gap: 6 }}>
        <IL icon="lock" small>Non si sincronizzano mai</IL>
        {EXCLUDED.filter((e) => e.category && ['fin_accounts', 'fin_cards', 'fin_tax', 'health_clinical', 'doc_id'].includes(e.category)).map((e) => (
          <View key={e.what} style={{ flexDirection: 'row', gap: 8 }}>
            <Icon name="lock" size={14} color={t.muted} />
            <Body small muted style={{ flex: 1 }}>{e.what}</Body>
          </View>
        ))}
        <Body small muted>Carte, IBAN, CSV della banca, dati sanitari clinici e documenti fiscali restano sempre sul telefono, senza interruttore.</Body>
      </View>
    </Card>
  );
}
