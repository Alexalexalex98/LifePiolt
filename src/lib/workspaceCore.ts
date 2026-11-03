/** Tipi e funzioni pure di LifeWorkspace (si provano con node:test). */
export type BlockType = 'h' | 'p' | 'todo' | 'bullet' | 'quote' | 'divider' | 'link';
export type Block = { id: string; t: BlockType; text: string; done?: boolean; /** id della pagina collegata */ ref?: string };
export type ColKind = 'text' | 'status' | 'number' | 'date';
export type Col = { id: string; name: string; kind: ColKind };
export type Row = { id: string; cells: Record<string, string> };
export type WsComment = { id: string; ts: number; text: string };
export type WsPage = {
  id: string; parent: string | null; title: string; kind: 'page' | 'db'; blocks: Block[];
  cols?: Col[]; rows?: Row[]; view?: 'table' | 'kanban';
  comments: WsComment[]; /** id dei file di LifeDrive collegati */ files: string[]; updatedAt: number;
};
export const STATUSES = ['Da fare', 'In corso', 'Fatto'];

export const childrenOf = (pages: WsPage[], parent: string | null) => pages.filter((p) => p.parent === parent).sort((a, b) => a.updatedAt - b.updatedAt);
export const descendants = (pages: WsPage[], id: string): string[] => childrenOf(pages, id).flatMap((c) => [c.id, ...descendants(pages, c.id)]);
export const pathOf = (pages: WsPage[], id: string): WsPage[] => { const out: WsPage[] = []; let cur = pages.find((p) => p.id === id); let n = 0; while (cur && n++ < 20) { out.unshift(cur); cur = cur.parent ? pages.find((p) => p.id === cur!.parent) : undefined; } return out; };

/** Il comando «/» scritto all'inizio di un blocco lo trasforma: «/titolo», «/todo», «/elenco», «/citazione», «/linea». */
export function slashCommand(text: string): { t: BlockType; rest: string } | null {
  const m = /^\/(titolo|h|todo|compito|elenco|punto|citazione|linea|divisore|testo)\s*(.*)$/i.exec(text.trim());
  if (!m) return null;
  const k = m[1]!.toLowerCase();
  const t: BlockType = k === 'titolo' || k === 'h' ? 'h' : k === 'todo' || k === 'compito' ? 'todo' : k === 'elenco' || k === 'punto' ? 'bullet' : k === 'citazione' ? 'quote' : k === 'linea' || k === 'divisore' ? 'divider' : 'p';
  return { t, rest: m[2] ?? '' };
}

/** Il testo di una pagina (titolo, blocchi, righe del database, commenti) per cercare e per l'assistente. */
export function pageText(p: WsPage): string {
  const lines: string[] = [p.title];
  p.blocks.forEach((b) => { if (b.t !== 'divider' && b.text.trim()) lines.push(b.text); });
  if (p.kind === 'db') { const cols = p.cols ?? []; lines.push(cols.map((c) => c.name).join(' | ')); (p.rows ?? []).forEach((r) => lines.push(cols.map((c) => r.cells[c.id] ?? '').join(' | '))); }
  p.comments.forEach((c) => lines.push(`Commento: ${c.text}`));
  return lines.join('\n');
}
