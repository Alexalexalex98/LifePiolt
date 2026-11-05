import { supa } from '@/lib/accountApi';
import { mergeItems, type Block, type Col, type Row, type WsPage } from '@/lib/workspaceCore';
import { raw } from '@/lib/teams';
import { useTeams } from '@/store/teams';
import { useWorkspace } from '@/store/workspace';

/**
 * Pagine condivise in tempo reale: ogni modifica locale si manda al server (che unisce le modifiche di tutti, vince la più recente per elemento)
 * e ogni modifica degli altri arriva subito (Realtime di Supabase) e si unisce a quella locale.
 */
type Item = { id: string; u?: number; o?: number; del?: boolean };
type Wire = { id: string; team_id: string; parent: string | null; title: string; title_u: number; kind: 'page' | 'db'; blocks: Item[]; cols: Item[]; rows: Item[]; comments: Item[]; files: Item[]; deleted?: boolean };

export function toWire(p: WsPage): Wire {
  const tomb = (k: 'b' | 'r' | 'c' | 'f') => (p.tomb ?? []).filter((x) => x.k === k).map((x) => ({ id: x.id, u: x.u, del: true }));
  const base = p.updatedAt;
  return {
    id: p.id, team_id: p.teamId!, parent: p.parent, title: p.title, title_u: p.titleU ?? base, kind: p.kind,
    blocks: [...p.blocks.map((b, i) => ({ ...b, o: i, u: b.u ?? base })), ...tomb('b')],
    cols: [...(p.cols ?? []).map((c, i) => ({ ...c, o: i, u: c.u ?? base })), ...tomb('c')],
    rows: [...(p.rows ?? []).map((r, i) => ({ ...r, o: i, u: r.u ?? base })), ...tomb('r')],
    comments: p.comments.map((c) => ({ ...c, u: c.ts })),
    files: [...p.files.map((id) => ({ id, u: base })), ...tomb('f')],
  };
}

type WireRow = Wire & { deleted: boolean };
/** Unisce la pagina che arriva dal server con quella locale (le modifiche locali più recenti restano). */
export function fromWire(w: WireRow, local?: WsPage): WsPage {
  const lw = local ? toWire(local) : null;
  const m = (a: Item[], b: Item[] | undefined) => mergeItems<Item>(a, b ?? []);
  const blocks = m(lw?.blocks ?? [], w.blocks), cols = m(lw?.cols ?? [], w.cols), rows = m(lw?.rows ?? [], w.rows), comments = m(lw?.comments ?? [], w.comments), files = m(lw?.files ?? [], w.files);
  const live = <T extends Item>(a: T[]) => a.filter((x) => !x.del);
  const tomb = (a: Item[], k: 'b' | 'r' | 'c' | 'f') => a.filter((x) => x.del).map((x) => ({ id: x.id, u: x.u ?? 0, k }));
  const useTitle = !lw || w.title_u >= lw.title_u;
  return {
    id: w.id, parent: w.parent, kind: w.kind, teamId: w.team_id,
    title: useTitle ? w.title : local!.title, titleU: Math.max(w.title_u, lw?.title_u ?? 0),
    blocks: live(blocks) as unknown as Block[], cols: live(cols) as unknown as Col[], rows: live(rows) as unknown as Row[],
    comments: live(comments).map((c) => ({ id: c.id, ts: (c as unknown as { ts?: number }).ts ?? c.u ?? 0, text: (c as unknown as { text?: string }).text ?? '' })),
    files: live(files).map((f) => f.id),
    tomb: [...tomb(blocks, 'b'), ...tomb(cols, 'c'), ...tomb(rows, 'r'), ...tomb(files, 'f')],
    updatedAt: Date.now(),
    ...(w.kind === 'db' ? { view: local?.view ?? 'table' } : {}),
  } as WsPage;
}

const lastPushed = new Map<string, string>();
const sig = (p: WsPage) => JSON.stringify(toWire(p), (k, v) => (k === 'updatedAt' ? undefined : v));

function apply(row: WireRow) {
  if (row.deleted) { useWorkspace.setState((s) => ({ pages: s.pages.filter((p) => p.id !== row.id) })); return; }
  useWorkspace.setState((s) => {
    const local = s.pages.find((p) => p.id === row.id);
    const next = fromWire(row, local);
    lastPushed.set(next.id, sig(next));
    return { pages: local ? s.pages.map((p) => (p.id === next.id ? next : p)) : [...s.pages, next] };
  });
}

export async function pushPage(p: WsPage): Promise<void> {
  const s = sig(p);
  if (lastPushed.get(p.id) === s) return;
  lastPushed.set(p.id, s);
  try {
    const row = await (await supa()).rpc<WireRow>('team_page_save', { p: toWire(p) });
    if (row) apply(row);
  } catch { lastPushed.delete(p.id); /* senza rete: si riprova alla prossima modifica */ }
}

export async function deleteSharedPage(id: string): Promise<void> {
  const p = useWorkspace.getState().pages.find((x) => x.id === id);
  if (!p?.teamId) return;
  try { await (await supa()).rpc('team_page_save', { p: { ...toWire(p), deleted: true } }); } catch { /* ignora */ }
}

export async function pullTeamPages(teamId: string): Promise<void> {
  try {
    const q = (await raw()).from('team_pages').select('*').eq('team_id', teamId) as unknown as Promise<{ data: WireRow[] | null }>;
    for (const row of (await q).data ?? []) apply(row);
  } catch { /* offline */ }
}

let started = false;
let channels: unknown[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Avvia la sincronizzazione: scarica le pagine dei team, ascolta le modifiche degli altri e manda le tue. Si può chiamare più volte. */
export async function startTeamSync(): Promise<void> {
  try {
    const c = await raw();
    for (const ch of channels) c.removeChannel(ch);
    channels = [];
    for (const t of useTeams.getState().teams) {
      await pullTeamPages(t.id);
      const ch = c.channel(`team-pages-${t.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_pages', filter: `team_id=eq.${t.id}` }, (payload: { new?: WireRow }) => { if (payload?.new?.id) apply(payload.new); }).subscribe();
      channels.push(ch);
    }
    void (await import('@/lib/teamWork')).startWorkSync(); void (await import('@/lib/teamNotify')).watchNotifs();
    if (!started) {
      started = true;
      useWorkspace.subscribe((s, prev) => {
        if (s.pages === prev.pages) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { s.pages.filter((p) => p.teamId).forEach((p) => { void pushPage(p); }); }, 700);
      });
    }
  } catch { /* senza server: le pagine condivise restano sul telefono */ }
}
export function stopTeamSync(): void { void raw().then((c) => { channels.forEach((ch) => c.removeChannel(ch)); channels = []; }).catch(() => undefined); }
