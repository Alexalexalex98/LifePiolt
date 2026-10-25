import { create } from 'zustand';

import { uid } from '@/lib/format';
import { MAX_DEPTH, MAX_NODES, buildTree, depthOf, isLeaf, parseOutline, rootOf, subtreeIds, type PNode } from '@/lib/projectTree';

import { persisted } from './persist';

/** I progetti ad albero (task con sotto-task a più livelli). Restano sul telefono. */
type State = {
  nodes: PNode[];
  importText: (text: string) => { roots: number; count: number; truncated: boolean };
  addChild: (parent: string | null, title: string) => string | null;
  rename: (id: string, title: string) => void;
  setNote: (id: string, note: string) => void;
  /** spunta una foglia; un padre non si spunta a mano */
  toggle: (id: string) => boolean;
  remove: (id: string) => string[];
  attach: (id: string, fileId: string) => void;
  detach: (id: string, fileId: string) => void;
  setShared: (rootId: string, names: string[]) => void;
  addComment: (id: string, by: string, text: string) => boolean;
  removeComment: (id: string, commentId: string) => void;
  reset: () => void;
};
const mk = (parent: string | null, title: string, done = false, note?: string): PNode => ({ id: uid(), parent, title: title.trim().slice(0, 200), done, ...(note ? { note } : null), files: [], shared: [], createdAt: Date.now() });

export const useProjects = create<State>()(persisted<State>('projects', (set, get) => ({
  nodes: [],
  importText: (text) => {
    const { items } = parseOutline(text);
    const room = Math.max(0, MAX_NODES - get().nodes.length);
    const { nodes: parsed, truncated } = buildTree(items, room);
    const made: PNode[] = parsed.map((n) => mk(null, n.title, n.done, n.note));
    parsed.forEach((n, i) => { made[i]!.parent = n.parentIndex === null ? null : made[n.parentIndex]!.id; });
    if (made.length) set((s) => ({ nodes: [...s.nodes, ...made] }));
    return { roots: made.filter((n) => n.parent === null).length, count: made.length, truncated };
  },
  addChild: (parent, title) => {
    const t = title.trim(); if (!t) return null;
    const s = get().nodes;
    if (s.length >= MAX_NODES || (parent && depthOf(s, parent) >= MAX_DEPTH)) return null;
    const n = mk(parent, t);
    set({ nodes: [...s, n] });
    return n.id;
  },
  rename: (id, title) => { const t = title.trim().slice(0, 200); if (t) set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, title: t } : n)) })); },
  setNote: (id, note) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, note: note.trim().slice(0, 400) || undefined } : n)) })),
  toggle: (id) => {
    const s = get().nodes; if (!isLeaf(s, id)) return false;
    set({ nodes: s.map((n) => (n.id === id ? { ...n, done: !n.done } : n)) });
    return true;
  },
  remove: (id) => {
    const ids = new Set(subtreeIds(get().nodes, id));
    const files = get().nodes.filter((n) => ids.has(n.id)).flatMap((n) => n.files);
    set((s) => ({ nodes: s.nodes.filter((n) => !ids.has(n.id)) }));
    return files;
  },
  attach: (id, fileId) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, files: [...n.files, fileId] } : n)) })),
  detach: (id, fileId) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, files: n.files.filter((f) => f !== fileId) } : n)) })),
  setShared: (rootId, names) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === rootId ? { ...n, shared: [...new Set(names)] } : n)) })),
  addComment: (id, by, text) => {
    const tx = text.trim().slice(0, 1000); if (!tx || !get().nodes.some((n) => n.id === id)) return false;
    const c = { id: uid(), by: by.trim().slice(0, 60) || 'Io', text: tx, at: Date.now() };
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, comments: [...(n.comments ?? []), c].slice(-200) } : n)) }));
    return true;
  },
  removeComment: (id, commentId) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, comments: (n.comments ?? []).filter((c) => c.id !== commentId) } : n)) })),
  reset: () => set({ nodes: [] }),
})));
export { rootOf };
