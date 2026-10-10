import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Input, Item, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { DESCRIPTIVE_NOTE, suggestAutomations } from '@/lib/automationSuggest';
import { cancelAutomation, suggestInput, syncAutomation } from '@/lib/automationRuntime';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { useLife, type Automation } from '@/store/life';
import { toast } from '@/store/toast';
import { t as tl, translateText } from '@/i18n/core';

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** Descrizione breve di cosa fa davvero l'automazione. */
function effectOf(a: Automation): string {
  const n = a.rule?.notify;
  if (!n) return 'Promemoria: ti avvisa, l\'azione la confermi tu';
  return n.kind === 'weekly' ? tl('Notifica ogni {0} alle {1}:{2}', translateText(DAYS[n.weekday ?? 0]), pad(n.hour), pad(n.minute)) : tl('Notifica ogni giorno alle {0}:{1}', pad(n.hour), pad(n.minute));
}

/** Programma/annulla la notifica e avvisa l'utente se non è possibile (Expo Go, web, permesso negato). */
async function apply(a: Pick<Automation, 'id' | 'on' | 'rule'>, quiet = false) {
  const msg = await syncAutomation(a);
  if (!quiet && msg && a.rule?.notify && a.on) toast(msg);
}

/** Foglio delle automazioni: elenco attuale, proposte consigliate e creazione a mano. Usabile da Plan e da Profilo. */
export function AutomationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const automations = useLife((s) => s.automations);
  const tasks = useLife((s) => s.tasks);
  const goals = useLife((s) => s.goals);
  const events = useLife((s) => s.events);
  const { addAuto, toggleAuto, renameAuto, delAuto, restoreAuto } = useLife();
  const [text, setText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // le proposte si ricalcolano quando cambiano dati o automazioni, ma solo a foglio aperto
  const suggestions = useMemo(() => (visible ? suggestAutomations(suggestInput(), 8) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, automations, tasks, goals, events]);

  const addSuggestion = (s: (typeof suggestions)[number]) => {
    const id = addAuto(s.rule, { key: s.key, ...(s.notify ? { notify: s.notify } : {}) });
    toast(s.notify ? 'Automazione aggiunta' : 'Automazione aggiunta · ti avvisa, l\'azione la confermi tu');
    void apply({ id, on: true, rule: { key: s.key, notify: s.notify } });
  };

  const remove = (a: Automation) => {
    let removed: { auto: Automation; idx: number } | null = null;
    confirmDelete(tl('l\'automazione «{0}»', a.t), () => { removed = delAuto(a.id); void cancelAutomation(a.id); }, () => {
      const r = removed as { auto: Automation; idx: number } | null;
      if (r) { restoreAuto(r.auto, r.idx); void apply(r.auto, true); }
    }, { undoMessage: 'Automazione eliminata' });
  };

  return (
    <Sheet visible={visible} title="Automazioni" onClose={onClose}>
      <Body small muted>Le automazioni con un orario ti mandano una notifica sul telefono. Le altre sono promemoria: ti avvisano, ma l'azione la confermi tu.</Body>

      <Text accessibilityRole="header" style={{ color: t.text, fontWeight: '800', fontSize: 15, marginTop: 16, marginBottom: 6 }}>Le tue automazioni</Text>
      {automations.length === 0 && <Body small muted>Nessuna automazione attiva. Aggiungi una di quelle consigliate qui sotto.</Body>}
      {automations.map((a) => (
        <Item key={a.id}>
          {editId === a.id ? (
            <>
              <Input value={editText} onChangeText={setEditText} autoFocus />
              <Row style={{ justifyContent: 'flex-start' }} gap={8}>
                <Btn small title="Salva" onPress={() => { const v = editText.trim(); if (!v) return; renameAuto(a.id, v); setEditId(null); toast('Automazione rinominata'); }} />
                <Btn small ghost title="Annulla" onPress={() => setEditId(null)} />
              </Row>
            </>
          ) : (
            <>
              <Toggle label={a.t} value={a.on} onChange={(v) => { toggleAuto(a.id, v); toast(v ? 'Automazione attivata' : 'Automazione disattivata'); void apply({ ...a, on: v }); }} />
              <Row style={{ marginTop: 2 }}>
                <Body small muted style={{ flex: 1 }}>{effectOf(a)}</Body>
                <Pressable onPress={() => { setEditId(a.id); setEditText(a.t); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${translateText('Rinomina')} ${a.t}`}><Icon name="edit" size={18} color={t.text} /></Pressable>
                <Pressable onPress={() => remove(a)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${translateText('Elimina')} ${a.t}`}><Icon name="trash" size={18} color={t.danger} /></Pressable>
              </Row>
            </>
          )}
        </Item>
      ))}

      <Text accessibilityRole="header" style={{ color: t.text, fontWeight: '800', fontSize: 15, marginTop: 20, marginBottom: 6 }}>Te le consiglio</Text>
      {suggestions.length === 0 && <Body small muted>Hai già aggiunto tutte le automazioni che ti consiglio.</Body>}
      {suggestions.map((s) => (
        <Item key={s.key}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Body bold>{s.title}</Body>
              <Body small style={{ marginTop: 2 }}>{s.rule}</Body>
              <Body small muted style={{ marginTop: 2 }}>{s.why}</Body>
              <Body small muted style={{ marginTop: 2 }}>{s.notify ? 'Ti manda una notifica all\'orario indicato.' : DESCRIPTIVE_NOTE}</Body>
            </View>
            <Btn small title="Aggiungi" icon="plus" onPress={() => addSuggestion(s)} />
          </Row>
        </Item>
      ))}

      <Text accessibilityRole="header" style={{ color: t.text, fontWeight: '800', fontSize: 15, marginTop: 20, marginBottom: 6 }}>Creane una tua</Text>
      <Input placeholder="Es. Ogni domenica crea la review della settimana" value={text} onChangeText={setText} />
      <Btn title="Crea" onPress={() => { const v = text.trim(); if (!v) return; addAuto(v); setText(''); toast('Automazione creata · ti avvisa, l\'azione la confermi tu'); }} />
      <Body small muted style={{ marginTop: 6 }}>Le automazioni scritte a mano sono promemoria descrittivi: non eseguono azioni da sole.</Body>
    </Sheet>
  );
}

/** Scheda riassuntiva per il Plan (e per il Profilo): quante automazioni attive e un tocco per aprire il foglio. */
export function AutomationsCard({ onOpen }: { onOpen: () => void }) {
  const automations = useLife((s) => s.automations);
  const { toggleAuto } = useLife();
  const t = useTheme();
  return (
    <Card>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={translateText('Automazioni')}>
        <Row>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>Automazioni</Text>
            <Body small muted>{automations.filter((a) => a.on).length === 1 ? '1 attiva' : tl('{0} attive', automations.filter((a) => a.on).length)} · tocca per vedere i consigli</Body>
          </View>
          <Btn small ghost icon="sparkle" title="Consigli" onPress={onOpen} />
        </Row>
      </Pressable>
      {automations.slice(0, 5).map((a) => (
        <Toggle key={a.id} label={a.t} value={a.on} onChange={(v) => { toggleAuto(a.id, v); toast(v ? 'Automazione attivata' : 'Automazione disattivata'); void apply({ ...a, on: v }); }} />
      ))}
      {automations.length > 5 && <Body small muted style={{ marginTop: 6 }}>{tl('e altre {0}', automations.length - 5)}</Body>}
    </Card>
  );
}
