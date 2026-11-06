import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { useToday } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { KIND_LABEL, MEMBER_COLORS, canDo, dailyPlan, monthlyBoard, weeklyLoad, type Member } from '@/lib/homeCare';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const monthName = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** La famiglia o i coinquilini: chi fa cosa, in modo chiaro e giusto, e la classifica del mese (che si può spegnere). */
export function HomeFamily() {
  const th = useTheme(); const today = useToday(); const { members, chores, log, settings, me, addMember, updateMember, removeMember, updateChore, set, setSettings } = useCasa();
  const [edit, setEdit] = useState<Member | 'new' | null>(null); const [name, setName] = useState(''); const [kind, setKind] = useState<Member['kind']>('adulto'); const [color, setColor] = useState(MEMBER_COLORS[0]!);
  const month = today.slice(0, 7); const board = useMemo(() => monthlyBoard(log, month, members), [log, month, members]); const load = useMemo(() => weeklyLoad(chores, members), [chores, members]);
  const openEdit = (m: Member | 'new') => { setEdit(m); setName(m === 'new' ? '' : m.name); setKind(m === 'new' ? 'adulto' : m.kind); setColor(m === 'new' ? MEMBER_COLORS[members.length % MEMBER_COLORS.length]! : m.color); };
  const save = () => { if (!name.trim()) { toast('Scrivi il nome'); return; } if (edit === 'new') addMember({ id: `m${Date.now().toString(36)}`, name: name.trim(), kind, color }); else if (edit) updateMember(edit.id, { name: name.trim(), kind, color }); setEdit(null); };
  const share = () => { const lines = members.map((m) => { const p = dailyPlan(chores, today, { budget: settings.budget, who: m.id }); return `${m.name}: ${p.items.length ? p.items.map((x) => x.chore.title).join(', ') : tl('niente oggi')}`; }); void Share.share({ message: `${tl('Casa, oggi')}\n${lines.join('\n')}` }); };
  const fair = () => {
    const ms = members; if (ms.length < 2) { toast('Serve almeno un\'altra persona'); return; }
    const mins = new Map(weeklyLoad(chores, ms).map((x) => [x.member.id, x.minutes])); let n = 0;
    for (const c of [...chores].filter((x) => x.active && !x.assignee).sort((a, b) => b.minutes - a.minutes)) {
      const ok = ms.filter((m) => canDo(m, c)); if (!ok.length) continue; const pick = [...ok].sort((a, b) => (mins.get(a.id) ?? 0) - (mins.get(b.id) ?? 0))[0]!;
      updateChore(c.id, { assignee: pick.id }); mins.set(pick.id, (mins.get(pick.id) ?? 0) + Math.round((c.minutes * 7) / Math.max(1, c.every.n * { day: 1, week: 7, month: 30, year: 365 }[c.every.unit]))); n++;
    }
    toast(tl('{0} faccende distribuite in modo equo', n));
  };
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row><H>Chi vive in casa</H><Btn small icon="plus" title="Aggiungi" onPress={() => openEdit('new')} /></Row>
        {members.length === 0 ? <Empty text="Aggiungi te e le altre persone: famiglia, coinquilini, ragazzi." /> : members.map((m) => (
          <Row key={m.id} style={{ marginTop: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>{m.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}><Body bold>{m.name}{m.id === me ? ` · ${tl('tu')}` : ''}</Body><Body small muted>{`${tl(KIND_LABEL[m.kind])} · ${tl('{0} min a settimana', load.find((x) => x.member.id === m.id)?.minutes ?? 0)}`}</Body></View>
            {m.id !== me ? <Btn small ghost title="Sono io" onPress={() => set({ me: m.id })} /> : null}
            <Btn small ghost title="Modifica" onPress={() => openEdit(m)} />
          </Row>
        ))}
        {members.length > 1 ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><Btn small icon="users" title="Distribuisci in modo equo" onPress={fair} /><Btn small ghost icon="send" title="Condividi il piano di oggi" onPress={share} /></View> : null}
        <Body small muted style={{ marginTop: 8 }}>{tl('I compiti sono visibili a tutti: si vede chi fa cosa e quanto tempo richiede. I bambini ricevono solo cose facili e brevi.')}</Body>
      </Card>

      <Card>
        <Row><H>{`${tl('Classifica')} · ${monthName(`${month}-01`)}`}</H></Row>
        <Toggle label={tl('Mostra la classifica della casa')} value={settings.leaderboard} onChange={(v) => setSettings({ leaderboard: v })} hint={tl('Se non piace a qualcuno, spegnila: i punti restano e Theia le stelline le prende lo stesso.')} />
        {settings.leaderboard ? (board.total === 0 ? <Body small muted style={{ marginTop: 6 }}>{tl('Il mese è appena iniziato: ogni faccenda fatta porta punti alla casa.')}</Body> : <>
          <Body small muted style={{ marginTop: 6 }}>{tl('La casa ha fatto {0} punti questo mese. Si riparte da zero ogni mese.', board.total)}</Body>
          {board.rows.map((r, i) => (
            <View key={r.member.id} style={{ marginTop: 10 }}>
              <Row><Body bold style={{ flex: 1 }}>{`${i + 1}. ${r.member.name}`}</Body><Body small muted>{`${r.points} ${tl('punti')} · ${r.count} ${tl('faccende')}`}</Body></Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: th.chip, marginTop: 4 }}><View style={{ width: `${Math.max(3, r.share)}%`, height: 8, borderRadius: 4, backgroundColor: r.member.color }} /></View>
            </View>
          ))}
          <Body small muted style={{ marginTop: 10 }}>{tl('Contano tutti: la casa è in ordine quando ognuno fa la sua parte. Le stesse faccende ripetute nello stesso giorno non danno punti doppi.')}</Body>
        </>) : null}
      </Card>

      <Card>
        <H>Più telefoni</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Per ora la casa vive su questo telefono: chi la usa segna le faccende scegliendo il proprio nome. Con «Condividi il piano di oggi» mandi a tutti l\'elenco.')}</Body>
      </Card>

      <Sheet visible={!!edit} title={edit === 'new' ? 'Nuova persona' : 'Persona'} onClose={() => setEdit(null)}>
        <Input placeholder="Nome" value={name} onChangeText={setName} />
        <Body small bold muted style={{ marginBottom: 6 }}>{tl('CHI È').toUpperCase()}</Body>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>{(Object.keys(KIND_LABEL) as Member['kind'][]).map((k) => <Pill key={k} label={tl(KIND_LABEL[k])} on={kind === k} onPress={() => setKind(k)} />)}</View>
        <Body small bold muted style={{ marginBottom: 6 }}>{tl('COLORE').toUpperCase()}</Body>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>{MEMBER_COLORS.map((c) => <Pill key={c} label={color === c ? '✓' : ' '} color={c} on={color === c} onPress={() => setColor(c)} />)}</View>
        <Row><Btn icon="check" title="Salva" onPress={save} />{edit && edit !== 'new' ? <Btn ghost danger title="Togli" onPress={() => alertT('Togliere questa persona?', `${edit.name}: le sue faccende restano senza nome.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Togli', style: 'destructive', onPress: () => { removeMember(edit.id); setEdit(null); } }])} /> : null}</Row>
      </Sheet>
    </View>
  );
}
