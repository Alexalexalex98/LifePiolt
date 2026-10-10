import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Input, Pill, Row, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { buildKnowledge, groupKnowledge, matchCatalog, shouldGroup, SOURCE_LABEL, type KItem } from '@/lib/knowledge';
import { useHealth } from '@/store/health';
import { INTEREST_CATALOG, useInterests } from '@/store/interests';
import { useLife } from '@/store/life';
import { useTravel } from '@/store/travel';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';

/** Cosa LifePilot sa di te: tutto in un elenco, raggruppato in macro categorie quando è lungo. Ogni voce si modifica e si elimina. */
export function InterestsPicker() {
  const t = useTheme();
  const it = useInterests();
  const trips = useTravel((s) => s.saved);
  const goals = useLife((s) => s.goals);
  const workouts = useHealth((s) => s.workouts);
  const [text, setText] = useState('');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const items = useMemo(() => buildKnowledge({
    chosen: INTEREST_CATALOG.filter((c) => it.selected.includes(c.id)).map((c) => ({ id: c.id, label: c.label })),
    custom: it.custom,
    recent: it.recent,
    trips: trips.map((x) => ({ id: x.id, city: x.city })),
    goals: goals.map((g) => ({ id: g.id, t: g.t })),
    workouts: workouts.map((w) => ({ type: w.type })),
    dismissed: it.dismissed,
  }), [it.selected, it.custom, it.recent, it.dismissed, trips, goals, workouts]);

  const suggestions = INTEREST_CATALOG.filter((c) => !it.selected.includes(c.id));

  const add = () => {
    const l = text.trim();
    if (!l) return;
    const id = matchCatalog(l, INTEREST_CATALOG.map((c) => ({ id: c.id, label: c.label })));
    if (id) { if (!it.selected.includes(id as never)) it.toggle(id as never); } else it.addCustom(l);
    setText(''); toast('Aggiunto');
  };

  const remove = (x: KItem) => {
    const kind = x.key[0];
    const id = x.key.slice(2);
    if (kind === 'c') confirmDelete(`«${x.label}» dai tuoi interessi`, () => it.toggle(id as never), () => it.toggle(id as never), { undoMessage: 'Interesse rimosso' });
    else if (kind === 'm') {
      const keep = it.custom.find((c) => c.id === id);
      confirmDelete(`«${x.label}» dai tuoi interessi`, () => it.removeCustom(id), () => { if (keep) it.addCustom(keep.label); }, { undoMessage: 'Interesse rimosso' });
    } else confirmDelete(`«${x.label}» da ciò che so di te`, () => it.dismiss(x.key), () => it.undismiss(x.key), { undoMessage: 'Voce rimossa' });
  };

  const saveEdit = (x: KItem) => {
    const l = editText.trim();
    setEditKey(null);
    if (!l || l === x.label) return;
    if (x.key[0] === 'm') it.renameCustom(x.key.slice(2), l);
    else {
      // una voce scelta o dedotta diventa tua, con il nome che preferisci
      if (x.key[0] === 'c') it.toggle(x.key.slice(2) as never); else it.dismiss(x.key);
      const id = matchCatalog(l, INTEREST_CATALOG.map((c) => ({ id: c.id, label: c.label })));
      if (id) { if (!it.selected.includes(id as never)) it.toggle(id as never); } else it.addCustom(l);
    }
    toast('Salvato');
  };

  const row = (x: KItem) => (
    <View key={x.key} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.border }}>
      {editKey === x.key ? (
        <Row>
          <Input flex={1} value={editText} onChangeText={setEditText} autoFocus style={{ marginBottom: 0 }} onSubmitEditing={() => saveEdit(x)} />
          <Btn small title="Salva" onPress={() => saveEdit(x)} />
        </Row>
      ) : (
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{x.label}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{SOURCE_LABEL[x.source]}</Text>
          </View>
          <Pressable onPress={() => { setEditKey(x.key); setEditText(x.label); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText(`Modifica ${x.label}`)} style={{ padding: 6 }}><Icon name="edit" size={18} color={t.muted} /></Pressable>
          <XBtn label={`Elimina ${x.label}`} onPress={() => remove(x)} />
        </Row>
      )}
    </View>
  );

  const grouped = shouldGroup(items);

  return (
    <View>
      <Body muted style={{ marginBottom: 10 }}>Qui c'è tutto ciò che so dei tuoi interessi: quello che scegli, quello che aggiungi e quello che deduco da ricerche, viaggi, obiettivi e allenamenti. Puoi modificare o eliminare ogni voce. Lo uso per proporti cosa fare se arrivi in anticipo e per consigliarti viaggi.</Body>

      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{`Le tue voci · ${items.length}`}</Text>
      {items.length === 0 ? <Body small muted>Ancora niente. Aggiungi un interesse qui sotto.</Body> : grouped
        ? groupKnowledge(items).map((g) => (
          <View key={g.group} style={{ marginBottom: 6 }}>
            <Pressable onPress={() => setOpen({ ...open, [g.group]: !open[g.group] })} accessibilityRole="button" accessibilityState={{ expanded: !!open[g.group] }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
              <View style={{ transform: [{ rotate: open[g.group] ? '90deg' : '0deg' }] }}><Icon name="chevron" size={14} color={t.muted} stroke={2.2} /></View>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', flex: 1 }}>{g.group}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{g.items.length}</Text>
            </Pressable>
            {open[g.group] ? g.items.map(row) : null}
          </View>
        ))
        : items.map(row)}

      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 }}>Aggiungi</Text>
      <Input placeholder="Es. fotografia, jazz, Lisbona…" value={text} onChangeText={setText} onSubmitEditing={add} />
      <Btn small title="Aggiungi" icon="plus" onPress={add} disabled={!text.trim()} />
      {suggestions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {suggestions.map((c) => <Pill key={c.id} icon="plus" label={c.label} onPress={() => it.toggle(c.id)} />)}
        </View>
      ) : null}

      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 }}>La tua città o zona abituale</Text>
      <Input placeholder="Es. Lugano" value={it.homeCity} onChangeText={it.setHomeCity} />
    </View>
  );
}
