import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { WeeklyReportButton } from '@/components/WeeklyReportButton';
import { Flame, LineChart } from '@/components/charts';
import { Body, Btn, Card, Empty, H, Input, Item, Link, Metric, Page, Progress, Row, SectionLabel, Sheet, Tag, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { avg } from '@/lib/format';
import { areaColors, Icon } from '@/lib/icons';
import { computeScores } from '@/lib/scores';
import { healthMeta, last, moodOptions, streakOf, useHealth, type Metric as M } from '@/store/health';
import { toast } from '@/store/toast';
import { autoSyncIfConnected, connectAppleHealth, hkUnsupportedMessage, syncAppleHealth, useHkStatus } from '@/lib/healthkit';

/** "2 minuti fa", "oggi alle 09:14"… */
function ago(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} ${m === 1 ? 'minuto' : 'minuti'} fa`;
  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' });
  return new Date().toDateString() === d.toDateString() ? `oggi alle ${hhmm}` : `${d.toLocaleDateString('it-CH', { day: '2-digit', month: '2-digit' })} alle ${hhmm}`;
}

const fmtSleep = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
const stressLabel = (v: number) => (v < 30 ? 'Basso' : v < 60 ? 'Medio' : 'Alto');
const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };

export default function LifeHealth() {
  const t = useTheme();
  const h = useHealth();
  const { series } = h;
  const sc = computeScores();
  const [trend, setTrend] = useState<M | null>(null);
  const [sheet, setSheet] = useState<null | 'workout' | 'weight' | 'mind' | 'mood' | 'today'>(null);
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [today, setToday] = useState<Record<string, string>>({});
  const color = areaColors.lifehealth;
  const [busy, setBusy] = useState(false);
  const [hkMsg, setHkMsg] = useState('');
  const [hkOk, setHkOk] = useState(false);
  const hk = useHkStatus();
  // sincronizza all'apertura della pagina e ogni volta che l'app torna attiva (in primo piano; niente sync ad app chiusa)
  useEffect(() => {
    void autoSyncIfConnected();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void autoSyncIfConnected(); });
    return () => sub.remove();
  }, []);
  async function runSync(connect: boolean) {
    setBusy(true);
    try {
      const r = connect ? await connectAppleHealth() : await syncAppleHealth(60);
      setHkMsg(r.message); setHkOk(r.ok); toast(r.message);
    } catch {
      const m = hkUnsupportedMessage();
      setHkMsg(m); setHkOk(false); toast(m);
    } finally { setBusy(false); }
  }

  const sleep = last(series.sleep), hr = last(series.hr), steps = last(series.steps), weight = last(series.weight);
  const stress = last(series.stress), hrv = last(series.hrv), mindful = last(series.mindful);
  const goal = 10000;
  const stepsStreak = streakOf(series.steps, (v) => v >= 10000);
  const sleepStreak = streakOf(series.sleep, (v) => v >= 7);
  const open = (s: typeof sheet) => { setF1(''); setF2(''); setSheet(s); };

  const Tile = ({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} style={{ width: '48.5%', backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 22, padding: 14, marginBottom: 10 }}>
      <Tag>{label}</Tag>
      <Body bold>{value}</Body>
    </Pressable>
  );

  const trendData = trend ? series[trend] : [];
  const meta = trend ? healthMeta[trend] : null;

  return (
    <Page id="lifehealth" title="LifeHealth" back>
      <Card>
        <H>Apple Health e Apple Watch</H>
        {h.wearable.connected && h.wearable.device === 'Apple Health' ? (
          <>
            <Row><Body>Collegato a <Text style={{ fontWeight: '700' }}>Apple Health</Text></Body><Link onPress={() => { h.connect(null); toast('Apple Health scollegato'); }}>Disconnetti</Link></Row>
            <Body small muted style={{ marginTop: 6 }}>{h.lastSync ? `Ultimo aggiornamento: ${ago(h.lastSync)} (${new Date(h.lastSync).toLocaleString('it-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})` : 'Non ancora sincronizzato.'} I dati dell'Apple Watch arrivano qui tramite l'app Salute. Si aggiorna da solo quando apri l'app e quando ci torni.</Body>
            <Body small color={hk.phase === 'syncing' ? t.muted : hk.phase === 'ok' ? t.positive : hk.phase === 'idle' ? t.muted : t.warn} style={{ marginTop: 6 }}>
              Stato: {hk.phase === 'syncing' ? 'sincronizzazione in corso…' : hk.phase === 'ok' ? 'aggiornato' : hk.phase === 'error' ? 'errore nell’ultima sincronizzazione' : hk.phase === 'unsupported' ? 'non disponibile su questo dispositivo' : h.syncError ? 'errore nell’ultima sincronizzazione' : 'in attesa'}
            </Body>
            {hk.phase === 'unsupported' ? <Body small color={t.warn} style={{ marginTop: 4 }}>{hk.message}</Body> : null}
            {h.syncError ? <Body small color={t.danger} style={{ marginTop: 6 }}>Ultimo errore: {h.syncError}</Body> : null}
            <Btn small ghost style={{ marginTop: 10 }} disabled={busy || hk.phase === 'syncing'} title={busy || hk.phase === 'syncing' ? 'Sincronizzo…' : 'Sincronizza ora'} onPress={() => runSync(false)} />
          </>
        ) : (
          <>
            <Body small muted style={{ marginBottom: 10 }}>Collega Apple Health per portare qui passi, sonno, battito a riposo, HRV, peso, allenamenti e altro, anche quelli registrati dall'Apple Watch. I dati restano sul tuo iPhone.</Body>
            <Btn title={busy ? 'Collego…' : 'Collega Apple Health'} disabled={busy} onPress={() => runSync(true)} />
            {hkMsg ? <Body small color={hkOk ? t.positive : t.warn} style={{ marginTop: 8 }}>{hkMsg}</Body> : null}
          </>
        )}
        <WeeklyReportButton small style={{ marginTop: 10 }} />
        <Btn small ghost style={{ marginTop: 10 }} title="Registra i dati di oggi a mano" onPress={() => { setToday({}); setSheet('today'); }} />
      </Card>

      <Card accent={color}>
        <Row><H>Stato di salute</H><Metric>{sc.health ?? '—'}</Metric></Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 }}>
          <Tile label="SONNO" value={sleep != null ? fmtSleep(sleep) : '–'} onPress={() => setTrend('sleep')} />
          <Tile label="FC RIPOSO" value={hr != null ? `${Math.round(hr)} bpm` : '–'} onPress={() => setTrend('hr')} />
          <Tile label="PASSI OGGI" value={steps != null ? Math.round(steps).toLocaleString('it-CH') : '–'} onPress={() => setTrend('steps')} />
          <Tile label="PESO" value={weight != null ? `${weight.toFixed(1)} kg` : '–'} onPress={() => setTrend('weight')} />
        </View>
      </Card>

      {(series.energy.length > 0 || series.exercise.length > 0 || series.vo2.length > 0 || series.spo2.length > 0) && (
        <Card>
          <H>Altri dati da Apple Watch</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {series.energy.length > 0 && <Tile label="ENERGIA ATTIVA" value={`${Math.round(last(series.energy)!)} kcal`} onPress={() => setTrend('energy')} />}
            {series.exercise.length > 0 && <Tile label="ESERCIZIO" value={`${Math.round(last(series.exercise)!)} min`} onPress={() => setTrend('exercise')} />}
            {series.vo2.length > 0 && <Tile label="VO₂ MAX" value={`${last(series.vo2)!.toFixed(1)}`} onPress={() => setTrend('vo2')} />}
            {series.spo2.length > 0 && <Tile label="OSSIGENO" value={`${Math.round(last(series.spo2)!)}%`} onPress={() => setTrend('spo2')} />}
          </View>
        </Card>
      )}

      <Card>
        <H>Obiettivi giornalieri</H>
        {[{ label: "10'000 passi al giorno", done: (steps ?? 0) >= 10000, streak: stepsStreak }, { label: 'Dormi almeno 7 ore', done: (sleep ?? 0) >= 7, streak: sleepStreak }].map((it, i) => (
          <Item key={i} last={i === 1}>
            <Row>
              <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={8}><Icon name={it.done ? 'checksquare' : 'circle'} size={17} color={it.done ? t.positive : t.muted} /><Body small>{it.label}</Body></Row>
              {it.streak ? <Flame streak={it.streak} size={26} /> : null}
            </Row>
          </Item>
        ))}
      </Card>

      <Card onPress={() => setTrend('sleep')}><Row><H>Sonno</H><Btn small ghost title="+ Registra" onPress={() => { setToday({}); setSheet('today'); }} /></Row><Body small muted>{sleep != null ? `Ultima notte: ${fmtSleep(sleep)} · media 7gg ${avg(series.sleep.slice(-7)).toFixed(1)}h` : 'Nessun dato: registra il sonno di stanotte.'}</Body></Card>
      <Card onPress={() => setTrend('hr')}><Row><H>Cuore</H><Btn small ghost title="+ Registra" onPress={() => { setToday({}); setSheet('today'); }} /></Row><Body small muted>{hr != null ? `Frequenza a riposo: ${Math.round(hr)} bpm · media 7gg ${Math.round(avg(series.hr.slice(-7)))} bpm` : 'Nessun dato registrato.'}</Body></Card>

      <Card>
        <Row><H>Attività</H><Btn small ghost title="+ Registra" onPress={() => { setToday({}); setSheet('today'); }} /></Row>
        <Row><Body muted>Passi oggi</Body><Body bold>{Math.round(steps ?? 0).toLocaleString('it-CH')} / {goal.toLocaleString('it-CH')}</Body></Row>
        <Progress value={Math.min(100, ((steps ?? 0) / goal) * 100)} />
        <Row style={{ marginTop: 8 }}><Body muted>Calorie attive stimate</Body><Body bold>{Math.round((steps ?? 0) * 0.045)} kcal</Body></Row>
      </Card>

      <Card>
        <Row><H>Allenamenti</H><Btn small ghost title="+ Registra" onPress={() => open('workout')} /></Row>
        {h.workouts.length === 0 ? <Empty text="Nessun allenamento registrato: il primo passo conta più di quanto pensi." /> : h.workouts.map((w, i) => (
          <Item key={w.id} last={i === h.workouts.length - 1}>
            <Row><View style={{ flex: 1 }}><Body bold>{w.type}</Body><Body small muted>{w.date} · {w.duration} min</Body></View><Body small muted>{w.calories} kcal</Body><XBtn onPress={() => { h.delWorkout(w.id); toast('Allenamento eliminato'); }} /></Row>
          </Item>
        ))}
      </Card>

      <Card>
        <Row><H>Peso</H><Btn small ghost title="+ Registra" onPress={() => open('weight')} /></Row>
        <Pressable onPress={() => setTrend('weight')}>
          <Body small muted>{weight != null ? `${weight.toFixed(1)} kg · ${weight - series.weight[0] >= 0 ? '+' : ''}${(weight - series.weight[0]).toFixed(1)} kg nelle ultime 2 settimane · tocca per il grafico` : 'Nessun peso registrato.'}</Body>
        </Pressable>
      </Card>

      <SectionLabel>Mind</SectionLabel>
      <Card>
        <Row><H>Benessere mentale</H><Metric>{stress != null ? Math.round(100 - stress) : '–'}</Metric></Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 }}>
          <Tile label="STRESS" value={stress != null ? `${Math.round(stress)}/100` : '–'} onPress={() => setTrend('stress')} />
          <Tile label="HRV" value={hrv != null ? `${Math.round(hrv)} ms` : '–'} onPress={() => setTrend('hrv')} />
          <Tile label="MINDFULNESS OGGI" value={mindful != null ? `${Math.round(mindful)} min` : '–'} onPress={() => setTrend('mindful')} />
          <Tile label="UMORE" value={h.moods[0]?.mood ?? '–'} />
        </View>
        <Body small muted>Stress, HRV e mindfulness misurabili da Apple Watch o altri wearable · l'umore resta un check-in scelto da te.</Body>
      </Card>
      <Card onPress={() => setTrend('stress')}><Row><H>Stress</H><Btn small ghost title="+ Registra" onPress={() => { setToday({}); setSheet('today'); }} /></Row><Body small muted>{stress != null ? `Livello ${stressLabel(stress)} · media 7gg ${Math.round(avg(series.stress.slice(-7)))}/100` : 'Nessun dato registrato.'}</Body></Card>
      <Card>
        <Row><H>Mindfulness</H><Btn small ghost title="+ Registra" onPress={() => open('mind')} /></Row>
        <Item><Row><Body muted>Minuti stimati questa settimana (wearable)</Body><Body bold>{Math.round(series.mindful.slice(-7).reduce((a, b) => a + b, 0))} min</Body></Row></Item>
        {h.mindSessions.length === 0 ? <Empty text="Nessuna sessione registrata." /> : h.mindSessions.map((s, i) => (
          <Item key={s.id} last={i === h.mindSessions.length - 1}>
            <Row><View style={{ flex: 1 }}><Body bold>{s.type}</Body><Body small muted>{s.date}</Body></View><Body small muted>{s.duration} min</Body><XBtn onPress={() => { h.delMind(s.id); toast('Sessione eliminata'); }} /></Row>
          </Item>
        ))}
      </Card>
      <Card>
        <Row><H>Umore</H><Btn small ghost title="+ Check-in" onPress={() => open('mood')} /></Row>
        {h.moods.length === 0 ? <Empty text="Nessun check-in registrato." /> : h.moods.slice(0, 10).map((m, i) => <Item key={i} last={i === Math.min(9, h.moods.length - 1)}><Row><Body>{m.mood}</Body><Body small muted>{m.date}</Body></Row></Item>)}
      </Card>

      {/* trend */}
      <Sheet visible={!!trend} title={meta?.label ?? ''} onClose={() => setTrend(null)}>
        {trend && meta && (trendData.length ? (
          <>
            <Metric big>{trendData[trendData.length - 1].toFixed(meta.dec)} {meta.unit}</Metric>
            <Body small muted style={{ marginBottom: 8 }}>Ultimi {trendData.length} giorni</Body>
            <LineChart data={trendData} color={meta.color} fmt={(n) => n.toFixed(meta.dec)} />
            <Item style={{ marginTop: 14 }}><Row><Body muted>Media periodo</Body><Body bold>{avg(trendData).toFixed(meta.dec)} {meta.unit}</Body></Row></Item>
            <Item><Row><Body muted>Massimo</Body><Body bold>{Math.max(...trendData).toFixed(meta.dec)} {meta.unit}</Body></Row></Item>
            <Item last><Row><Body muted>Minimo</Body><Body bold>{Math.min(...trendData).toFixed(meta.dec)} {meta.unit}</Body></Row></Item>
          </>
        ) : <Empty text="Nessun dato ancora per questa metrica." />)}
      </Sheet>

      <Sheet visible={sheet === 'workout'} title="Nuovo allenamento" onClose={() => setSheet(null)}>
        <Input placeholder="Tipo (es. Corsa, Palestra, Yoga)" value={f1} onChangeText={setF1} />
        <Input keyboardType="decimal-pad" placeholder="Durata (minuti)" value={f2} onChangeText={setF2} />
        <Btn title="Registra" onPress={() => { const d = num(f2); if (!f1.trim() || !d) { toast('Inserisci tipo e durata (minuti)'); return; } h.addWorkout(f1.trim(), d); setSheet(null); toast('Allenamento registrato'); }} />
      </Sheet>
      <Sheet visible={sheet === 'weight'} title="Registra peso" onClose={() => setSheet(null)}>
        <Input keyboardType="decimal-pad" placeholder="Peso attuale (kg)" value={f1} onChangeText={setF1} />
        <Btn title="Registra" onPress={() => { const v = num(f1); if (!v) { toast('Inserisci il peso in kg'); return; } h.logMetric('weight', v); setSheet(null); toast('Peso registrato'); }} />
      </Sheet>
      <Sheet visible={sheet === 'mind'} title="Nuova sessione" onClose={() => setSheet(null)}>
        <Input placeholder="Tipo (es. Meditazione, Respirazione)" value={f1} onChangeText={setF1} />
        <Input keyboardType="decimal-pad" placeholder="Durata (minuti)" value={f2} onChangeText={setF2} />
        <Btn title="Registra" onPress={() => { const d = num(f2); if (!f1.trim() || !d) { toast('Inserisci tipo e durata (minuti)'); return; } h.addMind(f1.trim(), d); setSheet(null); toast('Sessione registrata'); }} />
      </Sheet>
      <Sheet visible={sheet === 'mood'} title="Come ti senti?" onClose={() => setSheet(null)}>
        <Body small muted style={{ marginBottom: 12 }}>Il check-in dell'umore resta un'indicazione che scegli tu: non è misurato automaticamente dal sensore.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {moodOptions.map(([m, c]) => (
            <Pressable key={m} onPress={() => { h.logMood(m); setSheet(null); toast('Umore registrato: ' + m); }} style={{ width: '31%', alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.navBorder }}>
              <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c, marginBottom: 7 }} /><Body small>{m}</Body>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <Sheet visible={sheet === 'today'} title="Dati di oggi" onClose={() => setSheet(null)}>
        <Body small muted style={{ marginBottom: 8 }}>Compila solo quello che vuoi: aggiorna i valori di oggi.</Body>
        {([['sleep', 'Sonno (ore)', '7.5'], ['hr', 'Frequenza a riposo (bpm)', '58'], ['steps', 'Passi', '8000'], ['stress', 'Stress (0-100)', '35'], ['hrv', 'HRV (ms)', '54'], ['mindful', 'Mindfulness (min)', '10']] as [M, string, string][]).map(([k, label, ph]) => (
          <View key={k}><Body small muted>{label}</Body><Input keyboardType="decimal-pad" placeholder={ph} value={today[k] ?? ''} onChangeText={(v) => setToday({ ...today, [k]: v })} /></View>
        ))}
        <Btn title="Salva" onPress={() => { let n = 0; (Object.keys(today) as M[]).forEach((k) => { const v = num(today[k] ?? ''); if (v != null) { h.logMetric(k, v); n++; } }); setSheet(null); toast(n ? 'Dati aggiornati' : 'Niente da salvare'); }} />
      </Sheet>
    </Page>
  );
}
