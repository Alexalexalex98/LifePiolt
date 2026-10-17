import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Bar, Panel, SectionTitle } from '@/components/money/parts';
import { Text } from '@/components/T';
import { Body, Btn, Input, Pill, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { FACT_FIELDS, completeness, dcf, dcfGrid, metrics, pillars, typicalPe, type Facts } from '@/lib/markets/fundamentals';
import { fetchFacts, fundamentalsConfigured, useMarkets } from '@/store/markets';
import { toast } from '@/store/toast';

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
const fmt = (n: number | null, d = 2, suf = '') => (n === null ? '–' : `${n.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: d })}${suf}`);

/** Analisi fondamentale: dai dati di bilancio (scritti a mano o dal server) calcola multipli, pagelle e un valore stimato. */
export function Fundamentals({ sym, priceUsd, sector }: { sym: string; priceUsd: number; sector: string }) {
  const t = useTheme();
  const mk = useMarkets();
  const f: Facts = mk.facts[sym] ?? {};
  const [open, setOpen] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const [dg, setDg] = useState('8'), [dr, setDr] = useState('10'), [dtg, setDtg] = useState('2.5');
  const [busy, setBusy] = useState(false);
  const m = useMemo(() => metrics(priceUsd, f), [priceUsd, f]);
  const ps = useMemo(() => pillars(priceUsd, f, sector), [priceUsd, f, sector]);
  const c = completeness(f);
  const [lo, hi] = typicalPe(sector);
  const g = num(dg) ?? 0, r = num(dr) ?? 0, tg = num(dtg) ?? 0;
  const v = dcf(f.fcfps, g, r, tg, priceUsd);
  const grid = dcfGrid(f.fcfps, g, r, tg, priceUsd);
  const col = (s: number | null) => (s === null ? t.muted : s >= 66 ? t.positive : s >= 40 ? t.warn : t.danger);

  const load = async () => {
    setBusy(true);
    const got = await fetchFacts(sym);
    setBusy(false);
    if (got) { mk.setFact(sym, got); toast('Dati caricati'); } else toast('Il server dei dati di bilancio non è collegato o non ha questo titolo');
  };
  const cell = (label: string, value: string, note?: string) => (
    <View key={label} style={{ width: '48%', backgroundColor: t.chip, borderRadius: 16, padding: 12 }}>
      <Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: '900', fontSize: 17, marginTop: 3 }}>{value}</Text>
      {note ? <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 2 }}>{note}</Text> : null}
    </View>
  );

  return (
    <View>
      <SectionTitle>{tl('Analisi fondamentale')}</SectionTitle>
      <Panel>
        <Row><Text style={{ color: t.text, fontWeight: '800' }}>{tl('Dati di bilancio')}</Text><Text style={{ color: t.muted, fontWeight: '700' }}>{c.have} {tl('su')} {c.total}</Text></Row>
        <View style={{ marginVertical: 8 }}><Bar pct={(c.have / c.total) * 100} /></View>
        <Text style={{ color: t.muted, fontSize: 12.5, lineHeight: 18 }}>{tl('Gli utili e i bilanci non arrivano dalla fonte dei prezzi: non li inventiamo. Scrivi i dati che hai (dal bilancio, da un sito o da uno screenshot) e gli indicatori si calcolano da soli.')}</Text>
        <Row style={{ gap: 8, marginTop: 10, justifyContent: 'flex-start' }}>
          <Btn small title={showData ? tl('Nascondi i dati') : tl('Inserisci i dati')} onPress={() => setShowData((x) => !x)} />
          {fundamentalsConfigured ? <Btn small ghost title={busy ? tl('Carico…') : tl('Carica dal server')} onPress={() => void load()} disabled={busy} /> : null}
          {c.have ? <Btn small ghost title={tl('Azzera')} onPress={() => mk.clearFacts(sym)} /> : null}
        </Row>
        {showData ? (
          <View style={{ marginTop: 12 }}>
            {(['Valutazione', 'Redditività', 'Crescita', 'Solidità'] as const).map((grp) => (
              <View key={grp} style={{ marginBottom: 6 }}>
                <Text style={{ color: t.text, fontWeight: '800', marginVertical: 6 }}>{tl(grp)}</Text>
                {FACT_FIELDS.filter((x) => x.group === grp).map((x) => (
                  <View key={x.key} style={{ marginBottom: 6 }}>
                    <Text style={{ color: t.muted, fontSize: 12 }}>{tl(x.label)} · {tl(x.hint)}</Text>
                    <Input keyboardType="numbers-and-punctuation" defaultValue={f[x.key] !== undefined ? String(f[x.key]) : ''} onChangeText={(val) => mk.setFact(sym, { [x.key]: num(val) } as Facts)} placeholder="–" style={{ marginBottom: 0, marginTop: 2 }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </Panel>

      {/* pagelle */}
      <SectionTitle>{tl('Le quattro pagelle')}</SectionTitle>
      <View style={{ gap: 10 }}>
        {ps.map((p) => (
          <Press key={p.id} onPress={() => setOpen(open === p.id ? null : p.id)} accessibilityLabel={p.label} style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.border, padding: 16 }}>
            <Row><Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{tl(p.label)}</Text><Text style={{ color: col(p.score), fontWeight: '900' }}>{p.score === null ? '–' : `${p.score}/100`}</Text></Row>
            <View style={{ marginVertical: 8 }}><Bar pct={p.score ?? 0} color={col(p.score)} /></View>
            <Text style={{ color: t.muted, fontSize: 13 }}>{tl(p.verdict)}{p.used ? ` · ${p.used} ${tl('indicatori')}` : ''}</Text>
            {open === p.id ? <View style={{ marginTop: 8 }}>{p.points.length ? p.points.map((x, i) => <Text key={i} style={{ color: t.text, marginTop: 4, lineHeight: 19 }}>• {x}</Text>) : <Text style={{ color: t.muted }}>{tl('Inserisci i dati di questa area per vedere la pagella.')}</Text>}</View> : null}
          </Press>
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 8, lineHeight: 16 }}>{tl('Le pagelle dicono dove il bilancio è forte o debole: non sono un voto al titolo né un consiglio.')}</Text>

      {/* multipli */}
      <SectionTitle>{tl('Indicatori di bilancio')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
        {cell('P/E', fmt(m.pe, 1), m.pe === null ? undefined : `${tl('tipico del settore')} ${lo}–${hi}`)}
        {cell(tl('Rendimento degli utili'), fmt(m.earningsYield, 1, '%'))}
        {cell('P/B', fmt(m.pb, 1))}
        {cell(tl('Prezzo/flusso di cassa'), fmt(m.pfcf, 1))}
        {cell(tl('Dividendo'), fmt(m.divYield, 1, '%'), m.payout === null ? undefined : `${tl('distribuisce')} ${fmt(m.payout, 0, '%')} ${tl('degli utili')}`)}
        {cell('PEG', fmt(m.peg, 1), m.peg === null ? undefined : m.peg < 1 ? tl('sotto 1: economico rispetto alla crescita') : m.peg > 2 ? tl('sopra 2: caro rispetto alla crescita') : tl('equilibrato'))}
        {cell(tl('Margine netto'), fmt(m.netMargin, 1, '%'))}
        {cell(tl('Margine operativo'), fmt(m.opMargin, 1, '%'))}
        {cell('ROE', fmt(m.roe, 1, '%'))}
        {cell(tl('Debito/capitale'), fmt(m.debtEquity, 2))}
        {cell(tl('Debito netto (mln)'), fmt(m.netDebt, 0), m.netDebt === null ? undefined : m.netDebt <= 0 ? tl('più liquidità che debiti') : undefined)}
        {cell(tl('Copertura interessi'), fmt(m.coverage, 1, 'x'))}
      </View>

      {/* valore stimato */}
      <SectionTitle>{tl('Quanto potrebbe valere')}</SectionTitle>
      <Panel>
        <Text style={{ color: t.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 10 }}>{tl('Stima del valore scontando i flussi di cassa dei prossimi anni. Il risultato dipende dalle ipotesi che scegli: cambiale e guarda come si muove.')}</Text>
        <Row style={{ gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: t.muted, fontSize: 11.5 }}>{tl('Crescita % 5 anni')}</Text><Input keyboardType="numbers-and-punctuation" value={dg} onChangeText={setDg} style={{ marginBottom: 0 }} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: t.muted, fontSize: 11.5 }}>{tl('Sconto %')}</Text><Input keyboardType="numbers-and-punctuation" value={dr} onChangeText={setDr} style={{ marginBottom: 0 }} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: t.muted, fontSize: 11.5 }}>{tl('Poi % annua')}</Text><Input keyboardType="numbers-and-punctuation" value={dtg} onChangeText={setDtg} style={{ marginBottom: 0 }} /></View>
        </Row>
        {v ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{tl('Valore stimato')} <Text style={{ fontWeight: '900' }}>{fmt(v.fair, 2)}</Text> {tl('contro un prezzo di')} <Text style={{ fontWeight: '900' }}>{fmt(priceUsd, 2)}</Text> (USD). <Text style={{ fontWeight: '900', color: v.marginOfSafety >= 0 ? t.positive : t.danger }}>{v.marginOfSafety >= 0 ? `${tl('Margine di sicurezza')} ${v.marginOfSafety.toFixed(0)}%` : `${tl('Il prezzo è sopra la stima del')} ${Math.abs(v.marginOfSafety).toFixed(0)}%`}</Text>.</Text>
            <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 10, marginBottom: 4 }}>{tl('Al variare di sconto (righe) e crescita (colonne):')}</Text>
            {grid.map((row, i) => (
              <Row key={i} style={{ gap: 6, marginVertical: 2 }}>
                {row.map((x, j) => <View key={j} style={{ flex: 1, backgroundColor: x !== null && x >= priceUsd ? t.positive + '22' : t.danger + '22', borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}><Text style={{ color: t.text, fontWeight: '800', fontSize: 13 }}>{fmt(x, 0)}</Text></View>)}
              </Row>
            ))}
            <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 6 }}>{tl('Verde: la stima supera il prezzo attuale. Rosso: lo scontrerebbe sotto.')}</Text>
          </View>
        ) : <Body small muted style={{ marginTop: 10 }}>Inserisci il flusso di cassa libero per azione (e uno sconto più alto della crescita finale) per calcolare la stima.</Body>}
        {m.graham !== null ? <Text style={{ color: t.text, marginTop: 12, lineHeight: 20 }}>{tl('Numero di Graham')}: <Text style={{ fontWeight: '900' }}>{fmt(m.graham, 2)}</Text> USD. {tl('È un valore «prudente» che unisce utili e patrimonio: sopra questo prezzo, secondo Graham, si paga un sovrapprezzo.')}</Text> : null}
      </Panel>
    </View>
  );
}
