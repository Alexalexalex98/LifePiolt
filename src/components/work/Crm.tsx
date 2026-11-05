import { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';

import { Text } from '@/components/T';
import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { KIND_LABEL, STAGES, computeQuote, contactMatches, followUpsDue, nameOfContact, openTickets, overdueDeals, owed, pipeline, probOf, quoteText, renewalsSoon, slaOf, stageLabel, telUrl, validEmail, winRate, type Contact, type Currency, type Deal, type Interaction, type Kind, type QuoteLine, type Stage, type Ticket } from '@/lib/crm';
import { addInteraction, addReceivable, createContact, createDeal, createTicket, deleteContact, deleteDeal, markPaid, pullCrm, saveQuote, setFollow, updateContact, updateDeal, updateTicket, watchCrm } from '@/lib/teamCrm';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { today } from '@/lib/teamWork';
import { addDays } from '@/lib/workHours';
import { crmOf, useCrm } from '@/store/crm';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

const NONE: never[] = [];
type Tab = 'oggi' | 'trattative' | 'clienti' | 'fornitori' | 'assistenza';
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const money = (n: number, c: string) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${c}`;
const chips = <T,>(label: string, items: { k: T; l: string }[], val: T, set: (v: T) => void) => (<><Body small bold muted style={{ marginBottom: 6 }}>{tl(label).toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{items.map((i) => <Pill key={String(i.k)} label={i.l} on={val === i.k} onPress={() => set(i.k)} />)}</View></>);

/** Clienti, vendite e fornitori: richiami di oggi, trattative per fase, schede con la storia dei rapporti, preventivi, da incassare, assistenza. */
export function Crm() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { caps } = useCaps(team?.id);
  const d = useCrm((s) => crmOf(team?.id, s.data));
  const [tab, setTab] = useState<Tab>('oggi');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [deal, setDeal] = useState<string | null>(null);
  const [newC, setNewC] = useState<Kind | null>(null);
  const [newD, setNewD] = useState(false);
  const [newT, setNewT] = useState(false);
  const [tk, setTk] = useState<string | null>(null);
  const people = usePeopleNames(team?.id ?? '');
  useEffect(() => { if (!team) return; void pullCrm(team.id); void loadPeople(team.id); let off: () => void = () => undefined; let dead = false; void watchCrm(team.id).then((f) => { if (dead) f(); else off = f; }); return () => { dead = true; off(); }; }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace what="gestisci clienti, trattative e fornitori" />;
  const canCrm = caps.has('crm'), canSup = caps.has('suppliers');
  if (!canCrm && !canSup) return <Card><H>Clienti e fornitori</H><Body small muted style={{ marginTop: 4 }}>Questa sezione la vedono vendite, assistenza clienti, acquisti, amministrazione e direzione. Se ti serve, chiedi a chi gestisce le persone di darti la posizione giusta.</Body></Card>;

  const t0 = today();
  const byId = (id: string | null) => d.contacts.find((c) => c.id === id);
  const tabs: [Tab, string][] = [...(canCrm ? [['oggi', 'Oggi'], ['trattative', 'Trattative'], ['clienti', 'Clienti']] as [Tab, string][] : []), ...(canSup ? [['fornitori', 'Fornitori'] as [Tab, string]] : []), ...(canCrm ? [['assistenza', 'Assistenza'] as [Tab, string]] : [])];
  const cur: Tab = tabs.some(([k]) => k === tab) ? tab : tabs[0]![0];
  const follow = followUpsDue(d.interactions, t0);
  const ren = renewalsSoon(d.deals, t0);
  const late = overdueDeals(d.deals, t0);
  const sla = openTickets(d.tickets).filter((x) => slaOf(x, Date.now()).late);
  const lateMoney = owed(d.receivables.filter((r) => d.contacts.find((c) => c.id === r.contact)?.kind !== 'supplier'), t0);
  const clients = d.contacts.filter((c) => c.kind !== 'supplier' && contactMatches(c, q));
  const suppliers = d.contacts.filter((c) => c.kind === 'supplier' && contactMatches(c, q));
  const dealCard = (x: Deal) => (
    <View key={x.id} style={{ backgroundColor: th.card, borderRadius: 14, borderWidth: 1, borderColor: th.border, padding: 10, marginBottom: 8 }}>
      <Row><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>{x.title}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{`${byId(x.contact)?.name ?? ''} · ${money(x.amount, x.currency)} · ${probOf(x)}%${x.expected_close ? ` · ${day(x.expected_close)}` : ''}`}</Text></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setDeal(x.id)} /></Row>
    </View>
  );
  const contactRow = (c: Contact) => (
    <View key={c.id} style={{ paddingVertical: 8 }}><Row><View style={{ flex: 1 }}><Body bold>{c.name}</Body><Body small muted numberOfLines={1}>{[c.company, c.phone, c.email].filter(Boolean).join(' · ') || tl(KIND_LABEL[c.kind])}</Body></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setOpen(c.id)} /></Row></View>
  );

  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{tabs.map(([k, l]) => <Pill key={k} label={tl(l)} on={cur === k} onPress={() => setTab(k)} />)}</ScrollView>

      {cur === 'oggi' ? (
        <>
          <Card>
            <H>Da fare oggi</H>
            {follow.length === 0 && ren.length === 0 && late.length === 0 && sla.length === 0 ? <Empty text="Niente di urgente: nessun richiamo, rinnovo o reclamo in ritardo." /> : null}
            {follow.map((i) => (
              <Row key={i.id} style={{ marginTop: 8 }}>
                <View style={{ flex: 1 }}><Body bold>{`${tl('Richiama')} ${byId(i.contact)?.name ?? ''}`}</Body><Body small muted numberOfLines={2}>{`${i.follow_up && i.follow_up < t0 ? tl('in ritardo') + ' · ' : ''}${i.text}`}</Body></View>
                <ChipBtn icon="check" title="Fatto" onPress={() => { void setFollow(i, { follow_done: true }).then((r) => { if (!r.ok) toast(r.message); }); }} />
                <ChipBtn icon="clock" title="Domani" onPress={() => { void setFollow(i, { follow_up: addDays(t0, 1) }).then((r) => { if (!r.ok) toast(r.message); }); }} />
              </Row>
            ))}
            {ren.map((x) => <Row key={x.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{`${tl('Rinnovo')}: ${x.title}`}</Body><Body small muted>{`${byId(x.contact)?.name ?? ''} · ${x.renewal ? day(x.renewal) : ''}`}</Body></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setDeal(x.id)} /></Row>)}
            {late.map((x) => <Row key={x.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{x.title}</Body><Body small muted>{tl('Doveva chiudersi il {0}', x.expected_close ? day(x.expected_close) : '')}</Body></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setDeal(x.id)} /></Row>)}
            {sla.map((x) => <Row key={x.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{x.title}</Body><Body small muted>{tl('Reclamo aperto da {0} ore', slaOf(x, Date.now()).hours)}</Body></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setTk(x.id)} /></Row>)}
          </Card>
          <Card>
            <H>Il commerciale in numeri</H>
            {(['CHF', 'EUR'] as Currency[]).map((cur2) => { const p = pipeline(d.deals, cur2); const tot = p.reduce((a, x) => a + x.weighted, 0); const won = p.find((x) => x.stage === 'won')!; const o = lateMoney[cur2]; return tot || won.total || o.open ? <View key={cur2} style={{ marginTop: 6 }}><Body small>{`${cur2}: ${tl('previsto')} ${money(tot, cur2)} · ${tl('vinto')} ${money(won.total, cur2)} · ${tl('da incassare')} ${money(o.open, cur2)}${o.late ? ` (${money(o.late, cur2)} ${tl('scaduti')})` : ''}`}</Body></View> : null; })}
            {winRate(d.deals) != null ? <Body small muted style={{ marginTop: 6 }}>{tl('Trattative vinte: {0}% di quelle chiuse', winRate(d.deals)!)}</Body> : null}
            {d.deals.length === 0 && d.receivables.length === 0 ? <Empty text="Aggiungi trattative e importi da incassare per vedere i numeri." /> : null}
          </Card>
        </>
      ) : null}

      {cur === 'trattative' ? (
        <>
          <Row><H>Trattative</H><Btn small icon="plus" title="Nuova" onPress={() => setNewD(true)} /></Row>
          {d.deals.length === 0 ? <Card><Empty text="Nessuna trattativa. Creane una da un cliente o da qui." /></Card> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {STAGES.map((s) => { const l = d.deals.filter((x) => x.stage === s.id); const p = pipeline(d.deals, 'CHF').find((x) => x.stage === s.id)!; return <View key={s.id} style={{ width: 270 }}><Body small bold muted style={{ marginBottom: 6 }}>{`${tl(s.label).toUpperCase()} · ${l.length}${p.total ? ` · ${money(p.total, 'CHF')}` : ''}`}</Body>{l.map(dealCard)}</View>; })}
            </ScrollView>
          )}
        </>
      ) : null}

      {cur === 'clienti' || cur === 'fornitori' ? (
        <Card>
          <Row><H>{cur === 'clienti' ? 'Clienti' : 'Fornitori'}</H><Btn small icon="plus" title="Nuovo" onPress={() => setNewC(cur === 'clienti' ? 'client' : 'supplier')} /></Row>
          <Input placeholder="Cerca per nome, azienda, telefono, email" value={q} onChangeText={setQ} />
          {(cur === 'clienti' ? clients : suppliers).length === 0 ? <Empty text={cur === 'clienti' ? 'Nessun cliente. Aggiungi il primo.' : 'Nessun fornitore. Aggiungi il primo.'} /> : (cur === 'clienti' ? clients : suppliers).map(contactRow)}
        </Card>
      ) : null}

      {cur === 'assistenza' ? (
        <Card>
          <Row><H>Reclami e assistenza</H><Btn small icon="plus" title="Nuovo" onPress={() => setNewT(true)} /></Row>
          {d.tickets.length === 0 ? <Empty text="Nessun reclamo aperto." /> : [...d.tickets].sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || b.created_at.localeCompare(a.created_at)).map((x) => { const s = slaOf(x, Date.now()); return (
            <Row key={x.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{x.title}</Body><Body small muted>{`${byId(x.contact)?.name ?? ''} · ${x.status === 'resolved' ? tl('risolto') : s.late ? tl('in ritardo: {0} h', s.hours) : tl('{0} h', s.hours)}`}</Body></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setTk(x.id)} /></Row>
          ); })}
        </Card>
      ) : null}

      {newC ? <ContactForm team={team.id} kind={newC} onClose={() => setNewC(null)} /> : null}
      {open && byId(open) ? <ContactSheet c={byId(open)!} d={d} people={people} onClose={() => setOpen(null)} onDeal={(id) => { setOpen(null); setDeal(id); }} /> : null}
      <NewDeal team={team.id} open={newD} onClose={() => setNewD(false)} contacts={d.contacts.filter((c) => c.kind !== 'supplier')} />
      {deal && d.deals.find((x) => x.id === deal) ? <DealSheet deal={d.deals.find((x) => x.id === deal)!} contact={byId(d.deals.find((x) => x.id === deal)!.contact)} onClose={() => setDeal(null)} /> : null}
      <NewTicket team={team.id} open={newT} onClose={() => setNewT(false)} contacts={d.contacts.filter((c) => c.kind !== 'supplier')} />
      {tk && d.tickets.find((x) => x.id === tk) ? <TicketSheet tk={d.tickets.find((x) => x.id === tk)!} onClose={() => setTk(null)} /> : null}
    </View>
  );
}
function usePeopleNames(team: string) { const p = usePeople((s) => s.people[team]) ?? NONE; return useMemo(() => new Map(p.map((x) => [x.user_id, x.name || tl('Collega')])), [p]); }

/* ---------- nuova scheda ---------- */
function ContactForm({ team, kind, onClose }: { team: string; kind: Kind; onClose: () => void }) {
  const [k, setK] = useState<Kind>(kind); const [name, setName] = useState(''); const [company, setCompany] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<'IT' | 'CH' | null>(null); const [vat, setVat] = useState(''); const [address, setAddress] = useState('');
  const save = () => {
    if (!name.trim()) { toast('Scrivi il nome'); return; } if (!validEmail(email.trim())) { toast('L\'email non sembra giusta'); return; }
    void createContact({ team, kind: k, name, company, email: email.trim(), phone, country, vat, address }).then((r) => { if (r.ok) { toast('Scheda creata'); onClose(); } else toast(r.message); });
  };
  return (
    <Sheet visible title={k === 'supplier' ? 'Nuovo fornitore' : 'Nuovo cliente'} onClose={onClose}>
      {k !== 'supplier' ? chips('Tipo', [{ k: 'client' as Kind, l: tl('Cliente') }, { k: 'lead' as Kind, l: tl('Contatto nuovo') }], k, setK) : null}
      <Input placeholder="Nome e cognome o ragione sociale" value={name} onChangeText={setName} />
      <Input placeholder="Azienda (facoltativa)" value={company} onChangeText={setCompany} />
      <Row><Input flex={1} placeholder="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Input flex={1} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Row>
      <Input placeholder="Indirizzo" value={address} onChangeText={setAddress} />
      {chips('Paese', [{ k: null as 'IT' | 'CH' | null, l: tl('Non so') }, { k: 'IT' as 'IT' | 'CH' | null, l: tl('Italia') }, { k: 'CH' as 'IT' | 'CH' | null, l: tl('Svizzera') }], country, setCountry)}
      <Input placeholder={country === 'CH' ? 'Numero IDI (CHE-…)' : 'Partita IVA'} value={vat} onChangeText={setVat} />
      <Btn icon="check" title="Crea" onPress={save} />
    </Sheet>
  );
}

/* ---------- scheda cliente con la storia ---------- */
function ContactSheet({ c, d, people, onClose, onDeal }: { c: Contact; d: ReturnType<typeof crmOf>; people: Map<string, string>; onClose: () => void; onDeal: (id: string) => void }) {
  const [f, setF] = useState({ name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address, vat: c.vat, notes: c.notes });
  const [kind, setKind] = useState<Interaction['kind']>('call'); const [text, setText] = useState(''); const [fu, setFu] = useState<number | null>(null);
  const [rl, setRl] = useState(''); const [ra, setRa] = useState(''); const [rd, setRd] = useState('');
  const hist = d.interactions.filter((i) => i.contact === c.id).slice(0, 12);
  const deals = d.deals.filter((x) => x.contact === c.id); const rec = d.receivables.filter((r) => r.contact === c.id); const tks = d.tickets.filter((x) => x.contact === c.id);
  const cur: Currency = c.country === 'IT' ? 'EUR' : 'CHF'; const o = owed(rec, today())[cur];
  const dirty = (Object.keys(f) as (keyof typeof f)[]).some((k) => f[k] !== c[k]);
  const save = () => { if (!f.name.trim()) { toast('Scrivi il nome'); return; } if (!validEmail(f.email.trim())) { toast('L\'email non sembra giusta'); return; } void updateContact(c, { ...f, email: f.email.trim() }).then((r) => toast(r.ok ? 'Salvato' : r.message)); };
  const note = () => { if (!text.trim()) { toast('Scrivi la nota'); return; } void addInteraction(c, kind, text, fu == null ? null : addDays(today(), fu)).then((r) => { if (r.ok) { setText(''); setFu(null); toast(fu == null ? 'Nota salvata' : 'Nota salvata: il richiamo è nel Plan'); } else toast(r.message); }); };
  return (
    <Sheet visible title={nameOfContact(c)} onClose={onClose}>
      <Row>
        {c.phone ? <Btn small icon="phone" title="Chiama" onPress={() => { void Linking.openURL(telUrl(c.phone)); }} /> : null}
        {c.email ? <Btn small ghost icon="send" title="Scrivi" onPress={() => { void Linking.openURL(`mailto:${c.email}`); }} /> : null}
      </Row>
      {c.kind !== 'supplier' && (o.open > 0) ? <Body small bold color={o.late ? '#ff5a64' : undefined} style={{ marginTop: 8 }}>{`${tl('Ti deve')} ${money(o.open, cur)}${o.late ? ` (${money(o.late, cur)} ${tl('scaduti')})` : ''}`}</Body> : null}
      <Body small bold muted style={{ marginTop: 12, marginBottom: 6 }}>{tl('NOTA DOPO LA CHIAMATA').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{([['call', 'Chiamata'], ['meeting', 'Incontro'], ['email', 'Email'], ['visit', 'Visita'], ['note', 'Nota']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={kind === k} onPress={() => setKind(k)} />)}</View>
      <Input placeholder="Che cosa vi siete detti?" value={text} onChangeText={setText} maxLines={5} />
      {chips('Richiamare', [{ k: null as number | null, l: tl('Non serve') }, { k: 1 as number | null, l: tl('Domani') }, { k: 3 as number | null, l: tl('Tra 3 giorni') }, { k: 7 as number | null, l: tl('Tra una settimana') }], fu, setFu)}
      <Btn icon="check" title="Salva la nota" onPress={note} />
      {hist.length ? <><Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('STORIA DEI RAPPORTI').toUpperCase()}</Body>{hist.map((i) => <View key={i.id} style={{ marginBottom: 8 }}><Body small bold>{`${new Date(i.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${tl({ call: 'Chiamata', meeting: 'Incontro', email: 'Email', visit: 'Visita', note: 'Nota' }[i.kind])} · ${people.get(i.by) ?? ''}`}</Body><Body small>{i.text}</Body>{i.follow_up && !i.follow_done ? <Body small muted>{tl('Da richiamare il {0}', day(i.follow_up))}</Body> : null}</View>)}</> : null}

      {c.kind !== 'supplier' ? (
        <>
          <Row style={{ marginTop: 10 }}><Body small bold muted>{tl('TRATTATIVE').toUpperCase()}</Body></Row>
          {deals.length ? deals.map((x) => <Row key={x.id} style={{ marginTop: 4 }}><Body small style={{ flex: 1 }}>{`${x.title} · ${tl(stageLabel(x.stage))} · ${money(x.amount, x.currency)}`}</Body><ChipBtn icon="chevron-right" title="Apri" onPress={() => onDeal(x.id)} /></Row>) : <Body small muted>{tl('Nessuna trattativa.')}</Body>}
        </>
      ) : null}
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl(c.kind === 'supplier' ? 'DA PAGARE A LUI' : 'DA INCASSARE').toUpperCase()}</Body>
      {rec.map((r) => <Row key={r.id} style={{ marginBottom: 4 }}><Body small style={{ flex: 1, textDecorationLine: r.paid ? 'line-through' : 'none' }}>{`${r.label} · ${money(r.amount, r.currency)}${r.due ? ` · ${day(r.due)}` : ''}`}</Body><ChipBtn icon="check" title={r.paid ? 'Riapri' : 'Pagata'} onPress={() => { void markPaid(r, !r.paid).then((x) => { if (!x.ok) toast(x.message); }); }} /></Row>)}
      <Row><Input flex={1} style={{ marginBottom: 0 }} placeholder="Fattura n." value={rl} onChangeText={setRl} /><Input flex={1} style={{ marginBottom: 0 }} placeholder={`Importo ${cur}`} value={ra} onChangeText={setRa} keyboardType="decimal-pad" /></Row>
      <Row style={{ marginTop: 6 }}><Input flex={1} style={{ marginBottom: 0 }} placeholder="Scadenza (2026-12-31)" value={rd} onChangeText={setRd} /><Btn small icon="plus" title="" label="Aggiungi" onPress={() => { const a = parseFloat(ra.replace(',', '.')); if (!rl.trim() || !(a > 0)) { toast('Scrivi la fattura e l\'importo'); return; } if (rd && !/^\d{4}-\d{2}-\d{2}$/.test(rd)) { toast('Scrivi la scadenza come 2026-12-31'); return; } void addReceivable(c, rl, a, cur, rd || null).then((r) => { if (r.ok) { setRl(''); setRa(''); setRd(''); } else toast(r.message); }); }} /></Row>
      {tks.length ? <Body small muted style={{ marginTop: 10 }}>{tl('Reclami: {0} ({1} aperti)', tks.length, openTickets(tks).length)}</Body> : null}

      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('DATI').toUpperCase()}</Body>
      <Input placeholder="Nome" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} /><Input placeholder="Azienda" value={f.company} onChangeText={(v) => setF({ ...f, company: v })} />
      <Row><Input flex={1} placeholder="Telefono" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" /><Input flex={1} placeholder="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" /></Row>
      <Input placeholder="Indirizzo" value={f.address} onChangeText={(v) => setF({ ...f, address: v })} /><Input placeholder="Partita IVA o IDI" value={f.vat} onChangeText={(v) => setF({ ...f, vat: v })} /><Input placeholder="Note" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} maxLines={4} />
      <Btn icon="check" disabled={!dirty} title="Salva i dati" onPress={save} />
      <Row style={{ marginTop: 8 }}>
        <Btn small ghost title={c.kind === 'lead' ? 'Diventa cliente' : 'Archivia'} onPress={() => { void updateContact(c, c.kind === 'lead' ? { kind: 'client' } : { status: 'archived' }).then((r) => { toast(r.ok ? 'Fatto' : r.message); if (r.ok && c.kind !== 'lead') onClose(); }); }} />
        <Btn small ghost danger title="Elimina" onPress={() => alertT('Eliminare la scheda?', `${c.name}: spariscono anche storia, trattative e importi.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteContact(c).then((r) => { toast(r.ok ? 'Scheda eliminata' : r.message); if (r.ok) onClose(); }); } }])} />
      </Row>
    </Sheet>
  );
}

