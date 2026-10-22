import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { InfoTip } from '@/components/InfoTip';
import { Body, Btn, Card, H, Input, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { monthName, vacationPlan, ymOf } from '@/lib/vacationPlan';
import { useFin } from '@/store/finance';
import { toast } from '@/store/toast';

const ymAdd = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return ymOf(d); };
const num = (s: string) => { const n = Number(s.replace(/['\s]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

/** Piano di risparmio per una vacanza (o altra spesa con scadenza): quanto mettere da parte ogni mese e da quale stipendio. Tutto calcolato dall'estratto, nessuna AI. */
export default function VacationPlan() {
  const t = useTheme();
  const st = useFin((s) => s.statementInfo);
  const saved = useFin((s) => s.vacation);
  const setVacation = useFin((s) => s.setVacation);
  const [name, setName] = useState(saved?.name ?? 'Vacanza');
  const [goal, setGoal] = useState(saved ? String(saved.goal) : '');
  const [target, setTarget] = useState(saved?.target ?? ymAdd(2));
  const [have, setHave] = useState(saved ? String(saved.saved) : '');
  const sum = (l: { monthly: number }[]) => l.reduce((a, x) => a + x.monthly, 0);
  const g = num(goal);
  const plan = useMemo(() => (st && g > 0 ? vacationPlan({ now: new Date(), goal: g, target, saved: num(have), incomes: st.salary.sources.map((x) => ({ name: x.name, monthly: x.monthly })), fixed: sum(st.fixed), variable: sum(st.variable) }) : null), [st, g, target, have]);
  const tone = plan?.status === 'ok' ? t.positive : plan?.status === 'stretto' ? t.warn : t.danger;
  const verdict = plan?.status === 'ok' ? 'Il tuo margine basta' : plan?.status === 'stretto' ? 'Basta, ma resta poco margine' : plan?.status === 'non-basta' ? 'Il margine non basta' : plan?.status === 'scaduta' ? 'Il mese è già passato' : 'Non riconosco gli stipendi';
  return (
    <Page id="vacationPlan" back title="Risparmio per la vacanza">
      <Card accent="#8fd6b0">
        <Row><H style={{ flex: 1 }}>Quanto ti serve, e per quando</H><InfoTip title="Come calcolo il piano" body={['Prendo dall\'estratto conto le entrate che tornano ogni mese (anche più di uno stipendio) e le spese fisse e variabili medie. Il margine è la differenza.', 'Divido quello che ti serve per i mesi che mancano, e se hai più stipendi ripartisco il risparmio in proporzione a quanto portano. Sono medie, non certezze: se cambiano, rifai il piano. Non è un consiglio finanziario.']} /></Row>
        {!st ? <Body small muted style={{ marginTop: 6 }}>Per calcolare il piano mi serve un estratto conto con gli stipendi: caricalo da LifeFinance.</Body> : null}
        <Body small bold style={{ marginTop: 10, marginBottom: 4 }}>Per cosa</Body>
        <Input value={name} onChangeText={setName} placeholder="Es. Vacanza in Grecia" />
        <Body small bold style={{ marginTop: 8, marginBottom: 4 }}>Quanto ti serve</Body>
        <Input value={goal} onChangeText={setGoal} placeholder="Es. 2000" keyboardType="numeric" />
        <Body small bold style={{ marginTop: 8, marginBottom: 6 }}>In che mese parti</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {Array.from({ length: 13 }, (_, i) => ymAdd(i)).map((ym) => <Pill key={ym} label={monthName(ym)} on={target === ym} onPress={() => setTarget(ym)} />)}
        </ScrollView>
        <Body small bold style={{ marginTop: 8, marginBottom: 4 }}>Hai già messo da parte (facoltativo)</Body>
        <Input value={have} onChangeText={setHave} placeholder="0" keyboardType="numeric" />
      </Card>

      {plan ? (
        <>
          <Card accent={tone}>
            <Row gap={10}><Icon name={plan.status === 'ok' ? 'check' : 'alert'} size={22} color={tone} stroke={2.6} /><H style={{ flex: 1, marginBottom: 0 }}>{tl(verdict)}</H></Row>
            {plan.status !== 'scaduta' && plan.perMonth > 0 ? (
              <>
                <Body style={{ marginTop: 8 }}>{tl('Metti da parte {0} al mese per {1} mesi, dallo stipendio di questo mese a quello prima della partenza.', formatCHF(plan.perMonth), plan.months)}</Body>
                <Body small muted style={{ marginTop: 4 }}>{tl('Entrate {0} al mese, margine {1}: il risparmio ne usa il {2}%.', formatCHF(plan.income), formatCHF(plan.margin), plan.sharePct)}</Body>
              </>
            ) : null}
            {plan.status === 'non-basta' ? <Body small style={{ marginTop: 6 }}>{plan.monthsNeeded ? tl('Con il margine di oggi servirebbero {0} mesi, oppure puoi scegliere un importo più basso: entro la data arrivi a {1}.', plan.monthsNeeded, formatCHF(plan.reachable)) : ''}</Body> : null}
            {plan.notes.map((n) => <Body key={n} small muted style={{ marginTop: 4 }}>{tl(n)}</Body>)}
          </Card>

          {plan.perSource.length > 1 ? (
            <Card>
              <H>Da quale stipendio</H>
              <Body small muted>Ho riconosciuto più entrate che tornano ogni mese: il risparmio è ripartito in proporzione.</Body>
              {plan.perSource.map((x) => <Row key={x.name} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{x.name}</Body><Body small muted>{tl('entra {0} al mese', formatCHF(x.monthly))}</Body></View><Body bold>{formatCHF(x.amount)}</Body></Row>)}
            </Card>
          ) : plan.perSource.length === 1 ? <Card><Body small muted>{tl('Entrata riconosciuta: {0}, {1} al mese.', plan.perSource[0].name, formatCHF(plan.perSource[0].monthly))}</Body></Card> : null}

          {plan.schedule.length ? (
            <Card>
              <H>Mese per mese</H>
              {plan.schedule.map((r) => <Row key={r.ym} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold style={{ textTransform: 'capitalize' }}>{r.label}</Body><Body small muted>{tl('totale messo da parte: {0}', formatCHF(r.cumulative))}</Body></View><Body bold>{formatCHF(r.amount)}</Body></Row>)}
            </Card>
          ) : null}
          <Btn icon="check" title={saved ? 'Aggiorna l\'obiettivo' : 'Salva come obiettivo'} onPress={() => { setVacation({ name: name.trim() || 'Vacanza', goal: g, target, saved: num(have) }); toast('Obiettivo salvato: puoi chiedere a Theia come sta andando'); }} />
        </>
      ) : null}
      {saved ? <Btn ghost danger title="Togli l'obiettivo" onPress={() => { setVacation(null); setGoal(''); setHave(''); toast('Obiettivo tolto'); }} /> : null}
    </Page>
  );
}
