import type { SearchDoc } from './types.ts';

/** Estrae i documenti indicizzabili dagli stati degli store (oggetti semplici, nessun import nativo). */
type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Obj[]) : []);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Come noteTitle di src/lib/notes.ts (duplicato per tenere il modulo senza dipendenze). */
export function titleOfNote(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const first = (clean.match(/^.*?[.!?](?=\s|$)/) || [clean])[0];
  const title = first.split(' ').filter(Boolean).slice(0, 7).join(' ').replace(/[.,;:!?]+$/, '');
  return title || 'Nota senza titolo';
}

export const MAX_CHAT_DOCS = 30_000;
/** separa id chat e id messaggio negli id dei documenti di tipo chat */
export const CHAT_SEP = '@@';

export type SearchStates = { life?: Obj; network?: Obj; chat?: Obj; finance?: Obj };

export function buildDocs(s: SearchStates): SearchDoc[] {
  const out: SearchDoc[] = [];
  const life = s.life ?? {};
  for (const n of arr(life.notes)) { const text = str(n.text); if (n.id != null) out.push({ type: 'note', id: str(n.id), title: titleOfNote(text), text, ts: typeof n.ts === 'number' ? n.ts : 0 }); }
  for (const t of arr(life.tasks)) if (t.id != null) out.push({ type: 'task', id: str(t.id), title: str(t.t), text: arr(t.subtasks).map((x) => str(x.t)).join(' ') });
  for (const g of arr(life.goals)) if (g.id != null) out.push({ type: 'goal', id: str(g.id), title: str(g.t), text: '' });
  for (const f of arr(life.drive)) if (f.id != null) out.push({ type: 'file', id: str(f.id), title: str(f.n), text: str(f.folder) });
  const events = life.events && typeof life.events === 'object' && !Array.isArray(life.events) ? (life.events as Record<string, unknown>) : {};
  for (const [day, list] of Object.entries(events)) arr(list).forEach((e, i) => out.push({ type: 'event', id: `${day}#${i}`, title: str(e.title), text: [day, str(e.time), str(e.place)].filter(Boolean).join(' '), ts: Date.parse(day) || 0 }));

  const net = s.network ?? {};
  for (const i of arr(net.ideas)) if (i.id != null) out.push({ type: 'idea', id: str(i.id), title: str(i.title), text: str(i.desc), ts: typeof i.ts === 'number' ? i.ts : 0 });
  for (const p of arr(net.posts)) if (p.id != null) out.push({ type: 'post', id: str(p.id), title: str(p.author), text: str(p.text), ts: typeof p.ts === 'number' ? p.ts : 0 });

  const chat = s.chat ?? {};
  const chats = chat.chats && typeof chat.chats === 'object' ? (chat.chats as Record<string, Obj>) : {};
  const messages = chat.messages && typeof chat.messages === 'object' ? (chat.messages as Record<string, unknown>) : {};
  let budget = MAX_CHAT_DOCS;
  for (const [cid, c] of Object.entries(chats)) { if (c && typeof c === 'object') out.push({ type: 'chat', id: cid, title: str(c.name), text: str(c.description) }); }
  for (const [cid, list] of Object.entries(messages)) {
    const name = str(chats[cid]?.name);
    const ms = arr(list);
    for (let k = ms.length - 1; k >= 0 && budget > 0; k--) {
      const m = ms[k];
      if (!m.text || m.kind === 'system' || m.deletedForAll || m.id == null) continue;
      out.push({ type: 'chat', id: `${cid}${CHAT_SEP}${str(m.id)}`, title: name, text: str(m.text), ts: typeof m.ts === 'number' ? m.ts : 0 });
      budget--;
    }
  }

  const fin = s.finance ?? {};
  for (const inv of arr(fin.invoices)) if (inv.id != null) out.push({ type: 'bill', id: str(inv.id), title: str(inv.issuer), text: [str(inv.kind), str(inv.number), str(inv.dueDate)].filter(Boolean).join(' ') });
  return out;
}
