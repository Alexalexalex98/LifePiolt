import { useState } from 'react';
import { View } from 'react-native';

import { CalendarImportSheet } from '@/components/CalendarImportSheet';
import { GoalProgress } from '@/components/GoalProgress';
import { DaySheet, MonthCalendar, SmartTaskSheet, TaskBreakdownSheet, TaskRow, WorkHoursSheet, monthTitle } from '@/components/plan';
import { Body, Btn, Card, Empty, H, Input, Item, Link, Page, Progress, Row, Sheet, Toggle, XBtn } from '@/components/ui';
import { formatCHF, monthNames } from '@/lib/format';
import { sendToAssistant } from '@/lib/assistant/run';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';

export default function Plan() {
  const { tasks, goals, automations, vacRange, vacations, setVacRange, addGoal, bumpGoal, delGoal, addAuto, toggleAuto, delVacation } = useLife();
  const wh = useApp((s) => s.workHours);
  const [day, setDay] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [taskSheet, setTaskSheet] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [whSheet, setWhSheet] = useState(false);
  const [goalSheet, setGoalSheet] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [autoSheet, setAutoSheet] = useState(false);
  const [autoText, setAutoText] = useState('');
  const [calSheet, setCalSheet] = useState(false);

  const rangeText = vacRange?.end
    ? `Vacanza: ${vacRange.start.slice(8)}–${vacRange.end.slice(8)} ${monthNames[parseInt(vacRange.start.slice(5, 7)) - 1].toLowerCase()} (${Number(vacRange.end.slice(8)) - Number(vacRange.start.slice(8)) + 1} giorni)`
    : '';

  function pick(key: string) {
    if (!selectMode) { setDay(key); return; }
    if (!vacRange || vacRange.end) { setVacRange({ start: key, end: null }); toast("Ora tocca l'ultimo giorno di vacanza"); return; }
    const [a, b] = key >= vacRange.start ? [vacRange.start, key] : [key, vacRange.start];
    setVacRange({ start: a, end: b });
    setSelectMode(false);
    toast("Vacanza impostata · vai su LifeTravel per l'itinerario AI");
  }

  return (
    <Page id="plan" title="Plan">
      <Card>
        <H>{monthTitle()}</H>
        <MonthCalendar selectMode={selectMode} onPick={pick} />
        <Row style={{ marginTop: 12 }}>
          <Btn small ghost title={selectMode ? 'Tocca inizio e fine…' : 'Seleziona giorni vacanza'} onPress={() => { setSelectMode(!selectMode); if (!selectMode) toast('Tocca il primo giorno di vacanza'); }} />
          <Body small style={{ flexShrink: 1 }}>{rangeText}</Body>
        </Row>
      </Card>

      <Card>
        <H>Pianificazione automatica</H>
        <Body small muted style={{ marginVertical: 6 }}>Riempio il mese con i tuoi task (prima i più urgenti e quelli legati ai tuoi appuntamenti) e le tue abitudini, solo nel tuo orario di lavoro, lasciando liberi molti slot. Vedi l'anteprima e decidi tu.</Body>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}>
          <Btn small icon="calendar" title="Pianifica il mese" onPress={() => { void sendToAssistant('pianificami il mese'); go('ai'); }} />
          <Btn small ghost title="Solo questa settimana" onPress={() => { void sendToAssistant('pianifica la settimana'); go('ai'); }} />
        </Row>
        <Btn small ghost icon="calendar" style={{ marginTop: 8 }} title="Importa dal calendario del telefono" onPress={() => setCalSheet(true)} />
      </Card>

      <Card>
        <Row><H>Orari di lavoro</H><Btn small ghost title="Modifica" onPress={() => setWhSheet(true)} /></Row>
        <Body small>{wh.start} – {wh.end}</Body>
        <Body small muted style={{ marginTop: 4 }}>LifePilot usa questo intervallo per capire quando sei libero nel calendario e nella pianificazione della giornata.</Body>
      </Card>

      <Card>
        <H>Vacanze in programma</H>
        {vacations.length === 0 ? (
          <>
            <Empty text="Nessuna vacanza pianificata. Genera un itinerario in LifeTravel per aggiungerla qui." />
            <Btn small ghost title="Vai a LifeTravel" onPress={() => go('lifetravel')} />
          </>
        ) : vacations.map((v, i) => (
          <Item key={v.id} last={i === vacations.length - 1}>
            <Row>
              <View style={{ flex: 1 }}>
                <Body bold>{v.dest}</Body>
                <Body small muted>{v.month} · {v.days} giorni · {v.hotel} · {formatCHF(v.price * v.days + (v.flight || 0) * 2)} CHF stimati</Body>
              </View>
              <XBtn onPress={() => { delVacation(v.id); toast('Vacanza rimossa'); }} />
            </Row>
          </Item>
        ))}
      </Card>

      <Card>
        <Row><H>Task</H><Btn small ghost title="+ Task" onPress={() => setTaskSheet(true)} /></Row>
        {tasks.length === 0 && <Empty text="Giornata leggera: nessun task in lista. Raccontami cosa devi fare e lo scomponiamo insieme." />}
        {tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={setOpenTask} />)}
      </Card>

      <Card>
        <Row><H>Obiettivi</H><Btn small ghost title="+ Obiettivo" onPress={() => setGoalSheet(true)} /></Row>
        {goals.length === 0 && <Empty text="Nessun obiettivo attivo: definiamone uno insieme, anche piccolo." />}
        {goals.map((g) => (
          <Item key={g.id}>
            <Row><Body bold>{g.t}</Body><Body small muted>{g.p}%</Body></Row>
            <Progress value={g.p} />
            <GoalProgress goal={g} />
            <Row style={{ marginTop: 8 }}>
              <Link onPress={() => { const p = bumpGoal(g.id); if (p === 100) toast('Obiettivo completato'); }}>+5% progresso</Link>
              <Link danger onPress={() => { delGoal(g.id); toast('Obiettivo rimosso'); }}>rimuovi</Link>
            </Row>
          </Item>
        ))}
      </Card>

      <Card>
        <Row><H>Automazioni</H><Btn small ghost title="Crea automazione" onPress={() => setAutoSheet(true)} /></Row>
        {automations.length === 0 && <Empty text="Nessuna automazione." />}
        {automations.map((a) => (
          <Toggle key={a.id} label={a.t} value={a.on} onChange={(v) => { toggleAuto(a.id, v); toast(v ? 'Automazione attivata' : 'Automazione disattivata'); }} />
        ))}
      </Card>

      <CalendarImportSheet visible={calSheet} onClose={() => setCalSheet(false)} />
      <DaySheet day={day} onClose={() => setDay(null)} />
      <SmartTaskSheet visible={taskSheet} onClose={() => setTaskSheet(false)} />
      <TaskBreakdownSheet taskId={openTask} onClose={() => setOpenTask(null)} />
      <WorkHoursSheet key={`${wh.start}${wh.end}${whSheet}`} visible={whSheet} onClose={() => setWhSheet(false)} />
      <Sheet visible={goalSheet} title="Nuovo obiettivo" onClose={() => setGoalSheet(false)}>
        <Input placeholder="Es. Tedesco C1" value={goalText} onChangeText={setGoalText} />
        <Btn title="Aggiungi" onPress={() => { if (!goalText.trim()) return; addGoal(goalText.trim()); setGoalText(''); setGoalSheet(false); toast('Obiettivo creato'); }} />
      </Sheet>
      <Sheet visible={autoSheet} title="Nuova automazione" onClose={() => setAutoSheet(false)}>
        <Input placeholder="Es. Ogni domenica crea la review della settimana" value={autoText} onChangeText={setAutoText} />
        <Btn title="Crea" onPress={() => { if (!autoText.trim()) return; addAuto(autoText.trim()); setAutoText(''); setAutoSheet(false); toast('Automazione creata'); }} />
      </Sheet>
    </Page>
  );
}
