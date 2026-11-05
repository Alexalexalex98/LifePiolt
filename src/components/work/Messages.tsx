import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { useMembers } from '@/components/work/Meetings';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { go } from '@/lib/nav';
import { addDays } from '@/lib/workHours';
import { TEMPLATES, autoReply, draftReplies, fillTemplate, mentionIds, priorityOf, summarize, type Priority } from '@/lib/workComms';
import { commsAi, deleteMessage, markSeen, pinMessage, pullAway, pullMessages, sendMessage, setAway, unread, watchMessages } from '@/lib/teamComms';
import { today } from '@/lib/teamWork';
import { useCaps } from '@/lib/teamPeople';
import { chanKey, useComms, type Msg } from '@/store/comms';
import { useLife } from '@/store/life';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';
import { useWorkspace } from '@/store/workspace';

const time = (iso: string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const PRIO: Record<Priority, { l: string; c: string } | null> = { urgent: { l: 'Urgente', c: '#ff5a64' }, todo: { l: 'Da fare', c: '#e0a030' }, info: null, ignore: null };

/** Comunicazione di lavoro: canali del workspace (generale, annunci, uno per progetto), priorità, risposte pronte, modelli, assenza con risposta automatica. */
export function Messages() {
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const pages = useWorkspace((s) => s.pages);
  const [channel, setChannel] = useState('general');
  const msgs = useComms((s) => s.msgs);
  const { me } = useMembers(team?.id ?? '');
  if (!team) return <Card><H>Nessun workspace di lavoro</H><Body small muted style={{ marginTop: 4 }}>Crea un workspace o entra con un codice di invito per parlare con la tua squadra.</Body><Btn style={{ marginTop: 10 }} icon="plus" title="Crea o entra in un workspace" onPress={() => go('teams')} /></Card>;
  const projects = pages.filter((p) => p.teamId === team.id && p.parent === null && p.kind === 'page');
  const chans: { id: string; name: string }[] = [{ id: 'general', name: tl('Generale') }, { id: 'ann', name: tl('Annunci') }, ...projects.map((p) => ({ id: p.id, name: p.title || tl('Progetto') }))];
  void msgs;
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => { useWork.getState().set({ active: x.id }); setChannel('general'); }} />)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {chans.map((c) => { const n = unread(team.id, c.id, me); return <Pill key={c.id} label={n ? `${c.name} (${n})` : c.name} on={channel === c.id} onPress={() => setChannel(c.id)} />; })}
      </ScrollView>
      <WaitingCard team={team.id} />
      <ChannelView key={team.id + channel} team={team.id} channel={channel} admin={team.role !== 'member'} name={chans.find((c) => c.id === channel)?.name ?? ''} />
      <AwayCard team={team.id} />
    </View>
  );
}

