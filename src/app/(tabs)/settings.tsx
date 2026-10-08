import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import { navLabelFor } from '@/components/NavBar';
import { WorkHoursSheet } from '@/components/plan';
import { Body, Btn, Card, H, Input, Item, Link, Page, Pill, Row, Select, Sheet, Toggle, Chev } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { exportBackup, pickBackup, restoreBackup, STORE_LABELS, wipeAllData, type BackupPreview } from '@/lib/backup';
import { formatErrors, logError, useErrorLog } from '@/lib/errorLog';
import { translate, useSectionNames, useT } from '@/lib/i18n';
import { go } from '@/lib/nav';
import { cancelAll, refreshBriefings, requestPermission } from '@/lib/notify';
import { areaColors, Icon } from '@/lib/icons';
import { navCatalog, useApp, type Appearance, type Language } from '@/store/app';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useTravel } from '@/store/travel';
import { toast } from '@/store/toast';

const dataLabels: Record<string, string> = {
  life: 'Task, obiettivi, note, file e calendario', health: 'Dati di salute e umore', finance: 'Movimenti, budget e investimenti simulati',
  travel: 'Preferenze e itinerari di viaggio', app: 'Account, preferenze e impostazioni',
};

/** Orari a passi di 15 minuti tra due ore (incluse). */
const timeOptions = (from: number, to: number) => Array.from({ length: (to - from + 1) * 4 }, (_, i) => `${String(from + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

export default function Settings() {
  const t = useTheme();
  const tr = useT();
  const names = useSectionNames();
  const app = useApp();
  const { set } = app;
  const [edit, setEdit] = useState<null | 'name' | 'email' | 'assistant'>(null);
  const [editVal, setEditVal] = useState('');
  const [wh, setWh] = useState(false);
  const [info, setInfo] = useState<null | 'help' | 'contact' | 'terms'>(null);
  const [del, setDel] = useState<0 | 1 | 2>(0);
  const [restore, setRestore] = useState<null | { text: string; preview: BackupPreview | null; step: 1 | 2; error?: string }>(null);
  const [errSheet, setErrSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors = useErrorLog((e) => e.entries);
  const life = useLife(), health = useHealth(), fin = useFin(), travel = useTravel();

  const sizes: Record<string, number> = {
    life: JSON.stringify({ ...life, setCat: 0 }).length, health: JSON.stringify(health).length, finance: JSON.stringify(fin).length,
    travel: JSON.stringify(travel).length, app: JSON.stringify(app).length,
  };
  const totalKB = Math.round(Object.values(sizes).reduce((a, b) => a + b, 0) / 102.4) / 10;

  async function togglePush(v: boolean) {
    if (v) {
      let status = 'denied';
      try { status = (await Notifications.requestPermissionsAsync()).status; } catch { /* Expo Go o permessi non disponibili */ }
      if (status !== 'granted') { Alert.alert('Notifiche disattivate', 'Per riceverle abilita le notifiche per LifePilot dalle impostazioni del telefono.'); return; }
    }
    set({ notif: { ...app.notif, push: v } });
    toast('Preferenza aggiornata');
  }

  async function exportData() {
    const data = { account: app.account, life: { tasks: life.tasks, goals: life.goals, automations: life.automations, notes: life.notes, drive: life.drive.map(({ uri, ...f }) => f), events: life.events, vacations: life.vacations }, health: { series: health.series, workouts: health.workouts, mindSessions: health.mindSessions, moods: health.moods }, finance: { months: fin.months, budget: fin.budget, bills: fin.bills, tax: fin.tax }, travel: travel.saved };
    try { await Share.share({ message: JSON.stringify(data, null, 2), title: 'I miei dati LifePilot' }); } catch { toast('Esportazione non riuscita'); }
  }

  async function setBrief(kind: 'morning' | 'evening', patch: Partial<typeof app.briefing>) {
    const next = { ...app.briefing, ...patch };
    if (patch[kind] === true) {
      const r = await requestPermission();
      if (!r.ok) { toast(r.message); Alert.alert('Notifiche non attive', r.message); return; }
    }
    set({ briefing: next });
    void refreshBriefings();
    toast('Preferenza aggiornata');
  }

  async function doExportBackup() {
    setBusy(true);
    const r = await exportBackup();
    setBusy(false);
    toast(r.message);
  }

  async function doPickBackup() {
    const r = await pickBackup();
    if (!r.ok) { if (!r.canceled) setRestore({ text: '', preview: null, step: 1, error: r.error }); return; }
    setRestore({ text: r.text, preview: r.preview, step: 1 });
  }

  async function doRestore() {
    if (!restore) return;
    setBusy(true);
    const r = await restoreBackup(restore.text);
    setBusy(false);
    setRestore(null);
    if (r.ok) void refreshBriefings();
    toast(r.message);
  }

  async function doDeleteAll() {
    setDel(0);
    setBusy(true);
    try {
      await cancelAll();
      await wipeAllData();
      useErrorLog.getState().clear();
    } catch (e) { logError(e, 'settings.deleteAll'); toast('Eliminazione non completata'); }
    setBusy(false);
  }

  async function sendErrors() {
    try { await Share.share({ message: formatErrors(errors), title: 'Problemi riscontrati - LifePilot' }); } catch {
      try { await Clipboard.setStringAsync(formatErrors(errors)); toast('Copiato: incollalo in un messaggio al supporto'); } catch { toast('Condivisione non riuscita'); }
    }
  }

  function toggleNav(id: string) {
    const has = app.navItems.includes(id);
    if (!has && app.navItems.length >= 5) { toast('Puoi averne al massimo 5: toglierne una prima'); return; }
    if (has && app.navItems.length <= 1) { toast('Deve restarne almeno una'); return; }
    set({ navItems: has ? app.navItems.filter((x) => x !== id) : [...app.navItems, id] });
  }

  const infos = {
    help: { title: tr('stHelpCenter'), body: 'Domande frequenti su LifePilot: come collegare LifeHealth a un wearable, come funziona la scomposizione dei task, come modificare gli orari di lavoro. Per altro scrivici dalla sezione Contattaci.' },
    contact: { title: tr('stContactUs'), body: "Per assistenza su LifePilot scrivi al contatto di supporto indicato nella scheda dello store dell'app." },
    terms: { title: tr('stTerms'), body: 'BOZZA — da completare e far revisionare prima della pubblicazione: qui andranno i termini di servizio completi.' },
  };

  return (
    <Page id="settings" title={names.settings} back>
      <Card>
        <H>{tr('stNavCustomizeTitle')}</H>
        <Body small muted style={{ marginBottom: 10 }}>{tr('stNavCustomizeDesc')}</Body>
        {Object.keys(navCatalog).map((id) => {
          const checked = app.navItems.includes(id);
          const c = areaColors[id] ?? '#8fa4ff';
          return (
            <Item key={id} onPress={() => toggleNav(id)}>
              <Row>
                <Row style={{ justifyContent: 'flex-start', flex: 1 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={id} size={15} color={c} stroke={2} /></View>
                  <Body>{navLabelFor(id, app.language)}</Body>
                </Row>
                <Icon name={checked ? 'checksquare' : 'circle'} size={22} color={checked ? t.positive : t.muted} />
              </Row>
            </Item>
          );
        })}
      </Card>

      <Card>
        <H>{tr('stAccount')}</H>
        <Item><Row><Body muted>{tr('stNameLabel')}</Body><Pressable onPress={() => { setEditVal(app.account.name); setEdit('name'); }}><Body bold>{app.account.name || '—'}</Body></Pressable></Row></Item>
        <Item><Row><Body muted>{tr('stEmailLabel')}</Body><Pressable onPress={() => { setEditVal(app.account.email); setEdit('email'); }}><Body bold>{app.account.email || 'Aggiungi email'}</Body></Pressable></Row></Item>
        <Item><Row><Body muted>Nome dell'assistente AI</Body><Pressable onPress={() => { setEditVal(app.assistantName); setEdit('assistant'); }}><Body bold>{app.assistantName}</Body></Pressable></Row></Item>
        <Item last><Row><Body muted>{tr('stPasswordLabel')}</Body><Link onPress={() => toast("Il cambio password sarà disponibile con l'account online")}>{tr('stChangePasswordBtn')}</Link></Row></Item>
      </Card>

      <Card>
        <H>{tr('stDevices')}</H>
        {app.devices.map((d, i) => (
          <Item key={i} last={i === app.devices.length - 1}>
            <Row><View><Body bold>{d.name}</Body><Body small muted>{d.detail}</Body></View>{d.current ? <Body small color={t.positive}>attivo</Body> : <Link danger onPress={() => { set({ devices: app.devices.filter((_, j) => j !== i) }); toast('Dispositivo disconnesso'); }}>disconnetti</Link>}</Row>
          </Item>
        ))}
      </Card>

      <Card>
        <H>{tr('stNotif')}</H>
        <Toggle label={tr('stNotifPush')} value={app.notif.push} onChange={togglePush} />
        <Toggle label={tr('stNotifCal')} value={app.notif.calendar} onChange={(v) => { set({ notif: { ...app.notif, calendar: v } }); toast('Preferenza aggiornata'); }} />
        <Toggle label={tr('stNotifFin')} value={app.notif.finance} onChange={(v) => { set({ notif: { ...app.notif, finance: v } }); toast('Preferenza aggiornata'); }} />
        <Toggle label={tr('stNotifHealth')} value={app.notif.health} onChange={(v) => { set({ notif: { ...app.notif, health: v } }); toast('Preferenza aggiornata'); }} />
        <Toggle label={tr('stNotifDigest')} value={app.notif.digest} onChange={(v) => { set({ notif: { ...app.notif, digest: v } }); toast('Preferenza aggiornata'); }} />
        <Toggle label={tr('stNotifEmail')} value={app.notif.email} onChange={(v) => { set({ notif: { ...app.notif, email: v } }); toast('Preferenza aggiornata'); }} />
        <Toggle label="Briefing del mattino" hint="Notifica sul telefono con il riepilogo della giornata" value={app.briefing.morning} onChange={(v) => void setBrief('morning', { morning: v })} />
        {app.briefing.morning && <Row><Body small muted>Orario</Body><Select value={app.briefing.morningAt} options={timeOptions(5, 11)} onChange={(v) => void setBrief('morning', { morningAt: v })} /></Row>}
        <Toggle label="Riepilogo serale" hint="Notifica sul telefono con il bilancio della giornata" value={app.briefing.evening} onChange={(v) => void setBrief('evening', { evening: v })} />
        {app.briefing.evening && <Row><Body small muted>Orario</Body><Select value={app.briefing.eveningAt} options={timeOptions(17, 23)} onChange={(v) => void setBrief('evening', { eveningAt: v })} /></Row>}
      </Card>

      <Card>
        <H>{tr('stPrivacy')}</H>
        <Toggle label={tr('stSec2fa')} value={app.security.twofa} onChange={(v) => { set({ security: { ...app.security, twofa: v } }); toast('Preferenza di sicurezza aggiornata'); }} />
        <Toggle label={tr('stSecLock')} value={app.security.lock} onChange={(v) => { set({ security: { ...app.security, lock: v } }); toast('Preferenza di sicurezza aggiornata'); }} />
        <Btn small ghost style={{ marginTop: 10 }} title={tr('stEndSessionsBtn')} onPress={() => { set({ devices: app.devices.filter((d) => d.current) }); toast('Tutte le altre sessioni sono state terminate'); }} />
      </Card>

      <Card>
        <H>{tr('stAppearance')}</H>
        <Select value={app.appearance} options={['Scuro', 'Chiaro', 'Sistema']} onChange={(v) => { set({ appearance: v as Appearance }); toast('Aspetto: ' + v); }} />
      </Card>

      <Card>
        <H>{tr('stLanguage')}</H>
        <Select value={app.language} options={['Italiano', 'English', 'Deutsch', 'Français']} onChange={(v) => { set({ language: v as Language }); toast(translate(v as Language, 'langChanged')); }} />
        <View style={{ flexDirection: 'row' }}><Pill label={app.timeFormat} onPress={() => { const n = app.timeFormat === '24h' ? '12h' : '24h'; set({ timeFormat: n }); toast('Formato ora: ' + n); }} /></View>
      </Card>

      <Card>
        <H>{tr('stAccessibility')}</H>
        <Toggle label={tr('stAccTextLg')} value={app.accessibility.textLg} onChange={(v) => { set({ accessibility: { ...app.accessibility, textLg: v } }); toast('Impostazione applicata'); }} />
        <Toggle label={tr('stAccReduceMotion')} value={app.accessibility.reduceMotion} onChange={(v) => { set({ accessibility: { ...app.accessibility, reduceMotion: v } }); toast('Impostazione applicata'); }} />
        <Toggle label={tr('stAccHighContrast')} value={app.accessibility.highContrast} onChange={(v) => { set({ accessibility: { ...app.accessibility, highContrast: v } }); toast('Impostazione applicata'); }} />
      </Card>

      <Card>
        <H>{tr('stWorkHoursTitle')}</H>
        <Row><Body small>{app.workHours.start} – {app.workHours.end}</Body><Btn small ghost title={tr('stWorkHoursModifyBtn')} onPress={() => setWh(true)} /></Row>
        <Body small muted style={{ marginTop: 6 }}>{tr('stWorkHoursDesc')}</Body>
      </Card>

      <Card>
        <H>{tr('stIntegrationsTitle')}</H>
        {Object.keys(app.integrations).map((k) => <Toggle key={k} label={tr({ Calendario: 'stIntCalendar', Health: 'stIntHealth', Email: 'stIntEmail', Wearable: 'stIntWearable', 'Smart Home': 'stIntSmartHome' }[k] ?? k)} value={app.integrations[k]} onChange={(v) => { set({ integrations: { ...app.integrations, [k]: v } }); toast(`${k} ${v ? 'collegato' : 'disconnesso'}`); }} />)}
      </Card>

      <Card>
        <H>{tr('stPrivacyCenterTitle')}</H>
        {Object.keys(app.privacy).map((k) => <Toggle key={k} label={tr({ 'AI Memory': 'stPrivAiMemory', 'Dati salute': 'stPrivHealth', 'Dati finanziari': 'stPrivFinance', Posizione: 'stPrivLocation' }[k] ?? k)} value={app.privacy[k]} onChange={(v) => { set({ privacy: { ...app.privacy, [k]: v } }); toast(`${k} ${v ? 'collegato' : 'disconnesso'}`); }} />)}
        <View style={{ gap: 8, marginTop: 10 }}>
          <Btn small ghost title="Privacy e permessi" onPress={() => go('privacy')} />
          <Btn small ghost title={tr('stExportBtn')} onPress={exportData} />
          <Btn small ghost danger title="Elimina tutti i miei dati" onPress={() => setDel(1)} />
        </View>
      </Card>

      <Card>
        <H>Backup e ripristino</H>
        <Body small muted style={{ marginBottom: 10 }}>Salva tutti i tuoi dati in un unico file da conservare o da portare su un altro telefono. Gli allegati multimediali delle chat (foto, video, audio) non sono inclusi.</Body>
        <View style={{ gap: 8 }}>
          <Btn small ghost disabled={busy} title="Esporta backup" onPress={() => void doExportBackup()} />
          <Btn small ghost disabled={busy} title="Ripristina da file" onPress={() => void doPickBackup()} />
        </View>
      </Card>

      <Card>
        <H>Problemi riscontrati</H>
        <Row><Body small muted style={{ flex: 1 }}>{errors.length ? `${errors.length} registrati su questo dispositivo` : 'Nessun problema registrato'}</Body><Btn small ghost title="Apri" onPress={() => setErrSheet(true)} /></Row>
      </Card>

      <Card>
        <H>{tr('stStorageTitle')}</H>
        <Row><Body muted style={{ flex: 1 }}>{tr('stStorageLabel')}</Body><Body bold>{totalKB} KB</Body></Row>
        <Body small muted style={{ marginVertical: 10 }}>{tr('stStorageDesc')}</Body>
        {Object.keys(sizes).map((k) => (
          <Toggle key={k} label={dataLabels[k]} hint={`${(sizes[k] / 1024).toFixed(1)} KB`} value={app.dataLocal[k] !== false} onChange={(v) => { set({ dataLocal: { ...app.dataLocal, [k]: v } }); toast(v ? 'Categoria impostata su solo locale' : 'Preferenza salvata per quando ci sarà un account online'); }} />
        ))}
      </Card>

      <Card>
        <H>{tr('stHelpTitle')}</H>
        {([['help', tr('stHelpCenter')], ['contact', tr('stContactUs')], ['terms', tr('stTerms')], ['privacy', 'Privacy e permessi']] as const).map(([k, label], i, a) => (
          <Item key={k} last={i === a.length - 1} onPress={() => (k === 'privacy' ? go('privacy') : setInfo(k))}><Row><Body>{label}</Body><Chev /></Row></Item>
        ))}
      </Card>

      <Card><H>Informazioni sull'app</H><Row><Body muted>Versione</Body><Body>LifePilot {Constants.expoConfig?.version}</Body></Row></Card>

      <Sheet visible={!!edit} title={edit === 'name' ? 'Modifica nome' : edit === 'assistant' ? 'Nome dell’assistente' : 'Modifica email'} onClose={() => setEdit(null)}>
        <Input value={editVal} onChangeText={setEditVal} autoCapitalize={edit === 'email' ? 'none' : 'words'} keyboardType={edit === 'email' ? 'email-address' : 'default'} />
        <Btn title="Salva" onPress={() => { const v = editVal.trim(); if (!v || !edit) return; if (edit === 'assistant') set({ assistantName: v }); else set({ account: { ...app.account, [edit]: v } }); setEdit(null); toast(edit === 'name' ? 'Nome aggiornato' : 'Email aggiornato'); }} />
      </Sheet>
      <WorkHoursSheet key={`${app.workHours.start}${app.workHours.end}${wh}`} visible={wh} onClose={() => setWh(false)} />
      <Sheet visible={!!info} title={info ? infos[info].title : ''} onClose={() => setInfo(null)}>{info && <Body small muted>{infos[info].body}</Body>}</Sheet>
      <Sheet visible={del === 1} title="Eliminare tutti i miei dati?" onClose={() => setDel(0)}>
        <Body small muted>Verranno eliminati dal telefono task, note, file, salute, finanze, messaggi, impostazioni e profilo. Prima puoi salvare un backup.</Body>
        <Row style={{ marginTop: 14 }}>
          <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setDel(0)} />
          <Btn danger style={{ flex: 1 }} title="Continua" onPress={() => setDel(2)} />
        </Row>
      </Sheet>
      <Sheet visible={del === 2} title="Ultima conferma" onClose={() => setDel(0)}>
        <Body small muted>Questa azione non si può annullare. L'app tornerà alla schermata iniziale come appena installata.</Body>
        <Row style={{ marginTop: 14 }}>
          <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setDel(0)} />
          <Btn danger style={{ flex: 1 }} title="Elimina tutto" onPress={() => void doDeleteAll()} />
        </Row>
      </Sheet>
      <Sheet visible={!!restore} title={restore?.error ? 'Backup non valido' : restore?.step === 2 ? 'Ultima conferma' : 'Ripristina da backup'} onClose={() => setRestore(null)}>
        {restore?.error && <><Body small muted>{restore.error}</Body><Btn ghost style={{ marginTop: 14 }} title="Chiudi" onPress={() => setRestore(null)} /></>}
        {restore && !restore.error && restore.preview && restore.step === 1 && (
          <>
            <Body small muted>Backup del {restore.preview.createdAt ? new Date(restore.preview.createdAt).toLocaleString('it-IT') : 'data sconosciuta'}{restore.preview.appVersion ? ` (LifePilot ${restore.preview.appVersion})` : ''}. {restore.preview.storeCount} categorie, {restore.preview.sizeKB} KB.</Body>
            <View style={{ marginVertical: 10 }}>
              {Object.entries(restore.preview.items).map(([k, n]) => <Row key={k}><Body small>{STORE_LABELS[k] ?? k}</Body><Body small muted>{n > 0 ? `${n} voci` : 'impostazioni'}</Body></Row>)}
            </View>
            <Body small muted>Ripristinando, i dati attuali di questo telefono verranno sostituiti da quelli del backup.</Body>
            <Row style={{ marginTop: 14 }}>
              <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setRestore(null)} />
              <Btn danger style={{ flex: 1 }} title="Continua" onPress={() => setRestore({ ...restore, step: 2 })} />
            </Row>
          </>
        )}
        {restore && !restore.error && restore.step === 2 && (
          <>
            <Body small muted>Sei sicuro? I dati attuali verranno sovrascritti e non potranno essere recuperati.</Body>
            <Row style={{ marginTop: 14 }}>
              <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setRestore(null)} />
              <Btn danger style={{ flex: 1 }} disabled={busy} title="Sovrascrivi" onPress={() => void doRestore()} />
            </Row>
          </>
        )}
      </Sheet>
      <Sheet visible={errSheet} title="Problemi riscontrati" onClose={() => setErrSheet(false)}>
        {errors.length === 0 ? <Body small muted>Nessun problema registrato.</Body> : (
          <>
            <Body small muted style={{ marginBottom: 8 }}>Ultimi {errors.length} (massimo 50). Restano solo su questo telefono.</Body>
            {errors.map((e) => (
              <View key={e.id} style={{ marginBottom: 10 }}>
                <Body small bold>{new Date(e.at).toLocaleString('it-IT')}{e.screen ? ` · ${e.screen}` : ''}</Body>
                <Body small muted>{e.message}</Body>
              </View>
            ))}
            <Row style={{ marginTop: 6, flexWrap: 'wrap' }}>
              <Btn small ghost title="Copia" onPress={() => { void Clipboard.setStringAsync(formatErrors(errors)); toast('Copiato'); }} />
              <Btn small ghost title="Invia al supporto" onPress={() => void sendErrors()} />
              <Btn small ghost danger title="Cancella" onPress={() => { useErrorLog.getState().clear(); toast('Registro cancellato'); }} />
            </Row>
          </>
        )}
      </Sheet>
    </Page>
  );
}
