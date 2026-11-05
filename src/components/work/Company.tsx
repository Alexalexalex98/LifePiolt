import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { shareFile } from '@/lib/exportFile';
import { AUDIT_KINDS, COUNTRIES, NOTIF_GROUPS, aiMode, auditFilter, auditGroups, exportBundle, normsFor, type Country } from '@/lib/companyWork';
import { lockPage, pullCompany, relockPage, saveSettings, unlockPage, unprotectPage } from '@/lib/teamCompany';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { today } from '@/lib/teamWork';
import { pageText } from '@/lib/workspaceCore';
import { useCompany, notifOf } from '@/store/company';
import { useCrm, crmOf } from '@/store/crm';
import { useDocs } from '@/store/docs';
import { useMeetings } from '@/store/meetings';
import { usePeople } from '@/store/people';
import { useWTasks } from '@/store/tasks';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';
import { useWorkspace } from '@/store/workspace';

const NONE: never[] = [];
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const ACT_COLOR = { creato: '#22c55e', modificato: '#f59e0b', eliminato: '#ef4444', visto: '#8e98a8' } as const;

/** Azienda: paese e norme, piano AI, progetti riservati con password, notifiche, cronologia di ogni modifica, esportazione. */
export function Company() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { role } = useCaps(team?.id);
  const admin = role === 'owner' || role === 'admin';
  useEffect(() => { if (!team) return; void loadPeople(team.id); void pullCompany(team.id); }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace what="imposta paese, piano AI e progetti riservati" />;
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      <Basics team={team.id} admin={admin} />
      <AiPlan team={team.id} admin={admin} />
      <Locked team={team.id} admin={admin} />
      <Notifs team={team.id} />
      <History team={team.id} admin={admin} />
      <Export team={team.id} name={team.name} />
      <Card>
        <H>Senza connessione</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Il Plan, le pagine e le riunioni già scaricati restano sul telefono. Messaggi, soldi, HR, clienti e documenti si ricaricano quando torni online: restano solo in memoria per proteggere i dati.')}</Body>
      </Card>
      <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Chi è amministratore vede tutto e non ha bisogno di password. Ogni permesso lo controlla il server.')}</Text>
    </View>
  );
}

/* ---------- paese e norme ---------- */
function Basics({ team, admin }: { team: string; admin: boolean }) {
  const s = useCompany((x) => x.settings[team]); const ai = useCompany((x) => x.ai[team]);
  const country: Country = s?.country ?? 'IT'; const currency = s?.currency ?? COUNTRIES[country].currency;
  const base = { country, currency, ai_plan: !!s?.ai_plan, ai_all: s?.ai_all ?? true, ai_members: s?.ai_members ?? [] };
  const save = (p: Partial<typeof base>) => { void saveSettings(team, { ...base, ...p }).then((r) => toast(r.ok ? 'Salvato' : r.message)); };
  void ai;
  return (
    <Card>
      <H>L'azienda</H>
      <Body small bold muted style={{ marginTop: 8, marginBottom: 6 }}>{tl('PAESE').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['IT', 'CH'] as const).map((c) => <Pill key={c} label={tl(COUNTRIES[c].label)} on={country === c} onPress={admin ? () => save({ country: c, currency: COUNTRIES[c].currency }) : undefined} />)}</View>
      <Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('VALUTA').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['EUR', 'CHF'] as const).map((c) => <Pill key={c} label={c} on={currency === c} onPress={admin ? () => save({ currency: c }) : undefined} />)}</View>
      {!admin ? <Body small muted style={{ marginTop: 8 }}>{tl('Le impostazioni dell\'azienda le cambia un amministratore.')}</Body> : null}
      <Body small bold muted style={{ marginTop: 12, marginBottom: 4 }}>{tl('NORME (INDICATIVE)').toUpperCase()}</Body>
      {normsFor(country).map((l) => <Body key={l} small>{`• ${l}`}</Body>)}
    </Card>
  );
}