/* ---------- un canale ---------- */
export function ChannelView({ team, channel, admin, name }: { team: string; channel: string; admin: boolean; name: string }) {
  const th = useTheme();
  const key = chanKey(team, channel);
  const list = useComms((s) => s.msgs[key]) ?? [];
  const away = useComms((s) => s.away[team]) ?? {};
  const { members, me, nameOf } = useMembers(team);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Msg | null>(null);
  const [tpl, setTpl] = useState(false);
  const [sum, setSum] = useState<string[] | null>(null);
  const [wait, setWait] = useState<Msg | null>(null);
  const [drafts, setDrafts] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pullMessages(team, channel); void pullAway(team); let off: () => void = () => undefined; let dead = false; void watchMessages(team, channel).then((f) => { if (dead) f(); else off = f; }); return () => { dead = true; off(); }; }, [team, channel]);
  useEffect(() => { markSeen(team, channel); }, [list.length, team, channel]);
  const canAnnounce = useCaps(team).caps.has('announce');
  const canWrite = channel !== 'ann' || canAnnounce;
  const people = members.map((m) => ({ id: m.user_id, name: m.name }));
  const t0 = today();
  const absent = Object.entries(away).filter(([, a]) => a.until >= t0);
  const mentioned = mentionIds(text, people);
  const hints = mentioned.map((id) => autoReply(away[id], t0, nameOf(id))).filter(Boolean) as string[];
  const pinned = list.filter((m) => m.pinned);

  function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    void sendMessage(team, channel, text, { replyTo: reply?.id, mentions: mentioned }).then((r) => { setBusy(false); if (r.ok) { setText(''); setReply(null); } else toast(r.message); });
  }
  const bubble = (m: Msg) => {
    const mine = m.author === me; const mentionsMe = !!me && m.mentions.includes(me);
    const pr = mine ? null : PRIO[priorityOf(m.text, { mentionsMe, announcement: channel === 'ann' })];
    const quoted = m.reply_to ? list.find((x) => x.id === m.reply_to) : undefined;
    return (
      <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '92%', backgroundColor: mine ? th.accent + '26' : th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 10, marginBottom: 8 }}>
        <Row gap={8} style={{ justifyContent: 'flex-start' }}>
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }}>{mine ? tl('Tu') : nameOf(m.author)}</Text>
          <Text style={{ color: th.muted, fontSize: 11 }}>{time(m.created_at)}</Text>
          {pr ? <View style={{ backgroundColor: pr.c + '33', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ color: pr.c, fontSize: 11, fontWeight: '800' }}>{tl(pr.l)}</Text></View> : null}
        </Row>
        {quoted ? <Text numberOfLines={2} style={{ color: th.muted, fontSize: 12, marginTop: 4, borderStartWidth: 2, borderStartColor: th.border, paddingStart: 8 }}>{`${nameOf(quoted.author)}: ${quoted.text}`}</Text> : null}
        <Text style={{ color: th.text, fontSize: 15, lineHeight: 21, marginTop: 4 }}>{m.text}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
          <ChipBtn icon="reply" title="Rispondi" onPress={() => setReply(m)} />
          {!mine ? <ChipBtn icon="sparkle" title="Risposte pronte" onPress={() => setDrafts(m)} /> : null}
          {m.text.length > 240 ? <ChipBtn icon="note" title="Riassumi" onPress={() => setSum(summarize([m.text], 3))} /> : null}
          {mine ? <ChipBtn icon="clock" title="Aspetto risposta" onPress={() => setWait(m)} /> : null}
          {admin ? <ChipBtn icon="pin" title={m.pinned ? 'Stacca' : 'Fissa'} onPress={() => { void pinMessage(m, !m.pinned).then((r) => { if (!r.ok) toast(r.message); }); }} /> : null}
          {mine || admin ? <ChipBtn icon="trash" tone="danger" title="Elimina" onPress={() => alertT('Eliminare il messaggio?', m.text.slice(0, 80), [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteMessage(m).then((r) => { if (!r.ok) toast(r.message); }); } }])} /> : null}
        </View>
      </View>
    );
  };

  return (
    <Card>
      <Row><H>{name}</H>{list.length > 3 ? <Btn small ghost icon="note" title="Riassumi" onPress={() => setSum(summarize(list.slice(-20).map((m) => m.text), 4))} /> : null}</Row>
      {absent.length ? absent.map(([id, a]) => <Body key={id} small muted style={{ marginTop: 4 }}>{tl('{0} è assente fino al {1}.', nameOf(id), new Date(a.until + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}</Body>) : null}
      {pinned.length ? <View style={{ marginTop: 8, backgroundColor: th.accent + '1a', borderRadius: 12, padding: 10 }}><Body small bold>{tl('FISSATI').toUpperCase()}</Body>{pinned.map((m) => <Body key={m.id} small style={{ marginTop: 2 }}>{m.text}</Body>)}</View> : null}
      <View style={{ marginTop: 10 }}>
        {list.length === 0 ? <Empty text={channel === 'ann' ? 'Nessun annuncio. Gli annunci li scrivono amministratori e responsabili e li vedono tutti.' : 'Nessun messaggio. Scrivi il primo.'} /> : list.map(bubble)}
      </View>
      {reply ? <Row style={{ marginTop: 4 }}><Text numberOfLines={1} style={{ flex: 1, color: th.muted, fontSize: 12 }}>{tl('Rispondi a {0}: {1}', nameOf(reply.author), reply.text)}</Text><ChipBtn icon="x" title="Annulla" onPress={() => setReply(null)} /></Row> : null}
      {hints.map((h, i) => <Body key={i} small muted style={{ marginTop: 4 }}>{h}</Body>)}
      {canWrite ? (
        <>
          <Input value={text} onChangeText={setText} placeholder={tl('Scrivi un messaggio. Con @ citi una persona.')} maxLines={5} style={{ marginTop: 6 }} />
          <Row><Btn small ghost icon="note" title="Modelli" onPress={() => setTpl(true)} /><Btn small icon="send" disabled={busy || !text.trim()} title="Invia" onPress={send} /></Row>
        </>
      ) : <Body small muted style={{ marginTop: 6 }}>{tl('Gli annunci li scrivono amministratori e responsabili.')}</Body>}

      <Templates open={tpl} onClose={() => setTpl(false)} onPick={(v) => { setText(v); setTpl(false); }} />
      <Summary lines={sum} onClose={() => setSum(null)} raw={list.slice(-20).map((m) => m.text).join('\n')} />
      <Drafts msg={drafts} onClose={() => setDrafts(null)} onPick={(v) => { setText(v); setReply(drafts); setDrafts(null); }} />
      <WaitSheet msg={wait} onClose={() => setWait(null)} who={wait ? nameOf(wait.author) : ''} />
    </Card>
  );
}

function Templates({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (v: string) => void }) {
  const [vars, setVars] = useState<Record<string, string>>({});
  return (
    <Sheet visible={open} title="Modelli di messaggio" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Scrivi nome, data e importo, poi scegli il modello: i campi che lasci vuoti restano tra [parentesi] da completare.</Body>
      <Row><Input flex={1} placeholder="Nome" value={vars.nome ?? ''} onChangeText={(v) => setVars({ ...vars, nome: v })} /><Input flex={1} placeholder="Data" value={vars.data ?? ''} onChangeText={(v) => setVars({ ...vars, data: v })} /></Row>
      <Row><Input flex={1} placeholder="Importo" value={vars.importo ?? ''} onChangeText={(v) => setVars({ ...vars, importo: v })} /><Input flex={1} placeholder="Progetto" value={vars.progetto ?? ''} onChangeText={(v) => setVars({ ...vars, progetto: v })} /></Row>
      {TEMPLATES.map((x) => <Btn key={x.id} ghost style={{ marginTop: 6 }} title={x.name} onPress={() => onPick(fillTemplate(x.text, vars))} />)}
    </Sheet>
  );
}

function Summary({ lines, onClose, raw }: { lines: string[] | null; onClose: () => void; raw: string }) {
  const [ai, setAi] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!lines) setAi(null); }, [lines]);
  return (
    <Sheet visible={!!lines} title="Riassunto" onClose={onClose}>
      {(lines ?? []).length ? (lines ?? []).map((l, i) => <Body key={i} style={{ marginBottom: 6 }}>{`• ${l}`}</Body>) : <Empty text="Niente da riassumere." />}
      {ai ? <Body style={{ marginTop: 6 }}>{ai}</Body> : null}
      <Btn style={{ marginTop: 8 }} ghost icon="sparkle" disabled={busy} title={busy ? 'Theia legge…' : 'Riassunto migliore con Theia'} onPress={() => { setBusy(true); void commsAi('summary', raw).then((r) => { setBusy(false); setAi(r.text); }); }} />
    </Sheet>
  );
}

