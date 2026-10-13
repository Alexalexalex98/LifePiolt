/**
 * Registrazioni delle dirette (modulo PURO, nessun alias '@/'). Chi tiene il seminario, il corso o il webinar sceglie se registrare e chi
 * può rivederla: chi ha pagato (dal profilo di chi l'ha tenuta), gli iscritti a un suo LifeClub, oppure nessuno (solo lui).
 */
export type RecAccess = 'buyers' | 'club' | 'private';
export type LiveRecording = {
  id: string; /** 'seminar:12' / 'service:Nome' */ key: string; kind: 'seminar' | 'service'; title: string; host: string;
  startedAt: number; durationMs: number; /** file sul telefono di chi ha registrato (assente = solo segnaposto) */ uri?: string;
  access: RecAccess; /** LifeClub in cui è salvata, se access = 'club' */ clubId?: string; createdAt: number;
};
export const ACCESS_LABEL: Record<RecAccess, string> = { buyers: 'Chi ha pagato', club: 'Iscritti al mio LifeClub', private: 'Solo io' };

export type ViewerCtx = { viewer: string; /** ha pagato per quel seminario/servizio */ paid: boolean; /** iscritto al LifeClub in cui è salvata */ clubMember: boolean };

/** Può vedere la registrazione? Chi l'ha tenuta sempre; poi in base alla scelta. */
export function canWatch(rec: LiveRecording, v: ViewerCtx): boolean {
  if (v.viewer === rec.host) return true;
  if (rec.access === 'buyers') return v.paid;
  if (rec.access === 'club') return v.clubMember || v.paid;
  return false;
}

/** Cosa dire a chi non può guardarla (null = non mostrarla affatto). */
export function lockedReason(rec: LiveRecording): string | null {
  if (rec.access === 'private') return null;
  if (rec.access === 'club') return 'Disponibile agli iscritti al LifeClub di chi l\'ha tenuta';
  return rec.kind === 'seminar' ? 'Disponibile a chi ha pagato il seminario' : 'Disponibile a chi ha pagato il servizio';
}

/** Le registrazioni da mostrare sul profilo di `host` a chi guarda: le proprie sempre, le altre solo se non private. Dalla più recente. */
export function recordingsOnProfile(list: LiveRecording[], host: string, viewer: string): LiveRecording[] {
  return list.filter((r) => r.host === host && (viewer === host || r.access !== 'private')).sort((a, b) => b.startedAt - a.startedAt);
}

export function makeRecording(o: { key: string; kind: 'seminar' | 'service'; title: string; host: string; startedAt: number; endedAt: number; uri?: string; access?: RecAccess; now?: number }): LiveRecording {
  return { id: `rec:${o.key}@${o.startedAt}`, key: o.key, kind: o.kind, title: o.title, host: o.host, startedAt: o.startedAt, durationMs: Math.max(0, o.endedAt - o.startedAt), ...(o.uri ? { uri: o.uri } : {}), access: o.access ?? 'buyers', createdAt: o.now ?? o.endedAt };
}
