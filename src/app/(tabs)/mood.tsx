import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MoodChart, overlays, type Overlay } from '@/components/MoodChart';
import { Body, Btn, Card, Input, Page, Pill, Row, SectionLabel, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { lastNDays, useMoodData } from '@/lib/moodContext';
import type { Factor } from '@/lib/moodAnalysis';
import { defaultCity, refreshWeather } from '@/lib/weather';
import { useContext } from '@/store/context';
import { moodOptions, useHealth } from '@/store/health';
import { toast } from '@/store/toast';
import { todayStr } from '@/lib/analytics';

const factorIcon: Record<string, string> = { rain: 'wow', sun: 'star', events: 'calendar', sleep: 'clock', steps: 'play', exercise: 'trend-up', mindful: 'heart', spend: 'euro', weekend: 'calendar' };
const strengthColor = (s: Factor['strength'], t: { positive: string; warn: string; muted: string }) => (s === 'forte' ? t.warn : s === 'media' ? t.positive : t.muted);

export default function MoodPage() {
  const t = useTheme();
  const { days, report } = useMoodData();
  const moods = useHealth((s) => s.moods);
  const logMood = useHealth((s) => s.logMood);
  const wx = useContext();
  const [overlay, setOverlay] = useState<Overlay>('rain');
  const [range, setRange] = useState(45);
  const [open, setOpen] = useState<Factor | null>(null);
  const [city, setCity] = useState(wx.city || defaultCity());
  const [pick, setPick] = useState(false);
  const today = todayStr();
  const todayMood = moods.find((m) => m.day === today)?.mood;
  const keys = lastNDays(range);

  useEffect(() => { void refreshWeather(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const sig = report.factors.filter((f) => f.sig);
  const other = report.factors.filter((f) => !f.sig);
  const best = sig.filter((f) => f.diff > 0), worst = sig.filter((f) => f.diff < 0);

  return (
    <Page id="mood" back title="Il tuo umore">
      <Card>
        {todayMood && !pick ? (
          <Row><View><Body small muted>Oggi hai registrato</Body><Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{todayMood}</Text></View><Btn small ghost title="Cambia" onPress={() => setPick(true)} /></Row>
        ) : (
          <>
            <Body bold style={{ marginBottom: 8 }}>Come ti senti oggi?</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {moodOptions.map(([m, c]) => (
                <Pressable key={m} onPress={() => { logMood(m); setPick(false); toast('Umore registrato: ' + m); }} style={{ width: '31%', alignItems: 'center', paddingVertical: 11, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.navBorder }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, marginBottom: 6 }} /><Body small>{m}</Body>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card>
        <Row>
          <View><Body small muted>Umore medio ({report.n} {report.n === 1 ? 'giorno' : 'giorni'})</Body><Text style={{ color: report.mean >= 3.5 ? t.positive : t.warn, fontSize: 30, fontWeight: '800' }}>{report.n ? report.mean.toFixed(1).replace('.', ',') : '—'}<Text style={{ fontSize: 14, color: t.muted }}> /5</Text></Text></View>
          <View style={{ alignItems: 'flex-end' }}><Body small muted>Ottimale</Body><Body bold>3,5 o più, stabile</Body></View>
        </Row>
        <Row style={{ justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }} gap={6}>
          {[30, 45, 60].map((n) => <Pill key={n} label={`${n} giorni`} on={range === n} onPress={() => setRange(n)} />)}
        </Row>
        <View style={{ marginTop: 8 }}><MoodChart days={days} keys={keys} overlay={overlay} /></View>
        <Body small muted style={{ marginTop: 6 }}>Linea = il tuo umore · barre = il dato scelto qui sotto · tratteggio verde = soglia ottimale 3,5</Body>
        <Row style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }} gap={6}>
          <Pill label="Nessuno" on={overlay === 'none'} onPress={() => setOverlay('none')} />
          {overlays.map((o) => <Pill key={o.id} label={o.label} on={overlay === o.id} onPress={() => setOverlay(o.id)} />)}
        </Row>
      </Card>

      {report.confidence === 'insufficiente' ? (
        <Card><Body bold>Servono più check-in</Body><Body small muted style={{ marginTop: 4 }}>Con almeno 14 giorni di umore registrato posso confrontarlo con meteo, impegni, sonno, spese e movimento. Ne hai {report.n}: fai il check-in ogni giorno, bastano 5 secondi.</Body></Card>
      ) : (
        <>
          <SectionLabel>Cosa lo alza</SectionLabel>
          {best.length === 0 ? <Card><Body small muted>Per ora nessun fattore chiaro: più dati, più preciso diventa il confronto.</Body></Card> : best.map((f) => <FactorCard key={f.id} f={f} onPress={() => setOpen(f)} />)}
          <SectionLabel>Cosa lo abbassa</SectionLabel>
          {worst.length === 0 ? <Card><Body small muted>Nessun fattore che lo abbassi in modo chiaro.</Body></Card> : worst.map((f) => <FactorCard key={f.id} f={f} onPress={() => setOpen(f)} />)}
          {report.best && report.worst && report.best.label !== report.worst.label && (
            <>
              <SectionLabel>Giorno della settimana</SectionLabel>
              <Card><Body>Il tuo giorno migliore è <Body bold>{report.best.label}</Body> ({report.best.mean.toFixed(1).replace('.', ',')}), il peggiore <Body bold>{report.worst.label}</Body> ({report.worst.mean.toFixed(1).replace('.', ',')}).</Body></Card>
            </>
          )}
          {other.length > 0 && (
            <>
              <SectionLabel>Nessun legame evidente</SectionLabel>
              <Card><Body small muted>{other.map((f) => f.label).join(', ')}: la differenza di umore è troppo piccola o i giorni sono troppo pochi per dire che c’è un legame.</Body></Card>
            </>
          )}
        </>
      )}

      <SectionLabel>Meteo</SectionLabel>
      <Card>
        <Row><View style={{ flex: 1 }}><Body bold>{wx.city || 'Nessuna città'}</Body><Body small muted>{wx.source === 'demo' ? 'Dati meteo di esempio (demo)' : wx.source === 'open-meteo' ? 'Dati Open-Meteo, ultimi 60 giorni' : wx.error ?? 'Scegli la città per confrontare il meteo'}</Body></View></Row>
        <Input style={{ marginTop: 8 }} placeholder="Città (es. Lugano)" value={city} onChangeText={setCity} />
        <Btn small ghost icon="repeat" title="Aggiorna meteo" onPress={() => { useContext.getState().set({ city: city.trim(), lat: null, lon: null }); void refreshWeather(true).then(() => toast('Meteo aggiornato')); }} />
        {wx.error && wx.source !== 'demo' ? <Body small color={t.warn} style={{ marginTop: 6 }}>{wx.error}</Body> : null}
        <Body small muted style={{ marginTop: 8 }}>Uso solo il nome della città, non la tua posizione. Il meteo è confrontato con umore, sonno, spese e impegni nell’analisi della Dashboard.</Body>
      </Card>

      <Body small muted style={{ marginTop: 10 }}>Sono associazioni statistiche, non cause: confronto l’umore medio tra gruppi di giorni e segnalo un legame solo con abbastanza giorni e una differenza netta. Non sostituisce un parere professionale: se ti senti molto giù per più di due settimane, parlane con qualcuno di competente.</Body>

      <Sheet visible={!!open} title={open?.label ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <Body>{open.sentence}</Body>
            <Row style={{ marginTop: 12 }} gap={10}>
              <GroupBox g={open.a} />
              <GroupBox g={open.b} />
            </Row>
            <Body small muted style={{ marginTop: 10 }}>Differenza {open.diff > 0 ? '+' : ''}{open.diff.toFixed(1).replace('.', ',')} punti su 5 · forza del legame: {open.strength} · {open.sig ? 'statisticamente solido' : 'non abbastanza solido'} (t = {open.t.toFixed(1)}).</Body>
            <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 12, marginTop: 12 }}><Body bold>Cosa puoi fare</Body><Body small style={{ marginTop: 4 }}>{open.tip}</Body></View>
          </>
        )}
      </Sheet>
    </Page>
  );
}

function GroupBox({ g }: { g: { label: string; mean: number; n: number } }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.item, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '800' }}>{g.mean.toFixed(1).replace('.', ',')}</Text>
      <Body small muted>{g.label}</Body><Body small muted>{g.n} giorni</Body>
    </View>
  );
}

function FactorCard({ f, onPress }: { f: Factor; onPress: () => void }) {
  const t = useTheme();
  const up = f.diff > 0;
  return (
    <Card onPress={onPress}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Row style={{ justifyContent: 'flex-start', flex: 1, alignItems: 'flex-start' }} gap={10}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (up ? t.positive : t.danger) + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={factorIcon[f.id] ?? 'info'} size={17} color={up ? t.positive : t.danger} /></View>
          <View style={{ flex: 1 }}>
            <Body bold>{f.label}: {up ? '+' : ''}{f.diff.toFixed(1).replace('.', ',')} punti</Body>
            <Body small muted style={{ marginTop: 2 }}>{f.sentence}</Body>
            <Body small color={strengthColor(f.strength, t)} style={{ marginTop: 4 }}>Legame {f.strength} · tocca per i dettagli</Body>
          </View>
        </Row>
      </Row>
    </Card>
  );
}
