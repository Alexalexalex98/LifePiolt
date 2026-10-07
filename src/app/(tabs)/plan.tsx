import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Empty, H, Input, Row, Screen, Progress } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

export default function Plan() {
  const t = useTheme();
  const { tasks, goals, addTask, toggleTask, removeTask, addGoal, setGoalProgress, removeGoal } = useStore();
  const [task, setTask] = useState('');
  const [goal, setGoal] = useState('');

  return (
    <Screen title="Plan">
      <Card>
        <H>Task</H>
        <Input placeholder="Nuova attività" value={task} onChangeText={setTask} returnKeyType="done"
          onSubmitEditing={() => { if (task.trim()) { addTask(task.trim()); setTask(''); } }} />
        <Button small title="Aggiungi task" onPress={() => { if (task.trim()) { addTask(task.trim()); setTask(''); } }} />
        <View style={{ marginTop: 8 }}>
          {tasks.length === 0 && <Empty text="Nessun task. Aggiungi il primo." />}
          {tasks.map((x) => (
            <Row key={x.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <Pressable style={{ flex: 1 }} onPress={() => toggleTask(x.id)} accessibilityRole="checkbox" accessibilityState={{ checked: x.done }}>
                <Text style={{ color: x.done ? t.muted : t.text, fontSize: 15, textDecorationLine: x.done ? 'line-through' : 'none' }}>
                  {x.done ? '☑ ' : '☐ '}{x.title}
                </Text>
              </Pressable>
              <Pressable onPress={() => removeTask(x.id)} hitSlop={10} accessibilityLabel="Elimina task"><Text style={{ color: t.muted }}>✕</Text></Pressable>
            </Row>
          ))}
        </View>
      </Card>

      <Card>
        <H>Obiettivi</H>
        <Input placeholder="Nuovo obiettivo" value={goal} onChangeText={setGoal} returnKeyType="done"
          onSubmitEditing={() => { if (goal.trim()) { addGoal(goal.trim()); setGoal(''); } }} />
        <Button small title="Aggiungi obiettivo" onPress={() => { if (goal.trim()) { addGoal(goal.trim()); setGoal(''); } }} />
        <View style={{ marginTop: 8 }}>
          {goals.length === 0 && <Empty text="Nessun obiettivo ancora." />}
          {goals.map((g) => (
            <View key={g.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <Row>
                <Body style={{ flex: 1, fontWeight: '600' }}>{g.title}</Body>
                <Pressable onPress={() => removeGoal(g.id)} hitSlop={10} accessibilityLabel="Elimina obiettivo"><Text style={{ color: t.muted }}>✕</Text></Pressable>
              </Row>
              <Progress value={g.progress} />
              <Row style={{ marginTop: 8 }}>
                <Button small ghost title="−10%" onPress={() => setGoalProgress(g.id, g.progress - 10)} />
                <Body muted>{g.progress}%</Body>
                <Button small ghost title="+10%" onPress={() => setGoalProgress(g.id, g.progress + 10)} />
              </Row>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
