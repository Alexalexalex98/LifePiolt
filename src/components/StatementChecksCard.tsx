import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import { listMovements } from '@/lib/explain';
import { findChecks, otherCandidates } from '@/lib/statementChecks';
import { useFin } from '@/store/finance';
import { toast } from '@/store/toast';

const CLASSES = ['Affitto', 'Cassa malati e assicurazioni', 'Mutuo', 'Prestiti e leasing', 'Telefono e internet', 'Energia e acqua', 'Trasporti', 'Abbonamenti', 'Tasse e imposte', 'Cibo', 'Ristoranti e bar'];

/** Dove i dati non bastano per essere certi, l'app chiede: più casse malati o stipendi (nucleo familiare, conto unico, cambio fornitore/lavoro), voci grandi in «Altro». */
export function useStatementChecks() {
  const f = useFin();
  const info = f.statementInfo;
  if (!info) return { checks: [], other: [], rows: [] as { date: string; label: string; amount: number }[] };
  const rows = listMovements(f.months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount }));
  const checks = findChecks({ rows, fixed: info.fixed.map((x) => ({ name: x.name, key: x.key, cls: x.cls, monthly: x.monthly })), incomes: info.salary.sources, answers: f.checks ?? {}, tr: tl });
  const totalVar = info.variable.reduce((a, v) => a + v.total, 0);
  const altro = info.variable.find((v) => v.name === 'Altro');
  const other = altro && totalVar > 0 && altro.total / totalVar > 0.25 ? otherCandidates(rows) : [];
  return { checks, other, rows };
}

export function StatementChecksCard() {
  const t = useTheme();
  const f = useFin();
  const { checks, other } = useStatementChecks();
  const [openOther, setOpenOther] = useState(false);
  if (!checks.length && !other.length) return null;
  return (
    <>
      <Card accent={t.warn}>
        <H>Da confermare</H>
        <Body small muted style={{ marginTop: 4 }}>Nell'estratto ci sono cose che non posso sapere da sola. Dimmi come stanno: finché non rispondi i conti qui sotto potrebbero non essere giusti.</Body>
        {checks.map((c) => (
          <View key={c.id} style={{ marginTop: 12, gap: 6 }}>
            <Body bold>{c.text}</Body>
            {c.options.map((o) => <Btn key={o.answer} small ghost title={o.label} onPress={() => { f.answerCheck(c.id, o.answer, o.effect); toast('Fatto, ricalcolo'); }} />)}
          </View>
        ))}
        {other.length ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            <Body bold>«Altro» pesa molto sulle tue spese. Dimmi cosa sono le voci più grandi.</Body>
            <Btn small ghost title="Assegna le voci" onPress={() => setOpenOther(true)} />
          </View>
        ) : null}
      </Card>
      <Sheet visible={openOther} title="Cosa sono queste spese?" onClose={() => setOpenOther(false)}>
        <View style={{ gap: 12 }}>
          {other.map((o) => (
            <View key={o.key} style={{ gap: 6 }}>
              <Row><Body bold style={{ flex: 1 }} numberOfLines={2}>{o.name}</Body><Body bold>{formatMoney(o.total)}</Body></Row>
              <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {CLASSES.map((c) => <Pill key={c} label={c} on={f.payeeFix?.[o.key]?.cls === c} onPress={() => { f.setPayeeFix(o.key, { ...(f.payeeFix?.[o.key] ?? {}), cls: c }); toast('Fatto, ricalcolo'); }} />)}
              </Row>
            </View>
          ))}
          {!other.length ? <Body muted>Tutto assegnato.</Body> : null}
        </View>
      </Sheet>
    </>
  );
}