/* ---------- piano AI ---------- */
function AiPlan({ team, admin }: { team: string; admin: boolean }) {
  const s = useCompany((x) => x.settings[team]); const ai = useCompany((x) => x.ai[team]); const personal = useCompany((x) => x.personalAi);
  const people = usePeople((x) => x.people[team]) ?? NONE; const me = usePeople((x) => x.me);
  const country: Country = s?.country ?? 'IT'; const currency = s?.currency ?? 'EUR';
  const cur = { country, currency, ai_plan: !!s?.ai_plan, ai_all: s?.ai_all ?? true, ai_members: s?.ai_members ?? [] };
  const save = (p: Partial<typeof cur>) => { void saveSettings(team, { ...cur, ...p }).then((r) => toast(r.ok ? 'Salvato' : r.message)); };
  const mode = aiMode({ plan: !!ai?.plan, covered: !!ai?.covered, personal });
  return (
    <Card>
      <H>Theia e il piano AI</H>
      <Row style={{ marginTop: 6 }}><View style={{ flex: 1 }}><Body>{tl(mode.text)}</Body></View><Pill label={mode.on ? tl('Attiva') : tl('Spenta')} color={mode.on ? '#22c55e' : '#8e98a8'} /></Row>
      <Toggle label={tl('Uso il mio account personale per Theia nel lavoro')} value={personal} onChange={(v) => useCompany.getState().set({ personalAi: v })} hint={tl('Se lo spegni, Theia con l\'AI funziona nel lavoro solo se l\'azienda ti include nel suo piano.')} />
      {admin ? (
        <>
          <Body small bold muted style={{ marginTop: 12, marginBottom: 4 }}>{tl('PIANO AI A CARICO DELL\'AZIENDA').toUpperCase()}</Body>
          <Toggle label={tl('L\'azienda offre Theia alle persone')} value={cur.ai_plan} onChange={(v) => save({ ai_plan: v })} hint={tl('Qui scegli chi è incluso. Io non compro e non addebito niente: il pagamento del piano lo gestisci tu fuori dall\'app.')} />
          {cur.ai_plan ? (
            <>
              <Toggle label={tl('Incluse tutte le persone')} value={cur.ai_all} onChange={(v) => save({ ai_all: v })} />
              {!cur.ai_all ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>{people.map((p) => { const on = cur.ai_members.includes(p.user_id); return <Pill key={p.user_id} label={p.user_id === me ? tl('Tu') : p.name || tl('Collega')} on={on} onPress={() => save({ ai_members: on ? cur.ai_members.filter((x) => x !== p.user_id) : [...cur.ai_members, p.user_id] })} />; })}</View> : null}
            </>
          ) : null}
        </>
      ) : null}
      <Body small muted style={{ marginTop: 8 }}>{tl('Senza AI tutto il resto del workspace funziona: Theia capisce solo i comandi semplici.')}</Body>
    </Card>
  );
}

