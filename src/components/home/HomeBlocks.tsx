import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { TourTarget } from '@/components/tour/TourTarget';
import { Body, Btn, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tr } from '@/i18n/core';
import { fmtDate } from '@/i18n/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { nextEvent } from '@/lib/homeNext';
import { predictNeeds, theiaOnline } from '@/lib/theia';
import { isUnlocked, levelDef, MAX_LEVEL, remainingLevels, upcoming } from '@/lib/tour';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { askTheiaAbout, useTheia } from '@/store/theia';
import { useTour } from '@/store/tour';
import { toast } from '@/store/toast';

/** Titolo di sezione della Home: sempre uguale, senza linee e riquadri in più. */
export function HomeTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 26, marginBottom: 10 }}>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.2 }}>{children}</Text>
      {hint ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}

/** "Oggi": data e saluto. L'umore sta subito sotto (check-in). */
export function TodayHeader({ greet, name }: { greet: string; name: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: 14 }}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{`Oggi · ${fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}`}</Text>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 }}>{greet}{name ? `, ${name}` : ''}</Text>
    </View>
  );
}

/** UN blocco grande: il prossimo impegno (o l'invito ad aggiungerne uno). */
export function NextEventBlock({ onAdd }: { onAdd: () => void }) {
  const t = useTheme();
  const events = useLife((s) => s.events);
  const next = useMemo(() => nextEvent(events, new Date()), [events]);
  let when = '';
  let rel = '';
  if (next) {
    const [y, m, d] = next.day.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const time = fmtDate(new Date(y, m - 1, d, ...(next.ev.time.split(':').map(Number) as [number, number])), { hour: 'numeric', minute: '2-digit' });
    when = next.daysAhead === 0 ? tr('Oggi alle {0}', time) : next.daysAhead === 1 ? tr('Domani alle {0}', time) : `${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${time}`;
    if (next.minutesAway != null) rel = next.minutesAway < 60 ? tr('tra {0} min', Math.max(0, next.minutesAway)) : tr('tra {0} h', Math.round(next.minutesAway / 60));
  }
  return (
    <TourTarget id="home.next">
      {next ? (
        <Card style={{ padding: 20 }} onPress={() => go('plan')}>
          <Row style={{ justifyContent: 'flex-start' }} gap={8}>
            <Icon name="calendar" size={16} color={t.accent} stroke={2.2} />
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700', flexShrink: 1 }}>{when}{rel ? ` · ${rel}` : ''}</Text>
          </Row>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 }}>{next.ev.title}</Text>
          {next.ev.place ? <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={6}><Icon name="location" size={14} color={t.muted} /><Body small muted>{next.ev.place}</Body></Row> : null}
          <Body small muted style={{ marginTop: 10 }}>{next.daysAhead === 0 && next.todayLeft > 1 ? tr('Oggi ti restano {0} impegni', next.todayLeft) : next.daysAhead === 0 ? 'È l\'ultimo impegno di oggi.' : 'Oggi non hai altri impegni.'}</Body>
        </Card>
      ) : (
        <Card style={{ padding: 20 }}>
          <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="calendar" size={16} color={t.accent} stroke={2.2} /><Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>Nessun impegno in programma</Text></Row>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 8 }}>La tua giornata è libera</Text>
          <Body small muted style={{ marginTop: 6 }}>Aggiungi il primo impegno: bastano un titolo e un'ora. Puoi anche chiederlo a Theia, per esempio "aggiungi dentista giovedì alle 10".</Body>
          <View style={{ gap: 8, marginTop: 14 }}>
            <Btn icon="plan" title="Aggiungi un impegno" onPress={onAdd} />
            <Btn ghost title="Apri il Piano" onPress={() => go('plan')} />
          </View>
        </Card>
      )}
    </TourTarget>
  );
}

/** Suggerimenti di Theia ancora validi e già utilizzabili (le pagine bloccate non vengono proposte). */
export function useNeeds() {
  const dismissed = useTheia((s) => s.dismissed);
  const tasks = useLife((s) => s.tasks), events = useLife((s) => s.events), goals = useLife((s) => s.goals);
  const msgs = useChat((s) => s.messages), visits = useApp((s) => s.visitHours);
  const mode = useTour((s) => s.mode), level = useTour((s) => s.level), all = useTour((s) => s.allUnlocked);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => predictNeeds().filter((s) => !s.id.startsWith('ins-') && (!dismissed[s.id] || Date.now() - dismissed[s.id] > 6 * 3600000) && (!s.page || isUnlocked({ mode, level, allUnlocked: all }, s.page))), [tasks, events, goals, msgs, visits, dismissed, mode, level, all]);
}

