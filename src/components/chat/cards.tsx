import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { addSlotToPlan, dayLabelOf, importAgenda, importTasks, myConflicts } from '@/lib/chatShare';
import { Icon } from '@/lib/icons';
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

function AvailabilityCard({ m, me, chatId }: { m: ChatMessage; me: string; chatId: string }) {
  const c = useChatColors();
  const t = useTheme();
  useLife((s) => s.events);
  const a = m.agenda!;
  const mine = m.from === me;
  const days = [...new Set([...(a.free ?? []).map((f) => f.day), ...(a.busy ?? []).map((b) => b.day)])].sort();
  const propose = (day: string, from: string) => {
    useChat.getState().send(chatId, me, { kind: 'slots', slots: { title: 'Incontro', durationMin: a.hours?.minSlot ?? 30, options: [{ id: `p${day}${from}`, day, time: from, votes: [me] }] }, replyTo: m.id });
    toast(`Proposto ${dayLabelOf(day)} alle ${from}`);
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
        const conf = !mine && !imported ? myConflicts(it.day, it.time, 30) : [];
        return (
          <View key={i}>
            {head && <Text style={{ color: c.meta, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: i ? 6 : 0 }}>{dayLabelOf(it.day)}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 3 }}>
              <Text style={{ color: t.accent, fontWeight: '800', fontSize: 13, width: 42 }}>{it.time}</Text>
              <Text style={{ color: c.theirsText, fontSize: 14, flex: 1 }}>{it.title}</Text>
              {conf.length > 0 && <Icon name="alert" size={14} color={t.warn} />}
            </View>
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
  const mine = m.from === me;
  const imported = !!m.importedBy?.includes(me);
  return (
    <View style={{ minWidth: 240 }}>
      <Head icon="tasks" title={l.title} sub={`${l.items.filter((x) => x.done).length}/${l.items.length} completati`} />
      {l.items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
          <Icon name={it.done ? 'checksquare' : 'square'} size={17} color={it.done ? t.positive : c.meta} />
          <Text style={{ color: c.theirsText, fontSize: 14, flex: 1, textDecorationLine: it.done ? 'line-through' : 'none', opacity: it.done ? 0.6 : 1 }}>{it.t}</Text>
        </View>
      ))}
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
  const imported = !!m.importedBy?.includes(me);
  return (
    <View style={{ minWidth: 250 }}>
      <Head icon="clock" title={sl.title} sub={sl.confirmed ? 'Orario confermato' : `Proposta di orari · ${sl.durationMin} min · ${mine ? 'scegli quello giusto' : 'vota quelli che ti vanno bene'}`} />
      {sl.options.map((o) => {
        const voted = o.votes.includes(me);
        const conf = myConflicts(o.day, o.time, sl.durationMin);
        const isConf = sl.confirmed === o.id;
        const dim = !!sl.confirmed && !isConf;
        return (
          <Pressable key={o.id} onPress={() => { if (!sl.confirmed) useChat.getState().voteSlot(chatId, m.id, o.id, me); }} style={{ marginBottom: 6, borderWidth: 1.5, borderColor: isConf ? t.positive : voted ? t.accent : c.quoteBg, borderRadius: 12, padding: 9, opacity: dim ? 0.45 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={isConf ? 'check' : voted ? 'checksquare' : 'square'} size={18} color={isConf ? t.positive : voted ? t.accent : c.meta} />
              <Text style={{ color: c.theirsText, fontSize: 14, fontWeight: '700', flex: 1 }}>{dayLabelOf(o.day)} · {o.time}</Text>
              <Text style={{ color: c.meta, fontSize: 12 }}>{o.votes.length} {o.votes.length === 1 ? 'sì' : 'sì'}</Text>
            </View>
            {conf.length > 0 && <Text style={{ color: t.warn, fontSize: 11, marginTop: 3 }}>Per te: hai già {conf[0]}</Text>}
            {mine && !sl.confirmed && o.votes.length === best && best > 0 && (
              <Pressable onPress={() => useChat.getState().confirmSlot(chatId, m.id, o.id, me)} style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: t.onText, fontWeight: '800', fontSize: 12 }}>Conferma questo orario</Text></Pressable>
            )}
          </Pressable>
        );
      })}
      {mine && !sl.confirmed && best === 0 && <Text style={{ color: c.meta, fontSize: 11 }}>Quando qualcuno vota potrai confermare l’orario.</Text>}
      {sl.confirmed && <Action icon="plus" label={imported ? 'Aggiunto al tuo piano' : 'Aggiungi al mio piano'} done={imported} onPress={() => { addSlotToPlan(sl, sl.confirmed!); useChat.getState().markImported(chatId, m.id, me); toast('Aggiunto al tuo piano'); }} />}
    </View>
  );
}
