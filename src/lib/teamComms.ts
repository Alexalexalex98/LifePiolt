import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { supa } from '@/lib/accountApi';
import { myUserId } from '@/lib/teams';
import { db, q, run } from '@/lib/teamWork';
import { chanKey, useComms, type Away, type Msg } from '@/store/comms';

/** Messaggi di lavoro sul server: canali (generale, annunci, uno per progetto), tempo reale, assenza. Ogni permesso lo decide il server. */
const st = () => useComms.getState();

export async function pullMessages(team: string, channel: string, limit = 60): Promise<void> {
  try {
    const rows = await q<Msg[]>((await db()).from('team_messages').select('*').eq('team_id', team).eq('channel', channel).order('id', { ascending: false }).limit(limit));
    st().set({ msgs: { ...st().msgs, [chanKey(team, channel)]: rows.slice().reverse() } });
  } catch { /* offline: restano quelli sul telefono */ }
}
export const sendMessage = (team: string, channel: string, text: string, o: { replyTo?: number | null; mentions?: string[] } = {}) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_messages').insert({ team_id: team, channel, author: me, text: text.trim(), reply_to: o.replyTo ?? null, mentions: (o.mentions ?? []).filter((x) => x !== me) }));
  await pullMessages(team, channel);
});
export const deleteMessage = (m: Msg) => run(async () => { await q((await db()).from('team_messages').update({ deleted: true }).eq('id', m.id)); await pullMessages(m.team_id, m.channel); });
export const pinMessage = (m: Msg, on: boolean) => run(async () => { await (await supa()).rpc('team_message_pin', { p_id: m.id, p_on: on }); await pullMessages(m.team_id, m.channel); });

/** Resta in ascolto del team: ogni messaggio nuovo (anche degli altri) compare subito. */
export async function watchMessages(team: string, channel: string): Promise<() => void> {
  try {
    const c = await db();
    const ch = c.channel(`msgs-${team}-${channel}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_messages', filter: `team_id=eq.${team}` }, () => { void pullMessages(team, channel); }).subscribe();
    return () => { c.removeChannel(ch); };
  } catch { return () => undefined; }
}

/* ---------- assenza con risposta automatica ---------- */
export async function pullAway(team: string): Promise<void> {
  try {
    const rows = await q<{ user_id: string; until: string; message: string }[]>((await db()).from('team_away').select('user_id,until,message').eq('team_id', team));
    st().set({ away: { ...st().away, [team]: Object.fromEntries(rows.map((r) => [r.user_id, { until: r.until, message: r.message } as Away])) } });
  } catch { /* offline */ }
}
export const setAway = (team: string, a: Away | null) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const d = await db();
  if (!a) await q(d.from('team_away').delete().eq('team_id', team).eq('user_id', me));
  else await q(d.from('team_away').upsert({ team_id: team, user_id: me, until: a.until, message: a.message.slice(0, 500) }));
  await pullAway(team);
});

/** Numero di messaggi non letti in un canale (non conta i tuoi). */
export function unread(team: string, channel: string, me: string | null): number {
  const k = chanKey(team, channel); const last = st().seen[k] ?? 0;
  return (st().msgs[k] ?? []).filter((m) => m.id > last && m.author !== me).length;
}
export const markSeen = (team: string, channel: string) => { const k = chanKey(team, channel); const l = (st().msgs[k] ?? []).at(-1)?.id; if (l && st().seen[k] !== l) st().set({ seen: { ...st().seen, [k]: l } }); };

/* ---------- con l'AI (solo se collegata e con il tuo consenso) ---------- */
export type AiOp = 'translate' | 'summary' | 'draft';
export async function commsAi(op: AiOp, text: string): Promise<{ ok: boolean; text: string }> {
  if (!aiServerConfigured) return { ok: false, text: t('Per questo serve il collegamento con l\'AI: lo attivi in Intelligenza di Theia.') };
  if (!(await askSend('data', t('Solo il testo di questo messaggio. Nessun altro dato dell\'app.')))) return { ok: false, text: t('Va bene, non invio niente.') };
  logSend('data', text.length, ['messaggio di lavoro']);
  const p = op === 'translate' ? 'Traduci in italiano il messaggio seguente (se è già in italiano traducilo in inglese). Rispondi solo con la traduzione.'
    : op === 'summary' ? 'Riassumi in italiano, in massimo 4 punti brevi, il testo seguente. Un punto per riga, ognuno inizia con "- ". Nessuna introduzione.'
    : 'Scrivi in italiano una risposta breve, cortese e professionale al messaggio di lavoro seguente. Rispondi solo con il testo della risposta.';
  try { return { ok: true, text: (await aiChatRaw(`${p}\n\n${text.slice(0, 6000)}`)).trim() }; }
  catch (e) { return { ok: false, text: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }; }
}
