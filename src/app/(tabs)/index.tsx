import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TrendChart } from '@/components/charts';
import { TheiaCard } from '@/components/TheiaCard';
import { InsightCard, KpiCard, MetricSheet, deltaStatus, scoreStatus, statusColor } from '@/components/dashboard';
import { PlanDaySheet } from '@/components/plan';
import { Body, Btn, Card, H, Item, Page, Row, SectionLabel, Tag } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { attainment, fmtVal, type Analysis, type Domain } from '@/lib/analytics';
import { domainLabel, useDashboard } from '@/lib/analyticsData';
import { go } from '@/lib/nav';
import { applyDemo } from '@/store/demo';
import { useApp } from '@/store/app';
import { moodOptions, useHealth } from '@/store/health';
import { shortDate } from '@/lib/format';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

const order: Record<Domain, string[]> = {
  salute: ['sleep', 'steps', 'hrv', 'hr', 'exercise', 'energy', 'weight', 'vo2', 'spo2'],
  mente: ['stress', 'mood', 'mindful'],
  finanza: ['balance', 'savings', 'spending', 'dailyspend'],
  crescita: ['tasks'],
};

export default function Dashboard() {
  const t = useTheme();
  const dash = useDashboard();
  const account = useApp((s) => s.account);
  const lastSync = useHealth((s) => s.lastSync);
  const wearable = useHealth((s) => s.wearable);
  const moods = useHealth((s) => s.moods);
  const logMood = useHealth((s) => s.logMood);
  const [open, setOpen] = useState<Analysis | null>(null);
  const [plan, setPlan] = useState(false);
  const [moreInsights, setMoreInsights] = useState(false);

  const { scores, list, insights, corrs, lifeSeries, lifeForecast, lifeDelta } = dash;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const total = scores.total;
  const verdict = total == null ? 'Nessun dato da analizzare' : total >= 80 ? 'Ottima condizione' : total >= 65 ? 'Buona, con margini di miglioramento' : total >= 50 ? 'Da migliorare' : 'Richiede attenzione';
  const tc = statusColor(t, scoreStatus(total));
  const moodToday = moods[0]?.day === dash.today || moods[0]?.date === shortDate();

  // punti di forza e punti deboli (aderenza all'obiettivo)
  const scored = list
    .map((a) => ({ a, s: attainment(a.def, a.def.period === 'day' ? a.avg7 : a.latest.v) }))
    .filter((x): x is { a: Analysis; s: number } => x.s != null && !x.a.def.id.startsWith('goal:'));
  const strengths = scored.slice().sort((x, y) => y.s - x.s).filter((x) => x.s >= 85).slice(0, 2);
  const weak = scored.slice().sort((x, y) => x.s - y.s).filter((x) => x.s < 80).slice(0, 2);

  const byDomain = (d: Domain) => {
    const items = list.filter((a) => a.def.domain === d);
    const idx = (a: Analysis) => { const k = order[d].indexOf(a.def.id); return k < 0 ? 99 : k; };
    return items.sort((a, b) => idx(a) - idx(b)).slice(0, d === 'salute' ? 8 : 6);
  };
  const openMetric = (id?: string) => { const a = id ? dash.byId[id] : null; if (a) setOpen(a); };

  const srcNames: Record<string, string> = { apple: 'Apple Health', manuale: 'Manuale', demo: 'Demo', stimato: 'Stimato' };

  /* ---------- nessun dato ---------- */
  if (list.length === 0) {
    return (
      <Page id="index">
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', marginTop: 18 }}>{greet}, {account.name}</Text>
        <TheiaCard />
        <Card style={{ marginTop: 14 }}>
          <H>La Dashboard analizza i tuoi dati</H>
          <Body muted>Appena arrivano dati, qui compaiono punteggi, trend, previsioni, anomalie e correlazioni. Per iniziare:</Body>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Btn title="Collega Apple Health e Apple Watch" onPress={() => go('lifehealth')} />
            <Btn ghost title="Registra i dati a mano" onPress={() => go('lifehealth')} />
            <Btn ghost title="Esplora con dati demo" onPress={() => { applyDemo(account.name, account.email); useApp.getState().set({ demo: true }); toast('Dati demo caricati'); }} />
          </View>
        </Card>
      </Page>
    );
  }

  return (
    <Page id="index">
      <View style={{ paddingTop: 14 }}>
        <Text style={{ color: t.muted, fontSize: 13 }}>{greet}, {account.name}</Text>
        <Text style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>
          {dash.dataDays} giorni di dati · {wearable.connected && lastSync ? `Apple Health sincronizzato ${new Date(lastSync).toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' })}` : 'aggiornato in tempo reale'}
        </Text>
      </View>

      <TheiaCard />

      {/* ---------- 1. punteggio generale ---------- */}
      <Card style={{ marginTop: 10, padding: 18 }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Tag>Life Score</Tag>
            <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-end' }} gap={8}>
              <Text style={{ color: tc, fontSize: 56, fontWeight: '800', lineHeight: 60 }}>{total ?? '—'}</Text>
              <Text style={{ color: t.muted, fontSize: 14, marginBottom: 8 }}>/100</Text>
              {lifeDelta != null && (() => {
                const flat = Math.abs(lifeDelta) < 2;
                const c = flat ? t.muted : lifeDelta > 0 ? t.positive : t.danger;
                return (
                  <View style={{ marginBottom: 10, backgroundColor: c + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name={flat ? 'minus' : lifeDelta > 0 ? 'trend-up' : 'trend-down'} size={13} color={c} stroke={2.3} />
                    <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>{flat ? 'stabile' : lifeDelta > 0 ? `+${lifeDelta}` : `${lifeDelta}`} vs 7 gg prima</Text>
                  </View>
                );
              })()}
            </Row>
            <Text style={{ color: tc, fontSize: 14, fontWeight: '700' }}>{verdict}</Text>
          </View>
        </Row>
        {lifeSeries.length >= 3 && (
          <View style={{ marginTop: 10 }}>
            <TrendChart pts={lifeSeries} forecast={lifeForecast} color={tc} h={80} />
            <Body small muted style={{ marginTop: 4 }}>
              {lifeForecast ? `Previsione tra 7 giorni: ${Math.round(lifeForecast.end)} (probabile ${Math.round(lifeForecast.endLo)}–${Math.round(lifeForecast.endHi)}) · ${lifeForecast.confidence === 'alta' ? 'affidabilità alta' : lifeForecast.confidence === 'media' ? 'affidabilità media' : 'affidabilità bassa'}` : 'Servono almeno 7 giorni di dati per la previsione.'}
            </Body>
          </View>
        )}
        <Row style={{ marginTop: 14 }} gap={8}>
          {(['salute', 'mente', 'finanza', 'crescita'] as Domain[]).map((d) => {
            const v = scores[d]; const c = statusColor(t, scoreStatus(v));
            return (
              <View key={d} style={{ flex: 1, backgroundColor: t.tile, borderRadius: 14, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: t.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{domainLabel[d]}</Text>
                <Text style={{ color: c, fontSize: 22, fontWeight: '800' }}>{v ?? '—'}</Text>
                <View style={{ height: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: t.border, marginTop: 2 }}><View style={{ width: `${v ?? 0}%`, height: 3, borderRadius: 2, backgroundColor: c }} /></View>
              </View>
            );
          })}
        </Row>
      </Card>

      {/* ---------- 2. cosa conta adesso ---------- */}
      <SectionLabel>Cosa conta adesso</SectionLabel>
      {insights.length === 0 ? (
        <Card><Body muted>Per ora nessun segnale da evidenziare: sei in linea con i tuoi obiettivi e le tue abitudini.</Body></Card>
      ) : insights.slice(0, 3).map((i) => <InsightCard key={i.id} i={i} onPress={i.metricId ? () => openMetric(i.metricId) : undefined} />)}
      {insights.length > 3 && (
        <>
          {moreInsights && insights.slice(3).map((i) => <InsightCard key={i.id} i={i} onPress={i.metricId ? () => openMetric(i.metricId) : undefined} />)}
          <Btn small ghost title={moreInsights ? 'Mostra meno' : `Altri ${insights.length - 3} segnali`} onPress={() => setMoreInsights(!moreInsights)} />
        </>
      )}

      {/* ---------- 3. punti di forza / debolezza ---------- */}
      {(strengths.length > 0 || weak.length > 0) && (
        <Row style={{ alignItems: 'stretch', marginTop: 10 }} gap={10}>
          <Card style={{ flex: 1, marginVertical: 0 }}>
            <Text style={{ color: t.positive, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>PUNTI DI FORZA</Text>
            {strengths.length === 0 ? <Body small muted>Ancora nessuno sopra l'obiettivo.</Body> : strengths.map((x) => <Pressable key={x.a.def.id} onPress={() => setOpen(x.a)}><Body small bold>{x.a.def.label}</Body><Body small muted>{fmtVal(x.a.def.period === 'day' ? x.a.avg7 : x.a.latest.v, x.a.def)}</Body></Pressable>)}
          </Card>
          <Card style={{ flex: 1, marginVertical: 0 }}>
            <Text style={{ color: t.warn, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>DA MIGLIORARE</Text>
            {weak.length === 0 ? <Body small muted>Tutto sopra l'80% dell'obiettivo.</Body> : weak.map((x) => <Pressable key={x.a.def.id} onPress={() => setOpen(x.a)}><Body small bold>{x.a.def.label}</Body><Body small muted>{fmtVal(x.a.def.period === 'day' ? x.a.avg7 : x.a.latest.v, x.a.def)} · {x.s}% dell'obiettivo</Body></Pressable>)}
          </Card>
        </Row>
      )}

      {/* ---------- 4. indicatori per area ---------- */}
      {(['salute', 'mente', 'finanza', 'crescita'] as Domain[]).map((d) => {
        const items = byDomain(d);
        if (!items.length) return null;
        return (
          <View key={d}>
            <SectionLabel>{domainLabel[d]} · indicatori e previsioni</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {items.map((a) => <KpiCard key={a.def.id} a={a} onPress={() => setOpen(a)} />)}
            </View>
          </View>
        );
      })}
      {list.some((a) => a.def.id.startsWith('goal:')) && (
        <Card>
          <H>Avanzamento obiettivi</H>
          {list.filter((a) => a.def.id.startsWith('goal:')).map((a, i, arr) => (
            <Item key={a.def.id} last={i === arr.length - 1} onPress={() => setOpen(a)}>
              <Row><Body style={{ flex: 1 }}>{a.def.label}</Body><Body bold>{Math.round(a.value)}%</Body></Row>
              <Body small muted>{a.significant ? `${a.slopePctWeek > 0 ? '+' : ''}${(a.slope * 7).toFixed(1)} punti a settimana` : 'ritmo stabile'}{a.forecast ? ` · a questo ritmo ${Math.round(Math.min(100, a.forecast.end))}% tra 7 giorni` : ''}</Body>
            </Item>
          ))}
        </Card>
      )}

      {/* ---------- 5. correlazioni ---------- */}
      {corrs.length > 0 && (
        <>
          <SectionLabel>Cosa influenza cosa</SectionLabel>
          <Card>
            {corrs.map((c, i) => (
              <Item key={`${c.a.id}${c.b.id}${c.lag}`} last={i === corrs.length - 1}>
                <Body small>{c.sentence}</Body>
                <Row style={{ marginTop: 6 }} gap={8}>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(Math.abs(c.r) * 100)}%`, height: 6, backgroundColor: c.r > 0 ? t.positive : t.warn }} />
                  </View>
                  <Body small muted>r = {c.r.toFixed(2)} · {c.n} gg</Body>
                </Row>
              </Item>
            ))}
            <Body small muted style={{ marginTop: 8 }}>Legami statistici verificati con una soglia severa (correzione per confronti multipli). Indicano un'associazione, non una causa.</Body>
          </Card>
        </>
      )}

      {/* ---------- 6. qualità dei dati ---------- */}
      <SectionLabel>Come leggere i dati</SectionLabel>
      <Card>
        <Body small><Body small bold>Pallino verde / giallo / rosso</Body> — sei nella zona ottimale / vicino / lontano. L’ottimale è scritto sotto ogni dato.</Body>
        <Body small style={{ marginTop: 6 }}><Body small bold>Freccia e percentuale</Body> — come cambia la media degli ultimi 7 giorni rispetto ai 7 prima. Per alcuni dati salire è buono (passi), per altri è un segnale da guardare (battito a riposo, stress).</Body>
        <Body small style={{ marginTop: 6 }}><Body small bold>Tratteggio e fascia</Body> — previsione dei prossimi giorni e intervallo probabile all’80%: è una stima dalla tendenza recente, non una certezza.</Body>
        <Body small style={{ marginTop: 6 }}>Tocca qualsiasi dato per vedere cos’è, perché conta, cosa comporta se è fuori range e come migliorarlo. Non sono consigli medici o finanziari: per sintomi o decisioni importanti rivolgiti a un professionista.</Body>
      </Card>

      <SectionLabel>Affidabilità dell'analisi</SectionLabel>
      <Card>
        <Row><Body small muted>Giorni con dati</Body><Body small bold>{dash.dataDays}</Body></Row>
        <Row style={{ marginTop: 6 }}><Body small muted>Indicatori analizzati</Body><Body small bold>{list.length}</Body></Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
          {Object.entries(dash.sources).map(([k, n]) => (
            <View key={k} style={{ backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: t.text, fontSize: 12 }}>{srcNames[k] ?? k} · {n}</Text></View>
          ))}
        </View>
        <Body small muted style={{ marginTop: 10 }}>
          {dash.dataDays < 14 ? 'Con meno di 14 giorni di dati le previsioni sono molto incerte: più dati = analisi migliori. ' : ''}
          Le previsioni sono stime statistiche della tendenza recente, non promesse. Non sono consigli medici o finanziari.
        </Body>
        {!(wearable.connected && wearable.device === 'Apple Health') && <Btn small ghost style={{ marginTop: 10 }} title="Collega Apple Health per dati automatici" onPress={() => go('lifehealth')} />}
      </Card>

      {/* ---------- 7. azioni rapide per inserire dati ---------- */}
      <SectionLabel>Aggiungi dati</SectionLabel>
      {!moodToday && (
        <Card>
          <Body bold style={{ marginBottom: 8 }}>Come ti senti oggi?</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {moodOptions.map(([m, c]) => (
              <Pressable key={m} onPress={() => { logMood(m); toast('Umore registrato: ' + m); }} style={{ width: '31%', alignItems: 'center', paddingVertical: 11, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.navBorder }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, marginBottom: 6 }} /><Body small>{m}</Body>
              </Pressable>
            ))}
          </View>
        </Card>
      )}
      <Row gap={8}>
        <Btn small ghost style={{ flex: 1 }} title="Registra salute" onPress={() => go('lifehealth')} />
        <Btn small ghost style={{ flex: 1 }} title="Movimenti" onPress={() => go('lifefinance')} />
        <Btn small ghost style={{ flex: 1 }} title="Pianifica oggi" onPress={() => setPlan(true)} />
      </Row>

      <MetricSheet a={open} onClose={() => setOpen(null)} />
      <PlanDaySheet visible={plan} onClose={() => setPlan(false)} />
    </Page>
  );
}
void deltaStatus;
