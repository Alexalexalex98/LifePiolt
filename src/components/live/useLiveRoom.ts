import { useCallback, useEffect, useRef, useState } from 'react';

import {
  capReactions, createSimulatedTransport, hashSeed, pinComment, pushComment,
  type CommentKind, type LiveComment, type LiveReaction, type LiveTransport, type Me, type NetState, type Participant, type ReactionKind, type RoomInfo,
} from '@/lib/liveRoom';

/**
 * Collega la stanza a un LiveTransport (di default quello simulato) e ne espone lo stato alla UI.
 * Per un provider reale basta passare `makeTransport` (vedi docs/live.md).
 */
export function useLiveRoom(opts: { room: RoomInfo; me: Me; active: boolean; online: boolean; makeTransport?: () => LiveTransport }) {
  const { room, me, active, online } = opts;
  const makeRef = useRef(opts.makeTransport);
  const transport = useRef<LiveTransport | null>(null);
  const [net, setNet] = useState<NetState>('idle');
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [viewers, setViewers] = useState(0);
  const [peak, setPeak] = useState(0);
  const [people, setPeople] = useState<Participant[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ended, setEnded] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const [handUp, setHandUp] = useState(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => {
    if (!active) return;
    const tr = makeRef.current ? makeRef.current() : createSimulatedTransport({ seed: hashSeed(room.id) });
    transport.current = tr;
    let alive = true;
    const off = tr.subscribe((e) => {
      if (!alive) return;
      switch (e.type) {
        case 'state': setNet(e.state); break;
        case 'comment': setComments((l) => pushComment(l, e.comment)); break;
        case 'reaction': setReactions((l) => capReactions([...l, e.reaction])); setReactionCount((n) => n + 1); break;
        case 'viewers': setViewers(e.count); setPeak(e.peak); break;
        case 'participants': setPeople(e.list); break;
        case 'pinned': setComments((l) => pinComment(l, e.id)); break;
        case 'removed': if (e.id === me.id) setRemoved(true); break;
        case 'ended': setEnded(true); break;
      }
    });
    tr.connect(room, me).then(() => tr.setNetwork(onlineRef.current)).catch((err) => { console.warn('live connect', err); });
    const iv = setInterval(() => { const n = Date.now(); setNow(n); tr.tick?.(n); }, 1000);
    return () => { alive = false; clearInterval(iv); off(); void tr.disconnect(); transport.current = null; };
    // la stanza e l'utente non cambiano mentre la schermata e' aperta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, room.id, me.id, me.role]);

  useEffect(() => { transport.current?.setNetwork(online); }, [online]);

  const sendComment = useCallback((text: string, kind: CommentKind = 'comment') => transport.current?.publishComment(text, kind) ?? null, []);
  const react = useCallback((k: ReactionKind) => transport.current?.publishReaction(k), []);
  const dismissReaction = useCallback((id: string) => setReactions((l) => l.filter((r) => r.id !== id)), []);
  const toggleHand = useCallback(() => setHandUp((h) => { transport.current?.raiseHand(!h); return !h; }), []);
  const pin = useCallback((id: string | null) => transport.current?.pin(id), []);
  const mute = useCallback((id: string, muted: boolean) => transport.current?.muteParticipant(id, muted), []);
  const remove = useCallback((id: string) => transport.current?.removeParticipant(id), []);
  const endRoom = useCallback(() => transport.current?.endRoom(), []);

  return { net, comments, reactions, viewers, peak, people, now, ended, removed, reactionCount, handUp, sendComment, react, dismissReaction, toggleHand, pin, mute, remove, endRoom, provider: transport.current?.provider ?? 'simulated', realVideo: transport.current?.realVideo ?? false };
}
