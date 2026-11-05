import { linesToBlocks } from '@/lib/blocksFromText';
import { useWorkspace } from '@/store/workspace';

/** Riempie una pagina nuova con i blocchi (sostituisce il blocco vuoto di partenza). */
export function fillPage(pageId: string, text: string): void {
  const ws = useWorkspace.getState(); const blocks = linesToBlocks(text); const first = useWorkspace.getState().pages.find((p) => p.id === pageId)?.blocks[0];
  blocks.forEach((b, i) => { if (i === 0 && first) ws.patchBlock(pageId, first.id, { t: b.t, text: b.text }); else ws.addBlock(pageId, b.t, b.text); });
}
/** Salva un testo come pagina condivisa del workspace. */
export async function saveReportPage(team: string, title: string, text: string): Promise<string> {
  const page = useWorkspace.getState().addPage(null, 'page', title.slice(0, 190), team); fillPage(page, text); return page;
}
