import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ChannelView } from '@/components/work/Messages';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Item, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { absenceCovers, clashes, r1, windowEnd, digestOf, monthName, monthPdfHtml, monthRows, planned, prevMonth, shiftHours, targetHours, balanceOf, weekdayOf, type GShift } from '@/lib/group';
import { answerShift, cancelSwap, monthConfirm, monthOpen, openSwap, setCover, takeCover, takeSwap } from '@/lib/groupApi';
import { requestAbsence } from '@/lib/teamWork';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';

import type { GroupData } from './useGroup';

const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const dayLabel = (d: string) => `${tl(WD[weekdayOf(d)] ?? '')} ${d.slice(8)}/${d.slice(5, 7)}`;
type Tab = 'turni' | 'scambi' | 'ferie' | 'mese' | 'chat';

/** La vista del dipendente: turni da confermare, disponibilità a coprire, scambi, ferie, conferma del mese e chat. */
export function Employee({ team, name, today, data }: { team: string; name: string; today: string; data: GroupData }) {
  const [tab, setTab] = useState<Tab>('turni');
  const pending = data.shifts.filter((s) => s.user_id === data.me && s.status === 'proposed').length;
  const open = data.swaps.filter((s) => s.from_user !== data.me).length + data.covReqs.length;
  return (
    <>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
        <Pill label={pending ? `${tl('Turni')} (${pending})` : tl('Turni')} on={tab === 'turni'} onPress={() => setTab('turni')} />
        <Pill label={open ? `${tl('Scambi')} (${open})` : tl('Scambi')} on={tab === 'scambi'} onPress={() => setTab('scambi')} />
        <Pill label={tl('Ferie')} on={tab === 'ferie'} onPress={() => setTab('ferie')} />
        <Pill label={tl('Mese')} on={tab === 'mese'} onPress={() => setTab('mese')} />
        <Pill label={tl('Chat')} on={tab === 'chat'} onPress={() => setTab('chat')} />
      </Row>
      {tab === 'turni' ? <Turni team={team} today={today} data={data} /> : tab === 'scambi' ? <Scambi today={today} data={data} /> : tab === 'ferie' ? <Ferie team={team} data={data} /> : tab === 'mese' ? <Mese team={team} name={name} today={today} data={data} /> : <ChannelView team={team} channel="general" admin={false} name={tl('Generale')} />}
    </>
  );
}

