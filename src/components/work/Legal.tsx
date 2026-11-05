import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { LETTERS, OBLIGATIONS, contractState, dueRows, fillLetter, keepUntil, missingFields, retentionDue, type Country, type Letter } from '@/lib/workLegal';
import { addContract, addProcessing, addStarters, deleteLegal, doneCheck, pullLegal, saveContractNote, saveLetter, viewedLegal } from '@/lib/teamLegal';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { today } from '@/lib/teamWork';
import { contractOf, legalOf, processingOf, useLegal, type LegalItem } from '@/store/legal';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

type Tab = 'contratti' | 'scadenze' | 'dati' | 'lettere' | 'storico';
const day = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const STATE_TONE: Record<string, string> = { scaduto: '#ef4444', 'disdetta vicina': '#f59e0b', 'in scadenza': '#f59e0b', presto: '#f59e0b', 'da fare': '#8e98a8', ok: '#22c55e' };
const LEVEL_TONE = { alto: '#ef4444', medio: '#f59e0b', info: '#8e98a8' } as const;

/** Legale e conformità: contratti letti da Theia (clausole, scadenze, rinnovi, penali, rischi), scadenziario, cosa conservo e per quanto, lettere, storico. Non è consulenza legale. */
export function Legal() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { caps } = useCaps(team?.id);
  const d = useLegal((s) => legalOf(team?.id, s.data));
  const [tab, setTab] = useState<Tab>('contratti');
  useEffect(() => { if (!team) return; void loadPeople(team.id); void pullLegal(team.id); }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace what="leggi i contratti e tieni le scadenze di legge" />;
  const allowed = caps.has('legal.docs');
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      {!allowed ? <Card><H>Legale</H><Body muted style={{ marginTop: 6 }}>{tl('Questa sezione è per chi ha il permesso «Vedere contratti e documenti legali». Chiedilo all\'amministratore, dalla scheda Persone.')}</Body></Card> : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{([['contratti', 'Contratti'], ['scadenze', 'Scadenze'], ['dati', 'Dati personali'], ['lettere', 'Lettere'], ['storico', 'Storico']] as [Tab, string][]).map(([k, l]) => <Pill key={k} label={tl(l)} on={tab === k} onPress={() => setTab(k)} />)}</ScrollView>
          {tab === 'contratti' ? <Contracts team={team.id} items={d.items.filter((i) => i.kind === 'contract')} /> : null}
          {tab === 'scadenze' ? <Checks team={team.id} items={d.items.filter((i) => i.kind === 'check')} /> : null}
          {tab === 'dati' ? <Data team={team.id} items={d.items.filter((i) => i.kind === 'processing')} /> : null}
          {tab === 'lettere' ? <Letters team={team.id} saved={d.items.filter((i) => i.kind === 'letter')} /> : null}
          {tab === 'storico' ? <History team={team.id} /> : null}
          <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Theia dà un primo controllo in parole semplici. Non è consulenza legale: per le decisioni importanti fai verificare da un professionista.')}</Text>
        </>
      )}
    </View>
  );
}

