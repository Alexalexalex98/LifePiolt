import { View } from 'react-native';

import { Body, Card, H, Pill, Row, Switch } from '@/components/ui';
import { GROUP_HINT, GROUP_KINDS, GROUP_NAME } from '@/lib/aiRouter/labels';
import { PROVIDERS } from '@/lib/aiRouter/registry';
import { MODE_HINT, MODE_LABEL } from '@/lib/aiRouter/select';
import { TASK_GROUPS, type Mode, type TaskGroup } from '@/lib/aiRouter/types';
import { useAiRouter } from '@/store/aiRouter';

const MODES: Mode[] = ['economica', 'bilanciata', 'qualita'];
const providersOf = (g: TaskGroup) => PROVIDERS.filter((p) => GROUP_KINDS[g].some((k) => !!p.caps[k]));

export function ModeCard() {
  const prefs = useAiRouter((s) => s.prefs);
  const setPrefs = useAiRouter((s) => s.setPrefs);
  return (
    <>
      <Card>
        <H>Solo sul telefono</H>
        <Row>
          <Body style={{ flex: 1 }}>Non usare mai AI esterne</Body>
          <Switch value={prefs.phoneOnly} onValueChange={(v) => setPrefs({ phoneOnly: v })} accessibilityLabel="Solo sul telefono" />
        </Row>
        <Body small muted style={{ marginTop: 8 }}>{prefs.phoneOnly
          ? 'Consigliato. Theia fa tutto in locale e non delega nulla. Se una richiesta richiede un\'AI esterna ti dice che serve attivarla qui.'
          : 'Theia può delegare a un\'AI esterna solo ciò che serve davvero, dopo aver controllato limiti e privacy e (se serve) chiesto il tuo consenso.'}</Body>
      </Card>
      <Card>
        <H>Qualità o costo</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {MODES.map((m) => <Pill key={m} label={MODE_LABEL[m]} on={prefs.mode === m} onPress={() => setPrefs({ mode: m })} />)}
        </View>
        <Body small muted style={{ marginTop: 8 }}>{MODE_HINT[prefs.mode]}</Body>
      </Card>
    </>
  );
}

export function TaskChoices() {
  const taskPref = useAiRouter((s) => s.prefs.taskPref);
  const setTaskPref = useAiRouter((s) => s.setTaskPref);
  return (
    <Card>
      <H>Chi usare per ogni compito</H>
      <Body small muted style={{ marginBottom: 6 }}>Auto: scelgo io il migliore per ogni richiesta. Un fornitore: uso sempre quello. Mai: nessun servizio esterno per quel compito.</Body>
      {TASK_GROUPS.map((g) => {
        const cur = taskPref[g] ?? 'auto';
        return (
          <View key={g} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.18)' }} testID={'task-' + g}>
            <Body bold>{GROUP_NAME[g]}</Body>
            <Body small muted>{GROUP_HINT[g]}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <Pill label="Auto" on={cur === 'auto'} onPress={() => setTaskPref(g, 'auto')} />
              {providersOf(g).map((p) => <Pill key={p.id} label={p.short} on={cur === p.id} onPress={() => setTaskPref(g, p.id)} />)}
              <Pill label="Mai" on={cur === 'never'} onPress={() => setTaskPref(g, 'never')} />
            </View>
            <Body small muted style={{ marginTop: 6 }}>{cur === 'auto'
              ? 'Scelgo io il migliore, in base a qualità, costo e privacy.'
              : cur === 'never' ? 'Non uso servizi esterni per questo compito.'
                : 'Uso sempre questo fornitore. Se non è disponibile non ripiego su altri.'}</Body>
          </View>
        );
      })}
    </Card>
  );
}
