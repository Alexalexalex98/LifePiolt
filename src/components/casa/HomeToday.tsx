import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { ensureMe, maybeAskRoomPhoto, memberName, useToday } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Pill, Row, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dailyPlan, microSteps, nextTinyStep, postpone, praiseOf, roomName, timeBox, rotateTo, type PlanItem } from '@/lib/homeCare';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const BUDGETS = [15, 30, 45, 60, 90];

/** Oggi: poche cose, dentro il tempo che hai. Quello che non entra scivola in avanti da solo, senza colpe. */
export function HomeToday({ onStart }: { onStart: () => void }) {
  const th = useTheme(); const today = useToday();
  const { chores, rooms, members, log, settings, me, setSettings, slide, doChore, undo, updateChore } = useCasa();
  const [actor, setActor] = useState<string | undefined>(me); const [skip, setSkip] = useState<string[]>([]);
  useEffect(() => { slide(today); }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const lowEnergy = settings.lowEnergyDay === today;
  const doneToday = log.filter((d) => d.day === today && !d.chore.startsWith('tidy-'));
  const plan = useMemo(() => dailyPlan(chores, today, { budget: settings.budget, lowEnergy, doneToday: doneToday.map((d) => d.chore) }), [chores, today, settings.budget, lowEnergy, doneToday.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = actor ?? me ?? members[0]?.id ?? ensureMe().id;
  const finish = (id: string) => { const m = actor ?? me ?? ensureMe().id; const pts = doChore(id, m, today); if (pts != null) { toast(pts > 0 ? praiseOf(log.length) : 'Segnato'); maybeAskRoomPhoto(chores.find((x) => x.id === id)?.room ?? null); } };
  if (chores.length === 0) return <Card><H>Oggi</H><Empty text="Per cominciare crea la tua casa: ci vuole un minuto e il piano si fa da solo." /><View style={{ marginTop: 8 }}><Btn icon="plus" title="Crea la mia casa" onPress={onStart} /></View></Card>;
  const items = plan.items.filter((x) => !skip.includes(x.chore.id));
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row><H>Oggi</H><Pill label={tl('{0} min', settings.budget)} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{items.length ? tl('{0} cose, circa {1} minuti. Il resto non scappa: scivola nei prossimi giorni.', items.length, plan.minutes) : doneToday.length ? tl('Per oggi hai finito. Puoi riposare.') : tl('Oggi non c\'è niente in scadenza.')}</Body>
        <Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('QUANTO TEMPO HAI OGGI').toUpperCase()}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{BUDGETS.map((b) => <Pill key={b} label={`${b} min`} on={settings.budget === b} onPress={() => setSettings({ budget: b })} />)}</View>
        <Toggle label={tl('Una cosa alla volta')} value={settings.simple} onChange={(v) => setSettings({ simple: v })} hint={tl('Ti mostro solo la prossima cosa, piccola, con un timer. Meno da pensare.')} />
        <Toggle label={tl('Oggi è una giornata no')} value={lowEnergy} onChange={(v) => setSettings({ lowEnergyDay: v ? today : undefined })} hint={tl('Al massimo due cose facili e brevi. Va benissimo così.')} />
        {members.length > 1 ? <><Body small bold muted style={{ marginTop: 8, marginBottom: 6 }}>{tl('STO SEGNANDO PER').toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{members.map((m) => <Pill key={m.id} label={m.name} color={m.color} on={who === m.id} onPress={() => setActor(m.id)} />)}</View></> : null}
      </Card>

      {settings.simple ? <Simple items={items} onDone={finish} onSkip={(id) => setSkip([...skip, id])} onLater={(id) => { const c = chores.find((x) => x.id === id); if (c) { updateChore(id, postpone(c, today)); toast('Va bene: domani c\'è più spazio'); } }} rooms={rooms} />
        : <Card>
          {items.length === 0 ? <Empty text="Niente da fare ora." /> : items.map(({ chore: c, late }: PlanItem) => {
            const tur = c.assignee === 'rotate' ? rotateTo(c, members, log, today.slice(0, 7)) : null;
            return (
              <Row key={c.id} style={{ marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Body bold>{c.title}</Body>
                  <Body small muted>{`${roomName(rooms, c.room)} · ${c.minutes} min${c.assignee ? ` · ${tur ? tur.name : memberName(members, c.assignee)}` : ''}${late ? ` · ${tl('da recuperare')}` : ''}`}</Body>
                </View>
                <Btn small icon="check" title="Fatto" onPress={() => finish(c.id)} />
              </Row>
            );
          })}
          {plan.later.length ? <Body small muted style={{ marginTop: 12 }}>{tl('Altre {0} cose slittano ai prossimi giorni, dove c\'è posto.', plan.later.length)}</Body> : null}
        </Card>}

      {doneToday.length ? (
        <Card>
          <H>Fatto oggi</H>
          {doneToday.map((d) => { const c = chores.find((x) => x.id === d.chore); return <Row key={d.id} style={{ marginTop: 8 }}><Body small style={{ flex: 1, textDecorationLine: 'line-through', color: th.muted }}>{`${c?.title ?? tl('Faccenda')} · ${memberName(members, d.member)}`}</Body><Btn small ghost title="Annulla" onPress={() => undo(d.id)} /></Row>; })}
        </Card>
      ) : null}
    </View>
  );
}

/** Modalità semplice (ADHD): una sola cosa, a pezzi piccoli, con un timer. Niente liste lunghe, niente colpe. */
function Simple(p: { items: PlanItem[]; onDone: (id: string) => void; onSkip: (id: string) => void; onLater: (id: string) => void; rooms: ReturnType<typeof useCasa.getState>['rooms'] }) {
  const next = nextTinyStep(p.items);
  return <SimpleCard key={next?.chore.id ?? 'none'} {...p} />; // una scheda nuova per ogni faccenda: il timer riparte da zero
}
function SimpleCard({ items, onDone, onSkip, onLater, rooms }: { items: PlanItem[]; onDone: (id: string) => void; onSkip: (id: string) => void; onLater: (id: string) => void; rooms: ReturnType<typeof useCasa.getState>['rooms'] }) {
  const th = useTheme(); const next = nextTinyStep(items); const [left, setLeft] = useState<number | null>(null); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  if (!next) return <Card><Empty text="Per ora basta così. Bravo." /></Card>;
  const c = next.chore;
  const start = () => { if (timer.current) clearInterval(timer.current); setLeft(timeBox(c) * 60); timer.current = setInterval(() => setLeft((l) => { if (l == null || l <= 1) { if (timer.current) clearInterval(timer.current); return 0; } return l - 1; }), 1000); };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <Card accent={th.accent}>
      <Body small bold muted>{tl('ADESSO').toUpperCase()}</Body>
      <Text style={{ color: th.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{c.title}</Text>
      <Body small muted>{`${roomName(rooms, c.room)} · ${tl('basta {0} minuti', timeBox(c))}`}</Body>
      {microSteps(c).map((s, i) => <Body key={i} small style={{ marginTop: 6 }}>{`${i + 1}. ${tl(s.text)} (${s.minutes} min)`}</Body>)}
      <Text style={{ color: th.text, fontSize: 34, fontWeight: '800', textAlign: 'center', marginVertical: 12 }}>{left == null ? `${timeBox(c)}:00` : left === 0 ? tl('Tempo!') : fmt(left)}</Text>
      <Row><Btn icon="clock" title={left == null ? 'Parto' : 'Ricomincia'} onPress={start} /><Btn ghost icon="check" title="Fatto" onPress={() => onDone(c.id)} /></Row>
      <Row style={{ marginTop: 8 }}><Btn small ghost title="Un'altra cosa" onPress={() => onSkip(c.id)} /><Btn small ghost title="Domani" onPress={() => onLater(c.id)} /></Row>
      <Body small muted style={{ marginTop: 8 }}>{tl('Anche solo iniziare conta. Puoi fermarti quando vuoi.')}</Body>
    </Card>
  );
}
