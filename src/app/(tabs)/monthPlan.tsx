import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FixedEditSheet } from '@/components/FixedEditSheet';
import { pickClubFile } from '@/components/club/pickFile';
import { askSend, logSend } from '@/lib/aiConsent';
import { aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { CONTRACT_PROMPT, parseContract, type ContractRead } from '@/lib/contractParse';
import { Body, Btn, Card, H, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { listMovements } from '@/lib/explain';
import { addMonths, buildMonthPlan, monthsNeeded, spreadOver, type IncomeMode } from '@/lib/monthPlan';
import { findPlanChecks } from '@/lib/monthPlanChecks';
import { staleDays } from '@/lib/statementChecks';
import { monthName } from '@/lib/vacationPlan';
import { moveKey } from '@/lib/financeCalc';
import { useFin, type StatementInfo } from '@/store/finance';
import { useMonthPlan } from '@/store/monthPlan';
import { toast } from '@/store/toast';

const num = (s: string) => { const n = Number(s.replace(/['\s]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const ymNow = () => new Date().toISOString().slice(0, 7);
const MODES: { m: IncomeMode; label: string }[] = [{ m: 'fixed', label: 'Stipendio fisso' }, { m: 'hourly', label: 'A ore' }, { m: 'commission', label: 'A percentuale' }];

/** Piano del mese: entrata prevista − spese fisse − soldi da mettere da parte = quanto resta da vivere. Tutto modificabile; ciò che non so, lo chiedo. */
export default function MonthPlan() {
  const th = useTheme();
  const f = useFin();
  const mp = useMonthPlan();
  const info = f.statementInfo;
  const ym = ymNow();
  const today = new Date();
  const daysLeft = Math.max(1, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1);
  const [fx, setFx] = useState<StatementInfo['fixed'][number] | null>(null);
  const [newFixed, setNewFixed] = useState<{ name: string; amount: string } | null>(null);
  const [goalSheet, setGoalSheet] = useState<{ name: string; total: string; ym: string; saved: string; kind: 'vacation' | 'purchase' | 'other' } | null>(null);
  const [contract, setContract] = useState<ContractRead | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [planSheet, setPlanSheet] = useState<{ name: string; total: string; months: string; perMonth: string } | null>(null);

  const rows = useMemo(() => listMovements(f.months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount })), [f.months]);
  const inc = mp.income;
  const fixedLines = [
    ...(info?.fixed ?? []).map((x) => ({ label: x.name, amount: x.monthly })),
    ...mp.extraFixed.map((x) => ({ label: x.name, amount: x.amount })),
  ];
  const plan = buildMonthPlan({ ym, income: inc, fixed: fixedLines, goals: mp.goals, plans: mp.plans, daysLeft });
  const checks = useMemo(() => findPlanChecks({ rows, monthlyIncome: plan.income.total || info?.salary.monthly || 0, answers: mp.answers, setAside: plan.setAsideTotal, today: today.toISOString().slice(0, 10), savingsHint: mp.savingsAccount, tr: tl }), [rows, plan.income.total, plan.setAsideTotal, mp.answers, mp.savingsAccount]);
  const tone = plan.status === 'ok' ? th.positive : plan.status === 'stretto' ? th.warn : th.danger;
  const verdict = plan.status === 'ok' ? 'Il mese quadra' : plan.status === 'stretto' ? 'Quadra, ma con poco margine' : plan.status === 'in-rosso' ? 'Così non quadra: le uscite superano l\'entrata' : 'Dimmi quanto entra: senza non posso calcolare';

  const answerCheck = (c: (typeof checks)[number], a: string) => {
    mp.answer(c.id, a);
    if (c.kind === 'refund' && a === 'refund') {
      f.months.forEach((m) => m.movements.forEach((x) => { if (x.amount === c.data.amount && x.label.includes(c.data.label ?? '#')) f.setMoveKind(moveKey(m.label, x), 'refund'); }));
      f.recomputeStatement();
    }
    if (c.kind === 'duplicate' && a === 'error') {
      let done = false;
      f.months.forEach((m, mi) => { const idx = m.movements.map((x, vi) => ({ x, vi })).filter(({ x }) => x.amount === -(c.data.amount ?? 0) && x.label.includes(c.data.label ?? '#')); if (!done && idx.length >= 2) { f.delMovement(mi, idx[1]!.vi); done = true; } });
    }
    if (c.kind === 'lumpy' && a === 'spread') setPlanSheet({ name: c.data.label ?? 'Fattura', total: String(c.data.amount ?? ''), months: '6', perMonth: '' });
    toast('Fatto, ricalcolo');
  };

  const scanContract = async () => {
    if (!aiServerConfigured) { toast('Per leggere il contratto serve l\'AI collegata: scrivi tu i dati qui sotto'); return; }
    try {
      const file = await pickClubFile('pdf'); if (!file) return;
      if (!(await askSend('files', file.fileName))) { toast('Non invio il contratto: scrivi tu i dati'); return; }
      setScanBusy(true); logSend('files', file.size ?? 0, [file.mime ?? 'application/pdf']);
      const reply = await aiReadFiles(CONTRACT_PROMPT, [{ uri: file.uri, mime: file.mime ?? 'application/pdf' }]);
      const r = parseContract(reply);
      if (!r) toast('Non sono riuscita a leggere il contratto: scrivi tu i dati'); else setContract(r);
    } catch (e) { toast(e instanceof Error ? e.message : 'Lettura non riuscita'); } finally { setScanBusy(false); }
  };

  const ps = planSheet ? { total: num(planSheet.total), months: Math.max(1, Math.round(num(planSheet.months))), perMonth: num(planSheet.perMonth) } : null;
  const psMonths = ps ? (ps.perMonth > 0 ? monthsNeeded(ps.total, ps.perMonth) : ps.months) : 0;
  const psSchedule = ps && ps.total > 0 && Number.isFinite(psMonths) ? spreadOver(ps.total, psMonths, addMonths(ym, 1)) : [];

  return (
    <Page id="monthPlan" back title="Piano del mese">
      <Body small muted style={{ marginBottom: 8 }}>Quanto entra, cosa è già impegnato, cosa metti da parte e cosa ti resta da vivere. Sono stime da te correggibili: se qualcosa è sbagliato, cambialo.</Body>

      <Card accent={tone}>
        <H>{`${tl('Piano di')} ${monthName(ym)}`}</H>
        <Row style={{ marginTop: 6 }}><Body style={{ flex: 1 }}>Entrata prevista</Body><Body bold color={th.positive}>{formatMoney(plan.income.total)}</Body></Row>
        <Row><Body style={{ flex: 1 }}>Spese fisse</Body><Body bold>{`−${formatMoney(plan.fixedTotal)}`}</Body></Row>
        <Row><Body style={{ flex: 1 }}>Da mettere da parte</Body><Body bold>{`−${formatMoney(plan.setAsideTotal)}`}</Body></Row>
        <View style={{ height: 1, backgroundColor: th.border, marginVertical: 8 }} />
        <Row><Body bold style={{ flex: 1 }}>Ti restano da vivere</Body><Body bold color={plan.free >= 0 ? th.positive : th.danger}>{formatMoney(plan.free)}</Body></Row>
        {plan.income.total > 0 ? <Body small muted>{`${tl(verdict)}. ${plan.free > 0 ? tl('Sono circa {0} al giorno per i {1} giorni che restano.', formatMoney(plan.perDay), daysLeft) : ''}`}</Body> : <Body small color={th.warn}>{tl(verdict)}</Body>}
        {plan.setAsideTotal > 0 ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            <Body small bold>{`${tl('Appena arriva lo stipendio sposta {0}', formatMoney(plan.setAsideTotal))}${mp.savingsAccount ? ` ${tl('su')} «${mp.savingsAccount}»` : ''}.`}</Body>
            <Body small muted>Mettili su un conto a parte oppure prelevali in contanti: così hai la certezza di non spenderli. Il mese dopo controllo se lo spostamento c'è.</Body>
            <Input value={mp.savingsAccount} onChangeText={mp.setSavingsAccount} placeholder="Dove li metti? (es. Conto risparmio, contanti)" />
          </View>
        ) : null}
      </Card>

      {(() => { const d = staleDays(rows, today.toISOString().slice(0, 10)); return d != null && d > 30 ? <Card accent={th.warn}><Body small color={th.warn}>{tl('L\'ultimo movimento dell\'estratto risale a {0} giorni fa: i calcoli non sono aggiornati. Carica un estratto recente da LifeFinance.', d)}</Body></Card> : null; })()}
      {checks.length ? (
        <Card accent={th.warn}>
          <H>Da confermare</H>
          {checks.map((c) => (
            <View key={c.id} style={{ marginTop: 10, gap: 6 }}>
              <Body bold>{c.text}</Body>
              {c.options.map((o) => <Btn key={o.answer} small ghost title={o.label} onPress={() => answerCheck(c, o.answer)} />)}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <H>Quanto entra</H>
        <Body small muted style={{ marginTop: 4 }}>Scegli come guadagni. Puoi anche scrivere direttamente quanto dovrebbe arrivare il mese prossimo.</Body>
        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 8 }}>
          {MODES.map((x) => <Pill key={x.m} label={x.label} on={(inc?.mode ?? 'fixed') === x.m} onPress={() => mp.patchIncome({ mode: x.m })} />)}
        </Row>
        <View style={{ gap: 6, marginTop: 8 }}>
          {(inc?.mode ?? 'fixed') === 'fixed' ? <Field label="Stipendio netto al mese" v={inc?.amount} on={(n) => mp.patchIncome({ amount: n })} hint={info?.salary.monthly ? String(Math.round(info.salary.monthly)) : ''} /> : null}
          {inc?.mode === 'hourly' ? <><Field label="Ore del mese" v={inc.hours} on={(n) => mp.patchIncome({ hours: n })} /><Field label="Paga oraria netta" v={inc.rate} on={(n) => mp.patchIncome({ rate: n })} /></> : null}
          {inc?.mode === 'commission' ? <><Field label="Parte fissa (se c'è)" v={inc.amount} on={(n) => mp.patchIncome({ amount: n })} /><Field label="Incasso su cui si calcola" v={inc.revenue} on={(n) => mp.patchIncome({ revenue: n })} /><Field label="Percentuale %" v={inc.pct} on={(n) => mp.patchIncome({ pct: n })} /></> : null}
          <Field label="Straordinari: ore (facoltativo)" v={inc?.overtimeHours} on={(n) => mp.patchIncome({ overtimeHours: n })} />
          <Field label="Straordinari: paga oraria" v={inc?.overtimeRate} on={(n) => mp.patchIncome({ overtimeRate: n })} />
          <Field label="Tredicesima / bonus, quota mensile (facoltativo)" v={inc?.extra} on={(n) => mp.patchIncome({ extra: n })} />
          <Field label="Quanto arriverà davvero il mese prossimo (se lo sai)" v={inc?.manualNext} on={(n) => mp.patchIncome({ manualNext: n || undefined })} />
        </View>
        {plan.income.lines.map((l) => <Body key={l.label} small muted>{`${tl(l.label)}: ${formatMoney(l.amount)}`}</Body>)}
        <Btn small ghost icon="camera" style={{ marginTop: 8 }} title={scanBusy ? 'Leggo il contratto…' : 'Leggi il contratto di lavoro'} disabled={scanBusy} onPress={() => void scanContract()} />
        {contract ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            <Body small bold>Ho letto questo: controlla e confermalo, puoi cambiare tutto.</Body>
            {contract.notes.map((x) => <Body key={x} small muted>{x}</Body>)}
            <Btn small title="Usa questi dati" onPress={() => { mp.setIncome(contract.model); setContract(null); toast('Dati inseriti: controllali qui sotto'); }} />
          </View>
        ) : null}
        <Body small muted style={{ marginTop: 4 }}>L'AI può sbagliare: verifica gli importi sul contratto o sulla busta paga.</Body>
        {info?.salary.monthly && !inc ? <Btn small ghost style={{ marginTop: 8 }} title={`${tl('Usa la media dell\'estratto')} (${formatMoney(info.salary.monthly)})`} onPress={() => mp.setIncome({ mode: 'fixed', amount: Math.round(info.salary.monthly) })} /> : null}
      </Card>

      <Card>
        <H>Spese fisse</H>
        <Body small muted style={{ marginTop: 4 }}>Dall'estratto: tocca una voce per cambiarla (se hai cambiato cassa malati o altro, correggi l'importo o aggiungi la nuova e togli la vecchia).</Body>
        {(info?.fixed ?? []).map((x) => (
          <Row key={x.key} style={{ paddingVertical: 6 }}>
            <Body style={{ flex: 1, flexShrink: 1 }} numberOfLines={2}>{x.name}</Body>
            <Body bold style={{ flexShrink: 0, marginHorizontal: 8 }}>{formatMoney(x.monthly)}</Body>
            <Btn small ghost icon="edit" title="" label="Modifica" onPress={() => setFx(x)} />
          </Row>
        ))}
        {mp.extraFixed.map((x) => (
          <Row key={x.id} style={{ paddingVertical: 6 }}>
            <Body style={{ flex: 1, flexShrink: 1 }} numberOfLines={2}>{x.name}</Body>
            <View style={{ width: 90 }}><Input value={String(x.amount)} onChangeText={(v) => mp.patchExtraFixed(x.id, { amount: num(v) })} keyboardType="numeric" /></View>
            <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => mp.delExtraFixed(x.id)} />
          </Row>
        ))}
        <Btn small ghost style={{ marginTop: 8 }} icon="plus" title="Aggiungi una spesa fissa" onPress={() => setNewFixed({ name: '', amount: '' })} />
        <Row style={{ marginTop: 8 }}><Body bold style={{ flex: 1 }}>Totale</Body><Body bold>{formatMoney(plan.fixedTotal)}</Body></Row>
      </Card>

      <Card>
        <H>Da mettere da parte</H>
        <Body small muted style={{ marginTop: 4 }}>Vacanze, acquisti, o una fattura grossa distribuita su più mesi. L'importo del mese lo calcolo io.</Body>
        {mp.goals.map((g) => (
          <Row key={g.id} style={{ paddingVertical: 6 }}>
            <View style={{ flex: 1, flexShrink: 1 }}><Body bold numberOfLines={2}>{g.name}</Body><Body small muted>{`${formatMoney(g.total)} ${tl('entro')} ${monthName(g.targetYm)}${g.saved ? ` · ${tl('già messi')} ${formatMoney(g.saved)}` : ''}`}</Body></View>
            <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => mp.delGoal(g.id)} />
          </Row>
        ))}
        {mp.plans.map((p) => (
          <Row key={p.id} style={{ paddingVertical: 6 }}>
            <View style={{ flex: 1, flexShrink: 1 }}><Body bold numberOfLines={2}>{p.name}</Body><Body small muted>{`${formatMoney(p.total)} ${tl('in')} ${p.months} ${tl('mesi da')} ${monthName(p.startYm)}`}</Body></View>
            <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => mp.delPlan(p.id)} />
          </Row>
        ))}
        <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <Btn small ghost icon="plus" title="Obiettivo (vacanza, acquisto)" onPress={() => setGoalSheet({ name: '', total: '', ym: addMonths(ym, 3), saved: '', kind: 'purchase' })} />
          <Btn small ghost icon="plus" title="Distribuisci una fattura" onPress={() => setPlanSheet({ name: '', total: '', months: '6', perMonth: '' })} />
        </Row>
      </Card>

      <FixedEditSheet item={fx} onClose={() => setFx(null)} />

      <Sheet visible={!!newFixed} title="Nuova spesa fissa" onClose={() => setNewFixed(null)}>
        {newFixed ? <View style={{ gap: 8 }}>
          <Input value={newFixed.name} onChangeText={(v) => setNewFixed({ ...newFixed, name: v })} placeholder="Nome (es. Nuova cassa malati)" />
          <Input value={newFixed.amount} onChangeText={(v) => setNewFixed({ ...newFixed, amount: v })} placeholder="Importo al mese" keyboardType="numeric" />
          <Btn title="Aggiungi" onPress={() => { const n = num(newFixed.amount); if (!newFixed.name.trim() || n <= 0) { toast('Scrivi nome e importo'); return; } mp.addExtraFixed(newFixed.name.trim(), n); setNewFixed(null); }} />
        </View> : null}
      </Sheet>

      <Sheet visible={!!goalSheet} title="Nuovo obiettivo" onClose={() => setGoalSheet(null)}>
        {goalSheet ? <View style={{ gap: 8 }}>
          <Input value={goalSheet.name} onChangeText={(v) => setGoalSheet({ ...goalSheet, name: v })} placeholder="Per cosa (es. Vacanza in Grecia)" />
          <Input value={goalSheet.total} onChangeText={(v) => setGoalSheet({ ...goalSheet, total: v })} placeholder="Quanto ti serve" keyboardType="numeric" />
          <Input value={goalSheet.saved} onChangeText={(v) => setGoalSheet({ ...goalSheet, saved: v })} placeholder="Già messo da parte (facoltativo)" keyboardType="numeric" />
          <Body small bold>In che mese ti serve</Body>
          <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{Array.from({ length: 13 }, (_, i) => addMonths(ym, i + 1)).map((m) => <Pill key={m} label={monthName(m)} on={goalSheet.ym === m} onPress={() => setGoalSheet({ ...goalSheet, ym: m })} />)}</Row>
          <Btn title="Aggiungi" onPress={() => { const n = num(goalSheet.total); if (!goalSheet.name.trim() || n <= 0) { toast('Scrivi nome e importo'); return; } mp.addGoal({ name: goalSheet.name.trim(), kind: goalSheet.kind, total: n, targetYm: goalSheet.ym, saved: num(goalSheet.saved) || undefined }); setGoalSheet(null); }} />
        </View> : null}
      </Sheet>

      <Sheet visible={!!planSheet} title="Distribuisci una fattura" onClose={() => setPlanSheet(null)}>
        {planSheet && ps ? <View style={{ gap: 8 }}>
          <Body small muted>La fattura la paghi quando scade; qui metti da parte un po' ogni mese così il giorno del pagamento hai già i soldi.</Body>
          <Input value={planSheet.name} onChangeText={(v) => setPlanSheet({ ...planSheet, name: v })} placeholder="Che fattura è (es. Imposte, Assicurazione)" />
          <Input value={planSheet.total} onChangeText={(v) => setPlanSheet({ ...planSheet, total: v })} placeholder="Importo totale" keyboardType="numeric" />
          <Body small bold>In quanti mesi</Body>
          <Input value={planSheet.months} onChangeText={(v) => setPlanSheet({ ...planSheet, months: v, perMonth: '' })} keyboardType="numeric" />
          <Body small muted>Oppure dimmi quanto puoi mettere da parte al mese e calcolo io i mesi necessari:</Body>
          <Input value={planSheet.perMonth} onChangeText={(v) => setPlanSheet({ ...planSheet, perMonth: v })} placeholder="Importo al mese (facoltativo)" keyboardType="numeric" />
          {psSchedule.length ? <Body small muted>{`${psSchedule.length} ${tl('mesi')}: ${psSchedule.slice(0, 4).map((x) => `${monthName(x.ym)} ${formatMoney(x.amount)}`).join(', ')}${psSchedule.length > 4 ? '…' : ''}`}</Body> : null}
          <Btn title="Crea il piano" onPress={() => { if (!planSheet.name.trim() || ps.total <= 0 || !Number.isFinite(psMonths)) { toast('Scrivi nome, importo e mesi'); return; } mp.addPlan({ name: planSheet.name.trim(), total: ps.total, startYm: addMonths(ym, 1), months: psMonths }); setPlanSheet(null); toast('Piano creato'); }} />
        </View> : null}
      </Sheet>
    </Page>
  );
}

function Field({ label, v, on, hint }: { label: string; v?: number; on: (n: number) => void; hint?: string }) {
  return (
    <View>
      <Body small muted>{label}</Body>
      <Input value={v ? String(v) : ''} onChangeText={(s) => on(num(s))} placeholder={hint || '0'} keyboardType="numeric" />
    </View>
  );
}
