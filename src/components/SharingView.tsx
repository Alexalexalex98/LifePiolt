import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, IL, Input, Pill, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { alertT } from '@/lib/alert';
import { SENSITIVITY_LABEL, filterItems, groupBySensitivity, isChanged, isLocked, optionOf, summarize, whereNote, type CatalogItem, type Choices } from '@/lib/dataCatalog';
import { e2eLabel } from '@/lib/e2eModel';
import { Icon } from '@/lib/icons';
import { makeAllPrivate, useChoices, useSharing } from '@/store/sharing';
import { showUndoToast, toast } from '@/store/toast';
import { t as tl, translateText } from '@/i18n/core';

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.chip, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: tone ?? t.text, fontSize: 24, fontWeight: '800' }}>{n}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function ItemRow({ it, choices, last }: { it: CatalogItem; choices: Choices; last: boolean }) {
  const t = useTheme();
  const set = useSharing((s) => s.set);
  const opt = optionOf(it.id, choices)!;
  const locked = isLocked(it);
  const changed = isChanged(it.id, choices);
  const firstShared = it.options.find((o) => o.shared);
  const binary = it.options.length === 2;
  const change = (id: string) => {
    const r = set(it.id, id);
    if (!r.ok) { toast(r.error ?? 'Non si può cambiare'); return; }
    const o = it.options.find((x) => x.id === id);
    toast(tl('{0}: {1}', translateText(it.label), translateText(o?.label ?? '')));
  };
  return (
    <View style={{ paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.item }} testID={'share-' + it.id}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
          <View style={{ marginTop: 2 }}><Icon name={it.icon} size={19} color={t.muted} stroke={1.9} /></View>
          <View style={{ flex: 1 }}>
            <Body bold>{it.label}</Body>
            <Body small muted>{it.what}</Body>
          </View>
        </View>
        {locked
          ? <Icon name={opt.shared ? 'check' : 'lock'} size={19} color={opt.shared ? t.muted : t.positive} stroke={2} />
          : binary
            ? <Switch value={opt.shared} onValueChange={(v) => change(v ? it.options[1].id : it.options[0].id)} accessibilityLabel={translateText(tl('Condividi {0}', it.label))} />
            : null}
      </Row>
      {!locked && !binary && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {it.options.map((o) => <Pill key={o.id} label={o.label} on={o.id === opt.id} onPress={() => change(o.id)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <Pill label={whereNote(it.where)} icon={it.where === 'telefono' ? 'phone' : it.where === 'rete pubblica' ? 'users' : it.where === 'account su server' ? 'profile' : 'lock'} />
        <Pill label={tl('La vede: {0}', translateText(opt.audience))} icon="eye" />
        {it.status === 'predisposto' && <Pill label="Predisposta, si attiva col server" icon="clock" />}
        {changed && <Pill label="Modificato rispetto al predefinito" icon="edit" color={t.accent} />}
      </View>
      {it.e2e && <View style={{ marginTop: 8 }}><IL icon="lock" small muted>{e2eLabel()}</IL></View>}
      <Body small style={{ marginTop: 8 }}>{opt.hint}</Body>
      {!opt.shared && !locked && firstShared && <Body small muted style={{ marginTop: 2 }}>{tl('Se la condividi: {0}', translateText(firstShared.hint))}</Body>}
      {locked && it.lockedReason && <Body small muted style={{ marginTop: 2 }}>{it.lockedReason}</Body>}
    </View>
  );
}

/** Schermata "Cosa condivido": riepilogo, elenco per sensibilità, ricerca e azioni globali. */
export function SharingView() {
  const t = useTheme();
  const choices = useChoices();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const sum = summarize(choices);
  const groups = groupBySensitivity(filterItems(q, only, choices));
  const phone = sum.types - sum.onServer;

  const reset = () => alertT('Ripristinare i valori predefiniti?', 'Le tue scelte tornano a quelle iniziali: condivise solo le cose meno importanti, il resto resta solo tuo. Potrai annullare subito dopo.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Ripristina', style: 'destructive', onPress: () => {
      const before = { ...choices };
      useSharing.getState().resetDefaults();
      showUndoToast('Valori predefiniti ripristinati', () => useSharing.getState().applyAll(before));
    } },
  ]);
  const allPriv = () => alertT('Rendere tutto privato?', 'Smetti di condividere tutto ciò che si può non condividere. Resta pubblico solo ciò che lo è per natura (per esempio i post che pubblichi). Potrai annullare subito dopo.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Rendi tutto privato', style: 'destructive', onPress: () => {
      const before = makeAllPrivate();
      showUndoToast('Ora è tutto privato', () => useSharing.getState().applyAll(before));
    } },
  ]);

  return (
    <View>
      <Card>
        <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 10 }}>Il riepilogo</Text>
        <Row gap={8}>
          <Stat n={phone} label="Sul tuo telefono" />
          <Stat n={sum.shared} label="Condivisi" tone={t.accent} />
          <Stat n={sum.secret} label="Segreti" tone={t.positive} />
        </Row>
        <Body small muted style={{ marginTop: 10 }}>{tl('Sul tuo telefono: {0} tipi di dato', phone)}</Body>
        <Body small muted>Sui nostri server: solo nome, cognome, email, data di nascita e info di account.</Body>
        <Body small muted>{tl('Condivisi: {0} · Segreti: {1} · Critici sempre segreti: {2}', sum.shared, sum.secret, sum.critical)}</Body>
        <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 10, marginTop: 10 }}>
          <Body small>Il server di LifePilot non è ancora attivo: oggi nulla lascia il telefono, salvo ciò che invii tu (per esempio in chat) e le domande all'assistente AI. Le voci "predisposte" avranno effetto quando il server sarà attivo.</Body>
        </View>
      </Card>

      <Input placeholder="Cerca un tipo di dato (es. carte, agenda, salute)" value={q} onChangeText={setQ} style={{ marginTop: 4 }} />
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }} gap={8}>
        <Pill label="Solo condivisi" icon="eye" on={only} onPress={() => setOnly(!only)} />
        {sum.changed > 0 && <Pill label={tl('Modificati: {0}', sum.changed)} icon="edit" />}
      </Row>

      {groups.length === 0 && <Card><Body muted>Nessun dato corrisponde alla ricerca.</Body></Card>}
      {groups.map((g) => (
        <Card key={g.sensitivity} style={g.sensitivity === 'critico' ? { borderColor: t.positive } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {g.sensitivity === 'critico' && <Icon name="lock" size={18} color={t.positive} stroke={2} />}
            <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '700', flex: 1 }}>{SENSITIVITY_LABEL[g.sensitivity]}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>{g.items.length}</Text>
          </View>
          {g.sensitivity === 'critico' && <Body small muted>Carte, IBAN, CSV della banca, dati sanitari clinici e documenti fiscali non si possono condividere: non c'è nessun interruttore.</Body>}
          {g.items.map((it, i) => <ItemRow key={it.id} it={it} choices={choices} last={i === g.items.length - 1} />)}
        </Card>
      ))}

      <View style={{ gap: 8, marginTop: 4 }}>
        <Btn ghost title="Ripristina i valori predefiniti" icon="repeat" onPress={reset} />
        <Btn ghost title="Rendi tutto privato" icon="lock" onPress={allPriv} />
      </View>
    </View>
  );
}
