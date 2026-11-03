import { create } from 'zustand';

import { persisted } from './persist';

import { STATUSES, childrenOf, descendants, type Block, type BlockType, type Col, type ColKind, type Row, type WsComment, type WsPage } from '@/lib/workspaceCore';
export { STATUSES, childrenOf, descendants, pageText, pathOf, slashCommand } from '@/lib/workspaceCore';
export type { Block, BlockType, Col, ColKind, Row, WsComment, WsPage } from '@/lib/workspaceCore';

type State = {
  pages: WsPage[];
  addPage: (parent: string | null, kind?: 'page' | 'db', title?: string, teamId?: string) => string;
  patch: (id: string, p: Partial<WsPage>) => void;
  remove: (id: string) => WsPage[];
  restore: (list: WsPage[]) => void;
  addBlock: (pid: string, t?: BlockType, text?: string) => string;
  patchBlock: (pid: string, bid: string, p: Partial<Block>) => void;
  delBlock: (pid: string, bid: string) => void;
  moveBlock: (pid: string, bid: string, dir: -1 | 1) => void;
  addCol: (pid: string, name: string, kind: ColKind) => void;
  addRow: (pid: string) => string;
  patchRow: (pid: string, rid: string, cell: string, v: string) => void;
  delRow: (pid: string, rid: string) => void;
  addComment: (pid: string, text: string) => void;
  attach: (pid: string, fileId: string) => void;
  detach: (pid: string, fileId: string) => void;
};
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const upd = (s: State, id: string, f: (p: WsPage) => WsPage): Pick<State, 'pages'> => ({ pages: s.pages.map((p) => (p.id === id ? { ...f(p), updatedAt: Date.now() } : p)) });
export const useWorkspace = create<State>()(
  persisted<State>('workspace', (set, get) => ({
    pages: [],
    addPage: (parent, kind = 'page', title = '', teamId) => {
      const id = uid();
      const p: WsPage = { id, parent, title, kind, blocks: kind === 'page' ? [{ id: uid(), t: 'p', text: '' }] : [], comments: [], files: [], updatedAt: Date.now(), ...(teamId ? { teamId, titleU: Date.now() } : {}),
        ...(kind === 'db' ? { cols: [{ id: 'c1', name: 'Nome', kind: 'text' as const }, { id: 'c2', name: 'Stato', kind: 'status' as const }], rows: [], view: 'table' as const } : {}) };
      set((s) => ({ pages: [...s.pages, p] }));
      return id;
    },
    patch: (id, p) => set((s) => upd(s, id, (x) => ({ ...x, ...p, ...(p.title !== undefined ? { titleU: Date.now() } : {}) }))),
    remove: (id) => { const ids = new Set([id, ...descendants(get().pages, id)]); const gone = get().pages.filter((p) => ids.has(p.id)); set((s) => ({ pages: s.pages.filter((p) => !ids.has(p.id)) })); return gone; },
    restore: (list) => set((s) => ({ pages: [...s.pages, ...list.filter((p) => !s.pages.some((x) => x.id === p.id))] })),
    addBlock: (pid, t = 'p', text = '') => { const id = uid(); set((s) => upd(s, pid, (p) => ({ ...p, blocks: [...p.blocks, { id, t, text, u: Date.now() }] }))); return id; },
    patchBlock: (pid, bid, patch) => set((s) => upd(s, pid, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === bid ? { ...b, ...patch, u: Date.now() } : b)) }))),
    delBlock: (pid, bid) => set((s) => upd(s, pid, (p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== bid), ...(p.teamId ? { tomb: [...(p.tomb ?? []), { id: bid, u: Date.now(), k: 'b' as const }] } : {}) }))),
    moveBlock: (pid, bid, dir) => set((s) => upd(s, pid, (p) => { const i = p.blocks.findIndex((b) => b.id === bid); const j = i + dir; if (i < 0 || j < 0 || j >= p.blocks.length) return p; const a = p.blocks.slice(); [a[i], a[j]] = [a[j]!, a[i]!]; return { ...p, blocks: a.map((b, k) => (k === i || k === j ? { ...b, u: Date.now() } : b)) }; })),
    addCol: (pid, name, kind) => set((s) => upd(s, pid, (p) => ({ ...p, cols: [...(p.cols ?? []), { id: uid(), name: name.trim() || 'Colonna', kind, u: Date.now() }] }))),
    addRow: (pid) => { const id = uid(); set((s) => upd(s, pid, (p) => ({ ...p, rows: [...(p.rows ?? []), { id, cells: {}, u: Date.now() }] }))); return id; },
    patchRow: (pid, rid, cell, v) => set((s) => upd(s, pid, (p) => ({ ...p, rows: (p.rows ?? []).map((r) => (r.id === rid ? { ...r, cells: { ...r.cells, [cell]: v }, u: Date.now() } : r)) }))),
    delRow: (pid, rid) => set((s) => upd(s, pid, (p) => ({ ...p, rows: (p.rows ?? []).filter((r) => r.id !== rid), ...(p.teamId ? { tomb: [...(p.tomb ?? []), { id: rid, u: Date.now(), k: 'r' as const }] } : {}) }))),
    addComment: (pid, text) => set((s) => upd(s, pid, (p) => ({ ...p, comments: [...p.comments, { id: uid(), ts: Date.now(), text: text.trim() }] }))),
    attach: (pid, fileId) => set((s) => upd(s, pid, (p) => (p.files.includes(fileId) ? p : { ...p, files: [...p.files, fileId] }))),
    detach: (pid, fileId) => set((s) => upd(s, pid, (p) => ({ ...p, files: p.files.filter((f) => f !== fileId), ...(p.teamId ? { tomb: [...(p.tomb ?? []), { id: fileId, u: Date.now(), k: 'f' as const }] } : {}) }))),
  }), (s) => ({ pages: s.pages })),
);
