import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Page, Pill, Row, Sheet } from '@/components/ui';
import { useDictation } from '@/hooks/use-dictation';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { THEME_LABEL, addDays, analyzeDay, analyzePeriod, dayKey, dayLabel, entryText, periodOf, type PeriodAnalysis } from '@/lib/journalCore';
import { deepAnalysis } from '@/lib/journalAi';
import { shareJournal } from '@/lib/journalShare';
import { useJournal } from '@/store/journal';
import { toast } from '@/store/toast';

type Tab = 'scrivi' | 'analisi' | 'condividi';
const COLORS = ['#e07a7a', '#e0a36b', '#c9c9a0', '#9bc9a0', '#6fc7a0', '#4fbf9a'];
const colorOf = (v: number) => COLORS[Math.max(0, Math.min(5, Math.round(((v + 1) / 2) * 5)))]!;
const toneWord = (v: number) => (v > 0.15 ? tl('positivo') : v < -0.15 ? tl('difficile') : tl('neutro'));

export default function Diary() {
  const th = useTheme();
  const [tab, setTab] = useState<Tab>('scrivi');
  return (
    <Page id="diary" title={tl('Diario')} back>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
        <Icon name="lock" size={18} color={th.accent} />
        <Text style={{ flex: 1, color: th.muted, fontSize: 13, lineHeight: 19 }}>{tl('Il diario resta sul tuo telefono, cifrato. Theia non risponde qui: lo legge solo per l\'analisi, e solo se vuoi tu. A un medico o a uno psicologo mandi l\'analisi; il diario lo condividi solo se lo scegli.')}</Text>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: th.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: th.border }}>
        {([['scrivi', 'Scrivi'], ['analisi', 'Analisi'], ['condividi', 'Condividi']] as const).map(([id, l]) => (
          <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="button" accessibilityState={{ selected: tab === id }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: tab === id ? th.text : 'transparent' }}><Text style={{ color: tab === id ? th.onText : th.muted, fontWeight: '800', fontSize: 14 }}>{tl(l)}</Text></Pressable>
        ))}
      </View>
      {tab === 'scrivi' ? <Book /> : tab === 'analisi' ? <Analysis /> : <ShareTab />}
    </Page>
  );
}

