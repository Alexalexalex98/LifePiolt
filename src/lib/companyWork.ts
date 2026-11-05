/** Funzioni di base dell'azienda (modulo PURO, nessun alias '@/'): paese e norme, piano AI, notifiche per persona, cronologia, esportazione. */
export type Country = 'IT' | 'CH';
export const COUNTRIES: Record<Country, { label: string; currency: 'EUR' | 'CHF'; privacy: string; vat: number; locale: string }> = {
  IT: { label: 'Italia', currency: 'EUR', privacy: 'GDPR (autorità: Garante per la protezione dei dati personali)', vat: 22, locale: 'it-IT' },
  CH: { label: 'Svizzera', currency: 'CHF', privacy: 'nLPD (autorità: IFPDT)', vat: 8.1, locale: 'it-CH' },
};
/** Promemoria indicativi di quello che cambia da un paese all'altro: da confermare con un professionista. */
export const normsFor = (c: Country): string[] => [`Valuta: ${COUNTRIES[c].currency}`, `Privacy: ${COUNTRIES[c].privacy}`, `IVA ordinaria: ${COUNTRIES[c].vat}% (indicativa)`, c === 'IT' ? 'Fatture: elettroniche tramite SdI' : 'Fatture: QR-fattura svizzera'];
export const fmtMoney = (n: number, c: Country): string => `${n.toLocaleString(COUNTRIES[c].locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${COUNTRIES[c].currency}`;

/* ---------- piano AI ---------- */
export type AiMode = { on: boolean; by: 'azienda' | 'personale' | 'nessuno'; text: string };
/** Theia con l'AI nel lavoro: se l'azienda paga e sei incluso, vale il piano dell'azienda; altrimenti solo se usi il tuo account. Senza AI il resto del workspace funziona uguale (comandi semplici compresi). */
export function aiMode(s: { plan: boolean; covered: boolean; personal: boolean }): AiMode {
  if (s.plan && s.covered) return { on: true, by: 'azienda', text: 'Theia è inclusa nel piano dell\'azienda.' };
  if (s.personal) return { on: true, by: 'personale', text: s.plan ? 'Non sei incluso nel piano dell\'azienda: Theia usa il tuo account personale.' : 'L\'azienda non ha un piano AI: Theia usa il tuo account personale.' };
  return { on: false, by: 'nessuno', text: s.plan ? 'Non sei incluso nel piano AI dell\'azienda. Chiedilo all\'amministratore: il resto funziona uguale.' : 'L\'azienda non ha un piano AI. Tutto il resto funziona, Theia capisce solo i comandi semplici.' };
}

/* ---------- notifiche per persona ---------- */
export const NOTIF_GROUPS: { id: string; label: string; kinds: string[] }[] = [
  { id: 'riunioni', label: 'Spostamenti e annullamenti di riunioni', kinds: ['reschedule_ask', 'reschedule_accepted', 'reschedule_declined', 'cancelled'] },
  { id: 'trasferte', label: 'Approvazioni di trasferte', kinds: ['trip_requested', 'trip_decided'] },
];
export type NotifPrefs = { muted: boolean; off: string[] };
export const DEFAULT_NOTIF: NotifPrefs = { muted: false, off: [] };
/** Una notifica si mostra se il workspace non è silenziato e il suo gruppo non è spento. Le richieste che aspettano una tua risposta si vedono sempre. */
export function notifAllowed(kind: string, p: NotifPrefs): boolean {
  if (kind === 'reschedule_ask' || kind === 'trip_requested') return true;
  if (p.muted) return false;
  const g = NOTIF_GROUPS.find((x) => x.kinds.includes(kind)); return !g || !p.off.includes(g.id);
}

/* ---------- cronologia ---------- */
export type Audit = { id: number; user_id: string; action: 'creato' | 'modificato' | 'eliminato' | 'visto'; target: string; label: string; at: string };
export const AUDIT_KINDS = ['task', 'progetto', 'documento', 'nota spese', 'persona', 'pagina', 'trasferta', 'pagina riservata', 'impostazioni', 'contratto'];
export const auditKind = (a: Pick<Audit, 'label'>): string => { const k = a.label.split(':')[0]!.trim(); return AUDIT_KINDS.includes(k) ? k : k.startsWith('impostazioni') ? 'impostazioni' : k; };
export function auditFilter(rows: Audit[], f: { kind?: string; user?: string; action?: string }): Audit[] {
  return rows.filter((r) => (!f.kind || auditKind(r) === f.kind) && (!f.user || r.user_id === f.user) && (!f.action || r.action === f.action));
}
export function auditGroups(rows: Audit[]): { day: string; rows: Audit[] }[] {
  const m = new Map<string, Audit[]>(); for (const r of rows) { const d = r.at.slice(0, 10); m.set(d, [...(m.get(d) ?? []), r]); }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, rs]) => ({ day, rows: rs.sort((a, b) => b.at.localeCompare(a.at)) }));
}

/* ---------- esportazione ---------- */
export const csvCell = (v: unknown): string => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (cols: string[], rows: Record<string, unknown>[]): string => [cols.join(';'), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(';'))].join('\n');
export type ExportInput = { team: string; at: string; pages: { title: string; text: string }[]; tasks: Record<string, unknown>[]; meetings: { title: string; day: string; time: string; minutes: string | null }[]; clients: Record<string, unknown>[]; docs: Record<string, unknown>[] };
/** Un solo testo leggibile con tutto quello che la persona può vedere: pagine, riunioni; più i CSV di task, clienti, documenti. */
export function exportBundle(i: ExportInput): { readme: string; files: { name: string; content: string; mime: string }[] } {
  const md = [`# ${i.team}`, `Esportato il ${i.at}. Contiene solo quello che puoi vedere tu.`, '', '## Pagine', ...(i.pages.length ? i.pages.map((p) => `### ${p.title || 'Senza titolo'}\n${p.text}`) : ['(nessuna)']), '', '## Riunioni', ...(i.meetings.length ? i.meetings.map((m) => `### ${m.title} · ${m.day} ${m.time}\n${m.minutes ?? '(senza verbale)'}`) : ['(nessuna)'])].join('\n');
  const files = [{ name: 'workspace.md', content: md, mime: 'text/markdown' }, { name: 'task.csv', content: toCsv(['title', 'status', 'priority', 'due', 'assignee', 'notes'], i.tasks), mime: 'text/csv' }, { name: 'clienti.csv', content: toCsv(['name', 'company', 'email', 'phone', 'country', 'status'], i.clients), mime: 'text/csv' }, { name: 'documenti.csv', content: toCsv(['title', 'kind', 'due', 'amount', 'currency', 'status'], i.docs), mime: 'text/csv' }];
  return { readme: `${files.length} file`, files };
}
