import { crmOf, useCrm } from '@/store/crm';
import { useDocs } from '@/store/docs';
import { useComms } from '@/store/comms';
import { useMeetings } from '@/store/meetings';
import { usePeople } from '@/store/people';
import { useWTasks as useWTasksStore } from '@/store/tasks';
import { useTeams } from '@/store/teams';
import type { SearchItem } from '@/lib/workSearch';

/** Raccoglie dai dati del telefono (cioè solo quelli che il server ti ha dato) ciò che si può cercare: task, clienti, trattative, riunioni, messaggi, persone. */
export function collectSearchItems(): SearchItem[] {
  const out: SearchItem[] = []; const teams = useTeams.getState().teams;
  for (const tm of teams) {
    for (const x of useWTasksStore.getState().tasks[tm.id] ?? []) if (!x.deleted) out.push({ kind: 'task', id: x.id, title: x.title, text: x.notes ?? '', tab: 'task', sub: tm.name });
    const crm = crmOf(tm.id, useCrm.getState().data);
    for (const c of crm.contacts) out.push({ kind: 'client', id: c.id, title: c.name, text: `${c.company} ${c.email} ${c.phone} ${c.address} ${c.notes}`, tab: 'clienti', sub: tm.name });
    for (const d of crm.deals) out.push({ kind: 'deal', id: d.id, title: d.title, text: d.notes ?? '', tab: 'clienti', sub: tm.name });
    for (const p of usePeople.getState().people[tm.id] ?? []) out.push({ kind: 'person', id: p.user_id, title: p.name || '', text: p.position ?? '', tab: 'persone', sub: tm.name });
    for (const d of useDocs.getState().docs[tm.id] ?? []) out.push({ kind: 'doc', id: d.id, title: d.title, text: Object.values(d.fields).join(' '), tab: 'documenti', sub: tm.name });
  }
  for (const m of useMeetings.getState().items) if (!m.deleted) out.push({ kind: 'meeting', id: m.id, title: m.title, text: `${m.agenda} ${m.minutes ?? ''}`, tab: 'piano', sub: m.day });
  const msgs = useComms.getState().msgs;
  for (const [key, list] of Object.entries(msgs)) for (const m of list) out.push({ kind: 'message', id: `${key}-${m.id}`, title: m.text.slice(0, 60), text: m.text, tab: 'messaggi', sub: key.split('|')[1] });
  return out;
}