/* ---------- trattative ---------- */
function NewDeal({ team, open, onClose, contacts }: { team: string; open: boolean; onClose: () => void; contacts: Contact[] }) {
  const [title, setTitle] = useState(''); const [amount, setAmount] = useState(''); const [cid, setCid] = useState<string | null>(null); const [cur, setCur] = useState<Currency>('CHF'); const [close, setClose] = useState('');
  const save = () => { const a = parseFloat(amount.replace(',', '.')); if (!title.trim() || !cid) { toast('Scrivi il titolo e scegli il cliente'); return; } if (close && !/^\d{4}-\d{2}-\d{2}$/.test(close)) { toast('Scrivi la data come 2026-12-31'); return; } void createDeal({ team, contact: cid, title, amount: Number.isFinite(a) ? a : 0, currency: cur, expected_close: close || null }).then((r) => { if (r.ok) { toast('Trattativa creata'); setTitle(''); setAmount(''); setClose(''); onClose(); } else toast(r.message); }); };
  return (
    <Sheet visible={open} title="Nuova trattativa" onClose={onClose}>
      <Input placeholder="Che cosa vendi? (es. Nuovo sito)" value={title} onChangeText={setTitle} />
      {contacts.length ? chips('Cliente', contacts.map((c) => ({ k: c.id as string | null, l: c.name })), cid, setCid) : <Body small muted style={{ marginBottom: 8 }}>{tl('Prima aggiungi un cliente.')}</Body>}
      <Row><Input flex={1} placeholder="Valore" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Input flex={1} placeholder="Chiusura (2026-12-31)" value={close} onChangeText={setClose} /></Row>
      {chips('Valuta', [{ k: 'CHF' as Currency, l: 'CHF' }, { k: 'EUR' as Currency, l: 'EUR' }], cur, setCur)}
      <Btn icon="check" title="Crea" onPress={save} />
    </Sheet>
  );
}
function DealSheet({ deal, contact, onClose }: { deal: Deal; contact: Contact | undefined; onClose: () => void }) {
  const [amount, setAmount] = useState(String(deal.amount)); const [close, setClose] = useState(deal.expected_close ?? ''); const [ren, setRen] = useState(deal.renewal ?? ''); const [notes, setNotes] = useState(deal.notes); const [why, setWhy] = useState(deal.lost_reason);
  const [quote, setQuote] = useState(false);
  const patch = (p: Parameters<typeof updateDeal>[1]) => { void updateDeal(deal, p).then((r) => { if (!r.ok) toast(r.message); }); };
  const blurDate = (v: string, cur: string | null, key: 'expected_close' | 'renewal') => { if (v !== (cur ?? '') && (!v || /^\d{4}-\d{2}-\d{2}$/.test(v))) patch({ [key]: v || null }); };
  return (
    <Sheet visible title={deal.title} onClose={onClose}>
      <Body small muted>{`${contact ? nameOfContact(contact) : ''} · ${probOf(deal)}% ${tl('di probabilità')}`}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>{STAGES.map((s) => <Pill key={s.id} label={tl(s.label)} on={deal.stage === s.id} onPress={() => patch({ stage: s.id as Stage })} />)}</View>
      <Input placeholder="Valore" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" onBlur={() => { const a = parseFloat(amount.replace(',', '.')); if (Number.isFinite(a) && a !== deal.amount) patch({ amount: a }); }} />
      <Row><Input flex={1} placeholder="Chiusura prevista" value={close} onChangeText={setClose} onBlur={() => blurDate(close, deal.expected_close, 'expected_close')} /><Input flex={1} placeholder="Rinnovo (2027-01-31)" value={ren} onChangeText={setRen} onBlur={() => blurDate(ren, deal.renewal, 'renewal')} /></Row>
      <Input placeholder="Note" value={notes} onChangeText={setNotes} maxLines={4} onBlur={() => { if (notes !== deal.notes) patch({ notes }); }} />
      {deal.stage === 'lost' ? <Input placeholder="Perché l'abbiamo persa?" value={why} onChangeText={setWhy} onBlur={() => { if (why !== deal.lost_reason) patch({ lost_reason: why }); }} /> : null}
      {contact ? <Btn icon="note" title="Prepara il preventivo" onPress={() => setQuote(true)} /> : null}
      <Btn style={{ marginTop: 8 }} ghost danger title="Elimina la trattativa" onPress={() => alertT('Eliminare la trattativa?', deal.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteDeal(deal).then((r) => { toast(r.ok ? 'Eliminata' : r.message); if (r.ok) onClose(); }); } }])} />
      {contact && quote ? <QuoteSheet deal={deal} client={contact} onClose={() => setQuote(false)} /> : null}
    </Sheet>
  );
}
function QuoteSheet({ deal, client, onClose }: { deal: Deal; client: Contact; onClose: () => void }) {
  const myName = useTeams((s) => s.teams.find((x) => x.id === deal.team_id)?.name) ?? '';
  const [lines, setLines] = useState<QuoteLine[]>([{ desc: deal.title, qty: 1, price: deal.amount }]);
  const [disc, setDisc] = useState('0'); const [d, setD] = useState(''); const [qt, setQt] = useState('1'); const [pr, setPr] = useState('');
  const country = client.country ?? (deal.currency === 'EUR' ? 'IT' : 'CH');
  const c2 = { ...client, country } as Contact;
  const text = quoteText({ from: myName, client: c2, title: deal.title, lines, currency: deal.currency, discountPct: parseFloat(disc) || 0, today: today() });
  const tot = computeQuote(lines, country, deal.currency, parseFloat(disc) || 0);
  return (
    <Sheet visible title="Preventivo" onClose={onClose}>
      {lines.map((l, i) => <Row key={i} style={{ marginBottom: 4 }}><Body small style={{ flex: 1 }}>{`${l.desc} · ${l.qty} × ${money(l.price, deal.currency)}`}</Body><ChipBtn icon="trash" tone="danger" title="Togli" onPress={() => setLines(lines.filter((_, j) => j !== i))} /></Row>)}
      <Input placeholder="Descrizione" value={d} onChangeText={setD} />
      <Row><Input flex={1} placeholder="Quantità" value={qt} onChangeText={setQt} keyboardType="decimal-pad" /><Input flex={1} placeholder={`Prezzo ${deal.currency}`} value={pr} onChangeText={setPr} keyboardType="decimal-pad" /></Row>
      <Btn small ghost icon="plus" title="Aggiungi la riga" onPress={() => { const q = parseFloat(qt.replace(',', '.')), p = parseFloat(pr.replace(',', '.')); if (!d.trim() || !(q > 0) || !(p >= 0)) { toast('Scrivi descrizione, quantità e prezzo'); return; } setLines([...lines, { desc: d.trim(), qty: q, price: p }]); setD(''); setPr(''); setQt('1'); }} />
      <Input style={{ marginTop: 8 }} placeholder="Sconto %" value={disc} onChangeText={setDisc} keyboardType="decimal-pad" />
      <Body small bold>{`${tl('Totale con {0} {1}%', 'IVA', tot.vatRate)}: ${money(tot.total, deal.currency)}`}</Body>
      <View style={{ backgroundColor: 'rgba(128,128,128,0.12)', borderRadius: 12, padding: 10, marginTop: 8 }}><Body small>{text}</Body></View>
      <Btn style={{ marginTop: 10 }} icon="send" title="Condividi" onPress={() => { void Share.share({ message: text }); }} />
      <Btn style={{ marginTop: 8 }} ghost icon="note" title="Salva nel workspace" onPress={() => { void saveQuote(deal, client, text).then((r) => { toast(r.ok ? 'Salvato nel workspace: la trattativa è in «Preventivo»' : r.message); if (r.ok) onClose(); }); }} />
    </Sheet>
  );
}

