import { t } from '@/i18n/core';
import { supa } from '@/lib/accountApi';
import { aiMode, type Audit, type Country } from '@/lib/companyWork';
import { db, q, run } from '@/lib/teamWork';
import { useCompany, type LockedPage, type Settings } from '@/store/company';
import { useWorkspace } from '@/store/workspace';

/** Impostazioni dell'azienda, progetti riservati e cronologia. Ogni permesso lo decide il server. */
export async function pullCompany(team: string): Promise<void> {
  const st = useCompany.getState();
  try { const rows = await q<Settings[]>((await db()).from('team_settings').select('*').eq('team_id', team)); if (rows[0]) st.setServer(team, { settings: rows[0] }); } catch { /* senza server */ }
  try { const a = await (await supa()).rpc<{ plan: boolean; covered: boolean }>('team_ai_status', { p_team: team }); if (a) st.setServer(team, { ai: a }); } catch { /* senza server */ }
  try { const l = await (await supa()).rpc<LockedPage[]>('team_locked_pages', { p_team: team }); st.setServer(team, { locked: l ?? [] }); purgeLocked(team); } catch { /* senza server */ }
  try { const rows = await q<Audit[]>((await db()).from('team_audit').select('id,user_id,action,target,label,at').eq('team_id', team).order('at', { ascending: false }).limit(150)); st.setServer(team, { audit: rows }); } catch { /* solo chi ha il permesso */ }
}
const after = <T,>(team: string, f: () => Promise<T>) => run(async () => { const r = await f(); await pullCompany(team); return r; });

export const saveSettings = (team: string, s: { country: Country; currency: 'EUR' | 'CHF'; ai_plan: boolean; ai_all: boolean; ai_members: string[] }) => after(team, async () => { await (await supa()).rpc('team_settings_save', { p_team: team, p_country: s.country, p_currency: s.currency, p_ai_plan: s.ai_plan, p_ai_all: s.ai_all, p_ai_members: s.ai_members }); });

/** Toglie dal telefono le pagine riservate che non hai sbloccato (e quelle sotto): non devono restare in copia locale. */
export function purgeLocked(team: string): void {
  const locked = (useCompany.getState().locked[team] ?? []).filter((l) => !l.unlocked); if (!locked.length) return;
  const pages = useWorkspace.getState().pages; const drop = new Set<string>(locked.map((l) => l.id));
  let grew = true; while (grew) { grew = false; for (const p of pages) if (p.parent && drop.has(p.parent) && !drop.has(p.id)) { drop.add(p.id); grew = true; } }
  if (pages.some((p) => drop.has(p.id))) useWorkspace.setState({ pages: pages.filter((p) => !drop.has(p.id)) });
}
const pullPages = async (team: string) => { const m = await import('@/lib/teamSync'); await m.pullTeamPages(team); };

export const lockPage = (team: string, page: string, password: string) => after(team, async () => { await (await supa()).rpc('team_page_lock', { p_page: page, p_password: password }); });
export const unlockPage = (team: string, page: string, password: string) => run(async () => {
  const ok = await (await supa()).rpc<boolean>('team_page_unlock', { p_page: page, p_password: password });
  if (ok) { await pullPages(team); await pullCompany(team); }
  return !!ok;
});
export const relockPage = (team: string, page: string) => after(team, async () => { await (await supa()).rpc('team_page_relock', { p_page: page }); });
export const unprotectPage = (team: string, page: string) => after(team, async () => { await (await supa()).rpc('team_page_unprotect', { p_page: page }); });

/** Theia con l'AI nel lavoro di questo workspace: piano dell'azienda o, se l'hai scelto, il tuo account personale. */
export function workAiOn(team: string | undefined): boolean {
  const s = useCompany.getState(); const a = team ? s.ai[team] : undefined;
  return aiMode({ plan: !!a?.plan, covered: !!a?.covered, personal: s.personalAi }).on;
}
export const aiText = (team: string | undefined): string => { const s = useCompany.getState(); const a = team ? s.ai[team] : undefined; return t(aiMode({ plan: !!a?.plan, covered: !!a?.covered, personal: s.personalAi }).text); };
