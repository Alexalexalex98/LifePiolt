import { supa } from '@/lib/accountApi';
import { useApp } from '@/store/app';

/** Manda la segnalazione a chi gestisce l'app (se c'è un account e il server). Senza account resta solo sul telefono. Non blocca mai chi segnala. */
export async function sendReport(r: { kind: string; ref: string | number; label: string; author?: string; reason: string; note?: string }): Promise<boolean> {
  if (useApp.getState().demo) return false;
  try {
    await (await supa()).rpc('report_content', { p_kind: r.kind, p_ref: String(r.ref), p_label: r.label, p_author: r.author ?? '', p_reason: r.reason, p_note: r.note ?? '' });
    return true;
  } catch { return false; }
}