/* ---------- assistenza ---------- */
function NewTicket({ team, open, onClose, contacts }: { team: string; open: boolean; onClose: () => void; contacts: Contact[] }) {
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [cid, setCid] = useState<string | null>(null); const [prio, setPrio] = useState<Ticket['priority']>('normal');
  return (
    <Sheet visible={open} title="Nuovo reclamo o richiesta" onClose={onClose}>
      <Input placeholder="Di che cosa si tratta?" value={title} onChangeText={setTitle} />
      <Input placeholder="Dettagli" value={text} onChangeText={setText} maxLines={5} />
      {contacts.length ? chips('Cliente', [{ k: null as string | null, l: tl('Nessuno') }, ...contacts.map((c) => ({ k: c.id as string | null, l: c.name }))], cid, setCid) : null}
      {chips('Priorità', [{ k: 'low' as Ticket['priority'], l: tl('Bassa') }, { k: 'normal' as Ticket['priority'], l: tl('Normale') }, { k: 'high' as Ticket['priority'], l: tl('Alta') }, { k: 'urgent' as Ticket['priority'], l: tl('Urgente') }], prio, setPrio)}
      <Btn icon="check" title="Crea" onPress={() => { if (!title.trim()) { toast('Scrivi di che cosa si tratta'); return; } void createTicket({ team, contact: cid, title, text, priority: prio }).then((r) => { if (r.ok) { toast('Creato: ti avviso se passa il tempo di risposta'); setTitle(''); setText(''); onClose(); } else toast(r.message); }); }} />
    </Sheet>
  );
}
function TicketSheet({ tk, onClose }: { tk: Ticket; onClose: () => void }) {
  const s = slaOf(tk, Date.now());
  return (
    <Sheet visible title={tk.title} onClose={onClose}>
      <Body small muted>{tk.status === 'resolved' ? tl('Risolto') : s.late ? tl('In ritardo: aperto da {0} ore, il tempo previsto è {1}', s.hours, s.limit) : tl('Aperto da {0} ore (previsto: {1})', s.hours, s.limit)}</Body>
      {tk.text ? <Body style={{ marginTop: 8 }}>{tk.text}</Body> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{([['open', 'Aperto'], ['doing', 'In lavorazione'], ['resolved', 'Risolto']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={tk.status === k} onPress={() => { void updateTicket(tk, { status: k }).then((r) => { if (!r.ok) toast(r.message); }); }} />)}</View>
    </Sheet>
  );
}