/* ---------- progetti riservati ---------- */
function Locked({ team, admin }: { team: string; admin: boolean }) {
  const locked = useCompany((x) => x.locked[team]) ?? NONE;
  const pages = useWorkspace((x) => x.pages);
  const { caps } = useCaps(team);
  const roots = useMemo(() => pages.filter((p) => p.teamId === team && p.parent === null && p.kind === 'page' && !locked.some((l) => l.id === p.id)), [pages, team, locked]);
  const [ask, setAsk] = useState<{ id: string; title: string; mode: 'unlock' | 'lock' } | null>(null); const [pick, setPick] = useState(false);
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false);
  const canLock = admin || caps.has('projects.create');
  const go = () => {
    if (!ask) return; setBusy(true);
    if (ask.mode === 'lock') void lockPage(team, ask.id, pw).then((r) => { setBusy(false); if (r.ok) { toast('Progetto riservato: serve la password'); setAsk(null); setPw(''); } else toast(r.message); });
    else void unlockPage(team, ask.id, pw).then((r) => { setBusy(false); if (!r.ok) { toast(r.message); return; } if (r.data) { toast('Sbloccato per 8 ore'); setAsk(null); setPw(''); } else toast('Password sbagliata'); });
  };
  return (
    <Card>
      <Row><H>Progetti riservati</H>{canLock ? <Btn small icon="plus" title="Proteggi" onPress={() => setPick(true)} /> : null}</Row>
      <Body small muted style={{ marginTop: 4 }}>{tl('Chi non ha la password non vede il contenuto, nemmeno delle sottopagine. L\'amministratore entra senza.')}</Body>
      {locked.length === 0 ? <Empty text="Nessun progetto riservato." /> : locked.map((l) => (
        <View key={l.id} style={{ marginTop: 10 }}>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{l.title || tl('Senza titolo')}</Body><Body small muted>{admin ? tl('Sempre aperto per te (amministratore)') : l.unlocked ? tl('Sbloccato') : tl('Serve la password')}</Body></View>
            {!admin && !l.unlocked ? <Btn small title="Sblocca" onPress={() => setAsk({ id: l.id, title: l.title, mode: 'unlock' })} /> : null}
            {!admin && l.unlocked ? <Btn small ghost title="Richiudi" onPress={() => { void relockPage(team, l.id).then((r) => toast(r.ok ? 'Richiuso' : r.message)); }} /> : null}
          </Row>
          {admin || l.mine ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}><Btn small ghost title="Cambia password" onPress={() => setAsk({ id: l.id, title: l.title, mode: 'lock' })} /><Btn small ghost danger title="Togli la password" onPress={() => { void unprotectPage(team, l.id).then((r) => toast(r.ok ? 'Password tolta' : r.message)); }} /></View> : null}
        </View>
      ))}
      <Sheet visible={pick} title="Quale progetto proteggi?" onClose={() => setPick(false)}>
        {roots.length === 0 ? <Empty text="Non ci sono progetti condivisi da proteggere. Creane uno nella scheda Pagine." /> : roots.map((p) => <Row key={p.id} style={{ marginBottom: 8 }}><Body style={{ flex: 1 }}>{p.title || tl('Senza titolo')}</Body><Btn small title="Scegli" onPress={() => { setPick(false); setAsk({ id: p.id, title: p.title, mode: 'lock' }); }} /></Row>)}
      </Sheet>
      <Sheet visible={!!ask} title={ask?.mode === 'lock' ? tl('Imposta la password') : tl('Password del progetto')} onClose={() => { setAsk(null); setPw(''); }}>
        <Body style={{ marginBottom: 8 }}>{ask?.title}</Body>
        <Input placeholder={ask?.mode === 'lock' ? 'Nuova password (almeno 6 caratteri)' : 'Password'} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
        {ask?.mode === 'lock' ? <Body small muted style={{ marginBottom: 8 }}>{tl('Dalla a chi deve entrare: io non posso rimandartela. Chi la sbaglia 5 volte aspetta 15 minuti.')}</Body> : null}
        <Btn icon="check" disabled={busy || pw.length < (ask?.mode === 'lock' ? 6 : 1)} title={ask?.mode === 'lock' ? 'Proteggi' : 'Sblocca'} onPress={go} />
      </Sheet>
    </Card>
  );
}

/* ---------- notifiche per persona ---------- */
function Notifs({ team }: { team: string }) {
  const p = useCompany((x) => notifOf(team, x.notif));
  const set = (n: typeof p) => useCompany.getState().set({ notif: { ...useCompany.getState().notif, [team]: n } });
  return (
    <Card>
      <H>Le tue notifiche di questo workspace</H>
      <Toggle label={tl('Silenzia questo workspace')} value={p.muted} onChange={(v) => set({ ...p, muted: v })} hint={tl('Le richieste che aspettano una tua risposta le vedi sempre.')} />
      {NOTIF_GROUPS.map((g) => <Toggle key={g.id} label={tl(g.label)} value={!p.off.includes(g.id)} onChange={(v) => set({ ...p, off: v ? p.off.filter((x) => x !== g.id) : [...p.off, g.id] })} />)}
      <Body small muted style={{ marginTop: 6 }}>{tl('Vale solo per te, su questo telefono.')}</Body>
    </Card>
  );
}

