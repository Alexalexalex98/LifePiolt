import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AutomationsCard, AutomationsSheet } from '@/components/Automations';
import { CalendarImportSheet } from '@/components/CalendarImportSheet';
import { CalendarPanel, VacationSheet } from '@/components/CalendarViews';
import { NotifBanner } from '@/components/NotifPrompt';
import { GoalProgress } from '@/components/GoalProgress';
import { DaySheet, SmartTaskSheet, TaskBreakdownSheet, TaskRow, WorkHoursSheet } from '@/components/plan';
import { ChipBtn, Body, Btn, Card, Empty, H, Input, Item, Link, Page, Pill, Progress, Row, Sheet } from '@/components/ui';
import { sendToAssistant } from '@/lib/assistant/run';
import { isKey, parseKey, vacationBands } from '@/lib/calendarLayout';
import { confirmDelete } from '@/lib/confirm';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { TRASH_DAYS, taskIsDone, useLife, type Goal, type Vacation } from '@/store/life';
import { firstOpen } from '@/lib/taskTimer';
import { toast } from '@/store/toast';
import { fmtDate } from '@/i18n/format';
import { t as tl } from '@/i18n/core';

const dShort = (k: string) => fmtDate(parseKey(k), { day: 'numeric', month: 'short' });

export default function Plan() {
  const { tasks, goals, vacRange, vacations, trash, setVacRange, addGoal, bumpGoal, delGoal, restoreGoal, delVacation, restoreVacation, restoreFromTrash, purgeTrash } = useLife();
  const wh = useApp((s) => s.workHours);
  const [day, setDay] = useState<string | null>(null);
  // da una notifica ('event:<giorno>:<indice>') si apre direttamente il giorno dell'impegno
  const { day: dayParam, at: openedAt, task: taskParam } = useLocalSearchParams<{ day?: string; idx?: string; at?: string; task?: string }>();
  useEffect(() => { if (dayParam && isKey(dayParam)) setDay(dayParam); }, [dayParam, openedAt]);
  const [selectMode, setSelectMode] = useState(false);
  const [taskSheet, setTaskSheet] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  // dalla Dashboard: si apre direttamente il task toccato
  useEffect(() => { if (taskParam) setOpenTask(String(taskParam)); }, [taskParam, openedAt]);
  const [whSheet, setWhSheet] = useState(false);
  const [goalSheet, setGoalSheet] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [autoSheet, setAutoSheet] = useState(false);
  const [calSheet, setCalSheet] = useState(false);
  const [vacId, setVacId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  const bandOf = (id: string) => vacationBands(vacations, vacRange).find((b) => b.id === id);

  function pick(key: string) {
    if (!selectMode) { setDay(key); return; }
    if (!vacRange || vacRange.end) { setVacRange({ start: key, end: null }); toast("Ora tocca l'ultimo giorno di vacanza"); return; }
    const [a, b] = key >= vacRange.start ? [vacRange.start, key] : [key, vacRange.start];
    setVacRange({ start: a, end: b });
    setSelectMode(false);
    toast('Vacanza impostata · puoi pianificare il viaggio');
  }

  function removeGoal(g: Goal) {
    const idx = goals.findIndex((x) => x.id === g.id);
    confirmDelete(tl('l\'obiettivo «{0}»', g.t), () => delGoal(g.id), () => restoreGoal(g, idx), { undoMessage: 'Obiettivo eliminato · lo ritrovi in «Eliminati di recente»' });
  }

  function removeVacation(v: Vacation) {
    const idx = vacations.findIndex((x) => x.id === v.id);
    confirmDelete(tl('la vacanza «{0}»', v.dest), () => delVacation(v.id), () => restoreVacation(v, idx), { undoMessage: 'Vacanza eliminata' });
  }

  const fresh = trash.filter((x) => Date.now() - x.at < TRASH_DAYS * 86400000);

  return (
    <Page id="plan" title="Plan" right={<Btn small ghost icon="calendar" title="Agenda" onPress={() => go('agenda')} />}>
      <NotifBanner />
      <Card>
        <CalendarPanel selectMode={selectMode} onPickDay={pick} onOpenBand={(id) => setVacId(id)} />
        <Btn style={{ marginTop: 12 }} icon="compass" title="Pianifica le vacanze" onPress={() => go('vacationPlanner')} />
      </Card>

      <Card>
        <H>Pianificazione automatica</H>
        <Body small muted style={{ marginVertical: 6 }}>Riempio il mese con i tuoi task (prima i più urgenti e quelli legati ai tuoi appuntamenti) e le tue abitudini, solo nel tuo orario di lavoro, lasciando liberi molti slot. Vedi l'anteprima e decidi tu.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small icon="calendar" title="Pianifica il mese" onPress={() => { void sendToAssistant('pianificami il mese'); go('ai'); }} />
          <Btn small ghost title="Solo questa settimana" onPress={() => { void sendToAssistant('pianifica la settimana'); go('ai'); }} />
        </View>
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
            <Empty text="Nessuna vacanza pianificata. Tocca «Pianifica le vacanze» per sceglierne le date." />
            <Btn small ghost title="Vai a LifeTravel" onPress={() => go('lifetravel')} />
          </>
        ) : vacations.map((v, i) => (
          <Item key={v.id} last={i === vacations.length - 1}>
            <Row>
              <View style={{ flex: 1 }}>
                <Body bold>{v.dest}</Body>
                <Body small muted>{isKey(v.start) && isKey(v.end) ? `${dShort(v.start)} – ${dShort(v.end)}` : v.month} · {v.days} giorni{v.hotel ? ` · ${v.hotel}` : ''}</Body>
              </View>
            </Row>
            <Row style={{ marginTop: 6, justifyContent: 'flex-start' }} gap={14}>
              <ChipBtn icon="edit" title="Modifica" onPress={() => setVacId(v.id)} />
              {isKey(v.start) && isKey(v.end) ? <ChipBtn icon="lifetravel" title="Pianifica il viaggio" onPress={() => go('lifetravel', { start: v.start!, end: v.end! })} /> : null}
              <ChipBtn icon="trash" tone="danger" title="Elimina" onPress={() => removeVacation(v)} />
            </Row>
          </Item>
        ))}
      </Card>

      <Card>
        <Row><H>Task</H><Btn small ghost title="+ Task" onPress={() => setTaskSheet(true)} /></Row>
        {tasks.length === 0 && <Empty text="Giornata leggera: nessun task in lista. Raccontami cosa devi fare e lo scomponiamo insieme." />}
        {firstOpen(tasks, taskIsDone, 3).map((t) => <TaskRow key={t.id} task={t} onOpen={setOpenTask} />)}
        {tasks.length > 0 && firstOpen(tasks, taskIsDone, 1).length === 0 && <Empty text="Hai completato tutti i task. Bel lavoro." />}
        {tasks.length > 3 || tasks.some(taskIsDone) ? <Btn small ghost style={{ marginTop: 8 }} title={`Vedi tutti i task (${tasks.filter((x) => !taskIsDone(x)).length} da fare)`} onPress={() => go('lifetask')} /> : null}
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
              <ChipBtn icon="plus" title="+5% progresso" onPress={() => { const p = bumpGoal(g.id); if (p === 100) toast('Obiettivo completato'); }} />
              <ChipBtn icon="trash" tone="danger" title="Rimuovi" onPress={() => removeGoal(g)} />
            </Row>
          </Item>
        ))}
      </Card>

      <AutomationsCard onOpen={() => setAutoSheet(true)} />

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <H>Eliminati di recente</H>
            <Body small muted>{fresh.length === 0 ? `Obiettivi e task eliminati negli ultimi ${TRASH_DAYS} giorni compaiono qui.` : tl('{0} elementi · si conservano {1} giorni', fresh.length, TRASH_DAYS)}</Body>
          </View>
          <Btn small ghost title={trashOpen ? 'Chiudi' : 'Apri'} onPress={() => setTrashOpen(!trashOpen)} />
        </Row>
        {trashOpen && (fresh.length === 0 ? <Empty text="Nessun elemento eliminato di recente." /> : fresh.map((it) => {
          const name = it.kind === 'goal' ? it.goal?.t : it.task?.t;
          const left = Math.max(0, TRASH_DAYS - Math.floor((Date.now() - it.at) / 86400000));
          return (
            <Item key={it.tid}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'flex-start' }} gap={8}><Pill label={it.kind === 'goal' ? 'Obiettivo' : 'Task'} /></Row>
                  <Body bold style={{ marginTop: 4 }}>{name}</Body>
                  <Body small muted>{tl('Eliminato il {0} · ancora {1} giorni', fmtDate(it.at, { day: 'numeric', month: 'short' }), left)}</Body>
                </View>
              </Row>
              <Row style={{ marginTop: 6, justifyContent: 'flex-start' }} gap={14}>
                <Btn small title="Ripristina" icon="repeat" onPress={() => { if (restoreFromTrash(it.tid)) toast(it.kind === 'goal' ? 'Obiettivo ripristinato' : 'Task ripristinato'); }} />
                <ChipBtn icon="trash" tone="danger" title="Elimina per sempre" onPress={() => confirmDelete(tl('definitivamente «{0}»', name ?? ''), () => purgeTrash(it.tid), undefined, { title: 'Eliminare per sempre?', okLabel: 'Elimina per sempre' })} />
              </Row>
            </Item>
          );
        }))}
      </Card>

      <CalendarImportSheet visible={calSheet} onClose={() => setCalSheet(false)} />
      <DaySheet day={day} onClose={() => setDay(null)} onVacation={(id) => setVacId(id)} />
      <VacationSheet id={vacId && bandOf(vacId) ? vacId : null} onClose={() => setVacId(null)} />
      <SmartTaskSheet visible={taskSheet} onClose={() => setTaskSheet(false)} />
      <TaskBreakdownSheet taskId={openTask} onClose={() => setOpenTask(null)} />
      <WorkHoursSheet key={`${wh.start}${wh.end}${whSheet}`} visible={whSheet} onClose={() => setWhSheet(false)} />
      <Sheet visible={goalSheet} title="Nuovo obiettivo" onClose={() => setGoalSheet(false)}>
        <Input placeholder="Es. Imparare lo spagnolo" value={goalText} onChangeText={setGoalText} />
        <Btn title="Aggiungi" onPress={() => { if (!goalText.trim()) return; addGoal(goalText.trim()); setGoalText(''); setGoalSheet(false); toast('Obiettivo creato'); }} />
      </Sheet>
      <AutomationsSheet visible={autoSheet} onClose={() => setAutoSheet(false)} />
    </Page>
  );
}
