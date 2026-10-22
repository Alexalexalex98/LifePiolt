import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { InfoTip } from '@/components/InfoTip';
import { Switch } from 'react-native';
import { Body, Btn, Card, H, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { applyWeekPlan, collectWeekInput, undoWeekPlan } from '@/lib/theia/collectWeek';
import { dayKeyOf } from '@/lib/theia/core';
import { dayLabel, itemTitle, planWeek, type WItem } from '@/lib/theia/week';
import { DEFAULT_LUNCH, lunchMinutes } from '@/lib/fitness/lunch';
import { useFitness } from '@/store/fitness';
import { toast, showUndoToast } from '@/store/toast';

const KIND: Record<WItem['kind'], { label: string; color: string }> = { allenamento: { label: 'Allenamento', color: '#ff9d6e' }, task: { label: 'Task', color: '#8fb3ff' }, sonno: { label: 'Sonno', color: '#c9b6ff' }, pausa: { label: 'Pausa', color: '#7fd6a4' } };
const shiftTime = (h: string, add: number) => { const m = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + add; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const end = (it: WItem) => { const m = Number(it.time.slice(0, 2)) * 60 + Number(it.time.slice(3)) + it.dur; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** La settimana proposta da Theia: la guardi, togli ciò che non vuoi, poi la aggiungi al Plan (e puoi annullare tutto). */
export default function WeekPlan() {
  const t = useTheme();
  const [opts, setOpts] = useState({ workouts: true, tasks: true, sleep: true });
  const [off, setOff] = useState<string[]>([]);
  const lunch = useFitness((x) => x.lunch) ?? DEFAULT_LUNCH;
  const setLunch = useFitness((x) => x.setLunch);
  const plan = useMemo(() => planWeek(collectWeekInput(opts)), [opts, lunch]);
  const today = dayKeyOf(Date.now());
  const chosen = plan.items.filter((x) => !off.includes(x.id));
  const toggle = (id: string) => setOff((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const confirm = () => {
    if (!chosen.length) { toast('Non c\'è niente da aggiungere'); return; }
    const batch = applyWeekPlan(chosen);
    showUndoToast(tl('Aggiunte {0} voci al Plan', chosen.length), () => { undoWeekPlan(batch); });
    go('plan');
  };
  return (
    <Page id="weekPlan" back title="La tua settimana">
      <Card accent="#8fa4ff">
        <Row><H style={{ flex: 1 }}>Proposta di Theia</H><InfoTip title="Come ho preparato la settimana" body={['Ho messo gli allenamenti previsti, i task più importanti e il ricordo per andare a letto prima di un turno presto, solo nei momenti liberi. Turni e impegni restano occupati, con un\'ora di margine attorno ai turni, e ogni giorno lascio del tempo libero.', 'È una proposta fatta con regole semplici, non con l\'AI. Togli quello che non ti serve, poi aggiungila al Plan: puoi annullare tutto subito dopo.']} /></Row>
        <Body small muted>Controlla cosa vuoi tenere. Non cambia niente finché non confermi.</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          <Pill label="Allenamenti" on={opts.workouts} onPress={() => setOpts({ ...opts, workouts: !opts.workouts })} />
          <Pill label="Task" on={opts.tasks} onPress={() => setOpts({ ...opts, tasks: !opts.tasks })} />
          <Pill label="A letto prima dei turni" on={opts.sleep} onPress={() => setOpts({ ...opts, sleep: !opts.sleep })} />
        </Row>
      </Card>

      <Card>
        <Row><View style={{ flex: 1 }}><H>Pausa pranzo</H><Body small muted>{lunch.on ? tl('Dalle {0} alle {1}: la tengo libera e, se apri l\'app in quell\'ora, ti chiedo se hai mangiato.', lunch.from, lunch.to) : 'Se la imposti, la tengo libera nel piano e ti chiedo se hai mangiato.'}</Body></View><Switch value={lunch.on} onValueChange={(v) => setLunch({ on: v })} accessibilityLabel="Pausa pranzo" /></Row>
        {lunch.on ? (
          <View style={{ marginTop: 8 }}>
            <Body small bold style={{ marginBottom: 6 }}>Inizia alle</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
              {['12:00', '12:30', '13:00', '13:30', '14:00'].map((h) => <Pill key={h} label={h} on={lunch.from === h} onPress={() => setLunch({ from: h, to: shiftTime(h, lunchMinutes(lunch)) })} />)}
            </Row>
            <Body small bold style={{ marginTop: 8, marginBottom: 6 }}>Dura</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
              {[30, 45, 60, 90].map((m) => <Pill key={m} label={`${m} min`} on={lunchMinutes(lunch) === m} onPress={() => setLunch({ to: shiftTime(lunch.from, m) })} />)}
            </Row>
          </View>
        ) : null}
      </Card>

      {plan.days.map((d) => {
        const list = plan.items.filter((x) => x.day === d);
        if (!list.length) return null;
        return (
          <Card key={d}>
            <H style={{ textTransform: 'capitalize' }}>{tl(dayLabel(d, today))}</H>
            {list.map((it) => {
              const on = !off.includes(it.id);
              return (
                <Pressable key={it.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={itemTitle(it.title, tl)} onPress={() => toggle(it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.border }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? KIND[it.kind].color : t.border, backgroundColor: on ? KIND[it.kind].color : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <Icon name="check" size={14} color="#07090d" stroke={3} /> : null}</View>
                  <View style={{ flex: 1, opacity: on ? 1 : 0.5 }}>
                    <Body bold>{itemTitle(it.title, tl)}</Body>
                    <Body small muted>{it.kind === 'sonno' ? it.time : `${it.time}-${end(it)}`} · {tl(KIND[it.kind].label)}</Body>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        );
      })}
      {!plan.items.length ? <Card><Body muted>Non ho trovato niente da aggiungere: o è già tutto in ordine, o i giorni sono pieni, o non hai allenamenti, task e turni da pianificare.</Body></Card> : null}

      {plan.notes.length ? (
        <Card>
          <H>Da sapere</H>
          {plan.notes.map((n) => <Body key={n} small muted style={{ marginTop: 4 }}>{n}</Body>)}
        </Card>
      ) : null}

      <Btn icon="check" title={chosen.length ? tl('Aggiungi {0} voci al Plan', chosen.length) : 'Aggiungi al Plan'} disabled={!chosen.length} onPress={confirm} />
    </Page>
  );
}
