/**
 * Progetti ad albero (modulo PURO): una task padre con figli che possono avere altri figli, a qualsiasi livello.
 * Il padre non si completa a mano: è completato solo quando lo sono tutti i figli; la percentuale si calcola sulle foglie.
 * Si importa da un elenco di testo (Markdown con - [ ] / - [x], titoli # oppure righe rientrate) e si esporta nello stesso formato.
 */
export type PNode = { id: string; parent: string | null; title: string; /** vale solo per le foglie */ done: boolean; note?: string; /** id dei file caricati in LifeDrive */ files: string[]; /** persone con cui è condiviso (solo sul progetto radice) */ shared: string[]; createdAt: number };
export const MAX_NODES = 3000;
export const MAX_DEPTH = 12;

export const childrenOf = (nodes: PNode[], id: string | null): PNode[] => nodes.filter((n) => n.parent === id);
export const isLeaf = (nodes: PNode[], id: string): boolean => !nodes.some((n) => n.parent === id);

export function leavesOf(nodes: PNode[], id: string): PNode[] {
  const out: PNode[] = []; const stack = [id]; const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue; seen.add(cur);
    const kids = childrenOf(nodes, cur);
    if (!kids.length) { const n = nodes.find((x) => x.id === cur); if (n) out.push(n); } else for (const k of kids) stack.push(k.id);
  }
  return out;
}
/** Completato: una foglia se spuntata, un padre solo se tutte le sue foglie lo sono. */
export const isDone = (nodes: PNode[], id: string): boolean => { const l = leavesOf(nodes, id); return l.length > 0 && l.every((x) => x.done); };
export function progressOf(nodes: PNode[], id: string): { done: number; total: number; pct: number } {
  const l = leavesOf(nodes, id); const d = l.filter((x) => x.done).length;
  return { done: d, total: l.length, pct: l.length ? Math.round((d / l.length) * 100) : 0 };
}
/** I titoli dalla radice al nodo, per la cartella in LifeDrive. */
export function pathOf(nodes: PNode[], id: string): string[] {
  const out: string[] = []; let cur: PNode | undefined = nodes.find((n) => n.id === id); let guard = 0;
  while (cur && guard++ < MAX_DEPTH + 2) { out.unshift(cur.title); cur = cur.parent ? nodes.find((n) => n.id === cur!.parent) : undefined; }
  return out;
}
export const subtreeIds = (nodes: PNode[], id: string): string[] => { const out = [id]; for (let i = 0; i < out.length; i++) for (const k of childrenOf(nodes, out[i]!)) out.push(k.id); return out; };
export const depthOf = (nodes: PNode[], id: string): number => pathOf(nodes, id).length - 1;
export const rootOf = (nodes: PNode[], id: string): PNode | undefined => { let cur = nodes.find((n) => n.id === id); let g = 0; while (cur?.parent && g++ < 50) cur = nodes.find((n) => n.id === cur!.parent); return cur; };

export type Parsed = { title: string; depth: number; done: boolean; note?: string };
const clean = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

/** Dal testo all'elenco di voci con profondità. Capisce: titoli #, ##…, elenchi -, *, +, 1., 1), caselle [ ] e [x], righe rientrate (2, 4 spazi o tab). */
export function parseOutline(text: string): { items: Parsed[]; skipped: number } {
  const lines = text.replace(/\r/g, '').replace(/^﻿/, '').split('\n');
  const items: Parsed[] = []; let skipped = 0;
  let headingDepth = -1; let stack: number[] = []; let inFence = false; let inFront = false;
  lines.forEach((raw, i) => {
    if (i === 0 && raw.trim() === '---') { inFront = true; return; }
    if (inFront) { if (raw.trim() === '---') inFront = false; return; }
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; return; }
    if (inFence) return;
    const line = raw.replace(/\t/g, '    ');
    if (!line.trim() || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) || /^\s*<!--/.test(line)) return;
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { const last = items[items.length - 1]; if (last && q[1]) last.note = `${last.note ? `${last.note} ` : ''}${clean(q[1])}`.slice(0, 400); return; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (h) {
      const d = h[1]!.length - 1; const t = clean(h[2]!);
      if (!t) return;
      headingDepth = d; stack = [];
      items.push({ title: t, depth: d, done: false });
      return;
    }
    const m = /^(\s*)(?:[-*+•]|\d+[.)])?\s*(?:\[([ xX\-])\]\s*)?(.*)$/.exec(line);
    if (!m) { skipped++; return; }
    const indent = m[1]!.length; const title = clean(m[3] ?? '');
    if (!title) return;
    while (stack.length && stack[stack.length - 1]! >= indent) stack.pop();
    stack.push(indent);
    items.push({ title, depth: headingDepth + 1 + (stack.length - 1), done: (m[2] ?? '').toLowerCase() === 'x' });
  });
  return { items, skipped };
}

export type NewNode = { title: string; parentIndex: number | null; done: boolean; note?: string };
/** Trasforma le voci in nodi con il loro padre: se un livello salta (da 0 a 3) il padre è la voce più vicina sopra. Taglia a MAX_NODES e MAX_DEPTH. */
export function buildTree(items: Parsed[], max = MAX_NODES): { nodes: NewNode[]; truncated: boolean } {
  const out: NewNode[] = []; const lastAt: number[] = []; let truncated = false;
  const base = items.length ? Math.min(...items.map((x) => x.depth)) : 0;
  for (const it of items) {
    if (out.length >= max) { truncated = true; break; }
    const depth = Math.min(MAX_DEPTH, Math.max(0, it.depth - base));
    let parent: number | null = null;
    for (let d = Math.min(depth, lastAt.length) - 1; d >= 0; d--) { if (lastAt[d] !== undefined) { parent = lastAt[d]!; break; } }
    const idx = out.length;
    out.push({ title: it.title, parentIndex: depth === 0 ? null : parent, done: it.done, ...(it.note ? { note: it.note } : null) });
    lastAt.length = depth; lastAt[depth] = idx;
  }
  return { nodes: out, truncated };
}

/** Il progetto come testo, nello stesso formato che si importa: si condivide con altri o si salva in un file. */
export function toOutline(nodes: PNode[], rootId: string): string {
  const lines: string[] = [];
  const walk = (id: string, d: number) => {
    const n = nodes.find((x) => x.id === id); if (!n) return;
    const leaf = isLeaf(nodes, id);
    lines.push(`${'  '.repeat(d)}- [${(leaf ? n.done : isDone(nodes, id)) ? 'x' : ' '}] ${n.title}`);
    if (n.note) lines.push(`${'  '.repeat(d + 1)}> ${n.note}`);
    for (const k of childrenOf(nodes, id)) walk(k.id, d + 1);
  };
  walk(rootId, 0);
  return lines.join('\n');
}

/** Dove sta il file in LifeDrive: l'elenco delle cartelle da cui si arriva a questo punto (la radice è «Progetti»). */
export const driveSubfolders = (paths: string[][], prefix: string[]): string[] => [...new Set(paths.filter((p) => p.length > prefix.length && prefix.every((s, i) => p[i] === s)).map((p) => p[prefix.length]!))];
export const sameFolder = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);
