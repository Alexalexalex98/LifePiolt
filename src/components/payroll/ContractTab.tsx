import { useState } from 'react';
import { Image } from 'expo-image';
import { Linking, View } from 'react-native';

import { Body, Btn, Card, H, Pill, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { OVERTIME_MODES, defaultContract, hourlyRate, type Contract } from '@/lib/payroll';
import { Text } from '@/components/T';
import { readContract } from '@/lib/payrollAi';
import type { Captured } from '@/lib/warrantyScan';
import { usePayroll } from '@/store/payroll';
import { toast } from '@/store/toast';

import { CaptureSheet, Field, eur, fromNum, toNum } from './shared';

const ALL = ['hourly', 'monthly', 'weekHours', 'netPct', 'overtimePct', 'nightPct', 'sundayPct', 'holidayPct', 'vacationDays', 'pauseMin', 'employer', 'paidUpTo', 'bankRatio', 'bankExpiryMonths', 'bankCap', 'overtimeMode', 'currency'];
const LABEL: Record<string, string> = { hourly: 'Paga all\'ora', monthly: 'Stipendio al mese', weekHours: 'Ore settimanali', overtimePct: 'Straordinari', nightPct: 'Notte', sundayPct: 'Domenica', holidayPct: 'Festivo', overtimeMode: 'Regola ore in più', vacationDays: 'Ferie', pauseMin: 'Pausa', currency: 'Valuta', from: 'Inizio', employer: 'Azienda' };

/** Il contratto: paga, ore, maggiorazioni, ferie. Si carica la foto o il PDF e Theia compila; si controlla e si corregge. */
export function ContractTab() {
  const th = useTheme();
  const stored = usePayroll((s) => s.contract);
  const ready = usePayroll((st) => st.ready);
  const saved = { ...defaultContract(), ...stored };
  // un contratto nuovo, o già salvato con questa regola, mostra solo i campi che hanno un valore vero; quelli salvati prima mostrano tutto
  const strict = !ready || stored.known !== undefined;
  const [known, setKnown] = useState<string[]>(strict ? (stored.known ?? []) : ALL);
  const sh = <T,>(key: string, v: T, empty: T): T => (!strict || (stored.known ?? []).includes(key) ? v : empty);
  const [c, setC] = useState<Contract>(saved);
  const [f, setF] = useState({ hourly: sh('hourly', fromNum(saved.hourly), ''), monthly: sh('monthly', fromNum(saved.monthly), ''), week: sh('weekHours', fromNum(saved.weekHours), ''), net: sh('netPct', fromNum(saved.netPct), ''), ot: sh('overtimePct', fromNum(saved.overtimePct), ''), night: sh('nightPct', fromNum(saved.nightPct), ''), sun: sh('sundayPct', fromNum(saved.sundayPct), ''), hol: sh('holidayPct', fromNum(saved.holidayPct), ''), vac: sh('vacationDays', fromNum(saved.vacationDays), ''), pause: sh('pauseMin', fromNum(saved.pauseMin), ''), employer: sh('employer', saved.employer ?? '', ''), upTo: sh('paidUpTo', fromNum(saved.paidUpTo), ''), ratio: sh('bankRatio', fromNum(saved.bankRatio), ''), expiry: sh('bankExpiryMonths', fromNum(saved.bankExpiryMonths), ''), cap: sh('bankCap', fromNum(saved.bankCap), '') });
  const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const apply = (p: Partial<Contract>) => {
    setC((x) => ({ ...x, ...p, found: { ...(x.found ?? {}), ...(p.found ?? {}) } }));
    setKnown((k) => [...new Set([...k, ...(p.known ?? [])])]);
    setF((x) => ({ ...x, ...(p.hourly != null ? { hourly: fromNum(p.hourly) } : {}), ...(p.monthly != null ? { monthly: fromNum(p.monthly) } : {}), ...(p.weekHours != null ? { week: fromNum(p.weekHours) } : {}), ...(p.overtimePct != null ? { ot: fromNum(p.overtimePct) } : {}), ...(p.nightPct != null ? { night: fromNum(p.nightPct) } : {}), ...(p.sundayPct != null ? { sun: fromNum(p.sundayPct) } : {}), ...(p.holidayPct != null ? { hol: fromNum(p.holidayPct) } : {}), ...(p.vacationDays != null ? { vac: fromNum(p.vacationDays) } : {}), ...(p.pauseMin != null ? { pause: fromNum(p.pauseMin) } : {}), ...(p.employer ? { employer: p.employer } : {}) }));
  };
  const read = async (cap: Captured) => {
    // il file si vede subito e resta salvato, anche se la lettura non riesce
    setC((x) => ({ ...x, pdf: cap.pdf, pages: cap.pages })); usePayroll.getState().attachContractFile(cap.pdf, cap.pages);
    setBusy(true); const r = await readContract(cap); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    apply(r.data); const n = r.data.known?.length ?? 0;
    setNotice(n ? tl('Ho letto {0} dati dal contratto e sotto ti mostro la frase da cui vengono: controllali. Quello che il contratto non dice l\'ho lasciato vuoto: compilalo tu; intanto il calcolo usa valori standard.', n) : tl('Non ho trovato dati chiari nel contratto: compila tu i campi. Il file resta qui sotto.'));
  };
  const save = () => {
    const rate = c.kind === 'hourly' ? toNum(f.hourly) : toNum(f.monthly);
    const week = toNum(f.week) || 40; const net = toNum(f.net);
    if (net && (net < 30 || net > 100)) { toast('Il netto in % va da 30 a 100'); return; }
    const has = (v: string) => v.trim() !== '';
    const k = [...new Set([...(rate ? [c.kind === 'hourly' ? 'hourly' : 'monthly'] : []), ...(has(f.week) ? ['weekHours'] : []), ...(has(f.net) ? ['netPct'] : []), ...(has(f.ot) ? ['overtimePct'] : []), ...(has(f.night) ? ['nightPct'] : []), ...(has(f.sun) ? ['sundayPct'] : []), ...(has(f.hol) ? ['holidayPct'] : []), ...(has(f.vac) ? ['vacationDays'] : []), ...(has(f.pause) ? ['pauseMin'] : []), ...(has(f.employer) ? ['employer'] : []), ...(has(f.upTo) ? ['paidUpTo'] : []), ...(has(f.ratio) ? ['bankRatio'] : []), ...(has(f.expiry) ? ['bankExpiryMonths'] : []), ...(has(f.cap) ? ['bankCap'] : []), ...known.filter((x) => x === 'overtimeMode' || x === 'currency' || x === 'from')])];
    // un campo vuoto non blocca niente: il calcolo usa un valore prudente (nessuna maggiorazione che il contratto non dice)
    const next: Contract = { ...c, hourly: c.kind === 'hourly' ? rate : undefined, monthly: c.kind === 'monthly' ? rate : undefined, weekHours: Math.min(60, week), netPct: net || 85, overtimePct: toNum(f.ot), paidUpTo: toNum(f.upTo) || undefined, bankRatio: toNum(f.ratio) || 1, bankExpiryMonths: Math.round(toNum(f.expiry)) || undefined, bankCap: toNum(f.cap) || undefined, nightPct: toNum(f.night), sundayPct: toNum(f.sun), holidayPct: toNum(f.hol), vacationDays: has(f.vac) ? toNum(f.vac) : 20, pauseMin: Math.round(toNum(f.pause)), employer: f.employer.trim() || undefined, known: k };
    usePayroll.getState().setContract(next); setKnown(k);
    toast(rate ? 'Contratto salvato' : 'Salvato. Senza la paga non posso ancora calcolare quanto guadagni.');
  };

  return (
    <>
      <Card>
        <H>Il tuo contratto</H>
        <Body small muted>{tl('Foto o PDF del contratto: Theia legge paga, ore, maggiorazioni e ferie. Oppure scrivi tu i numeri qui sotto.')}</Body>
        <Btn icon="camera" disabled={busy} title={busy ? 'Theia legge…' : 'Carica il contratto'} onPress={() => setPick(true)} style={{ marginTop: 10 }} />
        {notice ? <Body small style={{ marginTop: 8 }}>{notice}</Body> : null}
      </Card>
      {c.pdf || c.pages?.length ? (
        <Card>
          <H>Il file che hai caricato</H>
          {c.pages?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {c.pages.slice(0, 6).map((uri, i) => <Press key={uri} onPress={() => { void Linking.openURL(uri).catch(() => toast('Non riesco ad aprire il file')); }} accessibilityLabel={tl('Pagina {0}', i + 1)}><Image source={{ uri }} style={{ width: 96, height: 128, borderRadius: 8, backgroundColor: th.chip }} contentFit="cover" /></Press>)}
            </View>
          ) : null}
          <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
            {c.pdf ? <Btn small icon="file" title="Apri il PDF" onPress={() => { void Linking.openURL(c.pdf as string).catch(() => toast('Non riesco ad aprire il file con un\'altra app')); }} /> : null}
            <Btn small ghost danger icon="trash" title="Togli il file" onPress={() => { setC((x) => ({ ...x, pdf: undefined, pages: undefined })); usePayroll.getState().attachContractFile(undefined, undefined); }} />
          </Row>
        </Card>
      ) : null}
      {c.found && Object.keys(c.found).length ? (
        <Card>
          <H>Cosa ho letto, e da dove</H>
          <Body small muted>{tl('Ogni dato qui sotto viene da una frase del tuo contratto. Se non corrisponde, correggilo nei campi.')}</Body>
          <View style={{ gap: 8, marginTop: 8 }}>
            {Object.entries(c.found).map(([k, q]) => <View key={k}><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{tl(LABEL[k] ?? k)}</Text><Body small muted>{`«${q}»`}</Body></View>)}
          </View>
        </Card>
      ) : null}
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
        <H>Ore in più (straordinari)</H>
        <Body small muted>{tl('Ogni lavoro ha la sua regola: scegli come vengono trattate le ore oltre il contratto.')}</Body>
        {!known.includes('overtimeMode') ? <Body small muted>{tl('Il contratto non lo dice chiaramente (o non l\'ho letto): scegli tu. Finché non scegli, conto le ore in più pagate senza maggiorazione.')}</Body> : null}
        <View style={{ gap: 8, marginTop: 8 }}>
          {OVERTIME_MODES.map((m) => (
            <Press key={m.k} onPress={() => { setC({ ...c, overtimeMode: m.k }); setKnown((x) => [...new Set([...x, 'overtimeMode'])]); }} accessibilityLabel={tl(m.n)} selected={c.overtimeMode === m.k} style={{ borderWidth: 1, borderColor: c.overtimeMode === m.k ? th.accent : th.border, borderRadius: 14, padding: 12 }}>
              <Body bold color={c.overtimeMode === m.k ? th.accent : undefined}>{tl(m.n)}</Body>
              <Body small muted>{tl(m.d)}</Body>
            </Press>
          ))}
          {c.overtimeMode === 'paid' || c.overtimeMode === 'mixed' ? <Field label="Maggiorazione sulle ore pagate %" value={f.ot} onChange={set('ot')} placeholder="25" numeric /> : null}
          {c.overtimeMode === 'mixed' ? <Field label="Ore pagate al mese prima del recupero" value={f.upTo} onChange={set('upTo')} placeholder="10" numeric /> : null}
          {c.overtimeMode === 'bank' || c.overtimeMode === 'mixed' ? (
            <>
              <Field label="Ore di riposo per ogni ora in più" value={f.ratio} onChange={set('ratio')} placeholder="1" numeric hint="1 = ora per ora. Se il recupero vale di più (per esempio +25%), scrivi 1,25." />
              <Field label="Da recuperare entro (mesi, vuoto = senza scadenza)" value={f.expiry} onChange={set('expiry')} placeholder="6" numeric />
              <Field label="Tetto della banca ore in ore (facoltativo)" value={f.cap} onChange={set('cap')} placeholder="80" numeric />
            </>
          ) : null}
        </View>
      </Card>
      <Card>
        <H>Maggiorazioni e ferie</H>
        <View style={{ gap: 10 }}>
          <Row gap={10}>
            <View style={{ flex: 1 }}><Field label="Notte %" value={f.night} onChange={set('night')} numeric /></View>
            <View style={{ flex: 1 }}><Field label="Domenica %" value={f.sun} onChange={set('sun')} numeric /></View>
          </Row>
          <Field label="Festivo lavorato %" value={f.hol} onChange={set('hol')} numeric />
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