function Drafts({ msg, onClose, onPick }: { msg: Msg | null; onClose: () => void; onPick: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={!!msg} title="Risposte pronte" onClose={onClose}>
      {msg ? <Body small muted style={{ marginBottom: 8 }} numberOfLines={3}>{msg.text}</Body> : null}
      {msg ? draftReplies(msg.text).map((d) => <Btn key={d} ghost style={{ marginTop: 6 }} title={d} onPress={() => onPick(d)} />) : null}
      <Body small muted style={{ marginTop: 8 }}>{tl('Scegline una: si scrive nel messaggio e la puoi modificare prima di inviare.')}</Body>
      {msg ? <Btn style={{ marginTop: 8 }} icon="sparkle" disabled={busy} title={busy ? 'Theia scrive…' : 'Scrivila con Theia'} onPress={() => { setBusy(true); void commsAi('draft', msg.text).then((r) => { setBusy(false); if (r.ok) onPick(r.text); else toast(r.text); }); }} /> : null}
    </Sheet>
  );
}

/* ---------- aspetto risposta ---------- */
function WaitSheet({ msg, onClose, who }: { msg: Msg | null; onClose: () => void; who: string }) {
  const add = (days: number) => {
    if (!msg) return;
    const due = addDays(today(), days);
    useComms.getState().set({ waiting: [...useComms.getState().waiting, { id: `w${Date.now().toString(36)}`, team: msg.team_id, msg: msg.id, text: msg.text.slice(0, 120), from: who, due }] });
    useLife.getState().addTask({ t: tl('Sollecita la risposta: {0}', msg.text.slice(0, 60)), team: msg.team_id, due });
    toast('Te lo ricordo: è anche nei tuoi task'); onClose();
  };
  return (
    <Sheet visible={!!msg} title="Aspetto una risposta" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Entro quando ti aspetti la risposta? Se non arriva te lo ricordo e lo trovi nei task con l'etichetta Lavoro.</Body>
      <Btn ghost title="Domani" onPress={() => add(1)} /><Btn ghost style={{ marginTop: 6 }} title="Tra 3 giorni" onPress={() => add(3)} /><Btn ghost style={{ marginTop: 6 }} title="Tra una settimana" onPress={() => add(7)} />
    </Sheet>
  );
}
function WaitingCard({ team }: { team: string }) {
  const all = useComms((s) => s.waiting);
  const list = all.filter((w) => w.team === team && !w.done);
  if (!list.length) return null;
  return (
    <Card>
      <H>Aspetto risposta</H>
      {list.map((w) => (
        <Row key={w.id} style={{ marginTop: 6 }}>
          <View style={{ flex: 1 }}><Body small bold numberOfLines={2}>{w.text}</Body><Body small muted>{w.due < today() ? tl('Scaduta: sollecita') : tl('Entro {0}', w.due)}</Body></View>
          <ChipBtn icon="check" title="Risposto" onPress={() => useComms.getState().set({ waiting: all.map((x) => (x.id === w.id ? { ...x, done: true } : x)) })} />
        </Row>
      ))}
    </Card>
  );
}

