import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate, formatMoney } from '@/i18n/format';
import { t } from '@/i18n/core';
import { buildPlan, estimateFixedOutflows, estimateIncomes, type Advice, type PlanInput, type PlanResult } from '@/lib/bills/plan';
import { diffDays, mkIso, todayIso } from '@/lib/bills/dates';
import { STATUS_LABEL, type BillStatus, type Confidence } from '@/lib/bills/types';
import { readable } from '@/lib/a11y';
import { parseMonthLabel } from '@/lib/financeRecap';
import { Icon } from '@/lib/icons';
import { monthEnd, useFin, type FinMonth } from '@/store/finance';
import { currentCurrency } from '@/i18n/format';

export const money = (a: number, cur?: string) => formatMoney(a, { currency: cur ?? currentCurrency(), decimals: 2 });
const isoDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 12);
export const fmtDay = (iso?: string) => (iso ? fmtDate(isoDate(iso), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDayShort = (iso: string) => fmtDate(isoDate(iso), { day: 'numeric', month: 'short' });
export const fmtWeekday = (iso: string) => fmtDate(isoDate(iso), { weekday: 'short', day: 'numeric', month: 'short' });

/** "scade domani", "scaduta da 3 giorni"... (da usare dentro funzioni, mai a livello di modulo). */
export function dueText(daysToDue: number): string {
  if (daysToDue === 0) return t('scade oggi');
  if (daysToDue === 1) return t('scade domani');
  if (daysToDue > 1) return t('scade tra {0} giorni', daysToDue);
  if (daysToDue === -1) return t('scaduta ieri');
  return t('scaduta da {0} giorni', -daysToDue);
}

export function adviceText(a: Advice): string {
  switch (a.code) {
    case 'overdue_now': return t('E\' scaduta: paga appena puoi per evitare altri solleciti.');
    case 'tight': return t('Il margine per il bonifico e\' gia\' consumato: conviene pagare oggi.');
    case 'wait_income': return t('Il {0} e\' attesa un\'entrata: potresti pagare dopo, restando entro la scadenza.', fmtDayShort(a.date));
    case 'penalty_first': return t('Ha penali o interessi in caso di ritardo: pagala per prima.');
    case 'can_postpone': return t('Non ha penali dichiarate: se serve, puoi pagarla dopo le altre.');
    case 'split': return t('L\'importo e\' alto: puoi chiedere una rateizzazione e dividerla in rate.');
  }
}

/** Colori sobri dai token del tema per ogni stato. */
export function useStatusTone() {
  const th = useTheme();
  return (s: BillStatus): { fg: string; bg: string; icon: string } => {
    switch (s) {
      case 'scaduta': return { fg: th.danger, bg: th.dangerBg, icon: 'alert' };
      case 'in_scadenza': return { fg: readable(th.warn, th.chip), bg: th.chip, icon: 'clock' };
      case 'pagata': return { fg: th.positive, bg: th.positiveBg, icon: 'check' };
      case 'rateizzata': return { fg: readable(th.accent, th.chip), bg: th.chip, icon: 'repeat' };
      case 'contestata': return { fg: th.muted, bg: th.chip, icon: 'info' };
      default: return { fg: th.text, bg: th.chip, icon: 'circle' };
    }
  };
}

export function StatusPill({ status }: { status: BillStatus }) {
  const tone = useStatusTone()(status);
  return (
    <View accessible accessibilityLabel={t('Stato: {0}', t(STATUS_LABEL[status]))} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: status === 'contestata' ? 1 : 0, borderColor: tone.fg }}>
      <Icon name={tone.icon} size={12} color={tone.fg} stroke={2.2} />
      <Text style={{ color: tone.fg, fontSize: 12, fontWeight: '700' }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

/** Confidenza di un campo letto: testo + icona, non solo colore. */
export function ConfBadge({ level }: { level: Confidence }) {
  const th = useTheme();
  const map: Record<Confidence, { label: string; fg: string; icon: string }> = {
    alta: { label: 'Alta', fg: th.positive, icon: 'check' },
    media: { label: 'Media', fg: readable(th.warn, th.chip), icon: 'info' },
    bassa: { label: 'Bassa', fg: th.danger, icon: 'alert' },
  };
  const m = map[level];
  return (
    <View accessible accessibilityLabel={t('Confidenza {0}', t(m.label))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: th.chip, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Icon name={m.icon} size={11} color={m.fg} stroke={2.4} />
      <Text style={{ color: m.fg, fontSize: 11, fontWeight: '700' }}>{m.label}</Text>
    </View>
  );
}

/** Riga di origine con la parte riconosciuta evidenziata. */
export function SourceLine({ source, match }: { source: string; match?: string }) {
  const th = useTheme();
  const i = match ? source.toLowerCase().indexOf(match.toLowerCase()) : -1;
  return (
    <Row gap={6} style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
      <Icon name="file" size={12} color={th.muted} stroke={1.9} />
      <Text style={{ color: th.muted, fontSize: 12, lineHeight: 17, flexShrink: 1 }}>
        {i >= 0 && match ? (
          <>
            {source.slice(0, i)}
            <Text style={{ backgroundColor: th.mode === 'light' ? '#fde9a8' : '#4a3d10', color: th.text, fontWeight: '700' }}>{source.slice(i, i + match.length)}</Text>
            {source.slice(i + match.length)}
          </>
        ) : source}
      </Text>
    </Row>
  );
}

export function Note({ icon = 'info', tone, children }: { icon?: string; tone?: 'warn' | 'danger' | 'muted'; children: string }) {
  const th = useTheme();
  const c = tone === 'danger' ? th.danger : tone === 'warn' ? readable(th.warn, th.card) : th.muted;
  return (
    <Row gap={8} style={{ alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 6 }}>
      <Icon name={icon} size={15} color={c} stroke={2} />
      <Body small color={c} style={{ flex: 1 }}>{children}</Body>
    </Row>
  );
}

// ---------------------------------------------------------------- dati per il piano

const mvIso = (months: FinMonth[]) => months.flatMap((m) => {
  const p = parseMonthLabel(m.label);
  if (!p) return [];
  return m.movements.flatMap((x) => {
    const mt = /(\d{1,2})\/(\d{1,2})/.exec(x.date);
    if (!mt) return [];
    const mo = +mt[2], d = +mt[1];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return [];
    return [{ date: mkIso(p.y, mo, d), amount: x.amount, label: x.label }];
  });
});

/** Costruisce l'ingresso del piano dai dati finanziari del telefono (saldo, entrate stimate, spese fisse stimate). */
export function usePlanInput(today: string): PlanInput {
  const invoices = useFin((s) => s.invoices);
  const months = useFin((s) => s.months);
  const bills = useFin((s) => s.bills);
  const prefs = useFin((s) => s.billPrefs);
  const salary = useFin((s) => s.budget.salary);
  return useMemo(() => {
    const cur = months[0];
    const balance = cur ? monthEnd(cur) : 0;
    let incomes: { date: string; amount: number }[] = estimateIncomes(mvIso(months), today);
    if (!incomes.length && salary > 0) {
      incomes = [0, 1, 2].map((k) => { const m = ((+today.slice(5, 7) - 1 + k) % 12) + 1, y = +today.slice(0, 4) + Math.floor((+today.slice(5, 7) - 1 + k) / 12); return { date: mkIso(y, m, 25), amount: salary }; }).filter((x) => diffDays(today, x.date) >= 0);
    }
    const labels = (cur?.movements ?? []).map((x) => x.label);
    return { invoices, today, balance, currency: currentCurrency(), incomes, fixedOutflows: estimateFixedOutflows(bills, labels, today), prefs };
  }, [invoices, months, bills, prefs, salary, today]);
}

export function usePlan(): { today: string; input: PlanInput; plan: PlanResult } {
  const today = todayIso();
  const input = usePlanInput(today);
  const plan = useMemo(() => buildPlan(input), [input]);
  return { today, input, plan };
}
