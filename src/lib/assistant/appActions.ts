import { t } from '@/i18n/core';
import { go } from '@/lib/nav';
import { peoplePool } from '@/lib/network';
import { sendLP } from '@/lib/paymentActions';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useClub } from '@/store/club';
import { ensureChat } from '@/store/clubFlow';
import { newId, topicList, useNet } from '@/store/network';
import { ACTIONS, isCancel, isNo, isYes, missing, startAction, type ActionDef, type Slots } from './appActionCore';
import type { TheiaExt } from './theiaExt';

export type Say = (text: string, extra?: { chips?: string[]; ext?: TheiaExt }) => void;
type Active = { action: ActionDef; slots: Slots; asked: string[]; stage: 'slot' | 'optional' | 'confirm'; pending?: string };
let active: Active | null = null;
export const hasActiveAction = () => active !== null;
export const resetActiveAction = () => { active = null; };

const me = () => useApp.getState().account.name;
const ctx = () => ({ people: peoplePool(me()) });
const CONFIRM = [t('Sì, conferma'), t('Annulla')];

/** Esegue l'azione: tutto avviene sul telefono; ciò che va online parte con la connessione. */
function execute(a: ActionDef, s: Slots, say: Say) {
  const net = useNet.getState();
  switch (a.id) {
    case 'post': {
      net.patch({ posts: [{ id: newId(), author: me(), text: s.text, media: null, tag: topicList[0], likes: 0, ts: Date.now() }, ...net.posts] });
      say(t('Fatto: il post è sul tuo profilo e in LifeNetwork. Si pubblica online appena c\'è connessione.'), { ext: { actions: [{ kind: 'open', label: t('Apri LifeNetwork'), page: 'lifenetwork' }] } });
      return;
    }
    case 'community': {
      net.patch({ communities: [{ id: newId(), name: s.name, topic: topicList[0], owner: me(), openPosting: false, members: [me()], posts: [], desc: s.desc, ts: Date.now() }, ...net.communities] });
      say(t('Fatto: ho creato la community «{0}». Solo tu puoi pubblicare, e puoi cambiarlo dalle sue impostazioni.', s.name), { ext: { actions: [{ kind: 'open', label: t('Apri LifeNetwork'), page: 'lifenetwork' }] } });
      return;
    }
    case 'lifeclub': {
      const cid = useClub.getState().createClub(me(), { name: s.name, tagline: s.tagline ?? '' });
      try { ensureChat(useClub.getState().clubs[cid]); } catch { /* il canale si crea anche dopo */ }
      say(t('Fatto: «{0}» è creato come bozza. Aggiungi i contenuti e poi pubblicalo.', s.name), { ext: { actions: [{ kind: 'open', label: t('Apri il LifeClub'), page: 'clubStudio' }] } });
      return;
    }
    case 'sendlp': {
      const r = sendLP(s.to, Number(s.amount), { note: s.note, via: 'chat' });
      say(r.ok ? t('Fatto: ho inviato {0} LP a {1}. L\'invio arriva online con la connessione.', s.amount, s.to) : r.message);
      return;
    }
    case 'follow': {
      if (net.following.includes(s.to)) { say(t('Segui già {0}.', s.to)); return; }
      net.toggleFollow(s.to);
      say(t('Ora segui {0}.', s.to), { ext: { actions: [{ kind: 'open', label: t('Apri il profilo'), page: 'userProfile', params: { name: s.to } }] } });
      return;
    }
    case 'message': {
      const chat = useChat.getState();
      chat.send(chat.ensureDm(s.to, me()), me(), { kind: 'text', text: s.text });
      say(t('Fatto: messaggio inviato a {0}.', s.to), { ext: { actions: [{ kind: 'open', label: t('Apri la chat'), page: 'conversationPage', params: { id: `dm:${s.to}` } }] } });
      return;
    }
    case 'open': { go(s.page); return; }
  }
}

function proceed(say: Say) {
  const cur = active!;
  const m = missing(cur.action, cur.slots);
  if (m) { cur.stage = 'slot'; cur.pending = m.key; say(t(m.ask)); return; }
  if (cur.action.confirm && cur.stage !== 'confirm') { cur.stage = 'confirm'; say(t(cur.action.confirm(cur.slots)), { chips: CONFIRM }); return; }
  active = null;
  execute(cur.action, cur.slots, say);
}

/**
 * Gestisce una richiesta che è una funzione dell'app. true = presa in carico (anche a metà: aspetta la risposta alla domanda),
 * false = non è un'azione e il messaggio prosegue per le altre strade.
 */
export function handleAppAction(text: string, say: Say): boolean {
  if (active) {
    const cur = active;
    if (isCancel(text)) { active = null; say(t('Va bene, annullato.')); return true; }
    if (cur.stage === 'confirm') {
      if (isYes(text)) { proceed(say); return true; }
      if (isNo(text)) { active = null; say(t('Va bene, non invio nulla.')); return true; }
      say(t('Rispondi «sì» per confermare oppure «annulla».'), { chips: CONFIRM }); return true;
    }
    // una nuova richiesta completa mentre si aspetta una risposta: ha la precedenza
    const fresh = startAction(text, ctx());
    if (fresh && fresh.action.id !== cur.action.id) { active = { ...fresh, asked: [], stage: 'slot' }; proceed(say); return true; }
    const def = cur.action.slots.find((d) => d.key === cur.pending);
    const v = def?.parse ? def.parse(text, ctx()) : text.trim();
    if (!def || !v) { say(t(def?.ask ?? 'Non ho capito.')); return true; }
    cur.slots[def.key] = v;
    proceed(say);
    return true;
  }
  const st = startAction(text, ctx());
  if (!st) return false;
  active = { ...st, asked: [], stage: 'slot' };
  proceed(say);
  return true;
}

export const APP_ACTION_TITLES = ACTIONS.map((a) => a.title);
