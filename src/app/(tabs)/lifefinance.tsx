import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CsvImportSheet } from '@/components/CsvImportSheet';
import { Donut, LineChart, Spark } from '@/components/charts';
import { FinTabs } from '@/components/FinTabs';
import { Body, Btn, Card, Empty, H, Input, Item, Link, Metric, Page, Pill, Progress, Row, Select, Sheet, Tag, Toggle, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF, shortDate } from '@/lib/format';
import { areaColors, Icon } from '@/lib/icons';
import { savingsRatePct } from '@/lib/scores';
import { alertsFor } from '@/lib/budgetState';
import { detectRecurring, movementsToDated } from '@/lib/recurring';
import { avgRecentNet, defaultBudget, emergencyByMonth, monthEnd, monthNet, normBill, spendByCategory, typicalCosts, useFin } from '@/store/finance';
import { toast } from '@/store/toast';
import { LpTag } from '@/components/network';
import { go } from '@/lib/nav';
import { useNet } from '@/store/network';

export default function LifeFinance() {
  const t = useTheme();
  const f = useFin();
  const color = areaColors.lifefinance;
  const [hist, setHist] = useState<number | null>(null);
  const [trend, setTrend] = useState(false);
  const [tips, setTips] = useState(false);
  const [ef, setEf] = useState(false);
  const [guide, setGuide] = useState(false);
  const [billSheet, setBillSheet] = useState(false);
  const [csvSheet, setCsvSheet] = useState(false);
  const [typSheet, setTypSheet] = useState(false);
  const [typ, setTyp] = useState<Record<string, { on: boolean; amt: string }>>({});
  const [budgetKey, setBudgetKey] = useState(0);
  // form movimento
  const [mvType, setMvType] = useState<'out' | 'in'>('out');
  const [mvLabel, setMvLabel] = useState('');
  const [mvAmount, setMvAmount] = useState('');
  const [mvDate, setMvDate] = useState('');
  // form bolletta
  const [bName, setBName] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [bFreq, setBFreq] = useState<'Ogni mese' | 'Ogni anno'>('Ogni mese');

  const ledger = useNet((n) => n.ledger);
  const lpTop = ledger.filter((l) => l.type === 'topup').reduce((s, l) => s + l.amount, 0);
  const lpSpent = ledger.filter((l) => l.type === 'spend').reduce((s, l) => s + l.amount, 0);
  const cur = f.months[0];
  const net = monthNet(cur), end = monthEnd(cur);
  const endsChrono = f.months.slice().reverse().map(monthEnd);

  // categorie reali: ultimi 3 mesi con spese (media mensile), così il grafico mostra tutte le categorie anche a inizio mese
  // (si usano i mesi chiusi: il mese in corso è parziale e falserebbe le quote; se non ce ne sono, si usa quello corrente)
  const closed = f.months.filter((x) => x.locked).slice(0, 3);
  const recent = closed.length ? closed : f.months.slice(0, 1);
  const spentMap = spendByCategory(recent, f.categories);
  const spentByCat = f.categories.map((c) => ({ ...c, v: spentMap[c.n] ?? 0 }));
  const totalSpent = spentByCat.reduce((s, c) => s + c.v, 0);
  const catParts = totalSpent > 0 ? spentByCat.filter((c) => c.v > 0).map((c) => ({ ...c, p: Math.round((c.v / totalSpent) * 1000) / 10 })).sort((a, b) => b.p - a.p) : f.categories;
  const sr = savingsRatePct();

  const buffer = avgRecentNet(f.months);
  const allocated = Object.values(f.budget.alloc).reduce((s, v) => s + (v || 0), 0);
  const remaining = f.budget.salary - allocated;
  const efTotal = f.months.reduce((s, m) => s + emergencyByMonth(m), 0);
  const monthlyBills = f.bills.reduce((s, b) => s + (b.freq === 'monthly' ? b.amount : b.amount / 12), 0);

  const m = hist != null ? f.months[hist] : null;
  const alerts = alertsFor(f);
  const recurring = detectRecurring(movementsToDated(f.months), f.bills.map((b) => b.name));

  const haveBills = new Set(f.bills.map((b) => normBill(b.name)));
  function openTyp() {
    const init: Record<string, { on: boolean; amt: string }> = {};
    typicalCosts.forEach((c) => { init[c.name] = { on: !haveBills.has(normBill(c.name)), amt: String(c.amount) }; });
    setTyp(init); setTypSheet(true);
  }
  function addTypical() {
    const list = typicalCosts.filter((c) => typ[c.name]?.on && !haveBills.has(normBill(c.name))).map((c) => {
      const a = parseFloat((typ[c.name]?.amt ?? '').replace(',', '.'));
      return { ...c, amount: Number.isFinite(a) && a > 0 ? a : c.amount };
    });
    if (!list.length) { toast('Seleziona almeno un costo da aggiungere'); return; }
    const n = f.addBills(list);
    setTypSheet(false); toast(n === 1 ? 'Aggiunto 1 costo' : `Aggiunti ${n} costi`);
  }

  function addMov() {
    const amt = parseFloat(mvAmount.replace(',', '.'));
    if (!mvLabel.trim() || !Number.isFinite(amt) || amt <= 0 || hist == null) { toast('Inserisci descrizione e importo validi'); return; }
    f.addMovement(hist, { date: mvDate.trim() || shortDate(), label: mvLabel.trim(), amount: mvType === 'in' ? amt : -amt });
    setMvLabel(''); setMvAmount(''); setMvDate('');
    toast('Movimento aggiunto');
  }

  return (
    <Page id="lifefinance" title="LifeFinance" back>
      <FinTabs current="lifefinance" />

      <Card accent={color} onPress={() => setHist(0)} style={{ padding: 20 }}>
        <H>Panoramica finanziaria</H>
        <Row style={{ alignItems: 'flex-end' }}>
          <View>
            <Metric big>{formatCHF(end)}</Metric>
            <Text style={{ color: t.positive, fontSize: 13 }}>{net >= 0 ? '+' : '-'}{formatCHF(Math.abs(net))} questo mese</Text>
          </View>
          <Pressable onPress={() => setTrend(true)}>{endsChrono.length > 1 && <Spark data={endsChrono} w={140} h={60} pad={6} stroke={2.5} color={t.text} />}</Pressable>
        </Row>
        <Body small muted style={{ marginTop: 8 }}>Tocca per vedere tutti i movimenti · stipendio ed entrate/uscite · tocca il grafico per l'andamento mensile</Body>
      </Card>

      {alerts.length > 0 && (
        <Card accent={alerts.some((a) => a.level === 'over') ? t.danger : t.warn}>
          <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="alert" size={20} color={alerts.some((a) => a.level === 'over') ? t.danger : t.warn} /><H>Avvisi di budget</H></Row>
          {alerts.map((a, i) => (
            <Item key={a.category} last={i === alerts.length - 1}>
              <Body bold color={a.level === 'over' ? t.danger : t.warn}>{a.text}</Body>
              <Body small muted style={{ marginTop: 2 }}>{a.detail}</Body>
              <Progress value={Math.min(100, a.pct)} color={a.level === 'over' ? t.danger : t.warn} />
            </Item>
          ))}
        </Card>
      )}

      <Card>
        <Row><View style={{ flex: 1 }}><Body bold>Importa movimenti</Body><Body small muted>Da un CSV o estratto conto della tua banca</Body></View><Btn small ghost icon="plus" title="Importa CSV" onPress={() => setCsvSheet(true)} /></Row>
      </Card>

      <Card onPress={() => go('lifepointsPage')}>
        <H>LifePoints</H>
        <Row>
          <View style={{ flex: 1, alignItems: 'center' }}><Body small muted>Caricati in totale</Body><Row gap={2}><Body bold>{formatCHF(lpTop)}</Body><LpTag size={14} /></Row></View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: t.item }}><Body small muted>Spesi in totale</Body><Row gap={2}><Body bold>{formatCHF(lpSpent)}</Body><LpTag size={14} /></Row></View>
        </Row>
        <Body small muted style={{ marginTop: 10 }}>tocca per il dettaglio</Body>
      </Card>

      {f.insights.length > 0 && (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}><Icon name="alert" size={20} color={t.warn} /><Body style={{ flex: 1 }}>Puoi aumentare il risparmio del <Text style={{ fontWeight: '700' }}>12%</Text> riducendo le spese non essenziali.</Body></Row>
          <Btn small ghost style={{ marginTop: 10 }} title="Come?" onPress={() => setTips(true)} />
        </Card>
      )}

      <Card>
        <H>Consigli di LifeFinance</H>
        {f.insights.length === 0 && <Empty text="Nessun consiglio per ora: arriveranno quando ci saranno abbastanza movimenti." />}
        {f.insights.map((i) => i.dismissed ? (
          <Item key={i.id}><Row><Body small muted style={{ textDecorationLine: 'line-through' }}>{i.title}</Body><Text style={{ color: t.positive, fontSize: 13 }}>gestito <Text style={{ textDecorationLine: 'underline' }} onPress={() => { f.dismissInsight(i.id, false); toast('Ripristinato'); }}>annulla</Text></Text></Row></Item>
        ) : (
          <Item key={i.id}>
            <Body bold>{i.title}</Body>
            <Body small muted style={{ marginVertical: 4 }}>{i.detail}</Body>
            <Body small color={t.positive} style={{ marginBottom: 8 }}>Risparmi stimati: {i.saving}</Body>
            <Btn small ghost title="Segna come gestito" onPress={() => { f.dismissInsight(i.id, true); toast('Consiglio applicato'); }} />
          </Item>
        ))}
      </Card>

      <Card>
        <H>Spese mensili per categoria</H>
        <Body small muted style={{ marginBottom: 10 }}>{recent.length > 1 ? `Ripartizione sulla media degli ultimi ${recent.length} mesi chiusi` : closed.length ? 'Ripartizione dell\'ultimo mese chiuso' : 'Ripartizione del mese corrente'}</Body>
        <Row gap={18}>
          <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
            <Donut parts={catParts} holeColor={t.card} />
            <View style={{ position: 'absolute', alignItems: 'center' }}><Body small muted>Risparmio</Body><Body bold>{sr == null ? '—' : `${sr.toFixed(1)}%`}</Body></View>
          </View>
          <View style={{ flex: 1 }}>
            {catParts.map((c) => (
              <Row key={c.n} style={{ paddingVertical: 4 }}>
                <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={8}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.c }} /><Body small numberOfLines={1} style={{ flex: 1 }}>{c.n}</Body></Row>
                <Body small bold>{c.p}%</Body>
              </Row>
            ))}
          </View>
        </Row>
      </Card>

      <Card>
        <Toggle label={<Body bold style={{ fontSize: 17 }}>Fondo di emergenza</Body>} value={f.budget.saveToEmergency} onChange={(v) => {
          const alloc = v ? defaultBudget(f.budget.salary, true, f.categories, f.months).alloc['Fondo emergenza'] : 0;
          f.setBudget({ saveToEmergency: v, alloc: { ...f.budget.alloc, 'Fondo emergenza': alloc } });
          setBudgetKey((k) => k + 1);
          toast(v ? 'Fondo emergenza reinserito con la stima' : 'Fondo emergenza escluso dal piano del prossimo mese');
        }} />
        <Pressable onPress={() => setEf(true)}><Metric big>{formatCHF(efTotal)} CHF</Metric></Pressable>
        <Body small muted>Accantonato in tutti i mesi registrati · tocca il totale per il dettaglio · la spunta decide se accantonarci anche il prossimo mese</Body>
      </Card>

      <Card onPress={() => setGuide(true)}>
        <H>Quanto dovrebbero pesare le tue spese</H>
        <Body small muted>Linee guida generali in base allo stipendio (non è consulenza finanziaria) · tocca per vedere e modificare</Body>
      </Card>

      <Card>
        <Row><H>Bollette e abbonamenti</H><Btn small ghost title="+ Aggiungi" onPress={() => setBillSheet(true)} /></Row>
        <Btn small ghost icon="plus" title="Aggiungi costi tipici" style={{ marginBottom: 8 }} onPress={() => { openTyp(); }} />
        {f.bills.length === 0 ? <Body small muted>Nessuna bolletta ricorrente ancora.</Body> : f.bills.map((b, i) => (
          <Item key={b.id} last={i === f.bills.length - 1}>
            <Row><View style={{ flex: 1 }}><Body>{b.name}</Body><Body small muted>{b.freq === 'monthly' ? 'ogni mese' : 'ogni anno'}</Body></View><Body bold>{formatCHF(b.amount)} CHF</Body><XBtn onPress={() => { f.delBill(b.id); toast('Rimossa'); }} /></Row>
          </Item>
        ))}
        {recurring.length > 0 && (
          <View style={{ marginTop: 12, backgroundColor: t.item, borderRadius: 14, padding: 12 }}>
            <Body bold>Rilevate dai tuoi movimenti</Body>
            <Body small muted style={{ marginBottom: 6 }}>Pagamenti che si ripetono: aggiungili con un tocco.</Body>
            {recurring.slice(0, 6).map((r) => (
              <Row key={r.key} style={{ paddingVertical: 5 }}>
                <View style={{ flex: 1 }}><Body>{r.name}</Body><Body small muted>{formatCHF(r.amount)} CHF · {r.freq === 'monthly' ? 'ogni mese' : 'ogni anno'} · visto {r.count} volte</Body></View>
                <Btn small ghost title="Aggiungi" onPress={() => { const n = f.addBills([{ name: r.name, amount: r.amount, freq: r.freq }]); toast(n ? 'Aggiunta alle bollette' : 'Già presente'); }} />
              </Row>
            ))}
            {recurring.length > 1 && <Btn small style={{ marginTop: 8 }} title={`Aggiungi tutte (${Math.min(recurring.length, 6)})`} onPress={() => { const n = f.addBills(recurring.slice(0, 6).map((r) => ({ name: r.name, amount: r.amount, freq: r.freq }))); toast(n === 1 ? 'Aggiunta 1 bolletta' : `Aggiunte ${n} bollette`); }} />}
          </View>
        )}
        {f.bills.length > 0 && <Body small muted style={{ marginTop: 10 }}>Totale equivalente mensile: {formatCHF(Math.round(monthlyBills))} CHF</Body>}
      </Card>

      <Card>
        <Row><H>Pianifica il prossimo mese</H><Btn small ghost title="Reimposta" onPress={() => { f.resetBudget(); setBudgetKey((k) => k + 1); toast('Piano reimpostato con un residuo stimato'); }} /></Row>
        <Body small muted style={{ marginBottom: 10 }}>Residuo suggerito ~{formatCHF(buffer)} CHF, in base alla media degli ultimi 3 mesi. Se lo stipendio non è fisso, usa una media prevista.</Body>
        <Row style={{ marginBottom: 10 }}><Body small muted style={{ flex: 1 }}>Stipendio medio previsto</Body><Input key={`s${budgetKey}`} keyboardType="decimal-pad" defaultValue={String(f.budget.salary || '')} style={{ width: 120, marginBottom: 0 }} onChangeText={(v) => f.setBudget({ salary: parseFloat(v.replace(',', '.')) || 0 })} /></Row>
        {f.categories.map((c) => {
          const isEF = c.n === 'Fondo emergenza', disabled = isEF && !f.budget.saveToEmergency;
          const amt = disabled ? 0 : (f.budget.alloc[c.n] ?? 0);
          const pct = f.budget.salary > 0 ? (amt / f.budget.salary) * 100 : 0;
          const g = f.guidelines[c.n];
          return (
            <Item key={c.n + budgetKey} style={{ opacity: disabled ? 0.45 : 1 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'flex-start' }} gap={8}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.c }} /><Body>{c.n}</Body></Row>
                  {g ? <Body small muted>Consigliato: max {g}%</Body> : null}
                </View>
                <Input keyboardType="decimal-pad" editable={!disabled} defaultValue={String(amt)} style={{ width: 76, padding: 8, marginBottom: 0 }} onChangeText={(v) => { if (!disabled) f.setAlloc(c.n, parseFloat(v.replace(',', '.')) || 0); }} />
                <Body small color={g && pct > g ? t.danger : t.text} style={{ width: 44, textAlign: 'right' }}>{pct.toFixed(1)}%</Body>
              </Row>
            </Item>
          );
        })}
        <Item><Row><Body muted>Allocato</Body><Body bold>{formatCHF(allocated)} CHF</Body></Row></Item>
        <Item last><Row><Body muted>Rimanente dopo le spese</Body><Body bold color={remaining < 0 ? t.danger : t.positive}>{formatCHF(remaining)} CHF</Body></Row></Item>
      </Card>

      {/* movimenti */}
      <Sheet visible={m != null} title="Movimenti" onClose={() => setHist(null)}>
        {m && hist != null && (() => {
          const income = m.movements.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
          const expenses = -m.movements.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
          return (
            <>
              <Row>
                <Btn small ghost disabled={hist >= f.months.length - 1} icon="arrow-left" title="precedente" onPress={() => setHist(hist + 1)} />
                <Body small bold>{m.label}</Body>
                <Btn small ghost disabled={hist <= 0} icon="arrow-right" title="successivo" onPress={() => setHist(hist - 1)} />
              </Row>
              <Item><Row><Body muted>Saldo iniziale</Body><Body bold>{m.start.toFixed(2)} CHF</Body></Row></Item>
              {m.movements.map((mv, mi) => (
                <Item key={mi}>
                  <Row>
                    <Body style={{ flex: 1 }}>{mv.date} · {mv.label}</Body>
                    <Body bold color={mv.amount > 0 ? t.positive : t.danger}>{mv.amount > 0 ? '+' : ''}{mv.amount.toFixed(2)} CHF</Body>
                    {!m.locked && <XBtn onPress={() => { f.delMovement(hist, mi); toast('Movimento rimosso'); }} />}
                  </Row>
                </Item>
              ))}
              <Item><Row><Body muted>Entrate</Body><Body bold color={t.positive}>+{income.toFixed(2)} CHF</Body></Row></Item>
              <Item><Row><Body muted>Uscite</Body><Body bold color={t.danger}>-{expenses.toFixed(2)} CHF</Body></Row></Item>
              <Item last><Row><Body muted>Saldo finale</Body><Body bold>{monthEnd(m).toFixed(2)} CHF</Body></Row></Item>
              {m.locked ? <Body small muted style={{ marginTop: 10 }}>Mese storico, non modificabile.</Body> : (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', marginBottom: 6 }}><Pill label="Uscita" on={mvType === 'out'} onPress={() => setMvType('out')} /><Pill label="Entrata" on={mvType === 'in'} onPress={() => setMvType('in')} /></View>
                  <Input placeholder="Descrizione" value={mvLabel} onChangeText={setMvLabel} />
                  <Row><Input flex={1} keyboardType="decimal-pad" placeholder="Importo CHF" value={mvAmount} onChangeText={setMvAmount} /><Input placeholder="gg/mm" style={{ width: 78 }} value={mvDate} onChangeText={setMvDate} /></Row>
                  <Btn title="Aggiungi movimento" onPress={addMov} />
                </View>
              )}
            </>
          );
        })()}
      </Sheet>

      <Sheet visible={trend} title="Andamento mensile" onClose={() => setTrend(false)}>
        {endsChrono.length > 1 ? <LineChart data={endsChrono} /> : <Empty text="Servono almeno due mesi di dati per il grafico." />}
        <Body small muted style={{ marginVertical: 10 }}>Saldo a fine mese (CHF)</Body>
        {f.months.slice().reverse().map((mm, i, a) => { const n = monthNet(mm); return (
          <Item key={mm.label} last={i === a.length - 1}><Row><Body>{mm.label}</Body><Row gap={10}><Text style={{ color: n >= 0 ? t.positive : t.danger, fontSize: 13 }}>{n >= 0 ? '+' : ''}{formatCHF(n)}</Text><Body bold>{formatCHF(monthEnd(mm))} CHF</Body></Row></Row></Item>
        ); })}
      </Sheet>

      <Sheet visible={tips} title="Come risparmiare" onClose={() => setTips(false)}>
        {f.insights.filter((i) => !i.dismissed).length === 0 ? <Empty text="Hai già gestito tutti i consigli attivi." /> : f.insights.filter((i) => !i.dismissed).map((i) => (
          <Item key={i.id}><Body bold>{i.title}</Body><Body small muted style={{ marginTop: 4 }}>{i.detail} Risparmi stimati: {i.saving}.</Body></Item>
        ))}
      </Sheet>

      <Sheet visible={ef} title="Fondo di emergenza" onClose={() => setEf(false)}>
        <Metric big>{formatCHF(efTotal)} CHF</Metric>
        <Body small muted style={{ marginTop: 4, marginBottom: 14 }}>Totale accantonato in tutti i mesi registrati, calcolato dai movimenti di categoria "Fondo emergenza" in ciascun mese.</Body>
        {f.months.map((mm, i) => <Item key={mm.label} last={i === f.months.length - 1}><Row><Body>{mm.label}</Body><Body bold>{formatCHF(emergencyByMonth(mm))} CHF</Body></Row></Item>)}
      </Sheet>

      <Sheet visible={guide} title="Quanto dovrebbero pesare le tue spese" onClose={() => setGuide(false)}>
        <Row style={{ marginBottom: 12 }}><Body small muted style={{ flex: 1 }}>Entrate di questo mese</Body><Input keyboardType="decimal-pad" defaultValue={String(f.budget.salary || '')} style={{ width: 120, marginBottom: 0 }} onChangeText={(v) => f.setGuidelineSalary(parseFloat(v.replace(',', '.')) || 0)} /></Row>
        <Body small muted style={{ marginBottom: 10 }}>Percentuali guida generali (non è consulenza finanziaria), calcolate sulla cifra qui sopra: affitto max 30%, il resto suddiviso tra necessità e risparmio.</Body>
        {Object.entries(f.guidelines).map(([name, pct], i, a) => (
          <Item key={name} last={i === a.length - 1}><Row><Body>{name}</Body><Body bold>{formatCHF(f.budget.salary ? Math.round((f.budget.salary * pct) / 100) : 0)} CHF <Text style={{ color: t.muted, fontSize: 12 }}>({pct}%)</Text></Body></Row></Item>
        ))}
      </Sheet>

      <Sheet visible={typSheet} title="Costi tipici di una persona" onClose={() => setTypSheet(false)}>
        <Body small muted style={{ marginBottom: 8 }}>Valori indicativi per una persona sola in Svizzera (CHF). Spunta quelli che ti servono e correggi gli importi: quelli già presenti non vengono duplicati.</Body>
        {typicalCosts.map((c, i) => {
          const dup = haveBills.has(normBill(c.name));
          const st = typ[c.name] ?? { on: false, amt: String(c.amount) };
          return (
            <Item key={c.name} last={i === typicalCosts.length - 1} style={{ opacity: dup ? 0.5 : 1 }}>
              <Row>
                <Pressable disabled={dup} onPress={() => setTyp({ ...typ, [c.name]: { ...st, on: !st.on } })} accessibilityRole="checkbox" accessibilityState={{ checked: st.on && !dup, disabled: dup }} accessibilityLabel={c.name} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name={st.on && !dup ? 'checksquare' : 'square'} size={20} color={st.on && !dup ? t.positive : t.muted} />
                  <View style={{ flex: 1 }}><Body>{c.name}</Body><Body small muted>{dup ? 'già presente' : c.freq === 'monthly' ? 'ogni mese' : 'ogni anno'}</Body></View>
                </Pressable>
                <Input keyboardType="decimal-pad" editable={!dup} value={st.amt} onChangeText={(v) => setTyp({ ...typ, [c.name]: { ...st, amt: v } })} style={{ width: 84, padding: 8, marginBottom: 0 }} accessibilityLabel={`Importo ${c.name}`} />
              </Row>
            </Item>
          );
        })}
        <Btn style={{ marginTop: 14 }} title={`Aggiungi selezionati (${typicalCosts.filter((c) => typ[c.name]?.on && !haveBills.has(normBill(c.name))).length})`} onPress={addTypical} />
      </Sheet>

      <Sheet visible={billSheet} title="Nuova bolletta o abbonamento" onClose={() => setBillSheet(false)}>
        <Input placeholder="Nome (es. Affitto, Netflix…)" value={bName} onChangeText={setBName} />
        <Input keyboardType="decimal-pad" placeholder="Importo in CHF" value={bAmount} onChangeText={setBAmount} />
        <Select value={bFreq} options={['Ogni mese', 'Ogni anno']} onChange={(v) => setBFreq(v as typeof bFreq)} />
        <Btn title="Aggiungi" onPress={() => {
          const a = parseFloat(bAmount.replace(',', '.'));
          if (!bName.trim() || !Number.isFinite(a) || a <= 0) { toast('Compila nome e importo'); return; }
          f.addBill({ name: bName.trim(), amount: a, freq: bFreq === 'Ogni mese' ? 'monthly' : 'yearly' });
          setBName(''); setBAmount(''); setBillSheet(false); toast('Bolletta aggiunta');
        }} />
      </Sheet>
      <CsvImportSheet visible={csvSheet} onClose={() => setCsvSheet(false)} />
      <Tag>{''}</Tag>
    </Page>
  );
}
