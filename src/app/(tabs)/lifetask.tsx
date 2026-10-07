import { useState } from 'react';
import { View } from 'react-native';

import { SmartTaskSheet, TaskBreakdownSheet, TaskRow } from '@/components/plan';
import { Body, Btn, Card, Empty, Page, Row, Seg } from '@/components/ui';
import { taskIsDone, useLife } from '@/store/life';

export default function LifeTask() {
  const tasks = useLife((s) => s.tasks);
  const [filter, setFilter] = useState('Tutti');
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  let active = 0, done = 0, hours = 0;
  tasks.forEach((t) => {
    if (t.subtasks?.length) hours += t.subtasks.reduce((s, x) => s + x.h, 0);
    if (taskIsDone(t)) done++; else active++;
  });
  const list = tasks.filter((t) => (filter === 'Attivi' ? !taskIsDone(t) : filter === 'Completati' ? taskIsDone(t) : true));
  const Stat = ({ l, v }: { l: string; v: string | number }) => <View><Body small muted>{l}</Body><Body bold style={{ fontSize: 20 }}>{v}</Body></View>;

  return (
    <Page id="lifetask" title="LifeTask" back>
      <Card><Row><Stat l="Attivi" v={active} /><Stat l="Completati" v={done} /><Stat l="Ore pianificate" v={`${hours}h`} /></Row></Card>
      <Btn small ghost style={{ marginBottom: 14 }} title="+ Task" onPress={() => setSheet(true)} />
      <Seg options={['Tutti', 'Attivi', 'Completati']} value={filter} onChange={setFilter} />
      <Card>
        {list.length === 0 ? <Empty text="Ancora nessun task qui: aggiungine uno quando vuoi." /> : list.map((t) => <TaskRow key={t.id} task={t} onOpen={setOpen} />)}
      </Card>
      <SmartTaskSheet visible={sheet} onClose={() => setSheet(false)} />
      <TaskBreakdownSheet taskId={open} onClose={() => setOpen(null)} />
    </Page>
  );
}