/** Il libro: una pagina per giorno. Si sfoglia con le frecce o trascinando; la pagina si gira. */
function Book() {
  const th = useTheme();
  const entries = useJournal((s) => s.entries);
  const today = dayKey();
  const [day, setDay] = useState(today);
  const [jump, setJump] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const dir = useRef<1 | -1>(1);
  const busy = useRef(false);
  const dict = useDictation((txt) => { useJournal.getState().append(day, txt, 'voice'); toast(tl('Aggiunto alla pagina')); });
  const text = entryText(entries[day]);
  const days = useMemo(() => Object.keys(entries).filter((k) => entryText(entries[k]).trim()).sort(), [entries]);
  const pageNo = days.indexOf(day) >= 0 ? days.indexOf(day) + 1 : days.filter((d) => d < day).length + 1;

  const turn = (to: string, d: 1 | -1) => {
    if (busy.current || to === day || to > today) return;
    busy.current = true; dir.current = d; dict.cancel();
    Animated.timing(flip, { toValue: 1, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setDay(to);
      Animated.timing(flip, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => { busy.current = false; });
    });
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderRelease: (_, g) => { if (g.dx < -60) turn(addDays(day, 1), 1); else if (g.dx > 60) turn(addDays(day, -1), -1); },
  }), [day]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (day > today) setDay(today); }, [day, today]);

  const rot = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', dir.current === 1 ? '-80deg' : '80deg'] });
  const origin = dir.current === 1 ? 'left center' : 'right center';
  const isToday = day === today;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => turn(addDays(day, -1), -1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tl('Giorno prima')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chevron" size={20} color={th.text} stroke={2.4} /></View></Pressable>
        <Pressable onPress={() => setJump(true)} accessibilityRole="button" style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700' }}>{isToday ? tl('Oggi') : tl('Pagina {0}', pageNo)}</Text>
          <Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>{tl('Tutte le pagine')}</Text>
        </Pressable>
        <Pressable onPress={() => turn(addDays(day, 1), 1)} disabled={isToday} hitSlop={10} accessibilityRole="button" accessibilityLabel={tl('Giorno dopo')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center', opacity: isToday ? 0.35 : 1 }}><View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={20} color={th.text} stroke={2.4} /></View></Pressable>
      </Row>

      <View {...pan.panHandlers} style={{ backgroundColor: th.card, borderRadius: 6, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderWidth: 1, borderColor: th.border, borderLeftWidth: 6, borderLeftColor: th.accent, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
        <Animated.View style={{ padding: 18, minHeight: 420, transform: [{ perspective: 900 }, { rotateY: rot }], transformOrigin: origin }}>
          <Text style={{ color: th.text, fontSize: 19, fontWeight: '800', textTransform: 'capitalize' }}>{dayLabel(day)}</Text>
          <View style={{ height: 1, backgroundColor: th.border, marginVertical: 10 }} />
          <TextInput
            value={text} onChangeText={(v) => useJournal.getState().setText(day, v)} multiline textAlignVertical="top" scrollEnabled={false}
            placeholder={isToday ? tl('Com\'è andata oggi? Scrivi quello che ti passa per la testa…') : tl('Una pagina vuota.')} placeholderTextColor={th.muted}
            style={{ color: th.text, fontSize: 17, lineHeight: 30, minHeight: 300, padding: 0 }}
          />
          {dict.listening ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: th.accent + '22', borderRadius: 12, padding: 10, marginTop: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: th.danger }} /><Text style={{ flex: 1, color: th.text, fontSize: 14 }} numberOfLines={3}>{dict.live || tl('Ti ascolto…')}</Text></View> : null}
          {dict.error ? <Text style={{ color: th.danger, fontSize: 13, marginTop: 8 }}>{dict.error}</Text> : null}
        </Animated.View>
      </View>

      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: th.muted, fontSize: 12 }}>{words ? tl('{0} parole', words) : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {text.trim() ? <Btn small ghost icon="trash" title={tl('Cancella la pagina')} onPress={() => confirmDelete(tl('questa pagina del diario'), () => useJournal.getState().removeDay(day), () => useJournal.getState().setText(day, text))} /> : null}
          <Pressable onPress={() => (dict.listening ? dict.stop() : void dict.start())} accessibilityRole="button" accessibilityLabel={dict.listening ? tl('Smetti di dettare') : tl('Detta a voce')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: dict.listening ? th.danger : th.text, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 }}>
            <Icon name="mic" size={18} color={th.onText} /><Text style={{ color: th.onText, fontWeight: '800' }}>{dict.listening ? tl('Fine') : tl('Parla')}</Text>
          </Pressable>
        </View>
      </Row>

      <Sheet visible={jump} title={tl('Le pagine del diario')} onClose={() => setJump(false)}>
        <Pressable onPress={() => { setJump(false); turn(today, 1); }} style={{ paddingVertical: 12 }}><Text style={{ color: th.accent, fontWeight: '800' }}>{tl('Vai a oggi')}</Text></Pressable>
        {days.length ? [...days].reverse().map((k) => { const a = analyzeDay(entries[k]!); return (
          <Pressable key={k} onPress={() => { setJump(false); turn(k, k > day ? 1 : -1); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: th.border }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorOf(a.valence) }} />
            <Text style={{ flex: 1, color: th.text, fontWeight: '700', textTransform: 'capitalize' }}>{dayLabel(k)}</Text>
            <Text style={{ color: th.muted, fontSize: 12 }}>{a.mood}</Text>
          </Pressable>
        ); }) : <Body small muted>{tl('Ancora nessuna pagina: scrivi la prima.')}</Body>}
      </Sheet>
    </View>
  );
}

