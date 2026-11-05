import { useWorkspace } from '@/store/workspace';

/** Salva un testo come pagina condivisa del workspace (una riga per blocco). */
export async function saveReportPage(team: string, title: string, text: string): Promise<string> {
  const ws = useWorkspace.getState(); const page = ws.addPage(null, 'page', title.slice(0, 190), team);
  const lines = text.split('\n'); const first = useWorkspace.getState().pages.find((p) => p.id === page)?.blocks[0];
  if (first) ws.patchBlock(page, first.id, { t: 'h', text: lines[0] ?? '' });
  lines.slice(1).forEach((l) => ws.addBlock(page, l.startsWith('- ') ? 'bullet' : 'p', l.startsWith('- ') ? l.slice(2) : l));
  return page;
}