/* ---------- la mia assenza ---------- */
function AwayCard({ team }: { team: string }) {
  const { me } = useMembers(team);
  const mine = useComms((s) => (me ? s.away[team]?.[me] : undefined));
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(addDays(today(), 7)); const [msg, setMsg] = useState('');
  const on = !!mine && mine.until >= today();
  const save = () => { if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) { toast('Scrivi la data come 2026-12-31'); return; } void setAway(team, { until, message: msg }).then((r) => { toast(r.ok ? 'Assenza impostata: chi ti scrive vede la risposta automatica' : r.message); if (r.ok) setOpen(false); }); };
  return (
    <Card>
      <Row><View style={{ flex: 1 }}><H>La mia assenza</H><Body small muted>{on ? tl('Assente fino al {0}. {1}', mine!.until, mine!.message) : 'Se sei in ferie o fuori, chi ti scrive vede una risposta automatica.'}</Body></View>
        {on ? <Btn small ghost title="Sono tornato" onPress={() => { void setAway(team, null).then((r) => toast(r.ok ? 'Bentornato' : r.message)); }} /> : <Btn small icon="plus" title="Imposta" onPress={() => setOpen(true)} />}</Row>
      <Sheet visible={open} title="Risposta automatica" onClose={() => setOpen(false)}>
        <Input placeholder="Assente fino al (2026-12-31)" value={until} onChangeText={setUntil} />
        <Input placeholder="Messaggio (es. Per urgenze scrivi a Marco)" value={msg} onChangeText={setMsg} maxLines={3} />
        <Btn icon="check" title="Imposta assenza" onPress={save} />
      </Sheet>
    </Card>
  );
}
