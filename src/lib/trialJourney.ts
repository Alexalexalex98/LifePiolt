import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useMemos } from '@/store/memos';
import { useWellbeing } from '@/store/wellbeing';

export type JourneyItem = { id: string; label: string; why: string; done: boolean; page: string };

/** Cosa mi serve per conoscerti e darti feedback utili: ogni voce dice a cosa serve ed è fatta quando nell'app ci sono i dati. */
export function journeyItems(): JourneyItem[] {
  const h = useHealth.getState();
  const l = useLife.getState();
  const f = useFin.getState();
  const fit = useFitness.getState();
  const wb = useWellbeing.getState();
  const days = (h.moods ?? []).length;
  return [
    { id: 'mood', label: 'Segnare come ti senti, qualche giorno', why: 'Serve a capire cosa ti fa stare meglio.', done: days >= 3, page: 'home' },
    { id: 'sleep', label: 'Collegare Apple Health o segnare il sonno', why: 'Sonno e passi sono la base del Life Score.', done: (h.series?.sleep?.length ?? 0) > 0, page: 'lifehealth' },
    { id: 'goals', label: 'Scrivere almeno un obiettivo', why: 'Così posso dirti a che punto sei.', done: l.goals.length > 0, page: 'lifetask' },
    { id: 'tasks', label: 'Aggiungere i tuoi task o impegni', why: 'Per aiutarti a organizzare le giornate.', done: l.tasks.length > 0 || Object.values(l.events ?? {}).some((x) => x.length > 0), page: 'lifetask' },
    { id: 'money', label: 'Caricare un estratto conto o i primi movimenti', why: 'Per mostrarti dove vanno i soldi e le scadenze.', done: (f.months?.length ?? 0) > 0 || !!f.statementInfo, page: 'lifefinance' },
    { id: 'food', label: 'Segnare un pasto o l\'acqua', why: 'Per collegare alimentazione, energia e umore.', done: (fit.meals?.length ?? 0) > 0, page: 'lifefitness' },
    { id: 'remind', label: 'Creare un promemoria', why: 'Per non dimenticare le cose importanti.', done: useMemos.getState().memos.length > 0, page: 'reminders' },
    { id: 'who5', label: 'Rispondere al questionario del benessere (facoltativo)', why: 'Rende il Life Score più affidabile.', done: wb.results.length > 0, page: 'lifehealth' },
  ];
}
