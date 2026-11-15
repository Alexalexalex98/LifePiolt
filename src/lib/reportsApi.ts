import { supa } from '@/lib/accountApi';
import { useApp } from '@/store/app';

/** Manda la segnalazione a chi gestisce l'app (se c'è un account e il server). Senza account resta solo sul telefono. Non blocca mai chi segnala. */
export async function sendReport(r: { kind: string; ref: string | number; label: string; author?: string; authorId?: string; reason: string; note?: string }): Promise<boolean> {
  if (useApp.getState().demo) return false;
  try {
    await (await supa()).rpc('report_content', { p_kind: r.kind, p_ref: String(r.ref), p_label: r.label, p_author: r.author ?? '', p_author_id: r.authorId ?? null, p_reason: r.reason, p_note: r.note ?? '' });
    return true;
  } catch { return false; }
}

/** Chi amministra l'app: rivede le segnalazioni e decide. Il server controlla che tu sia davvero amministratore. */
export type AdminReport = { id: string; kind: string; ref: string; label: string; author: string; author_id: string | null; reason: string; note: string; urgent: boolean; status: string; decision: string | null; created_at: string; times: number };
export type AdminAction = 'dismiss' | 'remove' | 'warn' | 'suspend' | 'ban';
const adminRun = async <T,>(f: (rpc: (n: string, a?: Record<string, unknown>) => Promise<unknown>) => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
  try { const tr = await supa(); return { ok: true, data: await f((n, a) => tr.rpc(n, a)) }; } catch (e) { return { ok: false, message: /non_autorizzato/.test(String((e as Error)?.message)) ? 'Non sei amministratore.' : 'Non sono riuscita a farlo: controlla la connessione e riprova.' }; }
};
export const adminReports = (status: 'open' | 'actioned' | 'dismissed' = 'open') => adminRun((rpc) => rpc('admin_reports', { p_status: status, p_limit: 100 }) as Promise<AdminReport[]>);
export const adminDecide = (id: string, action: AdminAction, note = '', days?: number) => adminRun((rpc) => rpc('admin_report_decide', { p_id: id, p_action: action, p_note: note, p_days: days ?? null }));