function Turni({ team, today, data }: { team: string; today: string; data: GroupData }) {
  const th = useTheme(); const [swap, setSwap] = useState<GShift | null>(null); const [note, setNote] = useState('');
  const mine = useMemo(() => data.shifts.filter((s) => s.user_id === data.me), [data.shifts, data.me]);
  const ask = mine.filter((s) => s.status === 'proposed');
  const next = mine.filter((s) => s.status === 'confirmed' && s.day >= today).slice(0, 14);
  const myCover = data.cover.find((c) => c.user_id === data.me)?.available ?? false;
  const monthFrom = `${today.slice(0, 7)}-01`; const weekly = data.contracts.find((c) => c.user_id === data.me)?.weekly_hours ?? 40;
  const monthEnd = today.slice(0, 7) + '-' + String(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()).padStart(2, '0');
  const upTo = windowEnd(mine, today, monthEnd); const hours = planned(mine, monthFrom, upTo); const target = targetHours(weekly, monthFrom, upTo);
  const answer = async (s: GShift, ok: boolean) => { const r = await answerShift(s.id, ok); toast(r.ok ? (ok ? 'Confermato: lo trovi nel tuo Plan' : 'Ho avvisato il datore: non puoi') : r.message); await data.reload(); };
  return (
    <>
      {ask.length ? (
        <Card accent={th.warn}>
          <H>Da confermare</H>
          {ask.map((s, i) => (
            <Item key={s.id} last={i === ask.length - 1}>
              <Body bold>{`${dayLabel(s.day)} · ${s.start_t}-${s.end_t}`}</Body>
              <Body small muted>{s.removal ? tl('Il datore vuole togliere questo turno') : s.label || tl('Turno')}</Body>
              <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                <Btn small icon="check" title={s.removal ? 'Va bene, toglilo' : 'Confermo'} onPress={() => { void answer(s, true); }} />
                <Btn small ghost title="Non posso" onPress={() => { void answer(s, false); }} />
              </Row>
            </Item>
          ))}
          <Body small muted style={{ marginTop: 8 }}>{tl('Finché non confermi, il turno non cambia nel tuo Plan.')}</Body>
        </Card>
      ) : null}
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Text style={{ color: th.text, fontSize: 22, fontWeight: '800' }}>{hours} h</Text><Body small muted>{tl('pianificate fino al {0} · contratto {1} h', `${upTo.slice(8)}/${upTo.slice(5, 7)}`, r1(target))}</Body></View>
          <View style={{ flex: 1 }}><Text style={{ color: balanceOf(hours, target) < 0 ? th.warn : th.positive, fontSize: 22, fontWeight: '800' }}>{balanceOf(hours, target) > 0 ? '+' : ''}{r1(balanceOf(hours, target))} h</Text><Body small muted>{tl('rispetto al contratto')}</Body></View>
        </Row>
        <Row style={{ justifyContent: 'flex-start', marginTop: 10 }} gap={8}>
          <Pill label={myCover ? tl('Sono disponibile a coprire') : tl('Non sono disponibile a coprire')} on={myCover} onPress={() => { void setCover(team, !myCover).then(async (r) => { toast(r.ok ? (!myCover ? 'Ti avviso per primo quando serve qualcuno' : 'Va bene, non ti disturbo') : r.message); await data.reload(); }); }} />
        </Row>
        <Body small muted style={{ marginTop: 6 }}>{tl('Se ti segni disponibile, il datore avvisa prima te quando un turno resta scoperto.')}</Body>
      </Card>
      <Card>
        <H>I tuoi prossimi turni</H>
        {next.length === 0 ? <Empty text={tl('Nessun turno in programma. Quando il datore ne pubblica uno, lo confermi qui.')} /> : next.map((s, i) => (
          <Item key={s.id} last={i === next.length - 1} onPress={() => { setSwap(s); setNote(''); }}>
            <Row gap={10}>
              <View style={{ flex: 1 }}><Body bold>{dayLabel(s.day)}</Body><Body small muted>{`${s.start_t}-${s.end_t} · ${shiftHours(s)} h${s.label ? ` · ${s.label}` : ''}`}</Body></View>
              {data.swaps.some((w) => w.shift_id === s.id) ? <Body small color={th.warn}>{tl('Scambio cercato')}</Body> : <Body small muted>{tl('Tocca per scambiare')}</Body>}
            </Row>
          </Item>
        ))}
      </Card>
      <Sheet visible={!!swap} title="Scambia questo turno" onClose={() => setSwap(null)}>
        {swap ? (
          <View style={{ gap: 10 }}>
            <Body bold>{`${dayLabel(swap.day)} · ${swap.start_t}-${swap.end_t}`}</Body>
            <Body small muted>{tl('Scrivo nella chat del gruppo che hai bisogno di questo giorno: chi è libero può prenderlo. Il programma controlla che non si sovrapponga ai suoi turni.')}</Body>
            <Input placeholder="Motivo o nota (facoltativo)" value={note} onChangeText={setNote} />
            {data.swaps.find((w) => w.shift_id === swap.id) ? <Btn ghost title="Annulla la richiesta di scambio" onPress={() => { const w = data.swaps.find((x) => x.shift_id === swap.id); if (w) void cancelSwap(w.id).then(async () => { setSwap(null); toast('Richiesta annullata'); await data.reload(); }); }} /> : <Btn icon="check" title="Cerca qualcuno" onPress={() => { void openSwap(swap.id, note.trim()).then(async (r) => { setSwap(null); toast(r.ok ? 'Ho avvisato il gruppo nella chat' : r.message); await data.reload(); }); }} />}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function Scambi({ today, data }: { today: string; data: GroupData }) {
  const th = useTheme(); const [give, setGive] = useState<{ id: string } | null>(null);
  const mine = data.shifts.filter((s) => s.user_id === data.me);
  const myAbs = data.absences.filter((a) => a.user_id === data.me);
  const free = (day: string, a: string, b: string, except?: string) => !clashes(mine, day, a, b, except) && !absenceCovers(myAbs, day);
  const swaps = data.swaps.filter((s) => s.from_user !== data.me && s.day >= today);
  const reqs = data.covReqs.filter((r) => r.day >= today);
  const take = async (id: string, giveId?: string) => { const r = await takeSwap(id, giveId); setGive(null); toast(r.ok ? 'Fatto: il turno è tuo e lo trovi nel Plan' : r.message); await data.reload(); };
  const cover = async (id: string) => { const r = await takeCover(id); toast(r.ok ? 'Grazie! Il turno è tuo' : r.message); await data.reload(); };
  const mySwaps = data.swaps.filter((s) => s.from_user === data.me);
  return (
    <>
      <Card accent={th.accent}>
        <H>Turni da coprire</H>
        {reqs.length === 0 ? <Body muted>{tl('Nessun turno scoperto adesso.')}</Body> : reqs.map((r, i) => (
          <Item key={r.id} last={i === reqs.length - 1}>
            <Body bold>{`${dayLabel(r.day)} · ${r.start_t}-${r.end_t}`}</Body>
            <Body small muted>{r.label || tl('Turno scoperto')}</Body>
            {free(r.day, r.start_t, r.end_t) ? <Btn small icon="check" title="Ci sono io" onPress={() => { void cover(r.id); }} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : <Body small color={th.warn} style={{ marginTop: 6 }}>{tl('Hai già un turno o un\'assenza in quell\'orario')}</Body>}
          </Item>
        ))}
      </Card>
      <Card>
        <H>Scambi proposti dai colleghi</H>
        {swaps.length === 0 ? <Body muted>{tl('Nessuno cerca uno scambio adesso.')}</Body> : swaps.map((s, i) => (
          <Item key={s.id} last={i === swaps.length - 1}>
            <Body bold>{`${data.nameOf(s.from_user)}: ${dayLabel(s.day)} · ${s.start_t}-${s.end_t}`}</Body>
            {s.note ? <Body small muted>{s.note}</Body> : null}
            {free(s.day, s.start_t, s.end_t) ? (
              <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
                <Btn small icon="check" title="Lo prendo" onPress={() => { void take(s.id); }} />
                <Btn small ghost title="Lo prendo e ne do uno in cambio" onPress={() => setGive({ id: s.id })} />
              </Row>
            ) : (
              <>
                <Body small color={th.warn} style={{ marginTop: 6 }}>{tl('Non puoi: hai già un turno o un\'assenza in quell\'orario')}</Body>
                <Btn small ghost title="Proponi un tuo turno in cambio" onPress={() => setGive({ id: s.id })} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
              </>
            )}
          </Item>
        ))}
      </Card>
      {mySwaps.length ? <Card><H>Le tue richieste</H>{mySwaps.map((s) => <Body key={s.id} small muted>{`${dayLabel(s.day)} · ${s.start_t}-${s.end_t}: ${tl('in attesa che qualcuno lo prenda')}`}</Body>)}</Card> : null}
      <Sheet visible={!!give} title="Quale turno dai in cambio?" onClose={() => setGive(null)}>
        <View style={{ gap: 8 }}>
          {mine.filter((s) => s.status === 'confirmed' && s.day >= today).slice(0, 14).map((s) => <Btn key={s.id} ghost title={`${dayLabel(s.day)} ${s.start_t}-${s.end_t}`} onPress={() => { if (give) void take(give.id, s.id); }} />)}
          <Body small muted>{tl('Il programma controlla che nessuno dei due abbia sovrapposizioni.')}</Body>
        </View>
      </Sheet>
    </>
  );
}

const KINDS: { k: 'ferie' | 'permesso' | 'malattia'; n: string }[] = [{ k: 'ferie', n: 'Ferie' }, { k: 'permesso', n: 'Permesso' }, { k: 'malattia', n: 'Malattia' }];
function Ferie({ team, data }: { team: string; data: GroupData }) {
  const th = useTheme(); const today = useMemoToday();
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today); const [kind, setKind] = useState<'ferie' | 'permesso' | 'malattia'>('ferie'); const [note, setNote] = useState('');
  const mine = data.absences.filter((a) => a.user_id === data.me);
  const taken = mine.filter((a) => a.kind === 'ferie' && a.status === 'approved' && a.from_day.startsWith(today.slice(0, 4))).reduce((t, a) => t + (Math.round((new Date(a.to_day).getTime() - new Date(a.from_day).getTime()) / 86400000) + 1), 0);
  const total = data.contracts.find((c) => c.user_id === data.me)?.vacation_days ?? 20;
  const send = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) { toast('Scrivi le date così: 2026-12-24, e la fine non prima dell\'inizio'); return; }
    const r = await requestAbsence(team, { kind, from_day: from, to_day: to, ...(note.trim() ? { note: note.trim() } : {}) });
    toast(r.ok ? 'Richiesta inviata: il datore deve approvarla' : r.message); if (r.ok) { setNote(''); await data.reload(); }
  };
  const ST: Record<string, string> = { requested: 'In attesa', approved: 'Approvata', rejected: 'Rifiutata' };
  return (
    <>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Text style={{ color: th.text, fontSize: 22, fontWeight: '800' }}>{Math.max(0, total - taken)}</Text><Body small muted>{tl('giorni di ferie rimasti su {0}', total)}</Body></View>
        </Row>
      </Card>
      <Card>
        <H>Chiedi ferie o un permesso</H>
        <View style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{KINDS.map((x) => <Pill key={x.k} label={tl(x.n)} on={kind === x.k} onPress={() => setKind(x.k)} />)}</Row>
          <Row gap={10}><View style={{ flex: 1 }}><Body small muted>{tl('Dal')}</Body><Input value={from} onChangeText={setFrom} placeholder="2026-12-24" /></View><View style={{ flex: 1 }}><Body small muted>{tl('Al')}</Body><Input value={to} onChangeText={setTo} placeholder="2026-12-31" /></View></Row>
          <Input placeholder="Nota (facoltativa)" value={note} onChangeText={setNote} />
          <Btn icon="check" title="Invia la richiesta" onPress={() => { void send(); }} />
          <Body small muted>{tl('Se sei già a lavoro in quei giorni, il datore lo vede prima di approvare.')}</Body>
        </View>
      </Card>
      <Card>
        <H>Le tue richieste</H>
        {mine.length === 0 ? <Empty text={tl('Nessuna richiesta.')} /> : mine.map((a, i) => <Item key={a.id} last={i === mine.length - 1}><Row><View style={{ flex: 1 }}><Body bold>{`${tl(KINDS.find((k) => k.k === a.kind)?.n ?? 'Altro')} · ${a.from_day.slice(8)}/${a.from_day.slice(5, 7)} - ${a.to_day.slice(8)}/${a.to_day.slice(5, 7)}`}</Body>{a.note ? <Body small muted>{a.note}</Body> : null}</View><Body small color={a.status === 'approved' ? th.positive : a.status === 'rejected' ? th.danger : th.muted}>{tl(ST[a.status] ?? '')}</Body></Row></Item>)}
      </Card>
    </>
  );
}
const useMemoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Mese({ team, name, today, data }: { team: string; name: string; today: string; data: GroupData }) {
  const th = useTheme(); const [month, setMonth] = useState(prevMonth(today)); const [busy, setBusy] = useState(false);
  const mine = data.shifts.filter((s) => s.user_id === data.me);
  const rows = useMemo(() => monthRows(mine, month), [mine, month]);
  const total = Math.round(rows.reduce((t, r) => t + r.hours, 0) * 100) / 100;
  const rec = data.months.find((m) => m.user_id === data.me && m.month === month);
  const done = rec?.status === 'confirmed';
  const pdf = async (digest: string, at: string) => {
    try {
      const Print = await import('expo-print'); const { File: FsFile } = await import('expo-file-system');
      const { uri } = await Print.printToFileAsync({ html: monthPdfHtml({ group: name, person: data.nameOf(data.me ?? ''), month, rows, digest, confirmedAt: at }), width: 595, height: 842 });
      let size = ''; try { size = `${Math.max(1, Math.round((new FsFile(uri).size ?? 0) / 1024))} KB`; } catch { /* dimensione non nota */ }
      useLife.getState().addFile({ n: `Ore ${monthName(month)} - ${name}.pdf`.slice(0, 80), s: size, folder: 'Lavoro', date: today, uri, tag: 'Gruppo di lavoro' });
      toast('PDF salvato in LifeDrive (cartella Lavoro)');
    } catch { toast('Il PDF non è disponibile su questo dispositivo, ma il mese è confermato.'); }
  };
  const confirm = async () => {
    setBusy(true);
    const o = await monthOpen(team, month); if (!o.ok) { setBusy(false); toast(o.message); return; }
    const digest = digestOf(rows, month, data.me ?? '');
    const r = await monthConfirm(team, month, digest); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    toast('Mese confermato: il datore è stato avvisato'); await data.reload();
    await pdf(digest, `${today.slice(8)}/${today.slice(5, 7)}/${today.slice(0, 4)}`);
  };
  return (
    <>
      <Card accent={done ? th.positive : th.warn}>
        <Row>
          <Pill label="‹" onPress={() => setMonth(prevMonth(`${month}-15`))} />
          <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{monthName(month)}</Text>
          <Pill label="›" onPress={() => { const [y, m] = month.split('-').map(Number) as [number, number]; const d = new Date(Date.UTC(y, m, 1)); setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }} />
        </Row>
        <Text style={{ color: th.text, fontSize: 26, fontWeight: '800', marginTop: 8 }}>{total} h</Text>
        <Body small muted>{done ? tl('Confermato il {0}', rec?.confirmed_at?.slice(0, 10) ?? '') : tl('Rivedi le ore e confermale: ogni mese serve la tua conferma.')}</Body>
        <Btn icon="check" disabled={busy || done} title={done ? 'Già confermato' : busy ? 'Un attimo…' : 'Confermo le ore e genera il PDF'} onPress={() => { void confirm(); }} style={{ marginTop: 10 }} />
        {done ? <Btn ghost icon="file" title="Rigenera il PDF" onPress={() => { void pdf(rec?.digest ?? '', rec?.confirmed_at?.slice(0, 10) ?? today); }} style={{ marginTop: 8 }} /> : null}
      </Card>
      <Card>
        <H>Turni del mese</H>
        {rows.length === 0 ? <Empty text={tl('Nessun turno confermato in questo mese.')} /> : rows.map((r, i) => <Item key={r.day + r.start} last={i === rows.length - 1}><Row><Body bold>{dayLabel(r.day)}</Body><Body small muted>{`${r.start}-${r.end} · ${r.hours} h`}</Body></Row></Item>)}
        <Body small muted style={{ marginTop: 8 }}>{tl('Il PDF contiene solo ore e turni, nessun importo. Se qualcosa non torna, scrivilo nella chat prima di confermare.')}</Body>
      </Card>
    </>
  );
}
