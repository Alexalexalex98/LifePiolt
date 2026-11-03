import { create } from 'zustand';

import { persisted } from './persist';

import { TEMPLATES } from '@/lib/workspaceViews';
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
  addRows: (pid: string, items: { title: string; date?: string }[]) => void;
  fromTemplate: (parent: string | null, tplId: string, teamId?: string) => string;
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
    addRows: (pid, items) => set((s) => upd(s, pid, (p) => {
      const cols = p.cols ?? []; const name = cols[0]?.id; const date = cols.find((c) => c.kind === 'date')?.id; const st = cols.find((c) => c.kind === 'status')?.id;
      if (!name) return p;
      return { ...p, rows: [...(p.rows ?? []), ...items.map((it) => ({ id: uid(), u: Date.now(), cells: { [name]: it.title, ...(date && it.date ? { [date]: it.date } : {}), ...(st ? { [st]: STATUSES[0]! } : {}) } }))] };
    })),
    fromTemplate: (parent, tplId, teamId) => {
      const tpl = TEMPLATES.find((x) => x.id === tplId); if (!tpl) return get().addPage(parent, 'page', '', teamId);
      const id = get().addPage(parent, tpl.kind, tpl.name, teamId);
      if (tpl.kind === 'page') set((s) => upd(s, id, (p) => ({ ...p, blocks: tpl.blocks!.map((b) => ({ id: uid(), t: b.t, text: b.text, u: Date.now() })) })));
      else {
        set((s) => upd(s, id, (p) => ({ ...p, cols: tpl.cols!.map((c, i) => ({ id: i === 0 ? 'c1' : i === 1 && c.kind === 'status' ? 'c2' : uid(), name: c.name, kind: c.kind, u: Date.now() })), view: tpl.view ?? 'table' })));
        get().addRows(id, (tpl.rows ?? []).map((title) => ({ title })));
      }
      return id;
    },
    patchRow: (pid, rid, cell, v) => set((s) => upd(s, pid, (p) => ({ ...p, rows: (p.rows ?? []).map((r) => (r.id === rid ? { ...r, cells: { ...r.cells, [cell]: v }, u: Date.now() } : r)) }))),
    delRow: (pid, rid) => set((s) => upd(s, pid, (p) => ({ ...p, rows: (p.rows ?? []).filter((r) => r.id !== rid), ...(p.teamId ? { tomb: [...(p.tomb ?? []), { id: rid, u: Date.now(), k: 'r' as const }] } : {}) }))),
    addComment: (pid, text) => set((s) => upd(s, pid, (p) => ({ ...p, comments: [...p.comments, { id: uid(), ts: Date.now(), text: text.trim() }] }))),
    attach: (pid, fileId) => set((s) => upd(s, pid, (p) => (p.files.includes(fileId) ? p : { ...p, files: [...p.files, fileId] }))),
    detach: (pid, fileId) => set((s) => upd(s, pid, (p) => ({ ...p, files: p.files.filter((f) => f !== fileId), ...(p.teamId ? { tomb: [...(p.tomb ?? []), { id: fileId, u: Date.now(), k: 'f' as const }] } : {}) }))),
  }), (s) => ({ pages: s.pages })),
);
