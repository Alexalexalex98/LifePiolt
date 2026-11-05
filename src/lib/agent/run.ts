import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { ACTIONS, actionById, catalogText, type Ctx } from '@/lib/agent/registry';
import { buildPrompt, isNo, isYes, offlineSteps, parsePlan, type Plan, type Step } from '@/lib/agent/plan';
import { serverState } from '@/lib/teams';
import { pullCrm } from '@/lib/teamCrm';
import { listDocs } from '@/lib/teamDocs';
import { pullHr } from '@/lib/teamHr';
import { pullMeetings } from '@/lib/teamMeetings';
import { pullMoney } from '@/lib/teamMoney';
import { loadPeople } from '@/lib/teamPeople';
import { pullTasks } from '@/lib/teamTasks';
import { today } from '@/lib/teamWork';
import { PROJECT_TEMPLATES } from '@/lib/workTasks';
import { positionOf } from '@/lib/workRoles';
import { useApp } from '@/store/app';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { useWork } from '@/store/work';
import { useWorkspace } from '@/store/workspace';
import { useWorkspaceChat } from '@/store/workspaceChat';

/**
 * Theia Lavoro esegue i compiti: capisce la richiesta (con le regole, oppure con l'AI se è collegata), la trasforma in azioni sul workspace
 * (task, progetti, riunioni, messaggi, clienti, soldi, HR, report, documenti) e le fa. Cancellare o rifiutare chiede prima il tuo «sì».
 * Restituisce true se ha gestito la richiesta, false se è una domanda sui file o una chiacchierata (si risponde nel modo di prima).
 */
const say = (text: string) => useWorkspaceChat.getState().push({ who: 'ai', text });
const KNOWN = () => new Set(ACTIONS.map((a) => a.id));

async function ensureData(team: string): Promise<void> {
  await Promise.allSettled([loadPeople(team), pullTasks(team), pullCrm(team), pullMoney(team), pullHr(team), listDocs(team), pullMeetings(team)]);
}
async function context(): Promise<Ctx | null> {
  const teams = useTeams.getState().teams; const team = teams.find((x) => x.id === useWork.getState().active) ?? teams[0];
  if (!team || team.id.startsWith('demo-') || (await serverState()) !== 'ok') return null;
  const { myUserId } = await import('@/lib/teams'); const me = await myUserId(); if (!me) return null;
  return { team: team.id, me, myName: useApp.getState().account.name || t('Io') };
}

export async function execute(steps: Step[], ctx: Ctx, confirmed: boolean): Promise<{ lines: string[]; pending: Step[]; failed: number }> {
  const lines: string[] = []; const pending: Step[] = []; let failed = 0;
  for (const s of steps) {
    const a = actionById(s.action); if (!a) continue;
    if (a.destructive && !confirmed) { pending.push(s); continue; }
    try { lines.push(await a.run(ctx, s.params)); } catch (e) { failed++; lines.push(t('Non sono riuscita con «{0}»: {1}', a.desc.toLowerCase(), e instanceof Error ? e.message : t('errore'))); }
  }
  return { lines, pending, failed };
}
const describe = (s: Step) => `${actionById(s.action)?.desc ?? s.action}: ${Object.entries(s.params).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}`;

async function plan(q: string, ctx: Ctx): Promise<Plan | null> {
  const off = offlineSteps(q); if (off) return { steps: off };
  if (!aiServerConfigured) return null;
  if (!(await askSend('data', t('Solo il testo della tua richiesta, il tuo nome, i nomi delle persone e dei progetti del workspace e le date. Nessun documento e nessun dato dei clienti o degli stipendi.')))) { say(t('Va bene, non invio niente. Senza l\'AI posso fare solo richieste semplici (ferie, task, «cosa ho oggi»).')); return { steps: [], reply: '·' }; }
  await ensureData(ctx.team);
  const people = (usePeople.getState().people[ctx.team] ?? []).map((p) => ({ name: p.name || t('Collega'), position: positionOf(p.position)?.label }));
  const projects = useWorkspace.getState().pages.filter((p) => p.teamId === ctx.team && p.parent === null && p.kind === 'page').map((p) => p.title).filter(Boolean);
  const hist = useWorkspaceChat.getState().log.slice(-5, -1).map((m) => `${m.who === 'me' ? 'Utente' : 'Theia Lavoro'}: ${m.text.replace(/\s+/g, ' ').slice(0, 300)}`);
  const prompt = buildPrompt({ today: today(), myName: ctx.myName, people, projects, templates: PROJECT_TEMPLATES.map((x) => x.name), actions: catalogText(), request: q, history: hist });
  logSend('data', prompt.length, ['richiesta di lavoro']);
  try { return parsePlan(await aiChatRaw(prompt), KNOWN()); } catch (e) { say(e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.')); return { steps: [], reply: '·' }; }
}

export async function runAgent(q: string): Promise<boolean> {
  const chat = useWorkspaceChat.getState(); const pend = chat.agentPending;
  const ctx = await context(); if (!ctx) return false;
  if (pend?.length) {
    chat.set({ agentPending: undefined });
    if (isYes(q)) { const r = await execute(pend, ctx, true); say(r.lines.map((l) => `- ${l}`).join('\n') || t('Fatto.')); return true; }
    if (isNo(q)) { say(t('Va bene, non faccio niente.')); return true; }
  }
  const p = await plan(q, ctx); if (!p) return false;
  if (p.reply === '·') return true;
  if (p.fallback) return false;
  if (p.ask) { say(p.ask); return true; }
  if (!p.steps.length) { if (p.reply) { say(p.reply); return true; } return false; }
  const r = await execute(p.steps, ctx, false);
  const out = [...(p.reply && !r.failed ? [p.reply] : []), ...r.lines.map((l) => `- ${l}`)];
  if (r.pending.length) { chat.set({ agentPending: r.pending }); out.push(t('Prima di farlo mi serve il tuo ok: {0}. Rispondi «sì» per confermare o «no» per annullare.', r.pending.map(describe).join('; '))); }
  say(out.join('\n') || t('Fatto.')); return true;
}
