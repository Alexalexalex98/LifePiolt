import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { addToPlanWithCheck, findConflicts, removeFromPlan } from '@/lib/planBooking';
import { dayLabelOf, importAgenda, importTasks, myConflicts } from '@/lib/chatShare';
import { rsvpSummary } from '@/lib/chatList';
import { findPlanned, respondToEvent } from '@/lib/chatEvent';
import { Icon } from '@/lib/icons';
import { fmtDay, tsOf } from '@/lib/when';
import { useChat, type ChatMessage } from '@/store/chat';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { useChatColors } from './parts';

function Head({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  const c = useChatColors();
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.accent + '2a', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={t.accent} stroke={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.theirsText, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={{ color: c.meta, fontSize: 11 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Action({ icon, label, onPress, done }: { icon: string; label: string; onPress: () => void; done?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={done ? undefined : onPress} onStartShouldSetResponder={() => true} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 8, borderRadius: 12, backgroundColor: done ? t.positive + '22' : t.accent, opacity: done ? 0.9 : 1 }}>
      <Icon name={done ? 'check' : icon} size={15} color={done ? t.positive : t.onText} stroke={2.3} />
      <Text style={{ color: done ? t.positive : t.onText, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** C'è già nel mio piano un impegno creato da questa scheda? */
const inPlan = (ref: string) => Object.values(useLife.getState().events).some((l) => l.some((e) => e.ref === ref));

function AvailabilityCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const t = useTheme();
  useLife((s) => s.events);
  const a = m.agenda!;
  const mine = m.from === me;
  const days = [...new Set([...(a.free ?? []).map((f) => f.day), ...(a.busy ?? []).map((b) => b.day)])].sort();
  const propose = (day: string, from: string) => {
    const dur = a.hours?.minSlot ?? 30;
    const tmp = `tmp:${m.id}:${day}${from}`;
    // scegliere uno slot lo mette subito nel mio calendario (con avviso se si sovrappone a qualcosa)
    addToPlanWithCheck({ day, time: from, durationMin: dur, title: 'Incontro (proposto)', ref: tmp, verb: 'Proponi' }, () => {
      const id = useChat.getState().send(chatId, me, { kind: 'slots', slots: { title: 'Incontro', durationMin: dur, options: [{ id: `p${day}${from}`, day, time: from, votes: [me] }] }, replyTo: m.id });
      const st = useLife.getState();
      const idx = (st.events[day] ?? []).findIndex((e) => e.ref === tmp);
      if (idx >= 0) st.patchEvent(day, idx, { ref: `slot:${id}:p${day}${from}` });
      toast(`Proposto ${dayLabelOf(day)} alle ${from} e aggiunto al tuo piano`);
    });
  };
  return (
    <View style={{ minWidth: 250 }}>
      <Head icon={a.mode === 'liberi' ? 'clock' : 'eye'} title={a.title} sub={a.mode === 'liberi' ? 'Solo slot liberi: gli impegni sono nascosti' : 'Impegni nascosti: vedi solo occupato e libero'} />
      {days.length === 0 && <Text style={{ color: c.meta, fontSize: 13 }}>Nessuno slot libero in questo periodo.</Text>}
      {days.map((d) => {
        const free = (a.free ?? []).filter((f) => f.day === d);
        const busy = (a.busy ?? []).filter((b) => b.day === d);
        return (
          <View key={d} style={{ marginTop: 6 }}>
            <Text style={{ color: c.meta, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 }}>{dayLabelOf(d)}</Text>
            {busy.map((b, i) => (
              <View key={'b' + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, opacity: 0.8 }}>
                <Icon name="minus" size={13} color={c.meta} />
                <Text style={{ color: c.meta, fontSize: 13 }}>Occupato {b.from}–{b.to}</Text>
              </View>
            ))}
            {free.map((f, i) => {
              const both = !mine && myConflicts(d, f.from, a.hours?.minSlot ?? 30).length === 0;
              return (
                <Pressable key={'f' + i} onPress={() => !mine && propose(d, f.from)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 8, marginVertical: 2, borderRadius: 10, backgroundColor: t.positive + '1f' }}>
                  <Icon name="check" size={14} color={t.positive} stroke={2.4} />
                  <Text style={{ color: c.theirsText, fontSize: 14, fontWeight: '700', flex: 1 }}>Libero {f.from}–{f.to}</Text>
                  {!mine && both && <Text style={{ color: t.positive, fontSize: 11, fontWeight: '700' }}>anche tu</Text>}
                  {!mine && <Text style={{ color: t.accent, fontSize: 11, fontWeight: '800' }}>Proponi</Text>}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      {a.hours && <Text style={{ color: c.meta, fontSize: 11, marginTop: 8 }}>Orario di lavoro {a.hours.from}–{a.hours.to} · slot da almeno {a.hours.minSlot} min</Text>}
      {mine && <Text style={{ color: c.meta, fontSize: 11, marginTop: 4 }}>I titoli dei tuoi impegni non sono stati inviati.</Text>}
    </View>
  );
}

function DetailCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const t = useTheme();
  useLife((s) => s.events);
  const a = m.agenda!;
  const mine = m.from === me;
  const imported = !!m.importedBy?.includes(me);
  let lastDay = '';
  return (
    <View style={{ minWidth: 240 }}>
      <Head icon="calendar" title={a.title} sub={`${a.items.length} ${a.items.length === 1 ? 'impegno' : 'impegni'}`} />
      {a.items.map((it, i) => {
        const head = it.day !== lastDay; lastDay = it.day;
        const ref = `ag:${m.id}:${i}`;
        const added = inPlan(ref);
        const conf = !mine && !imported && !added ? myConflicts(it.day, it.time, 30) : [];
        const pick = () => {
          if (mine) return;
          if (added) { removeFromPlan(ref); toast('Tolto dal tuo piano'); return; }
          addToPlanWithCheck({ day: it.day, time: it.time, durationMin: 60, title: it.title, ref, verb: 'Aggiungi' }, () => toast('Aggiunto al tuo piano'));
        };
        return (
          <View key={i}>
            {head && <Text style={{ color: c.meta, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: i ? 6 : 0 }}>{dayLabelOf(it.day)}</Text>}
            <Pressable onPress={pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }} accessibilityLabel={`${it.title}, tocca per ${added ? 'toglierlo dal' : 'aggiungerlo al'} tuo piano`}>
              <Text style={{ color: t.accent, fontWeight: '800', fontSize: 13, width: 42 }}>{it.time}</Text>
              <Text style={{ color: c.theirsText, fontSize: 14, flex: 1 }}>{it.title}</Text>
              {conf.length > 0 && <Icon name="alert" size={14} color={t.warn} />}
              {!mine && <Icon name={added ? 'check' : 'plus'} size={16} color={added ? t.positive : t.accent} stroke={2.4} />}
            </Pressable>
            {conf.length > 0 && <Text style={{ color: t.warn, fontSize: 11, marginLeft: 50 }}>Hai già: {conf[0]}</Text>}
          </View>
        );
      })}
      {!mine && <Action icon="plus" label={imported ? 'Aggiunta al tuo piano' : 'Aggiungi al mio piano'} done={imported} onPress={() => { const n = importAgenda(a, m.from); useChat.getState().markImported(chatId, m.id, me); toast(n ? `${n} impegni aggiunti al tuo piano` : 'Erano già nel tuo piano'); }} />}
    </View>
  );
}

export function AgendaCard(props: { m: ChatMessage; me: string; chatId: string }) {
  const mode = props.m.agenda?.mode;
  return mode === 'liberi' || mode === 'occupato' ? <AvailabilityCard {...props} /> : <DetailCard {...props} />;
}

export function TasksCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const t = useTheme();
  const l = m.taskList!;
  const myTasks = useLife((s) => s.tasks);
  const mine = m.from === me;
  const imported = !!m.importedBy?.includes(me);
  return (
    <View style={{ minWidth: 240 }}>
      <Head icon="tasks" title={l.title} sub={`${l.items.filter((x) => x.done).length}/${l.items.length} completati`} />
      {l.items.map((it, i) => {
        const have = myTasks.some((x) => x.t === it.t);
        return (
          <Pressable key={i} onPress={() => { if (mine || it.done) return; if (have) { toast('È già nei tuoi task'); return; } useLife.getState().addTask({ t: it.t, done: false }); toast('Aggiunto ai tuoi task'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }} accessibilityLabel={`${it.t}, tocca per aggiungerlo ai tuoi task`}>
            <Icon name={it.done ? 'checksquare' : 'square'} size={17} color={it.done ? t.positive : c.meta} />
            <Text style={{ color: c.theirsText, fontSize: 14, flex: 1, textDecorationLine: it.done ? 'line-through' : 'none', opacity: it.done ? 0.6 : 1 }}>{it.t}</Text>
            {!mine && !it.done && <Icon name={have ? 'check' : 'plus'} size={16} color={have ? t.positive : t.accent} stroke={2.4} />}
          </Pressable>
        );
      })}
      {!mine && <Action icon="plus" label={imported ? 'Aggiunti ai tuoi task' : 'Aggiungi ai miei task'} done={imported} onPress={() => { const n = importTasks(l); useChat.getState().markImported(chatId, m.id, me); toast(n ? `${n} task aggiunti` : 'Li avevi già'); }} />}
    </View>
  );
}

export function NoteCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const n = m.noteShare!;
  const mine = m.from === me;
  const imported = !!m.importedBy?.includes(me);
  return (
    <View style={{ minWidth: 240 }}>
      <Head icon="note" title={n.title} sub="Nota condivisa" />
      <Text style={{ color: c.theirsText, fontSize: 14 }} numberOfLines={8}>{n.text}</Text>
      {!mine && <Action icon="plus" label={imported ? 'Salvata nelle tue note' : 'Salva nelle mie note'} done={imported} onPress={() => { useLife.getState().saveNote(null, n.text); useChat.getState().markImported(chatId, m.id, me); toast('Nota salvata'); }} />}
    </View>
  );
}

export function SlotsCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const t = useTheme();
  useLife((s) => s.events);
  const sl = m.slots!;
  const mine = m.from === me;
  const best = Math.max(0, ...sl.options.map((o) => o.votes.length));
  const refOf = (oid: string) => `slot:${m.id}:${oid}`;
  const chat = useChat.getState();

  // quando l'orario viene confermato, dal mio calendario spariscono le altre opzioni che avevo scelto
  useEffect(() => {
    if (!sl.confirmed) return;
    sl.options.forEach((o) => { if (o.id !== sl.confirmed && inPlan(refOf(o.id))) removeFromPlan(refOf(o.id)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sl.confirmed]);

  /** Scegliere un orario lo mette nel mio calendario (con avviso se si sovrappone); toglierlo lo rimuove. */
  const choose = (o: (typeof sl.options)[number], voted: boolean) => {
    if (sl.confirmed) return;
    if (voted) { removeFromPlan(refOf(o.id)); chat.voteSlot(chatId, m.id, o.id, me); toast('Tolto dal tuo piano'); return; }
    addToPlanWithCheck({ day: o.day, time: o.time, durationMin: sl.durationMin, title: sl.title, ref: refOf(o.id), verb: 'Scegli' }, () => { chat.voteSlot(chatId, m.id, o.id, me); toast('Scelto e aggiunto al tuo piano'); });
  };
  const confirm = (o: (typeof sl.options)[number]) => {
    const done = () => { sl.options.forEach((x) => { if (x.id !== o.id) removeFromPlan(refOf(x.id)); }); chat.confirmSlot(chatId, m.id, o.id, me); chat.markImported(chatId, m.id, me); toast('Orario confermato e nel tuo piano'); };
    if (inPlan(refOf(o.id))) done();
    else addToPlanWithCheck({ day: o.day, time: o.time, durationMin: sl.durationMin, title: sl.title, ref: refOf(o.id), verb: 'Conferma' }, done);
  };
  const confirmedOpt = sl.options.find((x) => x.id === sl.confirmed);
  return (
    <View style={{ minWidth: 250 }}>
      <Head icon="clock" title={sl.title} sub={sl.confirmed ? 'Orario confermato' : `Proposta di orari · ${sl.durationMin} min · ${mine ? 'scegli quello giusto' : 'tocca gli orari che ti vanno bene: finiscono nel tuo piano'}`} />
      {sl.options.map((o) => {
        const voted = o.votes.includes(me);
        const conf = myConflicts(o.day, o.time, sl.durationMin);
        const isConf = sl.confirmed === o.id;
        const dim = !!sl.confirmed && !isConf;
        const added = inPlan(refOf(o.id));
        return (
          <Pressable key={o.id} onPress={() => choose(o, voted)} style={{ marginBottom: 6, borderWidth: 1.5, borderColor: isConf ? t.positive : voted ? t.accent : c.quoteBg, borderRadius: 12, padding: 9, opacity: dim ? 0.45 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={isConf ? 'check' : voted ? 'checksquare' : 'square'} size={18} color={isConf ? t.positive : voted ? t.accent : c.meta} />
              <Text style={{ color: c.theirsText, fontSize: 14, fontWeight: '700', flex: 1 }}>{dayLabelOf(o.day)} · {o.time}</Text>
              <Text style={{ color: c.meta, fontSize: 12 }}>{o.votes.length} {o.votes.length === 1 ? 'sì' : 'sì'}</Text>
            </View>
            {added && !sl.confirmed && <Text style={{ color: t.positive, fontSize: 11, marginTop: 3 }}>Nel tuo piano</Text>}
            {conf.length > 0 && !added && <Text style={{ color: t.warn, fontSize: 11, marginTop: 3 }}>Per te: hai già {conf[0]}</Text>}
            {mine && !sl.confirmed && o.votes.length === best && best > 0 && (
              <Pressable onPress={() => confirm(o)} style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: t.onText, fontWeight: '800', fontSize: 12 }}>Conferma questo orario</Text></Pressable>
            )}
          </Pressable>
        );
      })}
      {mine && !sl.confirmed && best === 0 && <Text style={{ color: c.meta, fontSize: 11 }}>Quando qualcuno vota potrai confermare l’orario.</Text>}
      {sl.confirmed && confirmedOpt && <Action icon="plus" label={inPlan(refOf(confirmedOpt.id)) ? 'Nel tuo piano' : 'Aggiungi al mio piano'} done={inPlan(refOf(confirmedOpt.id))} onPress={() => addToPlanWithCheck({ day: confirmedOpt.day, time: confirmedOpt.time, durationMin: sl.durationMin, title: sl.title, ref: refOf(confirmedOpt.id) }, () => { chat.markImported(chatId, m.id, me); toast('Aggiunto al tuo piano'); })} />}
    </View>
  );
}

const RSVP_OPTS = [['yes', 'Partecipo', 'check'], ['maybe', 'Forse', 'clock'], ['no', 'Non partecipo', 'x']] as const;

/** Invito a un evento: chi riceve risponde con tre pulsanti, chi invia vede il riepilogo. */
export function EventCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const t = useTheme();
  useLife((s) => s.events);
  const ev = m.event!;
  const mine = m.from === me;
  const mineAns = ev.rsvp[me];
  const sum = rsvpSummary(ev.rsvp);
  const conf = !mine && !mineAns && !findPlanned(m.id) ? findConflicts(ev.day, ev.time, ev.durationMin).map((x) => `${x.ev.time} ${x.ev.title}`) : [];
  const col = { yes: t.positive, maybe: t.warn, no: t.danger };
  return (
    <View style={{ minWidth: 250 }}>
      <Head icon="calendar" title={ev.title} sub={mine ? 'Il tuo invito' : `Invito di ${m.from}`} />
      <Text style={{ color: c.theirsText, fontSize: 14, fontWeight: '700' }}>{fmtDay(tsOf(ev.day, ev.time))} · {ev.time}</Text>
      <Text style={{ color: c.meta, fontSize: 12, marginTop: 1 }}>Durata {ev.durationMin >= 60 && ev.durationMin % 60 === 0 ? `${ev.durationMin / 60} h` : `${ev.durationMin} min`}</Text>
      {!!ev.place && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}><Icon name="location" size={14} color={c.meta} /><Text style={{ color: c.theirsText, fontSize: 13, flex: 1 }}>{ev.place}</Text></View>}
      {!!ev.description && <Text style={{ color: c.theirsText, fontSize: 13, marginTop: 4 }} numberOfLines={4}>{ev.description}</Text>}
      {conf.length > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}><Icon name="alert" size={14} color={t.warn} /><Text style={{ color: t.warn, fontSize: 12, flex: 1 }}>Si sovrappone a: {conf[0]}</Text></View>}
      {!mine && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {RSVP_OPTS.map(([k, label, ic]) => {
            const on = mineAns === k;
            return (
              <Pressable key={k} onPress={() => respondToEvent(chatId, m, me, k, toast)} accessibilityLabel={label} accessibilityState={{ selected: on }}
                style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 7, paddingHorizontal: 2, borderRadius: 12, borderWidth: 1.5, borderColor: on ? col[k] : c.quoteBg, backgroundColor: on ? col[k] + '22' : 'transparent' }}>
                <Icon name={ic} size={15} color={on ? col[k] : c.meta} stroke={2.3} />
                <Text style={{ color: on ? col[k] : c.theirsText, fontWeight: '800', fontSize: 11, textAlign: 'center' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {(mine || Object.keys(ev.rsvp).length > 0) && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: c.meta, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>{sum.yes.length} sì · {sum.maybe.length} forse · {sum.no.length} no</Text>
          {([['yes', 'Partecipano'], ['maybe', 'Forse'], ['no', 'Non partecipano']] as const).map(([k, label]) => sum[k].length ? <Text key={k} style={{ color: c.theirsText, fontSize: 12 }}><Text style={{ color: col[k], fontWeight: '800' }}>{label}: </Text>{sum[k].map((w) => (w === me ? 'Tu' : w)).join(', ')}</Text> : null)}
          {mine && Object.keys(ev.rsvp).length === 0 && <Text style={{ color: c.meta, fontSize: 12 }}>Nessuna risposta ancora.</Text>}
        </View>
      )}
    </View>
  );
}
