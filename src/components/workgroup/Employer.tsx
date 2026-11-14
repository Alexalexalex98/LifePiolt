import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ChannelView } from '@/components/work/Messages';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Item, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { OT_LABEL, addDays, balanceOf, clashes, flagsOf, isTime, overviewOf, r1, windowEnd, shiftHours, vacationLeft, weekStart, absenceCovers } from '@/lib/group';
import { askCover, groupInvite, removeShift, setContract, setShift, type GContract } from '@/lib/groupApi';
import { decideAbsence } from '@/lib/teamWork';
import { OVERTIME_MODES } from '@/lib/payroll';
import { toast } from '@/store/toast';

import { dayLabel } from './Employee';
import type { GroupData } from './useGroup';

type Tab = 'panoramica' | 'turni' | 'persone' | 'ferie' | 'chat';
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const monthRange = (today: string): [string, string] => { const a = `${today.slice(0, 7)}-01`; const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate(); return [a, `${today.slice(0, 7)}-${String(d).padStart(2, '0')}`]; };

/** La vista del datore: tutti i dipendenti con ore, ferie e saldo; turni della settimana; turno scoperto; contratti; richieste di ferie. Solo ore e piani, mai importi. */
export function Employer({ team, today, data }: { team: string; today: string; data: GroupData }) {
  const [tab, setTab] = useState<Tab>('panoramica');
  const reqs = data.absences.filter((a) => a.status === 'requested').length;
  return (
    <>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
        <Pill label={tl('Panoramica')} on={tab === 'panoramica'} onPress={() => setTab('panoramica')} />
        <Pill label={tl('Turni')} on={tab === 'turni'} onPress={() => setTab('turni')} />
        <Pill label={tl('Persone')} on={tab === 'persone'} onPress={() => setTab('persone')} />
        <Pill label={reqs ? `${tl('Ferie')} (${reqs})` : tl('Ferie')} on={tab === 'ferie'} onPress={() => setTab('ferie')} />
        <Pill label={tl('Chat')} on={tab === 'chat'} onPress={() => setTab('chat')} />
      </Row>
      {tab === 'panoramica' ? <Panoramica team={team} today={today} data={data} /> : tab === 'turni' ? <Turni team={team} today={today} data={data} /> : tab === 'persone' ? <Persone team={team} today={today} data={data} /> : tab === 'ferie' ? <FerieReq data={data} /> : <ChannelView team={team} channel="general" admin name={tl('Generale')} />}
    </>
  );
}

function Panoramica({ team, today, data }: { team: string; today: string; data: GroupData }) {
  const th = useTheme(); const [from, end] = monthRange(today); const to = windowEnd(data.shifts, today, end);
  const people = useMemo(() => overviewOf(data, from, to), [data, from, to]);
  void team;
  const todayOn = data.shifts.filter((s) => s.day === today && s.status === 'confirmed');
  const absent = data.absences.filter((a) => a.status === 'approved' && a.from_day <= today && a.to_day >= today);
  const open = data.covReqs.length;
  return (
    <>
      <Card accent={th.accent}>
        <H>Oggi</H>
        <Body>{todayOn.length ? todayOn.map((s) => `${data.nameOf(s.user_id)} ${s.start_t}-${s.end_t}`).join(' · ') : tl('Nessun turno oggi.')}</Body>
        {absent.length ? <Body small muted style={{ marginTop: 6 }}>{tl('Assenti: {0}', absent.map((a) => data.nameOf(a.user_id)).join(', '))}</Body> : null}
        {open ? <Body small color={th.warn} style={{ marginTop: 6 }}>{tl('{0} turni scoperti in attesa di risposta', open)}</Body> : null}
      </Card>
      <Card>
        <H>{tl('Ore e ferie del mese, fino al {0}', `${to.slice(8)}/${to.slice(5, 7)}`)}</H>
        {people.length === 0 ? <Empty text={tl('Invita i dipendenti dalla scheda Persone: qui vedi ore, saldo e ferie di tutti.')} /> : people.map((p, i) => {
          const d = balanceOf(p.planned, p.target); const fl = flagsOf(p, today);
          return (
            <Item key={p.user_id} last={i === people.length - 1}>
              <Row gap={10}>
                <View style={{ flex: 1 }}>
                  <Body bold>{p.name}{p.cover ? ` · ${tl('disponibile a coprire')}` : ''}</Body>
                  <Body small muted>{tl('{0} h pianificate su {1} h di contratto · ferie rimaste {2}', r1(p.planned), r1(p.target), vacationLeft(p))}</Body>
                  {fl.map((f) => <Body key={f.text} small color={f.kind === 'over' ? th.positive : th.warn}>{tl(f.text)}</Body>)}
                </View>
                <Text style={{ color: d < 0 ? th.warn : th.positive, fontWeight: '800' }}>{d > 0 ? '+' : ''}{r1(d)} h</Text>
              </Row>
            </Item>
          );
        })}
        <Body small muted style={{ marginTop: 8 }}>{tl('Vedi solo ore, ferie e piani: i conti dei soldi restano privati di ogni dipendente.')}</Body>
      </Card>
    </>
  );
}

