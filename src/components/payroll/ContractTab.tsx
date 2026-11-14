import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Pill, Row } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { hourlyRate, type Contract } from '@/lib/payroll';
import { readContract } from '@/lib/payrollAi';
import type { Captured } from '@/lib/warrantyScan';
import { usePayroll } from '@/store/payroll';
import { toast } from '@/store/toast';

import { CaptureSheet, Field, eur, fromNum, toNum } from './shared';

/** Il contratto: paga, ore, maggiorazioni, ferie. Si carica la foto o il PDF e Theia compila; si controlla e si corregge. */
export function ContractTab() {
  const saved = usePayroll((s) => s.contract);
  const [c, setC] = useState<Contract>(saved);
  const [f, setF] = useState({ hourly: fromNum(saved.hourly), monthly: fromNum(saved.monthly), week: fromNum(saved.weekHours), net: fromNum(saved.netPct), ot: fromNum(saved.overtimePct), night: fromNum(saved.nightPct), sun: fromNum(saved.sundayPct), hol: fromNum(saved.holidayPct), vac: fromNum(saved.vacationDays), pause: fromNum(saved.pauseMin), employer: saved.employer ?? '' });
  const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const apply = (p: Partial<Contract>) => {
    setC((x) => ({ ...x, ...p }));
    setF((x) => ({ ...x, ...(p.hourly != null ? { hourly: fromNum(p.hourly) } : {}), ...(p.monthly != null ? { monthly: fromNum(p.monthly) } : {}), ...(p.weekHours != null ? { week: fromNum(p.weekHours) } : {}), ...(p.overtimePct != null ? { ot: fromNum(p.overtimePct) } : {}), ...(p.nightPct != null ? { night: fromNum(p.nightPct) } : {}), ...(p.sundayPct != null ? { sun: fromNum(p.sundayPct) } : {}), ...(p.holidayPct != null ? { hol: fromNum(p.holidayPct) } : {}), ...(p.vacationDays != null ? { vac: fromNum(p.vacationDays) } : {}), ...(p.pauseMin != null ? { pause: fromNum(p.pauseMin) } : {}), ...(p.employer ? { employer: p.employer } : {}) }));
  };
  const read = async (cap: Captured) => {
    setBusy(true); const r = await readContract(cap); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    apply({ ...r.data, pdf: cap.pdf, pages: cap.pages }); setNotice(tl('Ho compilato i campi dal contratto: controllali e correggi quello che non torna, poi salva.'));
  };
  const save = () => {
    const rate = c.kind === 'hourly' ? toNum(f.hourly) : toNum(f.monthly);
    if (!rate) { toast(c.kind === 'hourly' ? 'Scrivi la paga lorda all\'ora' : 'Scrivi lo stipendio lordo al mese'); return; }
    const week = toNum(f.week) || 40; const net = toNum(f.net);
    if (net && (net < 30 || net > 100)) { toast('Il netto in % va da 30 a 100'); return; }
    const next: Contract = { ...c, hourly: c.kind === 'hourly' ? rate : undefined, monthly: c.kind === 'monthly' ? rate : undefined, weekHours: Math.min(60, week), netPct: net || 85, overtimePct: toNum(f.ot), nightPct: toNum(f.night), sundayPct: toNum(f.sun), holidayPct: toNum(f.hol), vacationDays: toNum(f.vac), pauseMin: Math.round(toNum(f.pause)), employer: f.employer.trim() || undefined };
    usePayroll.getState().setContract(next); toast('Contratto salvato');
  };

  return (
    <>
      <Card>
        <H>Il tuo contratto</H>
        <Body small muted>{tl('Foto o PDF del contratto: Theia legge paga, ore, maggiorazioni e ferie. Oppure scrivi tu i numeri qui sotto.')}</Body>
        <Btn icon="camera" disabled={busy} title={busy ? 'Theia legge…' : 'Carica il contratto'} onPress={() => setPick(true)} style={{ marginTop: 10 }} />
        {notice ? <Body small style={{ marginTop: 8 }}>{notice}</Body> : null}
      </Card>
      <Card>
        <H>Paga</H>
        <View style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
            <Pill label={tl('Pagato a ore')} on={c.kind === 'hourly'} onPress={() => setC({ ...c, kind: 'hourly' })} />
            <Pill label={tl('Stipendio fisso')} on={c.kind === 'monthly'} onPress={() => setC({ ...c, kind: 'monthly' })} />
            <Pill label="EUR" on={c.currency === 'EUR'} onPress={() => setC({ ...c, currency: 'EUR' })} />
            <Pill label="CHF" on={c.currency === 'CHF'} onPress={() => setC({ ...c, currency: 'CHF' })} />
          </Row>
          {c.kind === 'hourly' ? <Field label="Paga lorda all'ora" value={f.hourly} onChange={set('hourly')} placeholder="12,50" numeric /> : <Field label="Stipendio lordo al mese" value={f.monthly} onChange={set('monthly')} placeholder="2400" numeric hint="Per gli straordinari l'ora vale lo stipendio spalmato sulle ore del contratto." />}
          <Field label="Ore settimanali da contratto" value={f.week} onChange={set('week')} placeholder="40" numeric />
          <Field label="Pausa non pagata di solito (minuti)" value={f.pause} onChange={set('pause')} placeholder="30" numeric />
          <Field label="Azienda (facoltativo)" value={f.employer} onChange={set('employer')} />
        </View>
      </Card>
      <Card>
        <H>Maggiorazioni e ferie</H>
        <View style={{ gap: 10 }}>
          <Row gap={10}>
            <View style={{ flex: 1 }}><Field label="Straordinario %" value={f.ot} onChange={set('ot')} numeric /></View>
            <View style={{ flex: 1 }}><Field label="Notte %" value={f.night} onChange={set('night')} numeric /></View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}><Field label="Domenica %" value={f.sun} onChange={set('sun')} numeric /></View>
            <View style={{ flex: 1 }}><Field label="Festivo %" value={f.hol} onChange={set('hol')} numeric /></View>
          </Row>
          <Field label="Giorni di ferie all'anno" value={f.vac} onChange={set('vac')} placeholder="20" numeric />
          <Row style={{ justifyContent: 'flex-start' }} gap={6}><Pill label={tl('Ferie e malattia pagate')} on={c.paidLeave} onPress={() => setC({ ...c, paidLeave: !c.paidLeave })} /></Row>
        </View>
      </Card>
      <Card>
        <H>Quanto resta in busta</H>
        <Field label="Netto in % del lordo (trattenute del contratto, senza imposte)" value={f.net} onChange={set('net')} placeholder="85" numeric hint="Parti da una stima: appena carichi le buste paga la sostituisco con le trattenute vere. Le imposte sul reddito sono nella scheda Dichiarazione fiscale." />
      </Card>
      <Btn title="Salva il contratto" onPress={save} />
      {hourlyRate(c) ? <Body small muted>{tl('Un\'ora vale {0} lorde.', eur(hourlyRate(c), c.currency))}</Body> : null}
      <CaptureSheet visible={pick} title="Contratto di lavoro" onClose={() => setPick(false)} onCaptured={(cap) => { void read(cap); }} />
    </>
  );
}
