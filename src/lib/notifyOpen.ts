import { useEffect } from 'react';

import { readSignals } from '@/components/tour/hooks';
import { go } from '@/lib/nav';
import { postByKey } from '@/lib/network';
import { REPLY_ACTION } from '@/lib/quickReply';
import { sendQuickReply } from '@/lib/quickReplyActions';
import { lastTap, onNotificationTap, type TapEvent } from '@/lib/notify';
import { actorOf } from '@/lib/notifyKinds';
import { buildRef, parseRef, readPushData, routeFor, type Route } from '@/lib/notifyLinks';
import { isUnlocked, pageLevel } from '@/lib/tour';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useClub } from '@/store/club';
import { useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { useTour } from '@/store/tour';
import { toast } from '@/store/toast';
import { t } from '@/i18n/core';

/**
 * Apertura delle notifiche (in-app e di sistema). Una sola funzione, `openRef`, porta alla destinazione ESATTA:
 *  - se il contenuto non esiste piu' (post eliminato...) mostra "Questo contenuto non è più disponibile" e NON apre una schermata vuota;
 *  - se la pagina e' ancora "bloccata" dal percorso graduale del tour, sblocca SOLO quell'area (l'utente ha toccato un avviso
 *    che lo riguarda: mostrargli una scheda "si sblocca presto" sarebbe un vicolo cieco);
 *  - evita doppie navigazioni (stesso ref entro 1,5 secondi).
 */

let routeFiles: Set<string> | null = null;
/** True se la rotta esiste nell'app (serve per schermate create da altri moduli, es. billDetail). */
export function pageExists(page: string): boolean {
  try {
    if (!routeFiles) {
      // @ts-ignore require.context e' risolto da Metro in fase di build
      const ctx = require.context('../app/(tabs)', false, /\.tsx$/);
      routeFiles = new Set((ctx.keys() as string[]).map((k) => k.replace(/^\.\//, '').replace(/\.tsx$/, '')));
    }
    return routeFiles.has(page);
  } catch { return true; }
}

export type Resolved = { page: string; params: Record<string, string> } | { missing: true };

/** Risolve il ref con i dati dell'app: controlla che il contenuto esista e sceglie la schermata giusta. */
export function resolveRef(ref: string | null | undefined): Resolved {
  const route: Route = routeFor(ref);
  if (!route.valid) return { missing: true };
  const net = useNet.getState();
  const p = route.params;
  switch (parseRef(ref)?.kind) {
    case 'post': case 'comment': case 'like': case 'mention': case 'reply':
      return postByKey(p.key) ? route : { missing: true };
    case 'idea': return net.ideas.some((x) => String(x.id) === p.id) ? route : { missing: true };
    case 'community': return net.communities.some((x) => String(x.id) === p.id) ? route : { missing: true };
    case 'seminar': return net.seminars.some((x) => String(x.id) === p.id) ? route : { missing: true };
    case 'service': return net.providers.some((x) => x.name === p.name) ? route : { missing: true };
    case 'booking': {
      const b = net.bookings.find((x) => x.id === p.name);
      return b ? { page: 'servicePage', params: { name: b.provider } } : { missing: true };
    }
    case 'chat': {
      const c = useChat.getState().chats[p.id];
      // le chat dm: si creano da sole all'apertura; gruppi e altre chat devono esistere
      return c || p.id.startsWith('dm:') ? route : { missing: true };
    }
    case 'club': case 'clubcontent': {
      return useClub.getState().clubs[p.id] ? route : { missing: true };
    }
    case 'job': {
      const js = useJobs.getState();
      const a = js.applications.find((x) => x.id === p.id);
      const j = a && js.jobs.find((x) => x.id === a.jobId);
      if (!a || !j) return { missing: true };
      return { page: j.owner === useApp.getState().account.name ? 'applicantView' : 'interviewView', params: { id: p.id } };
    }
    case 'bill':
      return pageExists('billDetail') ? { page: 'billDetail', params: p } : { page: route.fallback?.page ?? 'plan', params: route.fallback?.params ?? {} };
    default: return route;
  }
}

let lastOpen = { key: '', at: 0 };

/** Segna come lette le notifiche in-app collegate (per id o, in mancanza, per ref). */
export function markReadByRef(nid?: number, ref?: string) {
  const net = useNet.getState();
  const hit = (n: { id: number; ref?: string; read: boolean }) => !n.read && (nid !== undefined ? n.id === nid : !!ref && n.ref === ref);
  if (net.notifications.some(hit)) net.patch({ notifications: net.notifications.map((n) => (hit(n) ? { ...n, read: true } : n)) });
}

/**
 * Apre la destinazione di un ref. Restituisce true se ha navigato. `nid` = id della notifica in-app (viene segnata come letta).
 */
export function openRef(ref: string | null | undefined, opts: { nid?: number; fallbackPage?: string } = {}): boolean {
  if (opts.nid !== undefined || ref) markReadByRef(opts.nid, ref ?? undefined);
  const now = Date.now();
  const key = ref ?? '';
  if (key && lastOpen.key === key && now - lastOpen.at < 1500) return false;
  lastOpen = { key, at: now };
  const r = ref ? resolveRef(ref) : ({ missing: true } as Resolved);
  if ('missing' in r) {
    toast(t('Questo contenuto non è più disponibile'));
    if (opts.fallbackPage) go(opts.fallbackPage);
    return false;
  }
  // pagina ancora bloccata dal percorso graduale: sblocco solo quell'area
  try {
    const tour = useTour.getState();
    if (!isUnlocked(tour, r.page)) tour.unlockTo(pageLevel(r.page), readSignals());
  } catch { /* ignore */ }
  // `at` rinnova i parametri anche aprendo due volte la stessa destinazione (le pagine restano montate)
  go(r.page, { ...r.params, at: String(now) });
  return true;
}

/** Ref di una notifica in-app: quello salvato oppure, per le vecchie notifiche senza ref, uno dedotto dal testo e dai dati. */
export function refOfNotif(n: { type: string; text: string; ref?: string; kind?: string }): string | undefined {
  if (n.ref && parseRef(n.ref)) return n.ref;
  const type = String(n.type).toLowerCase();
  const actor = actorOf(n.text);
  const net = useNet.getState();
  const me = useApp.getState().account.name;
  // i miei post, dal piu' recente
  const mine = [
    ...net.posts.filter((p) => p.author === me).map((p) => ({ id: `standalone:${p.id}`, text: p.text })),
    ...net.communities.flatMap((c) => c.posts.map((p, i) => ({ id: `community:${c.id}:${i}`, text: p.text, author: p.author })).filter((p) => p.author === me)),
  ];
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-zà-ù0-9]+/).filter((w) => w.length > 3));
  const pickPost = () => {
    if (mine.length === 0) return undefined;
    const tw = words(n.text);
    let best = mine[0], score = -1;
    for (const m of mine) { const sc = [...words(m.text)].filter((w) => tw.has(w)).length; if (sc > score) { best = m; score = sc; } }
    return best.id;
  };
  if (type === 'comment' || type === 'mention') {
    // il commento dell'autore su uno dei miei post: apre il post e lo evidenzia
    for (const m of mine) {
      const list = net.comments[m.id] ?? [];
      for (let i = list.length - 1; i >= 0; i--) if (actor && list[i].author === actor) return buildRef(type === 'mention' ? 'mention' : 'comment', m.id, i);
    }
  }
  if (type === 'like' || type === 'comment' || type === 'mention' || type === 'share' || type === 'vote') {
    const id = pickPost();
    if (id) return type === 'like' ? buildRef('like', id, actor) : buildRef('post', id);
    return undefined;
  }
  if (type === 'follow' && actor) return buildRef('follow', actor);
  if ((type === 'message' || type === 'dm' || type === 'chat') && actor) return buildRef('chat', `dm:${actor}`);
  if (type === 'reminder' || type === 'event') return buildRef('reminder');
  if (type === 'donation' || type === 'daily' || type === 'bonus' || type === 'contribution') return buildRef('points', 'latest');
  return undefined;
}

/** Destinazione della notifica in-app: ref (anche dedotto) oppure la pagina della categoria. */
export function openNotif(n: { id: number; type: string; text: string; ref?: string; kind?: string }): void {
  const ref = refOfNotif(n);
  const kind = n.kind ?? '';
  const fallback = kind === 'finanza' || String(n.type) === 'finance' ? 'lifefinance' : kind === 'messaggio' || n.type === 'message' ? 'messagesPage' : kind === 'servizio' || kind === 'seminario' || kind === 'lavoro' ? 'lifenetwork' : 'notificationsPage';
  if (!ref) { markReadByRef(n.id); go(fallback); return; }
  openRef(ref, { nid: n.id, fallbackPage: fallback });
}

// ---------- tocco sulle notifiche di sistema ----------

const seen = new Set<string>();
let pending: TapEvent | null = null;

function handleTap(e: TapEvent, ready: boolean) {
  if (seen.has(e.id)) return;
  if (!ready) { pending = e; return; }
  seen.add(e.id);
  const d = readPushData(e.data);
  // «Rispondi» dalla notifica: pubblico il commento/messaggio senza aprire nessuna schermata
  if (e.action === REPLY_ACTION) {
    if (d.nid !== undefined) markReadByRef(d.nid);
    if (!sendQuickReply(d.ref, e.text)) toast(t('Non sono riuscito a inviare la risposta'));
    return;
  }
  if (d.nid !== undefined) markReadByRef(d.nid);
  // senza ref (es. notifiche vecchie): elenco delle notifiche
  if (!d.ref) { go('notificationsPage'); return; }
  openRef(d.ref, { nid: d.nid, fallbackPage: 'notificationsPage' });
}

/**
 * Collega i tocchi sulle notifiche di sistema alla navigazione, anche ad app chiusa (cold start) o in background.
 * Va montato nel layout radice con `ready` = store ripristinati, `onboarded` = utente registrato (prima non c'e' dove andare).
 * Un tocco arrivato troppo presto resta in attesa e viene eseguito appena possibile; ogni notifica si apre una volta sola.
 */
export function useNotificationTaps(ready: boolean, onboarded: boolean): void {
  const go_ = ready && onboarded;
  useEffect(() => {
    if (!ready) return;
    const off = onNotificationTap((e) => handleTap(e, go_));
    // cold start: aspetto che lo Stack sia montato prima di navigare
    let h: ReturnType<typeof setTimeout> | undefined;
    void lastTap().then((e) => { if (e) h = setTimeout(() => handleTap(e, go_), 600); });
    return () => { off(); if (h) clearTimeout(h); };
  }, [ready, go_]);
  useEffect(() => {
    if (!go_ || !pending) return;
    const e = pending;
    pending = null;
    // lascio montare lo Stack prima di navigare
    const h = setTimeout(() => handleTap(e, true), 500);
    return () => clearTimeout(h);
  }, [go_]);
}