type Draft = { id?: string; user: string; day: string; start: string; end: string; label: string };
function Turni({ team, today, data }: { team: string; today: string; data: GroupData }) {
  const th = useTheme(); const [wk, setWk] = useState(weekStart(today)); const [edit, setEdit] = useState<Draft | null>(null); const [cov, setCov] = useState<{ day: string; start: string; end: string; label: string } | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
  const staff = data.members;
  const mineOf = (u: string) => data.shifts.filter((s) => s.user_id === u);
  const save = async () => {
    if (!edit) return;
    if (!isTime(edit.start) || !isTime(edit.end)) { toast('Scrivi gli orari così: 09:00 e 17:00'); return; }
    if (!edit.user) { toast('Scegli la persona'); return; }
    const r = await setShift(team, edit.user, edit.day, edit.start, edit.end, edit.label.trim(), edit.id);
    if (!r.ok) { toast(r.message); return; }
    setEdit(null); toast(edit.user === data.me ? 'Turno salvato' : 'Turno inviato: il dipendente deve confermarlo'); await data.reload();
  };
  const del = async () => { if (!edit?.id) return; const r = await removeShift(edit.id); setEdit(null); toast(r.ok ? 'Fatto: se il turno era confermato, il dipendente deve accettare la cancellazione' : r.message); await data.reload(); };
  const ask = async (all: boolean) => {
    if (!cov) return; if (!isTime(cov.start) || !isTime(cov.end)) { toast('Scrivi gli orari così: 09:00 e 17:00'); return; }
    const r = await askCover(team, cov.day, cov.start, cov.end, cov.label.trim(), all);
    if (!r.ok) { toast(r.message); return; }
    toast(r.data.notified ? tl('Ho avvisato {0} {1}', r.data.notified, all ? tl('persone libere') : tl('persone disponibili')) : all ? 'Nessuno è libero in quell\'orario' : 'Nessun disponibile libero: puoi avvisare tutti'); await data.reload();
  };
  const people = staff.filter((m) => m.role !== undefined);
  const BADGE: Record<string, string> = { confirmed: '', proposed: 'Da confermare', declined: 'Rifiutato' };
  return (
    <>
      <Row>
        <Btn small ghost title="‹ Settimana" onPress={() => setWk(addDays(wk, -7))} />
        <Body bold>{`${dayLabel(days[0]!)} - ${dayLabel(days[6]!)}`}</Body>
        <Btn small ghost title="Settimana ›" onPress={() => setWk(addDays(wk, 7))} />
      </Row>
      {days.map((d) => {
        const list = data.shifts.filter((s) => s.day === d).sort((a, b) => a.start_t.localeCompare(b.start_t));
        const hrs = Math.round(list.filter((s) => s.status === 'confirmed').reduce((t, s) => t + shiftHours(s), 0) * 10) / 10;
        return (
          <Card key={d} accent={d === today ? th.accent : undefined}>
            <Row><H style={{ marginBottom: 0 }}>{dayLabel(d)}</H><Body small muted>{hrs ? `${hrs} h` : ''}</Body></Row>
            {list.map((s, i) => (
              <Item key={s.id} last={i === list.length - 1} onPress={() => setEdit({ id: s.id, user: s.user_id, day: s.day, start: s.start_t, end: s.end_t, label: s.label })}>
                <Row gap={10}><View style={{ flex: 1 }}><Body bold>{data.nameOf(s.user_id)}</Body><Body small muted>{`${s.start_t}-${s.end_t}${s.label ? ` · ${s.label}` : ''}`}</Body></View>{BADGE[s.status] || s.removal ? <Body small color={th.warn}>{s.removal ? tl('Cancellazione da confermare') : tl(BADGE[s.status] ?? '')}</Body> : null}</Row>
              </Item>
            ))}
            <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
              <Btn small icon="plus" title="Turno" onPress={() => setEdit({ user: people[0]?.user_id ?? '', day: d, start: '09:00', end: '17:00', label: '' })} />
              <Btn small ghost title="Turno scoperto" onPress={() => setCov({ day: d, start: '09:00', end: '17:00', label: '' })} />
            </Row>
          </Card>
        );
      })}
      <Sheet visible={!!edit} title={edit?.id ? 'Modifica il turno' : 'Nuovo turno'} onClose={() => setEdit(null)}>
        {edit ? (
          <View style={{ gap: 10 }}>
            <Body bold>{dayLabel(edit.day)}</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
              {people.map((m) => {
                const busy = clashes(mineOf(m.user_id), edit.day, edit.start, edit.end, edit.id) || absenceCovers(data.absences.filter((a) => a.user_id === m.user_id), edit.day);
                return <Pill key={m.user_id} label={busy ? `${m.name} · ${tl('occupato')}` : m.name} on={edit.user === m.user_id} off={busy && edit.user !== m.user_id} onPress={() => setEdit({ ...edit, user: m.user_id })} />;
              })}
            </Row>
            <Row gap={10}>
              <View style={{ flex: 1 }}><Body small muted>{tl('Inizio')}</Body><Input value={edit.start} onChangeText={(v) => setEdit({ ...edit, start: v })} placeholder="09:00" /></View>
              <View style={{ flex: 1 }}><Body small muted>{tl('Fine')}</Body><Input value={edit.end} onChangeText={(v) => setEdit({ ...edit, end: v })} placeholder="17:00" /></View>
            </Row>
            <Input placeholder="Nome del turno (es. Mattina, Cassa)" value={edit.label} onChangeText={(v) => setEdit({ ...edit, label: v })} />
            <Body small muted>{tl('Il dipendente riceve una notifica e deve confermare: finché non accetta, il suo Plan non cambia.')}</Body>
            <Btn icon="check" title="Invia il turno" onPress={() => { void save(); }} />
            {edit.id ? <Btn ghost danger icon="trash" title="Togli il turno" onPress={() => { void del(); }} /> : null}
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={!!cov} title="Turno scoperto" onClose={() => setCov(null)}>
        {cov ? (
          <View style={{ gap: 10 }}>
            <Body bold>{dayLabel(cov.day)}</Body>
            <Row gap={10}>
              <View style={{ flex: 1 }}><Body small muted>{tl('Inizio')}</Body><Input value={cov.start} onChangeText={(v) => setCov({ ...cov, start: v })} placeholder="09:00" /></View>
              <View style={{ flex: 1 }}><Body small muted>{tl('Fine')}</Body><Input value={cov.end} onChangeText={(v) => setCov({ ...cov, end: v })} placeholder="17:00" /></View>
            </Row>
            <Input placeholder="Nome del turno (facoltativo)" value={cov.label} onChangeText={(v) => setCov({ ...cov, label: v })} />
            <Btn icon="check" title="Avvisa prima chi è disponibile" onPress={() => { void ask(false); }} />
            <Btn ghost title="Avvisa anche gli altri liberi" onPress={() => { void ask(true); }} />
            <Body small muted>{tl('Ricevono la richiesta solo le persone che non hanno già un turno o una assenza in quell\'orario. Il primo che risponde sì prende il turno.')}</Body>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function Persone({ team, today, data }: { team: string; today: string; data: GroupData }) {
  const th = useTheme(); const [code, setCode] = useState(''); const [edit, setEdit] = useState<{ user: string; weekly: string; vac: string; mode: GContract['overtime_mode']; upTo: string; ratio: string; expiry: string; ends: string } | null>(null);
  const contractOf = (u: string) => data.contracts.find((c) => c.user_id === u);
  const open = (u: string) => { const c = contractOf(u); setEdit({ user: u, weekly: String(c?.weekly_hours ?? 40), vac: String(c?.vacation_days ?? 20), mode: c?.overtime_mode ?? 'paid', upTo: c?.paid_up_to ? String(c.paid_up_to) : '', ratio: String(c?.bank_ratio ?? 1), expiry: c?.bank_expiry_months ? String(c.bank_expiry_months) : '', ends: c?.ends_on ?? '' }); };
  const save = async () => {
    if (!edit) return;
    if (edit.ends && !/^\d{4}-\d{2}-\d{2}$/.test(edit.ends)) { toast('La data di fine va scritta così: 2026-12-31'); return; }
    const r = await setContract(team, edit.user, { weekly: Math.min(60, Math.max(1, num(edit.weekly) || 40)), vac: Math.min(60, Math.round(num(edit.vac))), mode: edit.mode, paidUpTo: edit.mode === 'mixed' ? num(edit.upTo) : null, ratio: Math.min(3, Math.max(0.5, num(edit.ratio) || 1)), expiry: edit.expiry ? Math.round(num(edit.expiry)) : null, ends: edit.ends || null });
    if (!r.ok) { toast(r.message); return; }
    setEdit(null); toast('Contratto salvato: il dipendente è stato avvisato'); await data.reload();
  };
  return (
    <>
      <Card accent={th.accent}>
        <H>Invita i dipendenti</H>
        <Body small muted>{tl('Crea un codice valido 7 giorni e mandalo a chi deve entrare nel gruppo: nell\'app sceglie «Entra con un codice».')}</Body>
        <Btn icon="plus" title="Crea un codice d'invito" onPress={() => { void groupInvite(team).then((r) => { if (r.ok) setCode(r.data); else toast(r.message); }); }} style={{ marginTop: 10 }} />
        {code ? <Text selectable style={{ color: th.text, fontSize: 24, fontWeight: '800', letterSpacing: 2, marginTop: 10 }}>{code}</Text> : null}
      </Card>
      <Card>
        <H>Persone e contratti</H>
        {data.members.map((m, i) => {
          const c = contractOf(m.user_id);
          return (
            <Item key={m.user_id} last={i === data.members.length - 1} onPress={() => open(m.user_id)}>
              <Body bold>{m.name}{m.role !== 'member' ? ` · ${tl(m.role === 'owner' ? 'Titolare' : 'Responsabile')}` : ''}</Body>
              <Body small muted>{c ? `${c.weekly_hours} h/sett. · ${tl('ferie')} ${c.vacation_days} · ${tl(OT_LABEL[c.overtime_mode] ?? '')}${c.ends_on ? ` · ${tl('fino al')} ${c.ends_on}` : ''}` : tl('Contratto da impostare: tocca per compilarlo')}</Body>
            </Item>
          );
        })}
      </Card>
      <Sheet visible={!!edit} title="Contratto" onClose={() => setEdit(null)}>
        {edit ? (
          <View style={{ gap: 10 }}>
            <Body bold>{data.nameOf(edit.user)}</Body>
            <Row gap={10}>
              <View style={{ flex: 1 }}><Body small muted>{tl('Ore a settimana')}</Body><Input value={edit.weekly} onChangeText={(v) => setEdit({ ...edit, weekly: v })} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Body small muted>{tl('Giorni di ferie')}</Body><Input value={edit.vac} onChangeText={(v) => setEdit({ ...edit, vac: v })} keyboardType="number-pad" /></View>
            </Row>
            <Body bold>{tl('Ore in più')}</Body>
            {OVERTIME_MODES.map((m) => <Pill key={m.k} label={tl(m.n)} on={edit.mode === m.k} onPress={() => setEdit({ ...edit, mode: m.k })} />)}
            {edit.mode === 'mixed' ? <View><Body small muted>{tl('Ore pagate al mese prima del recupero')}</Body><Input value={edit.upTo} onChangeText={(v) => setEdit({ ...edit, upTo: v })} keyboardType="decimal-pad" /></View> : null}
            {edit.mode === 'bank' || edit.mode === 'mixed' ? (
              <Row gap={10}>
                <View style={{ flex: 1 }}><Body small muted>{tl('Riposo per ogni ora in più')}</Body><Input value={edit.ratio} onChangeText={(v) => setEdit({ ...edit, ratio: v })} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Body small muted>{tl('Scadenza (mesi)')}</Body><Input value={edit.expiry} onChangeText={(v) => setEdit({ ...edit, expiry: v })} keyboardType="number-pad" /></View>
              </Row>
            ) : null}
            <View><Body small muted>{tl('Fine contratto o disdetta (facoltativa, anno-mese-giorno)')}</Body><Input value={edit.ends} onChangeText={(v) => setEdit({ ...edit, ends: v })} placeholder="2026-12-31" /></View>
            <Btn icon="check" title="Salva" onPress={() => { void save(); }} />
            <Body small muted>{tl('Il contratto lo vedono solo il datore e la persona. Gli importi non si inseriscono qui.')}</Body>
          </View>
        ) : null}
      </Sheet>
      <Body small muted>{tl('Oggi è {0}.', today)}</Body>
    </>
  );
}

const KIND: Record<string, string> = { ferie: 'Ferie', permesso: 'Permesso', malattia: 'Malattia', altro: 'Altro' };
function FerieReq({ data }: { data: GroupData }) {
  const th = useTheme();
  const pending = data.absences.filter((a) => a.status === 'requested'); const decided = data.absences.filter((a) => a.status !== 'requested').slice(0, 15);
  const decide = async (id: string, ok: boolean) => { const r = await decideAbsence(id, ok); toast(r.ok ? (ok ? 'Approvata' : 'Rifiutata') : r.message); await data.reload(); };
  const overlap = (a: { user_id: string; from_day: string; to_day: string }) => data.absences.filter((b) => b.status === 'approved' && b.user_id !== a.user_id && b.from_day <= a.to_day && b.to_day >= a.from_day).map((b) => data.nameOf(b.user_id));
  return (
    <>
      <Card accent={pending.length ? th.warn : undefined}>
        <H>Da approvare</H>
        {pending.length === 0 ? <Body muted>{tl('Nessuna richiesta in attesa.')}</Body> : pending.map((a, i) => {
          const ov = overlap(a);
          return (
            <Item key={a.id} last={i === pending.length - 1}>
              <Body bold>{`${data.nameOf(a.user_id)} · ${tl(KIND[a.kind] ?? 'Altro')}`}</Body>
              <Body small muted>{`${a.from_day.slice(8)}/${a.from_day.slice(5, 7)} - ${a.to_day.slice(8)}/${a.to_day.slice(5, 7)}${a.note ? ` · ${a.note}` : ''}`}</Body>
              {ov.length ? <Body small color={th.warn}>{tl('Nello stesso periodo sono già in ferie: {0}', ov.join(', '))}</Body> : null}
              <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 8 }}><Btn small icon="check" title="Approva" onPress={() => { void decide(a.id, true); }} /><Btn small ghost title="Rifiuta" onPress={() => { void decide(a.id, false); }} /></Row>
            </Item>
          );
        })}
      </Card>
      {decided.length ? <Card><H>Ultime decisioni</H>{decided.map((a) => <Body key={a.id} small muted>{`${data.nameOf(a.user_id)} · ${tl(KIND[a.kind] ?? 'Altro')} ${a.from_day.slice(8)}/${a.from_day.slice(5, 7)} - ${a.to_day.slice(8)}/${a.to_day.slice(5, 7)}: ${a.status === 'approved' ? tl('approvata') : tl('rifiutata')}`}</Body>)}</Card> : null}
    </>
  );
}