const PERIODS = [7, 30, 90];
function Analysis() {
  const th = useTheme();
  const entries = useJournal((s) => s.entries);
  const reports = useJournal((s) => s.reports);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const { from, to } = periodOf(days);
  const a: PeriodAnalysis = useMemo(() => analyzePeriod(Object.values(entries), from, to), [entries, from, to]);
  const trend = a.trend === 'su' ? tl('in miglioramento') : a.trend === 'giù' ? tl('in calo: sii gentile con te') : a.trend === 'stabile' ? tl('stabile') : tl('servono più giorni');
  const run = async () => { setBusy(true); const r = await deepAnalysis(from, to); setBusy(false); toast(r.ok ? tl('Analisi pronta') : r.text); };
  return (
    <View style={{ gap: 12 }}>
      <Row gap={8} style={{ justifyContent: 'flex-start' }}>{PERIODS.map((d) => <Pill key={d} label={tl('{0} giorni', d)} on={days === d} onPress={() => setDays(d)} />)}</Row>
      {a.care ? (
        <Card accent={th.danger}>
          <H>{tl('Ti penso')}</H>
          <Body small>{tl('Nelle tue pagine ci sono parole molto pesanti. Non sei solo e non devi farcela da solo: parlane con una persona di fiducia o con un professionista. In Italia puoi chiamare il Telefono Amico (02 2327 2327) oppure il 112 se è un\'emergenza.')}</Body>
        </Card>
      ) : null}
      {a.written < 2 ? <Card><Body muted>{tl('Servono almeno due pagine scritte in questo periodo per un\'analisi. Scrivi quando ti va: bastano poche righe.')}</Body></Card> : (
        <>
          <Card>
            <H>{tl('Stato d\'animo')}</H>
            <Text style={{ color: th.text, fontSize: 28, fontWeight: '800' }}>{a.mood}</Text>
            <Body small muted>{tl('Andamento: {0}. Hai scritto {1} giorni su {2}.', trend, a.written, a.days)}</Body>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 64, marginTop: 12 }}>
              {a.daily.slice(-30).map((d) => <View key={d.day} style={{ flex: 1, height: 10 + Math.abs(d.valence) * 50, backgroundColor: colorOf(d.valence), borderRadius: 3 }} />)}
            </View>
            {a.worst && a.best ? <Body small muted style={{ marginTop: 8 }}>{tl('Giorno più pesante: {0} · giorno migliore: {1}', a.worst.day.split('-').reverse().join('/'), a.best.day.split('-').reverse().join('/'))}</Body> : null}
          </Card>
          <Card>
            <H>{tl('Di cosa parli')}</H>
            {a.themes.length ? a.themes.map((x) => <Row key={x.theme} style={{ justifyContent: 'space-between', paddingVertical: 3 }}><Body>{tl(THEME_LABEL[x.theme] ?? x.theme)}</Body><Body small muted>{`${tl('{0} giorni', x.days)} · ${toneWord(x.valence)}`}</Body></Row>) : <Body small muted>{tl('Nessun tema ricorrente.')}</Body>}
          </Card>
          <Card>
            <H>{tl('Le persone')}</H>
            {a.people.length ? a.people.map((x) => <Row key={x.who} style={{ justifyContent: 'space-between', paddingVertical: 3 }}><Body>{tl(x.who)}</Body><Body small muted>{`${tl('{0} volte', x.mentions)} · ${toneWord(x.valence)}`}</Body></Row>) : <Body small muted>{tl('Non hai nominato persone in questo periodo.')}</Body>}
            <Body small muted style={{ marginTop: 6 }}>{tl('È una lettura delle parole che usi: indica come racconti le persone, non come stanno le relazioni.')}</Body>
          </Card>
        </>
      )}
      <Card>
        <H>{tl('Analisi di Theia')}</H>
        <Body small muted style={{ marginBottom: 8 }}>{tl('Una lettura più attenta delle pagine. Theia non ti risponde: scrive solo l\'analisi. Parte solo se acconsenti ogni volta, e invia il testo del periodo scelto.')}</Body>
        <Btn icon="sparkle" title={busy ? tl('Theia legge…') : tl('Chiedi l\'analisi a Theia')} disabled={busy || a.written < 2} onPress={() => void run()} />
        {reports.map((r) => (
          <View key={r.id} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: th.border, paddingTop: 10 }}>
            <Body small muted>{`${r.from.split('-').reverse().join('/')} – ${r.to.split('-').reverse().join('/')}`}</Body>
            <Text selectable style={{ color: th.text, fontSize: 14.5, lineHeight: 21, marginTop: 4 }}>{r.text}</Text>
            <Btn small ghost icon="trash" title={tl('Elimina')} style={{ marginTop: 6 }} onPress={() => useJournal.getState().removeReport(r.id)} />
          </View>
        ))}
      </Card>
    </View>
  );
}

function ShareTab() {
  const th = useTheme();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const go = (what: 'analysis' | 'diary') => { setBusy(true); void shareJournal(what, days).then((r) => { setBusy(false); if (!r.ok && r.message) toast(r.message); }); };
  return (
    <View style={{ gap: 12 }}>
      <Row gap={8} style={{ justifyContent: 'flex-start' }}>{PERIODS.map((d) => <Pill key={d} label={tl('{0} giorni', d)} on={days === d} onPress={() => setDays(d)} />)}</Row>
      <Card>
        <H>{tl('Per il tuo medico o psicologo')}</H>
        <Body small muted style={{ marginBottom: 10 }}>{tl('Un PDF con stato d\'animo, andamento, temi e relazioni. Dentro non c\'è il testo del tuo diario. Si apre il menu di condivisione: scegli tu a chi mandarlo.')}</Body>
        <Btn icon="file" title={tl('Condividi l\'analisi')} disabled={busy} onPress={() => go('analysis')} />
      </Card>
      <Card>
        <H>{tl('Condividere il diario intero')}</H>
        <Body small muted style={{ marginBottom: 10 }}>{tl('Se vuoi far leggere le pagine al tuo psicologo o psicoterapeuta, puoi mandarle. Sono le tue parole, scritte per te: decidi tu.')}</Body>
        <Btn ghost icon="note" title={tl('Condividi il diario')} disabled={busy} onPress={() => alertT('Condividere il diario?', 'Il diario di questo periodo verrà mandato per intero a chi scegli nel prossimo passaggio. Lo vuoi condividere?', [{ text: 'Annulla', style: 'cancel' }, { text: 'Sì, condividi', onPress: () => go('diary') }])} />
      </Card>
      <Text style={{ color: th.muted, fontSize: 12, lineHeight: 18 }}>{tl('Non è una cura e non sostituisce un professionista. Se stai male, parlane con qualcuno.')}</Text>
    </View>
  );
}
