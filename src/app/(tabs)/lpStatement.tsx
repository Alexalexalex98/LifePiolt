import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { LpTag } from '@/components/network';
import { Body, Btn, Card, Empty, H, Item, Page, Row, Seg } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { SOURCE_LABEL, WITHDRAW_FEE_PCT, buildStatement, statementText, yearRange, type LpSource } from '@/lib/lpStatement';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const n2 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Rendiconto LifePoints di un anno: tutto ciò che è stato guadagnato, usato nell'app e ritirato in denaro (commissione 5% solo sul ritiro). */
export default function LpStatement() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const moves = useNet((s) => s.lpMoves) ?? [];
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => [...new Set([thisYear, ...moves.map((m) => new Date(m.ts).getFullYear())])].sort((a, b) => b - a).slice(0, 5), [moves, thisYear]);
  const [year, setYear] = useState(thisYear);
  const { from, to } = yearRange(year);
  const s = useMemo(() => buildStatement(moves, from, to), [moves, from, to]);
  const all = useMemo(() => [...s.earned.items.map((m) => ({ ...m, sign: '+' })), ...s.spent.items.map((m) => ({ ...m, sign: '-' })), ...s.withdrawn.items.map((m) => ({ ...m, sign: '-' }))].sort((a, b) => b.ts - a.ts), [s]);
  const amount = (n: number, bold = true) => <Row gap={2}><Body bold={bold}>{n2(n)}</Body><LpTag size={13} /></Row>;
  const line = (label: string, n: number, last = false, bold = false, muted = false) => <Item last={last}><Row><Body bold={bold} muted={muted} style={{ flex: 1 }}>{label}</Body>{amount(n, bold)}</Row></Item>;

  async function share() {
    try { await Share.share({ message: statementText(s, year, me) }); } catch { toast('Non riesco a condividere il rendiconto'); }
  }

  return (
    <Page id="lpStatement" back title="Rendiconto LifePoints">
      <Body small muted style={{ marginBottom: 8 }}>Tutti i movimenti dell'anno scelto, da usare per la dichiarazione fiscale.</Body>
      <Seg options={years.map(String)} value={String(year)} onChange={(v) => setYear(Number(v))} />

      <Card>
        <H>Guadagnati</H>
        {(Object.keys(SOURCE_LABEL) as LpSource[]).filter((k) => s.earned.bySource[k] > 0).map((k) => line(SOURCE_LABEL[k], s.earned.bySource[k]))}
        {line('Totale guadagnato', s.earned.total, true, true)}
      </Card>

      <Card>
        <H>Usati nell'app</H>
        {line('Seminari, servizi, club e contributi', s.spent.total, true, true)}
      </Card>

      <Card>
        <H>Ritirati in denaro</H>
        {line('Ritirati', s.withdrawn.gross)}
        {line(`Commissione ${WITHDRAW_FEE_PCT}%`, s.withdrawn.fee, false, false, true)}
        {line('Importo netto accreditato', s.withdrawn.net, true, true)}
        <Body small muted style={{ marginTop: 8 }}>La commissione si applica solo al ritiro. I LifePoints non ritirati o spesi nell'app non hanno nessuna commissione.</Body>
      </Card>

      <Card>
        <H>Non ritirati</H>
        {line('Ancora sul conto, senza commissione', s.kept, true, true)}
      </Card>

      <Card>
        <H>Movimenti</H>
        {all.length === 0 ? <Empty text="Nessun movimento in questo anno." /> : all.map((m, i) => (
          <Item key={m.id} last={i === all.length - 1}>
            <Row>
              <View style={{ flex: 1 }}><Body>{m.label}</Body><Body small muted>{fmtDate(new Date(m.ts), { day: 'numeric', month: 'long', year: 'numeric' })}</Body></View>
              <Row gap={2}><Body bold color={m.sign === '+' ? t.positive : t.text}>{m.sign}{n2(m.amount)}</Body><LpTag size={13} /></Row>
            </Row>
          </Item>
        ))}
      </Card>

      <Btn icon="share" title="Condividi il rendiconto" onPress={share} />
      <Btn ghost style={{ marginTop: 8 }} icon="coin" title="Ritira LifePoints" onPress={() => go('withdraw')} />
      <Body small muted style={{ marginTop: 10 }}>Riepilogo generato dall'app dai tuoi movimenti: controllalo sempre con un consulente fiscale.</Body>
    </Page>
  );
}
