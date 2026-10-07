import { go } from '@/lib/nav';
import { askTheia, type TheiaRequest } from '@/lib/theia';
import { useAssistant, type AMsg } from '@/store/assistant';
import { Assistant } from './engine';
import { makeEnv } from './env';

let engine: Assistant | null = null;
export const getAssistant = () => (engine ??= new Assistant(makeEnv()));

/**
 * Unico punto d'ingresso per LifeChat e per Theia.
 * 1) le regole locali capiscono i comandi (piano, task, profilo, report...) senza AI e senza rete;
 * 2) se non capiscono, e solo allora, la domanda va al server AI (se c'è) o alle risposte locali di Theia.
 */
export async function sendToAssistant(text: string, opts: { source?: 'chat' | 'theia'; req?: TheiaRequest } = {}): Promise<AMsg> {
  const store = useAssistant.getState();
  const req = opts.req;
  store.push({ who: 'me', text, source: opts.source ?? 'chat', image: req?.imageUri });
  const eng = getAssistant();
  const hasContext = !!(req?.imageUri || req?.text);
  try {
    if (!hasContext || eng.pending) {
      const r = await eng.handle(text);
      if (r.handled) {
        const m = useAssistant.getState().push({ who: 'ai', text: r.text, chips: r.chips, source: opts.source ?? 'chat' });
        if (r.navigate) go(r.navigate);
        return m;
      }
    }
    const a = await askTheia(text, req ?? { source: 'free' });
    return useAssistant.getState().push({ who: 'ai', text: a.text, source: opts.source ?? 'chat' });
  } catch {
    return useAssistant.getState().push({ who: 'ai', text: 'Non riesco a raggiungere il server. I comandi sul tuo piano, i task e i report funzionano comunque.', source: opts.source ?? 'chat' });
  }
}
