import { demoAutomations, demoBills, demoDrive, demoEvents, demoGoals, demoHealth, demoInsights, demoMonths, demoNotes, demoTasks } from '@/data/seed';
import { defaultBudget, defaultCategories, defaultWatchlist, useFin } from './finance';
import { useHealth } from './health';
import { useLife } from './life';

/** Carica i dati d'esempio del prototipo in tutti gli store. */
export function applyDemo() {
  useLife.setState({ tasks: demoTasks(), goals: demoGoals(), automations: demoAutomations(), notes: demoNotes(), drive: demoDrive(), events: demoEvents() });
  const h = demoHealth();
  useHealth.setState({ series: h.series, workouts: h.workouts, mindSessions: h.mindSessions, moods: h.moods });
  const months = demoMonths();
  useFin.setState({
    months, insights: demoInsights(), savingsPct: 6.5, bills: demoBills(), cash: 5000, stocks: defaultWatchlist(true),
    tax: { married: false, children: false, banks: ['UBS'], docs: {} },
    budget: defaultBudget(6500, true, defaultCategories, months),
  });
}

export function resetAllData() {
  useLife.getState().reset();
  useHealth.getState().reset();
  useFin.getState().reset();
}
