import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { UserAvatar } from '@/components/network';

import { Body, Btn, Card, Chev, Empty, H, Input, Item, Metric, Page, Pill, Row, Sheet, Tag, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { computeScores } from '@/lib/scores';
import { useApp } from '@/store/app';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { answerStyles, DEFAULT_STYLE, styleLabel, usePrefs } from '@/store/prefs';
import { showUndoToast, toast } from '@/store/toast';

const Sec = ({ children }: { children: string }) => <View style={{ marginTop: 16 }}><Tag>{children}</Tag></View>;

type SheetKey = null | 'goals' | 'autos' | 'pref' | 'memory' | 'module';

/** Moduli futuri: cosa sono, a che punto sono e (se esiste già qualcosa) dove aprirli. */
const modules: { name: string; icon: string; what: string; state: string; page?: string; pageLabel?: string }[] = [
  { name: 'Social', icon: 'users', what: 'Feed, post e interazioni tra persone, per condividere avanzamenti e idee.', state: 'Una prima versione è già in LifeNetwork.', page: 'lifenetwork', pageLabel: 'Apri LifeNetwork' },
  { name: 'Community', icon: 'users', what: 'Gruppi e community tematiche con chat e eventi.', state: 'Gruppi e chat sono già disponibili in LifeNetwork.', page: 'lifenetwork', pageLabel: 'Apri LifeNetwork' },
  { name: 'Marketplace', icon: 'briefcase', what: 'Servizi, seminari e offerte di lavoro tra utenti.', state: 'Una versione dimostrativa è in LifeNetwork.', page: 'lifenetwork', pageLabel: 'Apri LifeNetwork' },
  { name: 'Wallet', icon: 'euro', what: 'Portafoglio per pagamenti e punti, collegato alle tue finanze.', state: 'Oggi esistono solo i LifePoints; i pagamenti reali richiedono un provider e la conformità normativa.', page: 'lifepointsPage', pageLabel: 'Apri i LifePoints' },
  { name: 'Investments', icon: 'chart', what: 'Portafoglio titoli, ordini e watchlist.', state: 'Disponibile in modalità simulata, senza denaro reale.', page: 'portfolio', pageLabel: 'Apri il portafoglio' },
  { name: 'Travel', icon: 'lifetravel', what: 'Pianificazione viaggi, voli e hotel.', state: 'Disponibile con dati d\'esempio.', page: 'lifetravel', pageLabel: 'Apri LifeTravel' },
  { name: 'Translate', icon: 'repeat', what: 'Traduzione di testi e conversazioni dentro l\'app.', state: 'Non ancora disponibile: serve un servizio di traduzione esterno.' },
  { name: 'Voice Calls', icon: 'mic', what: 'Chiamate vocali tra utenti.', state: 'Non ancora disponibile: servono un backend e un provider di chiamate.' },
  { name: 'Hardware', icon: 'gear', what: 'Dispositivi collegati (sensori e accessori LifePilot).', state: 'Non ancora disponibile: dipende dal prodotto fisico in sviluppo.' },
];

export default function Profile() {
  const t = useTheme();
  const { account, privacy, set } = useApp();
  const life = useLife();
  const { goals, automations, tasks, notes } = life;
  const answerStyle = usePrefs((s) => s.answerStyle);
  const setStyle = usePrefs((s) => s.setAnswerStyle);
  const resetPrefs = usePrefs((s) => s.reset);
  useHealth((s) => s.series); useFin((s) => s.months);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [mod, setMod] = useState<(typeof modules)[number] | null>(null);
  const [newAuto, setNewAuto] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [edit, setEdit] = useState<{ kind: 'auto' | 'goal'; id: string; t: string; p: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const sc = computeScores();
  const main = goals.slice().sort((a, b) => b.p - a.p)[0];
  const openTasks = tasks.filter((x) => !x.done);
  const activePriv = Object.keys(privacy).filter((k) => privacy[k]);
  const close = () => { setSheet(null); setEdit(null); setConfirmAll(false); };
  const open = (k: SheetKey) => { setEdit(null); setConfirmAll(false); setSheet(k); };

  const addAuto = () => { const v = newAuto.trim(); if (!v) { toast('Scrivi il nome dell\'automazione'); return; } life.addAuto(v); setNewAuto(''); toast('Automazione aggiunta'); };
  const addGoal = () => { const v = newGoal.trim(); if (!v) { toast('Scrivi il titolo dell\'obiettivo'); return; } life.addGoal(v); setNewGoal(''); toast('Obiettivo aggiunto'); };
  const delAuto = (id: string) => { const r = life.delAuto(id); if (r) showUndoToast('Automazione eliminata', () => life.restoreAuto(r.auto, r.idx)); };
  const delGoal = (id: string) => {
    const idx = life.goals.findIndex((g) => g.id === id); const g = life.goals[idx];
    if (!g) return; life.delGoal(id); showUndoToast('Obiettivo eliminato', () => life.restoreGoal(g, idx));
  };
  const delTask = (id: string) => {
    const idx = life.tasks.findIndex((x) => x.id === id); const tk = life.delTask(id);
    if (tk) showUndoToast('Task eliminato', () => life.restoreTask(tk, idx));
  };
  const delNote = (id: string) => { const r = life.delNote(id); if (r) showUndoToast('Nota eliminata', () => life.restoreNote(r.note, r.idx)); };
  const saveEdit = () => {
    if (!edit) return;
    const title = edit.t.trim();
    if (!title) { toast('Il nome non può essere vuoto'); return; }
    if (edit.kind === 'auto') life.renameAuto(edit.id, title);
    else {
      const p = parseInt(edit.p, 10);
      life.patchGoal(edit.id, { t: title, ...(Number.isFinite(p) ? { p } : {}) });
    }
    setEdit(null); toast('Salvato');
  };
  const wipeAll = () => {
    openTasks.forEach((x) => life.delTask(x.id));
    life.notes.forEach((n) => life.delNote(n.id));
    life.goals.forEach((g) => life.delGoal(g.id));
    life.automations.forEach((a) => life.delAuto(a.id));
    resetPrefs();
    set({ privacy: Object.fromEntries(Object.keys(privacy).map((k) => [k, false])) });
    setConfirmAll(false); toast('Memoria cancellata');
  };

  const editor = (
    <View style={{ marginTop: 8 }}>
      <Input value={edit?.t ?? ''} onChangeText={(v) => setEdit((e) => (e ? { ...e, t: v } : e))} placeholder="Nome" autoFocus />
      {edit?.kind === 'goal' && <Input value={edit.p} onChangeText={(v) => setEdit((e) => (e ? { ...e, p: v.replace(/[^0-9]/g, '').slice(0, 3) } : e))} keyboardType="number-pad" placeholder="Percentuale (0-100)" />}
      <Row gap={8}><Btn small style={{ flex: 1 }} title="Salva" onPress={saveEdit} /><Btn small ghost style={{ flex: 1 }} title="Annulla" onPress={() => setEdit(null)} /></Row>
    </View>
  );

  const IconBtn = ({ name, label, onPress }: { name: string; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={{ padding: 4 }}><Icon name={name} size={17} color={t.muted} stroke={2} /></Pressable>
  );

  return (
    <Page id="profile" title="Profilo & Memory">
      <Card onPress={() => go('userProfile', { name: account.name })}>
        <Row style={{ justifyContent: 'flex-start' }}>
          <UserAvatar name={account.name} size={46} />
          <View style={{ flex: 1 }}>
            <H>{account.name}</H>
            <Body small muted>Il tuo profilo LifeNetwork · post, follower, voti, biglietto da visita</Body>
          </View>
          <Chev />
        </Row>
      </Card>
      <Card onPress={() => go('life')}>
        <Row>
          <View style={{ flex: 1 }}><H>La tua vita</H><Body small muted>Life Score, Health, Mind, Finance, Growth e altro</Body></View>
          <Metric>{sc.total ?? '—'}</Metric>
        </Row>
      </Card>
      <Card>
        <H>Cosa LifePilot sa di te</H>
        <Item onPress={() => open('goals')}><Row><Body style={{ flex: 1 }}>Obiettivo principale · {main ? main.t : 'non ancora impostato'}</Body><Chev /></Row></Item>
        <Item onPress={() => open('autos')}><Row><Body style={{ flex: 1 }}>Automazioni attive · {automations.filter((a) => a.on).length}</Body><Chev /></Row></Item>
        <Item last onPress={() => open('pref')}><Row><Body style={{ flex: 1 }}>Preferenza · {styleLabel(answerStyle)}</Body><Chev /></Row></Item>
        <Btn small ghost style={{ marginTop: 10 }} title="Gestisci memoria" onPress={() => open('memory')} />
      </Card>
      <Card onPress={() => go('settings')}>
        <H>Settings</H>
        <Body small muted>Integrazioni, privacy, notifiche, aspetto · tocca per aprire</Body>
      </Card>
      <Card>
        <H>Moduli futuri</H>
        <Body small muted style={{ marginBottom: 8 }}>Tocca un modulo per vedere a che punto è.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{modules.map((x) => <Pill key={x.name} label={x.name} icon={x.icon} onPress={() => { setMod(x); setSheet('module'); }} />)}</View>
        <Body small muted>Presenti nella mappa prodotto; richiedono backend, provider esterni e, per finanza/pagamenti, compliance dedicata.</Body>
      </Card>

      {/* obiettivi */}
      <Sheet visible={sheet === 'goals'} title="I tuoi obiettivi" onClose={close}>
        <Body small muted style={{ marginBottom: 6 }}>L'obiettivo principale è quello con il progresso più alto. Puoi cambiare titolo e percentuale o eliminarlo.</Body>
        {goals.length === 0 ? <Empty text="Nessun obiettivo: aggiungine uno qui sotto." /> : goals.map((g, i) => (
          <Item key={g.id} last={i === goals.length - 1}>
            {edit?.kind === 'goal' && edit.id === g.id ? editor : (
              <Row>
                <View style={{ flex: 1 }}><Body bold>{g.t}</Body><Body small muted>Progresso {g.p}%</Body></View>
                <IconBtn name="edit" label={`Modifica ${g.t}`} onPress={() => setEdit({ kind: 'goal', id: g.id, t: g.t, p: String(g.p) })} />
                <XBtn label={`Elimina ${g.t}`} onPress={() => delGoal(g.id)} />
              </Row>
            )}
          </Item>
        ))}
        <Sec>Nuovo obiettivo</Sec>
        <Input value={newGoal} onChangeText={setNewGoal} placeholder="Es. Correre 10 km" onSubmitEditing={addGoal} />
        <Btn title="Aggiungi obiettivo" icon="plus" onPress={addGoal} />
      </Sheet>

      {/* automazioni */}
      <Sheet visible={sheet === 'autos'} title="Le tue automazioni" onClose={close}>
        <Body small muted style={{ marginBottom: 6 }}>Attiva o disattiva ogni automazione, rinominala o eliminala.</Body>
        {automations.length === 0 ? <Empty text="Nessuna automazione: aggiungine una qui sotto." /> : automations.map((a, i) => (
          <Item key={a.id} last={i === automations.length - 1}>
            {edit?.kind === 'auto' && edit.id === a.id ? editor : (
              <Row>
                <View style={{ flex: 1 }}><Body bold={a.on} muted={!a.on}>{a.t}</Body><Body small muted>{a.on ? 'Attiva' : 'Disattivata'}</Body></View>
                <IconBtn name="edit" label={`Rinomina ${a.t}`} onPress={() => setEdit({ kind: 'auto', id: a.id, t: a.t, p: '' })} />
                <XBtn label={`Elimina ${a.t}`} onPress={() => delAuto(a.id)} />
                <Switch accessibilityLabel={`Interruttore ${a.t}`} value={a.on} onValueChange={(v) => { life.toggleAuto(a.id, v); toast(`${a.t}: ${v ? 'attiva' : 'disattivata'}`); }} trackColor={{ true: '#4f7cff', false: t.inputBorder }} thumbColor="#fff" />
              </Row>
            )}
          </Item>
        ))}
        <Sec>Nuova automazione</Sec>
        <Input value={newAuto} onChangeText={setNewAuto} placeholder="Es. Riepilogo spese ogni domenica" onSubmitEditing={addAuto} />
        <Btn title="Aggiungi automazione" icon="plus" onPress={addAuto} />
      </Sheet>

      {/* preferenze */}
      <Sheet visible={sheet === 'pref'} title="Come vuoi le risposte" onClose={close}>
        <Body small muted style={{ marginBottom: 6 }}>La scelta viene salvata e usata per adattare lo stile delle risposte.</Body>
        {answerStyles.map((o, i) => (
          <Item key={o.id} last={i === answerStyles.length - 1} onPress={() => { setStyle(o.id); toast(`Preferenza salvata: ${o.label}`); }}>
            <Row>
              <View style={{ flex: 1 }}><Body bold>{o.label}</Body><Body small muted>{o.hint}</Body></View>
              {answerStyle === o.id ? <Icon name="check" size={18} color={t.positive} stroke={2.4} /> : null}
            </Row>
          </Item>
        ))}
      </Sheet>

      {/* memoria */}
      <Sheet visible={sheet === 'memory'} title="Memoria di LifePilot" onClose={close}>
        <Body small muted>Qui vedi tutto ciò che l'app ricorda di te. Puoi cancellare le singole voci (con annulla) o tutto insieme.</Body>

        <Sec>{`Task aperti · ${openTasks.length}`}</Sec>
        {openTasks.length === 0 ? <Body small muted>Nessun task aperto.</Body> : openTasks.map((x) => <Row key={x.id} style={{ paddingVertical: 6 }}><Body small style={{ flex: 1 }} numberOfLines={2}>{x.t}</Body><XBtn label={`Elimina ${x.t}`} onPress={() => delTask(x.id)} /></Row>)}

        <Sec>{`Note · ${notes.length}`}</Sec>
        {notes.length === 0 ? <Body small muted>Nessuna nota.</Body> : notes.map((n) => <Row key={n.id} style={{ paddingVertical: 6 }}><Body small style={{ flex: 1 }} numberOfLines={2}>{n.text}</Body><XBtn label="Elimina nota" onPress={() => delNote(n.id)} /></Row>)}

        <Sec>{`Obiettivi · ${goals.length}`}</Sec>
        {goals.length === 0 ? <Body small muted>Nessun obiettivo.</Body> : goals.map((g) => <Row key={g.id} style={{ paddingVertical: 6 }}><Body small style={{ flex: 1 }}>{g.t} · {g.p}%</Body><XBtn label={`Elimina ${g.t}`} onPress={() => delGoal(g.id)} /></Row>)}

        <Sec>{`Automazioni · ${automations.length}`}</Sec>
        {automations.length === 0 ? <Body small muted>Nessuna automazione.</Body> : automations.map((a) => <Row key={a.id} style={{ paddingVertical: 6 }}><Body small style={{ flex: 1 }}>{a.t} · {a.on ? 'attiva' : 'disattivata'}</Body><XBtn label={`Elimina ${a.t}`} onPress={() => delAuto(a.id)} /></Row>)}

        <Sec>Preferenze</Sec>
        <Row style={{ paddingVertical: 6 }}>
          <Body small style={{ flex: 1 }}>Stile risposte · {styleLabel(answerStyle)}</Body>
          {answerStyle !== DEFAULT_STYLE ? <XBtn label="Ripristina la preferenza" onPress={() => { resetPrefs(); toast('Preferenza ripristinata'); }} color={t.muted} /> : null}
        </Row>

        <Sec>{`Privacy attive · ${activePriv.length}`}</Sec>
        {activePriv.length === 0 ? <Body small muted>Nessun consenso attivo.</Body> : activePriv.map((k) => (
          <Row key={k} style={{ paddingVertical: 6 }}><Body small style={{ flex: 1 }}>{k}</Body><Btn small ghost title="Disattiva" onPress={() => { set({ privacy: { ...privacy, [k]: false } }); toast(`${k} disattivato`); }} /></Row>
        ))}

        {confirmAll ? (
          <View style={{ marginTop: 18 }}>
            <Body small color={t.danger} style={{ marginBottom: 8 }}>Verranno cancellati task aperti, note, obiettivi, automazioni e preferenze, e disattivati i consensi privacy. Non si può annullare.</Body>
            <Row gap={8}><Btn danger style={{ flex: 1 }} title="Sì, cancella tutto" onPress={wipeAll} /><Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setConfirmAll(false)} /></Row>
          </View>
        ) : <Btn danger style={{ marginTop: 18 }} icon="trash" title="Cancella tutta la memoria" onPress={() => setConfirmAll(true)} />}
      </Sheet>

      {/* moduli futuri */}
      <Sheet visible={sheet === 'module'} title={mod?.name ?? ''} onClose={close}>
        {mod && (
          <>
            <Body>{mod.what}</Body>
            <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 10, marginVertical: 12 }}><Body small>Stato: {mod.state}</Body></View>
            {mod.page ? <Btn title={mod.pageLabel ?? 'Apri'} onPress={() => { close(); go(mod.page!); }} /> : <Body small muted>Lo aggiungeremo quando i requisiti tecnici saranno pronti.</Body>}
          </>
        )}
      </Sheet>
      <View style={{ height: 1, backgroundColor: t.bg }} />
    </Page>
  );
}