/** UNA azione consigliata: la più utile adesso (stessa logica di Theia: impegni vicini, task per urgenza, obiettivi fermi...). */
export function RecommendedBlock({ list }: { list: ReturnType<typeof useNeeds> }) {
  const t = useTheme();
  const name = useApp((s) => s.assistantName);
  const dismiss = useTheia((s) => s.dismiss);
  const [why, setWhy] = useState(false);
  const s = list[0];
  return (
    <Card style={{ padding: 18 }}>
      <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="sparkle" size={16} color={t.accent} /><Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{`${name} ti consiglia`}</Text></Row>
      {s ? (
        <>
          <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', marginTop: 8 }}>{s.title}</Text>
          {s.detail ? <Body small muted style={{ marginTop: 4 }}>{s.detail}</Body> : null}
          {why ? <Body small color={t.accent} style={{ marginTop: 6 }}>Perché lo vedi: {s.why}</Body> : null}
          <View style={{ gap: 8, marginTop: 14 }}>
            <Btn title={s.cta} onPress={() => (s.page ? go(s.page, s.params) : askTheiaAbout({ source: 'home' }))} />
            <Row gap={18} style={{ justifyContent: 'flex-start' }}>
              <Pressable onPress={() => setWhy(!why)} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: t.muted, fontSize: 13, textDecorationLine: 'underline' }}>{why ? 'Nascondi motivo' : 'Perché?'}</Text></Pressable>
              <Pressable onPress={() => dismiss(s.id)} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: t.muted, fontSize: 13, textDecorationLine: 'underline' }}>Non mi interessa</Text></Pressable>
            </Row>
          </View>
        </>
      ) : (
        <>
          <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', marginTop: 8 }}>Per ora nulla di urgente</Text>
          <Body small muted style={{ marginTop: 4 }}>Più usi l'app, più imparo cosa ti serve e quando. Intanto puoi chiedermelo.</Body>
          <Btn ghost style={{ marginTop: 14 }} title="Cosa faccio ora?" onPress={() => askTheiaAbout({ source: 'home', ask: 'Cosa devo fare adesso?' })} />
        </>
      )}
      <Body small muted style={{ marginTop: 12 }}>{theiaOnline ? 'Analisi con AI sul server.' : 'Calcolato sul telefono dalle tue abitudini e dai tuoi dati: nulla esce dal dispositivo.'}</Body>
    </Card>
  );
}

/** Altri suggerimenti (dal secondo in poi), dentro "Altro". */
export function MoreNeeds({ list }: { list: ReturnType<typeof useNeeds> }) {
  const rest = list.slice(1, 4);
  if (!rest.length) return null;
  return (
    <Card>
      <Body bold>Altri suggerimenti</Body>
      {rest.map((s) => (
        <Pressable key={s.id} onPress={() => (s.page ? go(s.page, s.params) : askTheiaAbout({ source: 'home' }))} accessibilityRole="button" style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><Body>{s.title}</Body>{s.detail ? <Body small muted>{s.detail}</Body> : null}</View>
          <Icon name="chevron-right" size={16} color="#8e98a8" />
        </Pressable>
      ))}
    </Card>
  );
}

/** "Altro": raggruppa il resto, chiuso di default per chi è ai primi livelli. */
export function MoreSection({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 26 }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={tr(open ? 'Altro: comprimi' : 'Altro: mostra punteggi, analisi e altre funzioni')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Altro</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Funzione del giorno, punteggi, analisi e il tuo percorso</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Icon name="chevron" size={18} color={t.muted} stroke={2.2} /></View>
      </Pressable>
      {open ? <View style={{ marginTop: 6 }}>{children}</View> : null}
    </View>
  );
}

/** "Nuovo: ..." quando si è sbloccata un'area e il suo mini-tour non è ancora stato visto. */
export function NewAreaBanner() {
  const t = useTheme();
  const pending = useTour((s) => s.pending);
  const seen = useTour((s) => s.seen);
  const mode = useTour((s) => s.mode);
  if (mode === 'open' || !pending || seen.includes(pending)) return null;
  const d = levelDef(Number(pending.slice(4)));
  if (!d) return null;
  return (
    <Card style={{ marginTop: 18, borderColor: t.accent, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="sparkle" size={16} color={t.accent} /><Text style={{ color: t.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>Nuovo da scoprire</Text></Row>
      <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', marginTop: 6 }}>{d.title}</Text>
      <Body small muted style={{ marginTop: 4 }}>{d.short}</Body>
      <Row style={{ marginTop: 12 }} gap={8}>
        <Btn small style={{ flex: 1 }} icon="play" title="Scoprilo" onPress={() => useTour.getState().start(pending)} />
        <Btn small ghost style={{ flex: 1 }} title="Più tardi" onPress={() => { useTour.setState((s) => ({ seen: s.seen.includes(pending) ? s.seen : [...s.seen, pending], pending: null })); }} />
      </Row>
    </Card>
  );
}

/** Il percorso: a che punto sei, prossima area, rifai il tour, sblocca tutto. */
export function JourneyCard() {
  const t = useTheme();
  const mode = useTour((s) => s.mode), level = useTour((s) => s.level), all = useTour((s) => s.allUnlocked);
  const st = { mode, level, allUnlocked: all };
  const left = remainingLevels(st);
  const next = upcoming(st);
  return (
    <Card>
      <Row style={{ justifyContent: 'flex-start' }} gap={10}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.accent + '25', alignItems: 'center', justifyContent: 'center' }}><Icon name={left ? 'lock' : 'check'} size={18} color={t.accent} stroke={2} /></View>
        <View style={{ flex: 1 }}>
          <Body bold>{left ? tr('Aree sbloccate: {0} su {1}', all ? MAX_LEVEL : level, MAX_LEVEL) : 'Hai sbloccato tutte le aree'}</Body>
          <Body small muted>{next ? tr('Prossima: {0}', next.title) : 'Tutto è a tua disposizione.'}</Body>
        </View>
      </Row>
      <View style={{ gap: 8, marginTop: 12 }}>
        <Btn small ghost icon="play" title="Rifai il tour" onPress={() => { go('home'); setTimeout(() => useTour.getState().start('welcome'), 350); }} />
        {left > 0 ? <Btn small ghost title="Mostra tutte le funzioni" onPress={() => { useTour.getState().unlockEverything(); toast('Tutte le funzioni sono sbloccate'); }} /> : null}
      </View>
    </Card>
  );
}
