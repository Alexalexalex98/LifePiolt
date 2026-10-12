/**
 * Strumenti di sviluppo: un server finto condiviso in memoria e un "altro dispositivo" simulato, per vedere la sincronizzazione
 * funzionare senza server. Attivi solo con l'interruttore di sviluppo in Sincronizzazione. Nessun dato lascia il telefono.
 */
import { memoryState, SyncEngine } from './engine.ts';
import { MockServer, MockServerTransport } from './mockServer.ts';
import { COLLECTIONS } from './registry.ts';

export const devServer = new MockServer();

type Mini = { getState(): Record<string, unknown>; setState(p: Record<string, unknown>): void; subscribe(l: (s: Record<string, unknown>, p: Record<string, unknown>) => void): () => void };
function mini(initial: Record<string, unknown>): Mini {
  let s = initial; const ls = new Set<(s: Record<string, unknown>, p: Record<string, unknown>) => void>();
  return { getState: () => s, setState: (p) => { const prev = s; s = { ...s, ...p }; ls.forEach((l) => l(s, prev)); }, subscribe: (l) => { ls.add(l); return () => ls.delete(l); } };
}

let other: { engine: SyncEngine; life: Mini } | null = null;

/** Un secondo dispositivo finto ("Tablet di prova") che aggiunge un task e modifica una nota. Ritorna cosa ha fatto. */
export async function simulateOtherDevice(noteIdToEdit?: string): Promise<string> {
  if (!other) {
    const life = mini({ tasks: [], goals: [], notes: [], drive: [], events: {}, vacations: [] });
    const st = memoryState({ deviceId: 'tablet-di-prova', deviceName: 'Tablet di prova', enabled: { plan_tasks: true, plan_notes: true } });
    const tr = new MockServerTransport(devServer, { deviceId: 'tablet-di-prova', deviceName: 'Tablet di prova' });
    await tr.connect();
    const engine = new SyncEngine({ bindings: { life } as never, collections: COLLECTIONS, state: st, getTransport: () => tr, config: { pollMs: 0, debounceMs: 0, autoRetry: false } });
    engine.start();
    other = { engine, life };
    await engine.syncNow();
  }
  const { engine, life } = other;
  await engine.syncNow(); // prima scarica le novita' del telefono (note comprese)
  const tasks = (life.getState().tasks as { id: string; t: string }[]) ?? [];
  const n = tasks.length + 1;
  life.setState({ tasks: [...tasks, { id: 'tablet-' + n, t: 'Task creato dal tablet di prova (' + n + ')' }] });
  let what = 'Aggiunto un task dal tablet di prova.';
  if (noteIdToEdit) {
    const notes = (life.getState().notes as { id: string; text: string; date: string }[]) ?? [];
    const has = notes.find((x) => x.id === noteIdToEdit);
    if (has) { life.setState({ notes: notes.map((x) => (x.id === noteIdToEdit ? { ...x, text: x.text + ' [modificata dal tablet]' } : x)) }); what += ' Modificata una nota.'; }
  }
  engine.captureAll();
  await engine.syncNow();
  return what;
}

export function resetDevMock() { other?.engine.stop(); other = null; devServer.deleteAll(); }
