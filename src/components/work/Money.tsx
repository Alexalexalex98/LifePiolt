import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { CATEGORIES_IN, CATEGORIES_OUT, EXPENSE_CATEGORIES, accountantCsv, accountantSummary, balance, budgetStatus, byCategory, expenseTotals, inMonth, monthOf, nextCharge, subsDue, subsMonthly, taxDeadlines, taxSoon, toPay, type Currency, type Expense, type Sub } from '@/lib/money';
import { owed } from '@/lib/crm';
import { sharePdf, shareFile } from '@/lib/exportFile';
import { listDocs } from '@/lib/teamDocs';
import { loadBrand } from '@/lib/teamBrand';
import { createEntry, createSub, decideExpense, deleteBudget, deleteEntry, deleteExpense, deleteSub, downloadReceipt, payDoc, pullMoney, saveBudget, submitExpense, taxToPlan, updateSub } from '@/lib/teamMoney';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { today } from '@/lib/teamWork';
import { docHtml } from '@/lib/writing';
import { brandOf, useBrand } from '@/store/brand';
import { crmOf, useCrm } from '@/store/crm';
import { useDocs } from '@/store/docs';
import { moneyOf, useMoney } from '@/store/money';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

type Tab = 'panoramica' | 'pagamenti' | 'spese' | 'nota' | 'budget' | 'abbonamenti' | 'fisco';
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const money = (n: number, c: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
const okDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + 'T12:00:00').getTime());
const num = (s: string) => parseFloat(s.replace(',', '.'));
const chips = <T,>(label: string, items: { k: T; l: string }[], val: T, set: (v: T) => void) => (<><Body small bold muted style={{ marginBottom: 6 }}>{tl(label).toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{items.map((i) => <Pill key={String(i.k)} label={i.l} on={val === i.k} onPress={() => set(i.k)} />)}</View></>);
const monthShift = (m: string, n: number) => { const d = new Date(`${m}-01T12:00:00`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Amministrazione e soldi: cassa, pagamenti da fare, note spese con foto dello scontrino, prima nota, budget, abbonamenti, scadenze fiscali e pacchetto per il commercialista. */
export function Money() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { caps } = useCaps(team?.id);
  const d = useMoney((s) => moneyOf(team?.id, s.data));
  const docs = useDocs((s) => (team ? s.docs[team.id] : undefined)) ?? NONE;
  const crm = useCrm((s) => crmOf(team?.id, s.data));
  const people = usePeople((s) => (team ? s.people[team.id] : undefined)) ?? NONE;
  const me = usePeople((s) => s.me);
  const brand = brandOf(team?.id, useBrand((s) => s.brand));
  const fin = caps.has('fin.docs');
  const [tab, setTab] = useState<Tab>('panoramica');
  const [month, setMonth] = useState(monthOf(today()));
  const [sheet, setSheet] = useState<null | 'entry' | 'expense' | 'budget' | 'sub'>(null);
  const [country, setCountry] = useState<'IT' | 'CH'>('CH'); const [vat, setVat] = useState<'month' | 'quarter'>('quarter');
  useEffect(() => { if (!team) return; void loadPeople(team.id); void pullMoney(team.id); void loadBrand(team.id); if (fin) void listDocs(team.id); }, [team?.id, fin]); // eslint-disable-line react-hooks/exhaustive-deps
  const t0 = today();
  const cur: Currency = useMemo(() => (d.entries[0]?.currency ?? d.subs[0]?.currency ?? 'CHF') as Currency, [d]);
  if (!team) return <NoWorkspace what="tieni sotto controllo pagamenti, spese e budget" />;
  const nameOf = (id: string) => (id === me ? tl('Tu') : people.find((p) => p.user_id === id)?.name || tl('Collega'));
  const tabs: [Tab, string][] = fin ? [['panoramica', 'Panoramica'], ['pagamenti', 'Pagamenti'], ['spese', 'Note spese'], ['nota', 'Prima nota'], ['budget', 'Budget'], ['abbonamenti', 'Abbonamenti'], ['fisco', 'Scadenze fiscali']] : [['spese', 'Note spese']];
  const t1: Tab = tabs.some(([k]) => k === tab) ? tab : tabs[0]![0];
  const pay = toPay(docs, t0)[cur]; const payDocs = docs.filter((x) => (x.kind === 'invoice' || x.kind === 'bill') && x.status === 'new').sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));
  const mEntries = inMonth(d.entries, month); const bal = balance(d.entries, cur); const mb = balance(mEntries, cur);
  const exps = fin ? d.expenses : d.expenses.filter((e) => e.user_id === me);
  const owedNow = owed(crm.receivables.filter((r) => crm.contacts.find((c) => c.id === r.contact)?.kind !== 'supplier'), t0)[cur];
  const bs = budgetStatus(d.budgets, d.entries, month, cur);
  const tax = taxSoon(taxDeadlines(country, Number(t0.slice(0, 4)), { vat }).concat(taxDeadlines(country, Number(t0.slice(0, 4)) + 1, { vat })), t0, 60);
  const b = { company: brand.company || team.name, address: brand.address, email: brand.email, phone: brand.phone, vat: brand.vat, footer: brand.footer, color: brand.color, logo: brand.logo };
  const open = async (e: Expense) => {
    const r = await downloadReceipt(e); if (!r.ok) { toast(r.message); return; }
    try { const { File, Paths } = await import('expo-file-system'); const S = await import('expo-sharing'); const f = new File(Paths.cache, `scontrino-${Date.now().toString(36)}.jpg`); f.create({ overwrite: true }); f.write(r.data); if (await S.isAvailableAsync()) await S.shareAsync(f.uri, { mimeType: 'image/jpeg' }); } catch { toast('Non riesco ad aprire lo scontrino su questo dispositivo.'); }
  };

  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{tabs.map(([k, l]) => <Pill key={k} label={tl(l)} on={t1 === k} onPress={() => setTab(k)} />)}</ScrollView>

      {t1 === 'panoramica' ? (
        <Card>
          <H>Com'è la situazione</H>
          <Row style={{ marginTop: 8 }}><Body small style={{ flex: 1 }}>{tl('Cassa (entrate meno uscite)')}</Body><Body bold color={bal.net < 0 ? '#ff5a64' : undefined}>{money(bal.net, cur)}</Body></Row>
          <Row style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{tl('Da pagare ai fornitori')}</Body><Body bold>{money(pay.open, cur)}</Body></Row>
          {pay.late ? <Body small bold color="#ff5a64" style={{ marginTop: 2 }}>{tl('{0} già scaduti', money(pay.late, cur))}</Body> : null}
          <Row style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{tl('Da incassare dai clienti')}</Body><Body bold>{money(owedNow.open, cur)}</Body></Row>
          <Row style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{tl('Abbonamenti al mese')}</Body><Body bold>{money(subsMonthly(d.subs, cur), cur)}</Body></Row>
          <Row style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{tl('Note spese da approvare')}</Body><Body bold>{String(d.expenses.filter((e) => e.status === 'submitted').length)}</Body></Row>
          {bs.filter((x) => x.over).length ? <Body small bold color="#ff5a64" style={{ marginTop: 8 }}>{tl('Budget superato: {0}', bs.filter((x) => x.over).map((x) => x.category).join(', '))}</Body> : null}
          {tax.length ? <><Body small bold muted style={{ marginTop: 12 }}>{tl('SCADENZE FISCALI VICINE').toUpperCase()}</Body>{tax.slice(0, 3).map((x) => <Body key={x.day + x.title} small style={{ marginTop: 2 }}>{`${day(x.day)} · ${tl(x.title)}`}</Body>)}</> : null}
        </Card>
      ) : null}

      {t1 === 'pagamenti' ? (
        <Card>
          <H>Pagamenti da fare</H>
          <Body small muted style={{ marginTop: 4 }}>Fatture e bollette caricate in «Documenti», in ordine di scadenza. Quando le paghi, la prima nota si aggiorna da sola.</Body>
          {payDocs.length === 0 ? <Empty text="Niente da pagare. Carica fatture e bollette nella scheda Documenti." /> : payDocs.map((x) => (
            <Row key={x.id} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}><Body bold numberOfLines={2}>{x.title}</Body><Body small muted>{[x.amount != null ? money(x.amount, x.currency ?? '') : tl('importo mancante'), x.due ? `${tl('scade')} ${day(x.due)}` : ''].filter(Boolean).join(' · ')}</Body>{x.due && x.due < t0 ? <Body small bold color="#ff5a64">{tl('Scaduta')}</Body> : null}</View>
              <ChipBtn icon="check" title="Pagata" onPress={() => { void payDoc(x).then((r) => toast(r.ok ? 'Segnata come pagata e messa in prima nota' : r.message)); }} />
            </Row>
          ))}
        </Card>
      ) : null}

      {t1 === 'spese' ? (
        <Card>
          <Row><H>{fin ? 'Note spese' : 'Le mie note spese'}</H><Btn small icon="plus" title="Nuova" onPress={() => setSheet('expense')} /></Row>
          {fin ? <Body small muted style={{ marginTop: 4 }}>{(['submitted', 'approved', 'paid'] as const).map((s) => `${tl({ submitted: 'Da approvare', approved: 'Approvate', paid: 'Pagate' }[s])}: ${money(expenseTotals(d.expenses, cur)[s], cur)}`).join(' · ')}</Body> : null}
          {exps.length === 0 ? <Empty text="Nessuna nota spese. Fotografa lo scontrino e invia." /> : exps.map((e) => (
            <View key={e.id} style={{ marginTop: 10 }}>
              <Row><View style={{ flex: 1 }}><Body bold>{`${e.description || e.category} · ${money(e.amount, e.currency)}`}</Body><Body small muted>{`${day(e.day)} · ${tl(e.category)} · ${fin && e.user_id !== me ? nameOf(e.user_id) + ' · ' : ''}${tl({ submitted: 'in attesa', approved: 'approvata', rejected: 'rifiutata', paid: 'rimborsata' }[e.status])}`}</Body>{e.note ? <Body small muted>{e.note}</Body> : null}</View>{e.receipt_path ? <ChipBtn icon="image" title="Scontrino" onPress={() => { void open(e); }} /> : null}</Row>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                {fin && e.status === 'submitted' && e.user_id !== me ? <><ChipBtn icon="check" title="Approva" onPress={() => { void decideExpense(e, 'approved').then((r) => { if (!r.ok) toast(r.message); }); }} /><ChipBtn icon="x" tone="danger" title="Rifiuta" onPress={() => { void decideExpense(e, 'rejected').then((r) => { if (!r.ok) toast(r.message); }); }} /></> : null}
                {fin && e.status === 'approved' ? <ChipBtn icon="check" title="Rimborsata" onPress={() => { void decideExpense(e, 'paid').then((r) => toast(r.ok ? 'Rimborsata e messa in prima nota' : r.message)); }} /> : null}
                {(e.user_id === me && e.status === 'submitted') || fin ? <ChipBtn icon="trash" tone="danger" title="Elimina" onPress={() => alertT('Eliminare la nota spese?', e.description || e.category, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteExpense(e).then((r) => { if (!r.ok) toast(r.message); }); } }])} /> : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {t1 === 'nota' ? (
        <>
          <Card>
            <Row><Btn small ghost icon="arrow-left" title="" label="Mese prima" onPress={() => setMonth(monthShift(month, -1))} /><Text style={{ color: th.text, fontWeight: '800' }}>{month}</Text><Btn small ghost icon="arrow-right" title="" label="Mese dopo" onPress={() => setMonth(monthShift(month, 1))} /></Row>
            <Body small style={{ marginTop: 8 }}>{`${tl('Entrate')} ${money(mb.inn, cur)} · ${tl('Uscite')} ${money(mb.out, cur)} · ${tl('Saldo')} ${money(mb.net, cur)}`}</Body>
            {byCategory(mEntries, 'out', cur).slice(0, 5).map((c) => <Body key={c.category} small muted style={{ marginTop: 2 }}>{`${tl(c.category)}: ${money(c.total, cur)}`}</Body>)}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Btn small icon="plus" title="Registra" onPress={() => setSheet('entry')} />
              <Btn small ghost icon="chart" title="CSV per il commercialista" onPress={() => { void shareFile(`prima-nota-${month}.csv`, accountantCsv(d.entries, d.expenses, month)); }} />
              <Btn small ghost icon="file" title="PDF riassunto" onPress={() => { void sharePdf(docHtml(accountantSummary(d.entries, d.expenses, month, cur), b), `prima-nota-${month}.pdf`); }} />
              <Btn small ghost icon="send" title="Condividi" onPress={() => { void Share.share({ message: accountantSummary(d.entries, d.expenses, month, cur) }); }} />
            </View>
          </Card>
          <Card>
            <H>Movimenti</H>
            {mEntries.length === 0 ? <Empty text="Nessun movimento in questo mese." /> : mEntries.map((e) => (
              <Row key={e.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{e.description || e.category}</Body><Body small muted>{`${day(e.day)} · ${tl(e.category)}`}</Body></View><Text style={{ color: e.kind === 'in' ? '#2f9e5b' : th.text, fontWeight: '800' }}>{`${e.kind === 'in' ? '+' : '−'}${money(e.amount, e.currency)}`}</Text><ChipBtn icon="trash" tone="danger" title="" onPress={() => { void deleteEntry(e).then((r) => { if (!r.ok) toast(r.message); }); }} /></Row>
            ))}
          </Card>
        </>
      ) : null}

      {t1 === 'budget' ? (
        <Card>
          <Row><H>{`Budget ${month}`}</H><Btn small icon="plus" title="Imposta" onPress={() => setSheet('budget')} /></Row>
          {bs.length === 0 ? <Empty text="Nessun budget. Imposta quanto vuoi spendere per categoria, per il mese o per tutto l'anno." /> : bs.map((x) => (
            <View key={x.category} style={{ marginTop: 10 }}>
              <Row><Body bold style={{ flex: 1 }}>{tl(x.category)}</Body><Body small color={x.over ? '#ff5a64' : undefined}>{`${money(x.spent, cur)} / ${money(x.budget, cur)}`}</Body></Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: th.border, marginTop: 4 }}><View style={{ width: `${Math.min(100, x.pct)}%`, height: 8, borderRadius: 4, backgroundColor: x.over ? '#ff5a64' : x.pct > 80 ? '#e0a030' : th.accent }} /></View>
            </View>
          ))}
          {d.budgets.filter((x) => x.period === month || x.period === month.slice(0, 4)).map((x) => <Row key={x.id} style={{ marginTop: 6 }}><Body small muted style={{ flex: 1 }}>{`${tl(x.category)} · ${x.period} · ${money(x.amount, x.currency)}`}</Body><ChipBtn icon="trash" tone="danger" title="" onPress={() => { void deleteBudget(x).then((r) => { if (!r.ok) toast(r.message); }); }} /></Row>)}
        </Card>
      ) : null}

      {t1 === 'abbonamenti' ? (
        <Card>
          <Row><View style={{ flex: 1 }}><H>Abbonamenti e contratti</H><Body small muted>{`${tl('Al mese')}: ${money(subsMonthly(d.subs, cur), cur)} · ${tl('all\'anno')}: ${money(subsMonthly(d.subs, cur) * 12, cur)}`}</Body></View><Btn small icon="plus" title="Nuovo" onPress={() => setSheet('sub')} /></Row>
          {d.subs.length === 0 ? <Empty text="Nessun abbonamento. Aggiungi software, assicurazioni, affitti: ti avviso prima del rinnovo." /> : d.subs.map((s) => { const n = nextCharge(s, t0); return (
            <Row key={s.id} style={{ marginTop: 10 }}>
              <View style={{ flex: 1 }}><Body bold style={{ opacity: s.active ? 1 : 0.5 }}>{s.name}</Body><Body small muted>{`${money(s.amount, s.currency)} / ${tl({ month: 'mese', quarter: 'trimestre', year: 'anno' }[s.cycle])}${n ? ` · ${tl('prossimo')} ${day(n)}` : ''}${s.vendor ? ` · ${s.vendor}` : ''}`}</Body></View>
              <ChipBtn icon="check" title={s.active ? 'Disdetto' : 'Riattiva'} onPress={() => { void updateSub(s, { active: !s.active }).then((r) => { if (!r.ok) toast(r.message); }); }} />
              <ChipBtn icon="trash" tone="danger" title="" onPress={() => alertT('Eliminare?', s.name, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteSub(s).then((r) => { if (!r.ok) toast(r.message); }); } }])} />
            </Row>
          ); })}
          {subsDue(d.subs, t0, 30).length ? <Body small muted style={{ marginTop: 10 }}>{tl('In arrivo nei prossimi 30 giorni: {0}', subsDue(d.subs, t0, 30).map((x) => `${x.sub.name} (${day(x.day)})`).join(', '))}</Body> : null}
        </Card>
      ) : null}

      {t1 === 'fisco' ? (
        <Card>
          <H>Scadenze fiscali</H>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}><Pill label={tl('Svizzera')} on={country === 'CH'} onPress={() => setCountry('CH')} /><Pill label={tl('Italia')} on={country === 'IT'} onPress={() => setCountry('IT')} /></View>
          {country === 'IT' ? <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}><Pill label={tl('IVA mensile')} on={vat === 'month'} onPress={() => setVat('month')} /><Pill label={tl('IVA trimestrale')} on={vat === 'quarter'} onPress={() => setVat('quarter')} /></View> : null}
          <Body small muted>Sono le scadenze più comuni, indicative: le date cambiano per regime, cantone e anno. Confermale con il tuo commercialista o la tua cassa.</Body>
          {tax.length === 0 ? <Empty text="Nessuna scadenza nei prossimi 60 giorni." /> : tax.map((x) => <Row key={x.day + x.title} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{tl(x.title)}</Body><Body small muted>{day(x.day)}</Body></View><ChipBtn icon="calendar" title="Nel Plan" onPress={() => { void taxToPlan(team.id, x).then((r) => toast(r.ok ? 'Messa nel tuo Plan' : r.message)); }} /></Row>)}
        </Card>
      ) : null}

      <EntrySheet open={sheet === 'entry'} team={team.id} cur={cur} onClose={() => setSheet(null)} />
      <ExpenseSheet open={sheet === 'expense'} team={team.id} cur={cur} onClose={() => setSheet(null)} />
      <BudgetSheet open={sheet === 'budget'} team={team.id} cur={cur} month={month} onClose={() => setSheet(null)} />
      <SubSheet open={sheet === 'sub'} team={team.id} cur={cur} onClose={() => setSheet(null)} />
    </View>
  );
}
const NONE: never[] = [];

