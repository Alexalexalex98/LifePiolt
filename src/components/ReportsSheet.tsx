import { View } from 'react-native';

import { Body, Btn, Empty, H, Item, Row, Sheet } from '@/components/ui';
import { kindLabel, reasonLabel } from '@/lib/modRules';
import { fmtDateTime } from '@/lib/when';
import { useChat } from '@/store/chat';
import { useMod } from '@/store/moderation';
import { showUndoToast, toast } from '@/store/toast';

export const REPORT_NOTICE = 'La segnalazione è registrata sul dispositivo e verrà inviata quando ci sarà il servizio online. Nel frattempo il contenuto sparisce dai tuoi feed; puoi annullare la segnalazione da qui.';

/** Contenuto di "Segnalazioni inviate": segnalazioni (annullabili), contenuti nascosti e utenti bloccati (sbloccabili). */
export function ReportsView() {
  const reports = useMod((s) => s.reports);
  const hidden = useMod((s) => s.hidden);
  const blocked = useChat((s) => s.blocked);
  const hiddenList = Object.entries(hidden);
  return (
    <View>
      <View style={{ marginBottom: 12 }}><Body small muted>{REPORT_NOTICE}</Body></View>

      <H>Segnalazioni ({reports.length})</H>
      {reports.length === 0 ? <Empty text="Non hai segnalato nulla." /> : reports.map((r, i) => (
        <Item key={r.id} last={i === reports.length - 1}>
          <Body bold>{kindLabel[r.kind]} · {reasonLabel(r.reason)}</Body>
          <Body small numberOfLines={2}>{r.label}</Body>
          {r.author ? <Body small muted>Autore: {r.author}</Body> : null}
          {r.note ? <Body small muted>Nota: {r.note}</Body> : null}
          <Row style={{ marginTop: 6 }}>
            <Body small muted>{fmtDateTime(r.ts)} · in attesa di invio</Body>
            <Btn small ghost title="Annulla segnalazione" onPress={() => { const copy = r; useMod.getState().cancelReport(r.id); showUndoToast('Segnalazione annullata: il contenuto è di nuovo visibile', () => useMod.getState().report({ kind: copy.kind, ref: copy.ref, label: copy.label, author: copy.author, reason: copy.reason, note: copy.note })); }} />
          </Row>
        </Item>
      ))}

      <View style={{ marginTop: 16 }}><H>Contenuti nascosti ({hiddenList.length})</H></View>
      {hiddenList.length === 0 ? <Empty text="Nessun contenuto nascosto." /> : hiddenList.map(([key, h], i) => (
        <Item key={key} last={i === hiddenList.length - 1}>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{kindLabel[h.kind]}</Body><Body small muted numberOfLines={2}>{h.label}</Body></View>
            <Btn small ghost title="Mostra di nuovo" onPress={() => { useMod.getState().unhide(key); toast('Contenuto di nuovo visibile'); }} />
          </Row>
        </Item>
      ))}

      <View style={{ marginTop: 16 }}><H>Utenti bloccati ({blocked.length})</H></View>
      {blocked.length === 0 ? <Empty text="Nessun utente bloccato." /> : blocked.map((n, i) => (
        <Item key={n} last={i === blocked.length - 1}>
          <Row>
            <Body bold>{n}</Body>
            <Btn small ghost title="Sblocca" onPress={() => { useChat.getState().block(n, false); toast(`${n} sbloccato`); }} />
          </Row>
        </Item>
      ))}
      <Body small muted style={{ marginTop: 10 }}>Bloccare un utente vale per chat e LifeNetwork: non vedi più i suoi contenuti e non può scriverti.</Body>
    </View>
  );
}

/** Foglio "Segnalazioni inviate": <ReportsSheet visible onClose /> da usare per esempio in Impostazioni. */
export function ReportsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Segnalazioni inviate" onClose={onClose}>
      <ReportsView />
    </Sheet>
  );
}