/* ---------- contratti ---------- */
function Contracts({ team, items }: { team: string; items: LegalItem[] }) {
  const [add, setAdd] = useState(false); const [open, setOpen] = useState<string | null>(null);
  const t0 = today();
  const sorted = useMemo(() => [...items].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')), [items]);
  return (
    <Card>
      <Row><H>Contratti</H><Btn small icon="plus" title="Aggiungi" onPress={() => setAdd(true)} /></Row>
      {sorted.length === 0 ? <Empty text="Incolla il testo di un contratto: Theia trova scadenze, rinnovi, penali e ti dice dove stare attento." /> : null}
      {sorted.map((i) => { const c = contractOf(i); const st = contractState(c, t0); return (
        <View key={i.id} style={{ paddingVertical: 8 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body bold onPress={() => { setOpen(i.id); viewedLegal(i.id); }}>{i.title}</Body>
              <Body small muted>{c.end ? tl('Fine {0}', day(c.end)) : tl('Senza scadenza trovata')}{c.cancelBy ? ` · ${tl('disdetta entro {0}', day(c.cancelBy))}` : ''}</Body>
            </View>
            {st !== 'ok' ? <Pill label={tl(st)} color={STATE_TONE[st]} /> : null}
            <Btn small ghost title="Apri" onPress={() => { setOpen(i.id); viewedLegal(i.id); }} />
          </Row>
        </View>
      ); })}
      <AddContract team={team} open={add} onClose={() => setAdd(false)} onDone={(id) => setOpen(id)} />
      {open ? <ContractView id={open} team={team} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}
function AddContract({ team, open, onClose, onDone }: { team: string; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const [name, setName] = useState(''); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const go = () => { if (text.trim().length < 40) { toast('Incolla il testo del contratto'); return; } setBusy(true); void addContract(team, name, text).then((r) => { setBusy(false); if (!r.ok) { toast(r.message); return; } setName(''); setText(''); onClose(); toast('Contratto letto: scadenze nel Plan'); onDone(r.data.id); }); };
  return (
    <Sheet visible={open} title="Nuovo contratto" onClose={onClose}>
      <Input placeholder="Nome (es. Fornitura Rossi)" value={name} onChangeText={setName} />
      <Input placeholder="Incolla qui il testo del contratto" value={text} onChangeText={setText} maxLines={12} />
      <Body small muted style={{ marginBottom: 8 }}>{tl('Il testo resta nel tuo workspace e lo vede solo chi ha il permesso legale. Theia lo legge sul telefono: non esce.')}</Body>
      <Btn icon="check" disabled={busy} title={busy ? 'Leggo…' : 'Leggi il contratto'} onPress={go} />
    </Sheet>
  );
}
function ContractView({ id, team, onClose }: { id: string; team: string; onClose: () => void }) {
  const th = useTheme();
  const i = useLegal((s) => legalOf(team, s.data).items.find((x) => x.id === id));
  const [note, setNote] = useState<string | null>(null);
  if (!i) return null;
  const c = contractOf(i); const row = (k: string, v?: string | number | null) => (v != null && v !== '' ? <Row key={k} style={{ marginTop: 4 }}><Body small muted style={{ flex: 1 }}>{tl(k)}</Body><Body small bold>{String(v)}</Body></Row> : null);
  return (
    <Sheet visible title={i.title} onClose={onClose}>
      {row('Inizio', c.start ? day(c.start) : null)}{row('Fine', c.end ? day(c.end) : null)}{row('Durata', c.months ? tl('{0} mesi', c.months) : null)}{row('Rinnovo automatico', c.autoRenew ? tl('Sì') : tl('No'))}
      {row('Preavviso', c.noticeDays != null ? tl('{0} giorni', c.noticeDays) : null)}{row('Ultimo giorno per disdire', c.cancelBy ? day(c.cancelBy) : null)}{row('Pagamento', c.paymentDays ? tl('a {0} giorni', c.paymentDays) : null)}{row('Importo', c.amount ? c.amount.toLocaleString() : null)}
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('DOVE STARE ATTENTO').toUpperCase()}</Body>
      {c.risks.length ? c.risks.map((r, k) => (
        <View key={k} style={{ borderLeftWidth: 3, borderLeftColor: LEVEL_TONE[r.level], paddingLeft: 10, marginBottom: 8 }}>
          <Body bold>{tl(r.title)}</Body><Body small muted>{r.why}</Body>
        </View>
      )) : <Body small muted>{tl('Non vedo punti delicati. Controlla comunque il testo intero.')}</Body>}
      {c.penalties.length ? <><Body small bold muted style={{ marginTop: 8, marginBottom: 4 }}>{tl('PENALI').toUpperCase()}</Body>{c.penalties.map((p, k) => <Body key={k} small style={{ marginBottom: 4 }}>{`• ${p}`}</Body>)}</> : null}
      {c.clauses.length ? <><Body small bold muted style={{ marginTop: 8, marginBottom: 6 }}>{tl('CLAUSOLE TROVATE').toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{c.clauses.map((x) => <Pill key={x} label={tl(x)} />)}</View></> : null}
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('LE TUE NOTE').toUpperCase()}</Body>
      <Input placeholder="Es. da rinegoziare il prezzo" value={note ?? c.note ?? ''} onChangeText={setNote} maxLines={4} />
      <Row style={{ marginTop: 6 }}>
        <Btn small title="Salva nota" disabled={note == null} onPress={() => { void saveContractNote(i, note ?? '').then((r) => toast(r.ok ? 'Nota salvata' : r.message)); }} />
        <Btn small danger ghost title="Elimina" onPress={() => alertT('Eliminare il contratto?', i.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteLegal(i).then((r) => { if (r.ok) onClose(); else toast(r.message); }); } }])} />
      </Row>
      <Text style={{ color: th.muted, fontSize: 12, marginTop: 10 }}>{tl('Aperto da te: resta scritto nello storico.')}</Text>
    </Sheet>
  );
}

/* ---------- scadenze di legge e controlli ---------- */
function Checks({ team, items }: { team: string; items: LegalItem[] }) {
  const [country, setCountry] = useState<Country>('IT');
  const done = useMemo(() => Object.fromEntries(items.map((i) => [String(i.data.obl), String(i.data.last)])), [items]);
  const rows = dueRows(OBLIGATIONS, done, today(), country);
  return (
    <Card>
      <H>Scadenze e controlli</H>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{([['IT', 'Italia'], ['CH', 'Svizzera']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={country === k} onPress={() => setCountry(k)} />)}</View>
      <Body small muted style={{ marginTop: 6 }}>{tl('Promemoria indicativi: quando segni «Fatto», il prossimo termine va nel tuo Plan.')}</Body>
      {rows.map(({ o, last, due, state }) => (
        <View key={o.id} style={{ marginTop: 12 }}>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{o.title}</Body><Body small muted>{o.why}</Body><Body small muted>{last ? tl('Ultimo: {0} · prossimo: {1}', day(last), day(due)) : tl('Mai segnato')}</Body></View>
            <Pill label={tl(state)} color={STATE_TONE[state]} />
          </Row>
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><Btn small ghost icon="check" title="Fatto oggi" onPress={() => { void doneCheck(team, o.id).then((r) => toast(r.ok ? 'Segnato: prossimo termine nel Plan' : r.message)); }} /></View>
        </View>
      ))}
    </Card>
  );
}

/* ---------- registro dei trattamenti ---------- */
function Data({ team, items }: { team: string; items: LegalItem[] }) {
  const [add, setAdd] = useState(false);
  const f = { what: '', why: '', where: '', years: '5', who: '' };
  const [v, setV] = useState(f);
  return (
    <Card>
      <Row><H>Dati personali: cosa conservo e per quanto</H></Row>
      <Body small muted style={{ marginTop: 4 }}>{tl('È il registro dei trattamenti: per ogni tipo di dato, perché lo tieni, dove sta e quando va cancellato.')}</Body>
      {items.length === 0 ? <Empty text="Il registro è vuoto. Parti dagli esempi e adattali." /> : null}
      {items.map((i) => { const p = processingOf(i); const until = keepUntil(i.created_at.slice(0, 10), p.years); const over = retentionDue(p, i.created_at.slice(0, 10), today()); return (
        <View key={i.id} style={{ paddingVertical: 8 }}>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{p.what}</Body><Body small muted>{`${p.why} · ${p.where} · ${p.who}`}</Body><Body small muted>{tl('Tengo {0} anni · da rivedere dal {1}', p.years, day(until))}</Body></View>
            {over ? <Pill label={tl('da rivedere')} color="#f59e0b" /> : null}
            <Btn small danger ghost icon="trash" title="" onPress={() => { void deleteLegal(i); }} />
          </Row>
        </View>
      ); })}
      <Row style={{ marginTop: 8 }}>
        <Btn small ghost icon="plus" title="Aggiungi" onPress={() => setAdd(true)} />
        <Btn small ghost title="Esempi di partenza" onPress={() => { void addStarters(team, items.map((i) => i.title)).then((r) => toast(r.ok ? 'Esempi aggiunti' : r.message)); }} />
      </Row>
      <Sheet visible={add} title="Nuovo trattamento" onClose={() => setAdd(false)}>
        <Input placeholder="Che dati sono (es. Foto dei dipendenti)" value={v.what} onChangeText={(x) => setV({ ...v, what: x })} />
        <Input placeholder="Perché li tieni" value={v.why} onChangeText={(x) => setV({ ...v, why: x })} />
        <Input placeholder="Dove stanno (es. Documenti · HR)" value={v.where} onChangeText={(x) => setV({ ...v, where: x })} />
        <Input placeholder="Chi se ne occupa" value={v.who} onChangeText={(x) => setV({ ...v, who: x })} />
        <Input placeholder="Per quanti anni (es. 5)" value={v.years} onChangeText={(x) => setV({ ...v, years: x.replace(/[^\d.]/g, '') })} keyboardType="numeric" />
        <Btn icon="check" title="Salva" onPress={() => { const y = parseFloat(v.years); if (!v.what.trim() || !(y > 0)) { toast('Scrivi che dati sono e per quanti anni'); return; } void addProcessing(team, { what: v.what.trim(), why: v.why.trim(), where: v.where.trim(), who: v.who.trim(), years: y }).then((r) => { if (r.ok) { setV(f); setAdd(false); } else toast(r.message); }); }} />
      </Sheet>
    </Card>
  );
}

/* ---------- lettere ---------- */
function Letters({ team, saved }: { team: string; saved: LegalItem[] }) {
  const [l, setL] = useState<Letter | null>(null); const [v, setV] = useState<Record<string, string>>({});
  const text = l ? fillLetter(l, v) : '';
  return (
    <Card>
      <H>Modelli di lettera</H>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{LETTERS.map((x) => <Pill key={x.id} label={x.name} onPress={() => { setL(x); setV({}); }} />)}</View>
      {saved.length ? <><Body small bold muted style={{ marginTop: 14, marginBottom: 4 }}>{tl('SALVATE').toUpperCase()}</Body>{saved.map((i) => <Row key={i.id}><Body style={{ flex: 1 }}>{i.title}</Body><Btn small ghost title="Condividi" onPress={() => { void Share.share({ message: String(i.data.text ?? '') }); }} /><Btn small danger ghost icon="trash" title="" onPress={() => { void deleteLegal(i); }} /></Row>)}</> : null}
      <Sheet visible={!!l} title={l?.name ?? ''} onClose={() => setL(null)}>
        {l ? (
          <>
            {l.fields.map((f) => <Input key={f.k} placeholder={f.ph ? `${tl(f.label)} (${f.ph})` : tl(f.label)} value={v[f.k] ?? ''} onChangeText={(x) => setV({ ...v, [f.k]: x })} />)}
            <View style={{ backgroundColor: 'rgba(128,128,128,0.12)', borderRadius: 14, padding: 12, marginVertical: 8 }}><Body small>{text}</Body></View>
            {missingFields(l, v).length ? <Body small muted style={{ marginBottom: 6 }}>{tl('Mancano: {0}', missingFields(l, v).join(', '))}</Body> : null}
            <Row>
              <Btn icon="send" title="Condividi" onPress={() => { void Share.share({ message: text }); }} />
              <Btn ghost title="Salva" onPress={() => { void saveLetter(team, `${l.name} · ${v[l.fields[0]!.k] ?? ''}`.trim(), { letter: l.id, vars: v, text }).then((r) => { toast(r.ok ? 'Lettera salvata' : r.message); if (r.ok) setL(null); }); }} />
            </Row>
          </>
        ) : null}
      </Sheet>
    </Card>
  );
}

/* ---------- storico ---------- */
function History({ team }: { team: string }) {
  const rows = useLegal((s) => legalOf(team, s.data).audit);
  const people = usePeople((s) => s.people[team]) ?? [];
  const me = usePeople((s) => s.me);
  const who = (id: string) => (id === me ? tl('Tu') : people.find((p) => p.user_id === id)?.name || tl('Collega'));
  return (
    <Card>
      <H>Chi ha fatto e visto cosa</H>
      <Body small muted style={{ marginTop: 4 }}>{tl('Contratti, schede e adempimenti: chi li ha creati, cambiati, eliminati o aperti. Non si può modificare.')}</Body>
      {rows.length === 0 ? <Empty text="Ancora niente." /> : rows.map((r) => (
        <View key={r.id} style={{ paddingVertical: 6 }}>
          <Body small bold>{`${who(r.user_id)} · ${tl(r.action)}`}</Body>
          <Body small muted>{`${r.label} · ${new Date(r.at).toLocaleString()}`}</Body>
        </View>
      ))}
    </Card>
  );
}