function EntrySheet({ open, team, cur, onClose }: { open: boolean; team: string; cur: Currency; onClose: () => void }) {
  const [kind, setKind] = useState<'in' | 'out'>('out'); const [cat, setCat] = useState('Fornitori'); const [desc, setDesc] = useState(''); const [amount, setAmount] = useState(''); const [d, setD] = useState(today()); const [c, setC] = useState<Currency>(cur);
  const save = () => { const a = num(amount); if (!(a > 0) || !okDay(d)) { toast('Controlla importo e data'); return; } void createEntry({ team, day: d, kind, category: cat, description: desc, amount: a, currency: c }).then((r) => { if (r.ok) { setDesc(''); setAmount(''); onClose(); toast('Registrato'); } else toast(r.message); }); };
  return (
    <Sheet visible={open} title="Registra un movimento" onClose={onClose}>
      {chips('Tipo', [{ k: 'out' as const, l: tl('Uscita') }, { k: 'in' as const, l: tl('Entrata') }], kind, (v) => { setKind(v); setCat(v === 'in' ? 'Vendite' : 'Fornitori'); })}
      {chips('Categoria', (kind === 'in' ? CATEGORIES_IN : CATEGORIES_OUT).map((x) => ({ k: x, l: tl(x) })), cat, setCat)}
      <Input placeholder="Descrizione" value={desc} onChangeText={setDesc} />
      <Row><Input flex={1} placeholder="Importo" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Input flex={1} placeholder="Data (2026-11-05)" value={d} onChangeText={setD} /></Row>
      {chips('Valuta', [{ k: 'CHF' as Currency, l: 'CHF' }, { k: 'EUR' as Currency, l: 'EUR' }], c, setC)}
      <Btn icon="check" title="Registra" onPress={save} />
    </Sheet>
  );
}
function ExpenseSheet({ open, team, cur, onClose }: { open: boolean; team: string; cur: Currency; onClose: () => void }) {
  const [cat, setCat] = useState('Pasti'); const [desc, setDesc] = useState(''); const [amount, setAmount] = useState(''); const [d, setD] = useState(today()); const [c, setC] = useState<Currency>(cur); const [photo, setPhoto] = useState<{ uri: string; name: string; mime?: string } | null>(null); const [busy, setBusy] = useState(false);
  const shoot = async (cam: boolean) => {
    const perm = cam ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!perm.granted) { toast('Serve il permesso per la foto'); return; }
    const r = cam ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] });
    if (!r.canceled && r.assets[0]) setPhoto({ uri: r.assets[0].uri, name: r.assets[0].fileName ?? `scontrino-${Date.now()}.jpg`, mime: r.assets[0].mimeType ?? 'image/jpeg' });
  };
  const save = () => { const a = num(amount); if (!(a > 0) || !okDay(d)) { toast('Controlla importo e data'); return; } setBusy(true); void submitExpense({ team, day: d, category: cat, description: desc, amount: a, currency: c, receipt: photo ?? undefined }).then((r) => { setBusy(false); if (r.ok) { setDesc(''); setAmount(''); setPhoto(null); onClose(); toast('Nota spese inviata'); } else toast(r.message); }); };
  return (
    <Sheet visible={open} title="Nuova nota spese" onClose={onClose}>
      {chips('Categoria', EXPENSE_CATEGORIES.map((x) => ({ k: x, l: tl(x) })), cat, setCat)}
      <Input placeholder="Di che spesa si tratta?" value={desc} onChangeText={setDesc} />
      <Row><Input flex={1} placeholder="Importo" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Input flex={1} placeholder="Data (2026-11-05)" value={d} onChangeText={setD} /></Row>
      {chips('Valuta', [{ k: 'CHF' as Currency, l: 'CHF' }, { k: 'EUR' as Currency, l: 'EUR' }], c, setC)}
      <Row><Btn small ghost icon="image" title={photo ? 'Foto pronta' : 'Fotografa lo scontrino'} onPress={() => { void shoot(true); }} /><Btn small ghost title="Dalla galleria" onPress={() => { void shoot(false); }} /></Row>
      <Btn style={{ marginTop: 10 }} icon="send" disabled={busy} title={busy ? 'Invio…' : 'Invia'} onPress={save} />
    </Sheet>
  );
}
function BudgetSheet({ open, team, cur, month, onClose }: { open: boolean; team: string; cur: Currency; month: string; onClose: () => void }) {
  const [cat, setCat] = useState('Fornitori'); const [amount, setAmount] = useState(''); const [whole, setWhole] = useState(false);
  return (
    <Sheet visible={open} title="Imposta un budget" onClose={onClose}>
      {chips('Categoria', CATEGORIES_OUT.map((x) => ({ k: x, l: tl(x) })), cat, setCat)}
      <Input placeholder={`Importo ${cur}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {chips('Vale per', [{ k: false, l: tl('Solo {0}', month) }, { k: true, l: tl('Tutto l\'anno {0}', month.slice(0, 4)) }], whole, setWhole)}
      <Btn icon="check" title="Salva" onPress={() => { const a = num(amount); if (!(a >= 0)) { toast('Scrivi l\'importo'); return; } void saveBudget({ team_id: team, project: null, category: cat, period: whole ? month.slice(0, 4) : month, amount: a, currency: cur }).then((r) => { if (r.ok) { setAmount(''); onClose(); } else toast(r.message); }); }} />
    </Sheet>
  );
}
function SubSheet({ open, team, cur, onClose }: { open: boolean; team: string; cur: Currency; onClose: () => void }) {
  const [name, setName] = useState(''); const [vendor, setVendor] = useState(''); const [amount, setAmount] = useState(''); const [cycle, setCycle] = useState<Sub['cycle']>('month'); const [next, setNext] = useState(''); const [c, setC] = useState<Currency>(cur);
  return (
    <Sheet visible={open} title="Nuovo abbonamento o contratto" onClose={onClose}>
      <Input placeholder="Che cos'è (es. Microsoft 365, assicurazione)" value={name} onChangeText={setName} />
      <Input placeholder="Fornitore" value={vendor} onChangeText={setVendor} />
      <Row><Input flex={1} placeholder="Importo" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Input flex={1} placeholder="Prossimo addebito (2026-12-01)" value={next} onChangeText={setNext} /></Row>
      {chips('Ogni', [{ k: 'month' as Sub['cycle'], l: tl('Mese') }, { k: 'quarter' as Sub['cycle'], l: tl('Trimestre') }, { k: 'year' as Sub['cycle'], l: tl('Anno') }], cycle, setCycle)}
      {chips('Valuta', [{ k: 'CHF' as Currency, l: 'CHF' }, { k: 'EUR' as Currency, l: 'EUR' }], c, setC)}
      <Btn icon="check" title="Aggiungi" onPress={() => { const a = num(amount); if (!name.trim() || !(a >= 0)) { toast('Scrivi nome e importo'); return; } if (next && !okDay(next)) { toast('Scrivi la data come 2026-12-01'); return; } void createSub({ team_id: team, name, vendor, category: 'Abbonamenti', amount: a, currency: c, cycle, next_date: next || null }).then((r) => { if (r.ok) { setName(''); setVendor(''); setAmount(''); setNext(''); onClose(); toast(next ? 'Aggiunto: il rinnovo è nel Plan' : 'Aggiunto'); } else toast(r.message); }); }} />
    </Sheet>
  );
}
