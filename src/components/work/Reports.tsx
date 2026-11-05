import { useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { pullCrm } from '@/lib/teamCrm';
import { sharePdf, shareFile } from '@/lib/exportFile';
import { EMPTY_INPUT, answer, anomalies, compare, delta, doneSeries, forecastNext, reportCsv, reportHtml, reportText, tasksCsv, trend, workload, type Kpi, type PeriodKind, type ReportInput } from '@/lib/reports';
import { loadReportInput, writeAi } from '@/lib/teamReports';
import { loadBrand } from '@/lib/teamBrand';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { pullTasks } from '@/lib/teamTasks';
import { saveReportPage } from '@/lib/reportPage';
import { today } from '@/lib/teamWork';
import { brandOf, useBrand } from '@/store/brand';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWTasks } from '@/store/tasks';
import { useWork } from '@/store/work';
import { useWorkspace } from '@/store/workspace';

const SECTIONS: Kpi['section'][] = ['Task', 'Ore', 'Vendite', 'Assistenza', 'Persone'];
const fmt = (k: Pick<Kpi, 'value' | 'unit'>) => `${k.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${k.unit === '%' ? '%' : k.unit ? ' ' + k.unit : ''}`;

/** Report e dati: indicatori per periodo con confronto, grafico dei task chiusi con tendenza e giorni anomali, carico di lavoro, report scritto, PDF e CSV, domande sui numeri. */
export function Reports() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { caps } = useCaps(team?.id);
  const people = usePeople((s) => (team ? s.people[team.id] : undefined)) ?? [];
  const me = usePeople((s) => s.me);
  const tasks = useWTasks((s) => (team ? s.tasks[team.id] : undefined)) ?? [];
  const pages = useWorkspace((s) => s.pages);
  const brand = brandOf(team?.id, useBrand((s) => s.brand));
  const [kind, setKind] = useState<PeriodKind>('month'); const [off, setOff] = useState(0);
  const [scope, setScope] = useState<'all' | 'me' | string>('all');
  const [inp, setInp] = useState<ReportInput>(EMPTY_INPUT);
  const [text, setText] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [a, setA] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!team) return; void (async () => { await Promise.all([pullTasks(team.id), loadPeople(team.id), loadBrand(team.id), caps.has('crm') ? pullCrm(team.id) : Promise.resolve()]); setInp(await loadReportInput(team.id)); })(); }, [team?.id, caps.has('crm')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setInp((i) => ({ ...i, tasks })); }, [tasks]);
  const nameOf = (id: string) => (id === me ? tl('Tu') : people.find((p) => p.user_id === id)?.name || tl('Collega'));
  const canAll = caps.has('reports.view');
  const sc = scope === 'all' ? (canAll ? {} : { user: me }) : scope === 'me' ? { user: me } : { project: scope };
  const projPages = pages.filter((p) => p.teamId === team?.id && p.parent === null && p.kind === 'page');
  const t0 = today();
  const cmp = useMemo(() => compare(inp, kind, off, t0, sc), [inp, kind, off, scope, me, canAll]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopedTasks = useMemo(() => tasks.filter((x) => !('project' in sc && sc.project) || x.project === sc.project).filter((x) => !('user' in sc && sc.user) || x.assignee === sc.user), [tasks, scope, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const series = useMemo(() => doneSeries(scopedTasks, cmp.period), [scopedTasks, cmp.period]);
  const vals = series.map((s) => s.v);
  const tr = trend(vals); const an = anomalies(vals); const fc = forecastNext(vals, 3);
  const wl = useMemo(() => workload(scopedTasks, nameOf), [scopedTasks, people, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const currency = (inp.deals[0]?.currency ?? 'CHF') as string;
  const title = scope === 'all' ? (canAll ? (team?.name ?? '') : tl('Il mio lavoro')) : scope === 'me' ? tl('Il mio lavoro') : (pages.find((p) => p.id === scope)?.title ?? tl('Progetto'));
  const auto = useMemo(() => reportText({ title, period: cmp.period, kpis: cmp.kpis, currency, workload: wl, anomalyDays: an.map((i) => series[i]!.day.slice(5).split('-').reverse().join('/')) }), [title, cmp, currency, wl, an, series]);
  const shown = text ?? auto;
  useEffect(() => { setText(null); setA(null); }, [kind, off, scope, team?.id]);
  if (!team) return <NoWorkspace what="vedi report e numeri del lavoro" />;
  const max = Math.max(1, ...vals);
  const b = { company: brand.company || team.name, address: brand.address, email: brand.email, phone: brand.phone, vat: brand.vat, footer: brand.footer, color: brand.color, logo: brand.logo };

  const ask = () => {
    if (!q.trim()) return;
    const r = answer(q, { kpis: cmp.kpis, workload: wl, currency, period: cmp.period });
    if (r) { setA(r); return; }
    setBusy(true); void writeAi('ask', cmp.kpis.map((k) => `${k.label}: ${fmt(k)}`).join('\n') + '\n' + wl.map((w) => `${w.who}: ${w.open} task aperti, ${w.late} in ritardo`).join('\n'), q).then((x) => { setBusy(false); setA(x.text); });
  };
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {canAll ? <Pill label={tl('Azienda')} on={scope === 'all'} onPress={() => setScope('all')} /> : null}
        <Pill label={tl('Io')} on={scope === 'me' || (!canAll && scope === 'all')} onPress={() => setScope('me')} />
        {projPages.map((p) => <Pill key={p.id} label={p.title || tl('Progetto')} on={scope === p.id} onPress={() => setScope(p.id)} />)}
      </View>
      <Row>
        <View style={{ flexDirection: 'row', gap: 8 }}>{([['week', 'Settimana'], ['month', 'Mese'], ['quarter', 'Trimestre']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={kind === k} onPress={() => { setKind(k); setOff(0); }} />)}</View>
      </Row>
      <Row><Btn small ghost icon="arrow-left" title="" label="Periodo prima" onPress={() => setOff(off - 1)} /><Text style={{ color: th.text, fontWeight: '800', textTransform: 'capitalize' }}>{cmp.period.label}</Text><Btn small ghost icon="arrow-right" title="" label="Periodo dopo" disabled={off >= 0} onPress={() => setOff(off + 1)} /></Row>

      {SECTIONS.map((s) => { const ks = cmp.kpis.filter((k) => k.section === s && (k.value || k.prev)); if (!ks.length) return null; return (
        <Card key={s}>
          <H>{tl(s)}</H>
          {ks.map((k) => { const d = delta(k); return (
            <Row key={k.id} style={{ marginTop: 8 }}>
              <Body small style={{ flex: 1 }}>{tl(k.label)}</Body>
              <Body bold>{fmt(k)}</Body>
              <Text style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: '800', color: d?.good === true ? '#2f9e5b' : d?.good === false ? '#ff5a64' : th.muted }}>{d ? (d.dir === 'same' ? '=' : `${d.dir === 'up' ? '▲' : '▼'} ${d.pct == null ? d.abs : d.pct + '%'}`) : ''}</Text>
            </Row>
          ); })}
        </Card>
      ); })}
      {cmp.kpis.every((k) => !k.value && !k.prev) ? <Card><Empty text="Ancora nessun dato in questo periodo. Appena crei task e registri ore compaiono qui." /></Card> : null}

      <Card>
        <H>Task chiusi ogni giorno</H>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90, marginTop: 10 }}>
          {series.map((s, i) => <View key={s.day} style={{ flex: 1, height: Math.max(3, (s.v / max) * 86), borderRadius: 3, backgroundColor: an.includes(i) ? '#e0a030' : th.accent, opacity: s.v ? 1 : 0.25 }} />)}
        </View>
        <Body small muted style={{ marginTop: 8 }}>{`${tl('Tendenza')}: ${tl(tr.dir)}${an.length ? ` · ${tl('giorni anomali in giallo')}` : ''}${vals.length >= 5 ? ` · ${tl('prossimi 3 giorni')}: ${fc.join(', ')}` : ''}`}</Body>
      </Card>

      {wl.length ? <Card><H>Chi ha quanto lavoro</H>{wl.slice(0, 8).map((w) => <Row key={w.who} style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{w.who}</Body><Body small>{`${w.open} ${tl('aperti')}${w.late ? ` · ${w.late} ${tl('in ritardo')}` : ''}`}</Body></Row>)}</Card> : null}

      <Card>
        <H>Il report scritto</H>
        <Input value={shown} onChangeText={setText} maxLines={14} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small ghost icon="sparkle" disabled={busy} title={busy ? 'Theia scrive…' : 'Rifinisci con Theia'} onPress={() => { setBusy(true); void writeAi('polish', shown).then((r) => { setBusy(false); if (r.ok) setText(r.text); else toast(r.text); }); }} />
          <Btn small ghost icon="send" title="Condividi" onPress={() => { void Share.share({ message: shown }); }} />
          <Btn small icon="file" title="PDF" onPress={() => { void sharePdf(reportHtml({ title: `${tl('Report')}: ${title}`, period: cmp.period, kpis: cmp.kpis, text: shown, brand: b }), 'Report.pdf'); }} />
          <Btn small ghost icon="chart" title="CSV indicatori" onPress={() => { void shareFile('indicatori.csv', reportCsv(cmp)); }} />
          <Btn small ghost icon="chart" title="CSV task" onPress={() => { void shareFile('task.csv', tasksCsv(scopedTasks, nameOf, (id) => pages.find((p) => p.id === id)?.title ?? '')); }} />
          <Btn small ghost icon="note" title="Salva nel workspace" onPress={() => { void saveReportPage(team.id, `${tl('Report')} · ${title} · ${cmp.period.label}`, shown).then(() => toast('Salvato nel workspace')); }} />
        </View>
      </Card>

      <Card>
        <H>Chiedi ai numeri</H>
        <Body small muted style={{ marginTop: 4 }}>Per esempio: «quanti task in ritardo?», «chi ha più lavoro?», «quanto dobbiamo incassare?», «quante ore abbiamo lavorato?».</Body>
        <Input style={{ marginTop: 8 }} value={q} onChangeText={setQ} placeholder="Scrivi la domanda" />
        <Btn small icon="sparkle" disabled={busy || !q.trim()} title="Rispondi" onPress={ask} />
        {a ? <Body style={{ marginTop: 8 }}>{a}</Body> : null}
      </Card>
    </View>
  );
}