/* ---------- cronologia ---------- */
function History({ team, admin }: { team: string; admin: boolean }) {
  const rows = useCompany((x) => x.audit[team]) ?? NONE;
  const people = usePeople((x) => x.people[team]) ?? NONE; const me = usePeople((x) => x.me);
  const [kind, setKind] = useState<string | undefined>(); const [open, setOpen] = useState(false);
  const who = (id: string) => (id === me ? tl('Tu') : people.find((p) => p.user_id === id)?.name || tl('Collega'));
  if (!admin && rows.length === 0) return null;
  const shown = auditGroups(auditFilter(rows, { kind })).slice(0, 6);
  return (
    <Card>
      <Row><H>Cronologia delle modifiche</H><Btn small ghost title={open ? 'Chiudi' : 'Apri'} onPress={() => setOpen(!open)} /></Row>
      <Body small muted style={{ marginTop: 4 }}>{tl('Chi ha creato, cambiato, eliminato o aperto cosa. Non si può modificare.')}</Body>
      {open ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginVertical: 8 }}><Pill label={tl('Tutto')} on={!kind} onPress={() => setKind(undefined)} />{AUDIT_KINDS.map((k) => <Pill key={k} label={tl(k)} on={kind === k} onPress={() => setKind(kind === k ? undefined : k)} />)}</ScrollView>
          {shown.length === 0 ? <Empty text="Ancora niente." /> : shown.map((g) => (
            <View key={g.day} style={{ marginTop: 8 }}>
              <Body small bold muted style={{ textTransform: 'capitalize' }}>{dayLabel(g.day)}</Body>
              {g.rows.slice(0, 25).map((r) => <Row key={r.id} style={{ marginTop: 4 }}><Pill label={tl(r.action)} color={ACT_COLOR[r.action]} /><View style={{ flex: 1 }}><Body small>{r.label}</Body><Body small muted>{`${who(r.user_id)} · ${new Date(r.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}</Body></View></Row>)}
            </View>
          ))}
        </>
      ) : null}
    </Card>
  );
}

/* ---------- esportazione ---------- */
function Export({ team, name }: { team: string; name: string }) {
  const pages = useWorkspace((x) => x.pages); const tasks = useWTasks((x) => x.tasks[team]) ?? NONE; const meetings = useMeetings((x) => x.items);
  const crm = useCrm((x) => crmOf(team, x.data)); const docs = useDocs((x) => x.docs[team]) ?? NONE;
  const bundle = () => exportBundle({
    team: name, at: today(),
    pages: pages.filter((p) => p.teamId === team).map((p) => ({ title: p.title, text: pageText(p) })),
    tasks: tasks.filter((x) => !x.deleted) as unknown as Record<string, unknown>[],
    meetings: meetings.filter((m) => m.team_id === team && !m.deleted).map((m) => ({ title: m.title, day: m.day, time: m.time, minutes: m.minutes })),
    clients: crm.contacts as unknown as Record<string, unknown>[], docs: docs as unknown as Record<string, unknown>[],
  });
  const send = (i: number) => { const f = bundle().files[i]!; void shareFile(f.name, f.content, f.mime); };
  return (
    <Card>
      <H>Esporta il workspace</H>
      <Body small muted style={{ marginTop: 4 }}>{tl('Un tuo backup: solo quello che puoi vedere tu. Pagine e riunioni in un testo, il resto in file per Excel.')}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Btn small icon="file" title="Pagine e riunioni" onPress={() => send(0)} /><Btn small ghost title="Task (Excel)" onPress={() => send(1)} /><Btn small ghost title="Clienti (Excel)" onPress={() => send(2)} /><Btn small ghost title="Documenti (Excel)" onPress={() => send(3)} />
      </View>
    </Card>
  );
}
