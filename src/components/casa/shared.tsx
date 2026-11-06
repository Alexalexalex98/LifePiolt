import { useEffect, useState } from 'react';

import { alertT } from '@/lib/alert';
import { MEMBER_COLORS, roomSummary, type Member } from '@/lib/homeCare';
import { pickFromGallery, takePhoto } from '@/components/theia/images';
import { useApp } from '@/store/app';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

export const localToday = (): string => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** Il giorno di oggi, che si aggiorna da solo a mezzanotte. */
export function useToday(): string {
  const [d, setD] = useState(localToday());
  useEffect(() => { const h = setInterval(() => setD((x) => { const n = localToday(); return n === x ? x : n; }), 60000); return () => clearInterval(h); }, []);
  return d;
}
/** Se non c'è ancora nessuno in famiglia, la prima persona sei tu (con il nome dell'account). */
export function ensureMe(): Member {
  const st = useCasa.getState(); if (st.members.length) return st.members.find((m) => m.id === st.me) ?? st.members[0]!;
  const m: Member = { id: `m${Date.now().toString(36)}`, name: useApp.getState().account.name || 'Io', kind: 'adulto', color: MEMBER_COLORS[0]! };
  st.addMember(m); return m;
}
/** Scatta una foto o scegli dalla galleria: restituisce l'indirizzo del file sul telefono (non esce da qui). */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const run = async (f: typeof takePhoto) => { try { const r = await f(1); resolve(r[0]?.uri ?? null); } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la foto'); resolve(null); } };
    alertT('Foto', 'Come vuoi aggiungerla?', [{ text: 'Annulla', style: 'cancel', onPress: () => resolve(null) }, { text: 'Scegli dalla galleria', onPress: () => { void run(pickFromGallery); } }, { text: 'Scatta ora', onPress: () => { void run(takePhoto); } }]);
  });
}
export const memberName = (ms: Member[], id: string | null | undefined): string => (id === 'rotate' ? 'A turno' : id ? ms.find((m) => m.id === id)?.name ?? 'Qualcuno' : 'Chiunque');

export const ROOM_COLORS = ['#0F766E', '#2563EB', '#7C3AED', '#B45309', '#DB2777', '#16A34A', '#0891B2', '#9333EA'];
/** Quando una stanza è a posto (niente in scadenza e qualcosa fatto oggi) chiede, una volta al giorno, se vuoi la foto com'è adesso come foto della stanza. */
export function maybeAskRoomPhoto(roomId: string | null): void {
  if (!roomId) return;
  const st = useCasa.getState(); const room = st.rooms.find((r) => r.id === roomId); if (!room) return; const today = localToday();
  if (!roomSummary(roomId, st.chores, st.log, today).clean || st.photoAsked[roomId] === today) return;
  st.set({ photoAsked: { ...st.photoAsked, [roomId]: today } });
  alertT(`${room.name} a posto!`, room.photo ? 'Vuoi aggiornare la foto della stanza con com\'è adesso?' : 'Vuoi scattare una foto e usarla come foto della stanza?', [
    { text: 'Non adesso', style: 'cancel' },
    { text: 'Scatta o scegli', onPress: () => { void pickPhoto().then((uri) => { if (uri) useCasa.getState().updateRoom(roomId, { photo: uri }); }); } },
  ]);
}
