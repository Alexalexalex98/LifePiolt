import { AppState } from 'react-native';

import { mergeFriends, planIncoming, planOutgoing, type DmRow, type Friend } from '@/lib/friendsCore';
import { dmId, useChat } from '@/store/chat';
import { useFriends } from '@/store/friends';
import { toast } from '@/store/toast';

import { fetchDms, listenDms, listFriends, sendDm } from './friendsApi';
import { socialSession, type Social } from './socialApi';

/**
 * Collega le chat dirette agli amici veri sul server: i messaggi che scrivi a un amico partono (solo testo),
 * quelli che ti scrive arrivano nella chat di sempre. Con amici di prova o senza accesso non cambia niente.
 * Stesso accesso del social: se non sei collegato, tutto resta sul telefono.
 */
let started = false;
let stop: (() => void) | null = null;
let running = false;
let warnedKinds = false;
let failedOnce = false;
const cap = (a: string[]) => a.slice(-3000);

export async function refreshFriends(s?: Social | null): Promise<Friend[]> {
  const sess = s ?? (await socialSession());
  if (!sess) return useFriends.getState().friends;
  const remote = await listFriends(sess);
  if (!remote) return useFriends.getState().friends;
  const merged = mergeFriends(useFriends.getState().friends, remote, Date.now());
  useFriends.getState().set({ friends: merged });
  return merged;
}

function apply(s: Social, rows: DmRow[]) {
  const fs = useFriends.getState();
  const { todo, seenNow } = planIncoming(rows, s.userId, fs.friends, new Set(fs.seen), new Set(fs.sent));
  const chat = useChat.getState();
  const sent = [...useFriends.getState().sent];
  for (const m of todo) {
    const id = chat.ensureDm(m.friend.chat, s.name);
    if (m.mine) { const mid = chat.receive(id, s.name, { kind: 'text', text: m.text, ts: m.ts }); sent.push(mid); }
    else chat.receive(id, m.friend.chat, { kind: 'text', text: m.text, ts: m.ts });
  }
  const last = rows.reduce((a, r) => (r.created_at > a ? r.created_at : a), useFriends.getState().cursor);
  useFriends.getState().set({ seen: cap([...useFriends.getState().seen, ...seenNow]), sent: cap(sent), cursor: last });
}

export async function pullDms(s?: Social | null) {
  const sess = s ?? (await socialSession());
  if (!sess) return;
  const rows = await fetchDms(sess, useFriends.getState().cursor);
  if (rows?.length) apply(sess, rows);
}

/** Manda i messaggi nuovi scritti a un amico vero. */
export async function pushDms() {
  if (running) return; running = true;
  try {
    const s = await socialSession(); if (!s) return;
    const { friends } = useFriends.getState();
    const messages = useChat.getState().messages;
    for (const f of friends.filter((x) => x.status === 'accepted')) {
      const { send, unsupported } = planOutgoing(messages[dmId(f.chat)] ?? [], s.name, f.since, new Set(useFriends.getState().sent));
      if (unsupported && !warnedKinds) { warnedKinds = true; toast('Online passa solo il testo: foto, posizione e altro per ora restano sul telefono.'); }
      for (const m of send) {
        const r = await sendDm(s, f.id, m.text ?? '', m.id);
        if (r.error) { if (!failedOnce) { failedOnce = true; toast(`Messaggio non partito: ${r.error}. Riprovo più tardi.`); } break; }
        failedOnce = false;
        const st = useFriends.getState();
        st.set({ sent: cap([...st.sent, m.id]), seen: r.row ? cap([...st.seen, r.row.id]) : st.seen });
      }
    }
  } finally { running = false; }
}

async function connect() {
  if (stop) return;
  const s = await socialSession(); if (!s) return;
  await refreshFriends(s);
  await pullDms(s);
  stop = listenDms(s, (r) => apply(s, [r]));
  void pushDms();
}

/** Da chiamare una volta all'avvio dell'app. */
export function startDmSync() {
  if (started) return;
  started = true;
  let lastMsgs = useChat.getState().messages;
  useChat.subscribe((st) => { if (st.messages === lastMsgs) return; lastMsgs = st.messages; if (useFriends.getState().friends.some((f) => f.status === 'accepted')) void pushDms(); });
  setTimeout(() => { void connect(); }, 3000);
  // finché non sei collegato riprova; poi, per sicurezza (se il tempo reale si interrompe), ogni minuto rinfresca amici e messaggi
  setInterval(() => { if (AppState.currentState !== 'active') return; if (!stop) void connect(); else { void refreshFriends(); void pullDms(); void pushDms(); } }, 30000);
  AppState.addEventListener('change', (st) => { if (st === 'active') { if (!stop) void connect(); else { void refreshFriends(); void pullDms(); } } });
}
/** Dopo l'uscita dall'account: ferma il tempo reale e svuota gli amici. */
export function stopDmSync() { try { stop?.(); } catch { /* ignore */ } stop = null; useFriends.getState().reset(); }
