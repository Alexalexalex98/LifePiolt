import { useEffect, useState } from 'react';

import { alertT } from '@/lib/alert';
import { MEMBER_COLORS, type Member } from '@/lib/homeCare';
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
