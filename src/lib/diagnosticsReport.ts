/**
 * Testo di diagnostica esportabile: versione, piattaforma, stato di storage/notifiche/background/permessi e log recenti.
 * Modulo PURO. NESSUN dato personale: niente titoli di notifiche, niente contenuti, niente nomi; il testo finale passa
 * comunque dalla redazione (email, IBAN, carte, telefoni, percorsi, token).
 */
import { sanitize, type LogEntry, fmtEntry } from './log.ts';

export type SchedInfo = { id: string; at: number | null };
export type DiagInfo = {
  app: { name: string; version: string; sdk: string; build: string; runtime: string };
  device: { platform: string; os: string; model: string; locale: string; tz: string };
  storage: { engine: string; keys: number; kb: number; note?: string };
  notifications: { supported: boolean; permission: string; scheduled: SchedInfo[] | null };
  background: { supported: boolean; registered: boolean; system: string; reason: string; last: { ts: number; source: string; ok: boolean; ran: string[]; clock: string | null; ms: number; error?: string } | null };
  permissions: Record<string, string>;
  voice?: Record<string, string | number | boolean | null>;
  errors: number;
  log: LogEntry[];
};

/** Tipo di notifica programmata dal prefisso dell'id (senza leggerne il testo). */
export function kindOfId(id: string): string {
  if (id.startsWith('lp-ev-')) return 'promemoria impegni';
  if (id.startsWith('lp-bill-')) return 'scadenze bollette';
  if (id.startsWith('lp-briefing')) return 'briefing';
  if (id.startsWith('lp-test')) return 'prova';
  return 'altre';
}

export function groupScheduled(list: SchedInfo[]): { kind: string; count: number; next: number | null }[] {
  const m = new Map<string, { count: number; next: number | null }>();
  for (const s of list) {
    const k = kindOfId(s.id);
    const cur = m.get(k) ?? { count: 0, next: null };
    cur.count++;
    if (s.at !== null && (cur.next === null || s.at < cur.next)) cur.next = s.at;
    m.set(k, cur);
  }
  return [...m.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => a.kind.localeCompare(b.kind));
}

const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : 'n/d');

export function buildReport(i: DiagInfo, now = Date.now()): string {
  const L: string[] = [];
  L.push(`${i.app.name} - diagnostica`);
  L.push(`Generata: ${iso(now)}`);
  L.push('');
  L.push('[App]');
  L.push(`Versione ${i.app.version} (build ${i.app.build}) - Expo SDK ${i.app.sdk} - ${i.app.runtime}`);
  L.push('[Dispositivo]');
  L.push(`${i.device.platform} ${i.device.os} - ${i.device.model} - lingua ${i.device.locale} - fuso ${i.device.tz}`);
  L.push('[Storage]');
  L.push(`${i.storage.engine}: ${i.storage.keys} archivi, ${i.storage.kb} KB${i.storage.note ? ' - ' + i.storage.note : ''}`);
  L.push('[Notifiche]');
  L.push(`Supportate: ${i.notifications.supported ? 'si' : 'no'} - permesso: ${i.notifications.permission}`);
  if (i.notifications.scheduled === null) L.push('Programmate: non leggibili');
  else {
    L.push(`Programmate: ${i.notifications.scheduled.length}`);
    for (const g of groupScheduled(i.notifications.scheduled)) L.push(`  ${g.kind}: ${g.count} (prossima ${iso(g.next)})`);
  }
  L.push('[Background]');
  L.push(`Supportato: ${i.background.supported ? 'si' : 'no'} - registrato: ${i.background.registered ? 'si' : 'no'} - sistema: ${i.background.system}${i.background.reason ? ' - ' + i.background.reason : ''}`);
  const l = i.background.last;
  L.push(l ? `Ultimo esito: ${iso(l.ts)} (${l.source}) ${l.ok ? 'ok' : 'ERRORE'}; eseguiti: ${l.ran.join(', ') || 'nessuno'}${l.clock ? '; ' + l.clock : ''}; ${l.ms} ms${l.error ? '; ' + l.error : ''}` : 'Ultimo esito: nessuno');
  L.push('[Permessi]');
  for (const [k, v] of Object.entries(i.permissions)) L.push(`  ${k}: ${v}`);
  if (i.voice) { L.push('[Voce]'); for (const [k, v] of Object.entries(i.voice)) L.push(`  ${k}: ${v === null ? 'n/d' : String(v)}`); }
  L.push('');
  L.push(`[Log] ${i.log.length} voci recenti, ${i.errors} errori registrati`);
  for (const e of i.log) L.push(fmtEntry(e));
  return sanitize(L.join('\n'));
}
