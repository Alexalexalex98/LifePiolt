import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Row, Select, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { isSupported, listScheduled, sendTest, type ScheduledInfo } from '@/lib/notify';
import { canAsk, exactAlarmRelevant, offerNotifications, openExactAlarmSettings, openSystemSettings, refreshPermission, usePermission, type PermState } from '@/lib/notifyPermission';
import { LEAD_OPTIONS, normalizePrefs, type ReminderPrefs } from '@/lib/reminders';
import { useApp } from '@/store/app';
import { useInterests } from '@/store/interests';
import { toast } from '@/store/toast';

const LABEL: Record<PermState, string> = { granted: 'Attive', undetermined: 'Non ancora richieste', denied: 'Non concesse', blocked: 'Bloccate', unsupported: 'Non disponibili qui' };

/** Stato del permesso (sempre visibile) con i pulsanti giusti per ogni caso + avviso sulle sveglie esatte di Android. */
export function NotifStatus() {
  const t = useTheme();
  const perm = usePermission();
  const color = perm === 'granted' ? t.positive : perm === 'unsupported' ? t.muted : t.danger;
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <Row>
        <Body bold>Notifiche sul telefono</Body>
        <Row gap={6} style={{ justifyContent: 'flex-end' }}>
          <Icon name={perm === 'granted' ? 'check' : 'bell-off'} size={16} color={color} stroke={2.2} />
          <Body bold color={color}>{LABEL[perm]}</Body>
        </Row>
      </Row>
      {perm === 'unsupported' && <Body small muted>{isSupported() ? 'Non disponibili in questo ambiente.' : 'Le notifiche funzionano solo sull\'app installata sul telefono (non su web né in Expo Go su Android).'}</Body>}
      {perm === 'undetermined' && <Body small muted>Il telefono non mi ha ancora dato il permesso: attivale per ricevere i promemoria.</Body>}
      {perm === 'denied' && <Body small muted>Le notifiche sono spente: non ti avviserò prima degli impegni.</Body>}
      {perm === 'blocked' && <Body small muted>Il telefono non mi lascia più chiedere il permesso: riattivale dalle impostazioni di sistema.</Body>}
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        {(canAsk(perm) || perm === 'unsupported') && <Btn small icon="bell" title="Attiva le notifiche" onPress={() => offerNotifications('manual')} />}
        {(perm === 'blocked' || perm === 'denied' || perm === 'granted') && <Btn small ghost icon="settings" title="Apri impostazioni di sistema" onPress={() => void openSystemSettings()} />}
        {perm !== 'unsupported' && <Btn small ghost icon="repeat" title="Ricontrolla" onPress={() => { void refreshPermission().then((s) => toast(tl('Stato: {0}', tl(LABEL[s])))); }} />}
      </Row>
      {perm === 'granted' && exactAlarmRelevant() && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Body small muted>Gli avvisi arrivano in ritardo? Per avvisi puntuali consenti «Sveglie e promemoria» a LifePilot.</Body>
          <Row style={{ justifyContent: 'flex-start' }}><Btn small ghost icon="clock" title="Sveglie e promemoria" onPress={() => void openExactAlarmSettings()} /></Row>
        </View>
      )}
    </View>
  );
}

/** Promemoria degli impegni: ogni avviso si può spegnere da solo. */
export function ReminderSettings() {
  const app = useApp();
  const homeCity = useInterests((s) => s.homeCity);
  const perm = usePermission();
  const rem = normalizePrefs(app.reminders);
  const set = (patch: Partial<ReminderPrefs>) => {
    app.set({ reminders: { ...rem, ...patch } });
    toast('Preferenza aggiornata');
    if (patch.on === true && perm !== 'granted' && perm !== 'unsupported') offerNotifications('reminder');
  };
  return (
    <>
      <Toggle label="Promemoria impegni" hint="Avvisi per gli impegni che hanno un orario. Qui sotto scegli quali." value={rem.on} onChange={(v) => set({ on: v })} />
      {rem.on && (
        <View style={{ paddingStart: 12 }}>
          <Toggle label={tl('{0} minuti prima', rem.leadMin)} hint="Ti avvisa poco prima che l'impegno inizi" value={rem.lead} onChange={(v) => set({ lead: v })} />
          {rem.lead && <Row><Body small muted>Anticipo</Body><Select value={tl('{0} min prima', rem.leadMin)} title="Anticipo" options={LEAD_OPTIONS.map((m) => tl('{0} min prima', m))} onChange={(v) => set({ leadMin: parseInt(v, 10) })} /></Row>}
          <Toggle label="Inizia ora" hint="Una notifica all'ora esatta in cui l'impegno comincia" value={rem.start} onChange={(v) => set({ start: v })} />
          <Toggle label="Parti alle ore…" hint={homeCity ? 'Se l\'impegno ha un luogo, ti dice a che ora partire' : 'Se l\'impegno ha un luogo, ti dice a che ora partire (imposta la città di casa nel profilo)'} value={rem.depart} onChange={(v) => set({ depart: v })} />
          {rem.depart && (
            <View style={{ paddingStart: 12 }}>
              <Toggle label="15 minuti prima di partire" hint="Un primo avviso, così hai il tempo di prepararti" value={rem.headsup} onChange={(v) => set({ headsup: v })} />
              <Toggle label="Alla partenza" hint="Un avviso all'ora in cui devi uscire" value={rem.leave} onChange={(v) => set({ leave: v })} />
            </View>
          )}
        </View>
      )}
    </>
  );
}

const fmtWhen = (at: number | null) => (at === null ? 'ora non nota' : fmtDate(at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));

/** Strumenti di verifica: notifica di prova tra 5 secondi + elenco delle notifiche programmate. */
export function NotifTools() {
  const t = useTheme();
  const perm = usePermission();
  const [list, setList] = useState<ScheduledInfo[] | null>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await listScheduled();
    setList(r.items);
    setInfo(r.ok ? '' : r.message ?? '');
  }, []);

  const test = async () => {
    if (!canAsk(perm) && perm !== 'granted') { toast(perm === 'unsupported' ? 'Disponibile solo sull\'app installata' : 'Le notifiche sono bloccate: aprile dalle impostazioni di sistema'); return; }
    setBusy(true);
    if (perm !== 'granted') { offerNotifications('manual'); setBusy(false); return; }
    const r = await sendTest(5);
    setBusy(false);
    toast(r.ok ? 'Notifica di prova in arrivo tra 5 secondi: se non arriva, controlla le impostazioni di sistema' : r.message);
    void load();
  };

  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        <Btn small icon="bell" title="Invia una notifica di prova tra 5 secondi" disabled={busy} onPress={() => void test()} />
        <Btn small ghost icon="tasks" title={list ? 'Aggiorna l\'elenco' : 'Elenco delle notifiche programmate'} onPress={() => void load()} />
      </Row>
      {info ? <Body small muted>{info}</Body> : null}
      {list && (
        <View style={{ gap: 2 }}>
          <Body small bold>{list.length === 0 ? 'Nessuna notifica programmata' : tl('{0} notifiche programmate', list.length)}</Body>
          {list.slice(0, 40).map((n) => (
            <View key={n.id} style={{ paddingVertical: 5, borderTopWidth: 1, borderTopColor: t.item }}>
              <Body small bold numberOfLines={1}>{n.title}</Body>
              <Body small muted numberOfLines={2}>{fmtWhen(n.at)} · {n.body}</Body>
            </View>
          ))}
          {list.length > 40 && <Body small muted>{tl('… e altre {0}', list.length - 40)}</Body>}
        </View>
      )}
    </View>
  );
}
