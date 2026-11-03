import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { readLocally } from '@/lib/bills/files';
import { readTextFile } from '@/lib/chatMedia';
import { downloadTeamFile, listTeamFiles, type TeamFile } from '@/lib/teams';
import { useTeams } from '@/store/teams';
import { docTypeOf } from '@/lib/attachments';
import { officeText } from '@/lib/officeText';
import { readUriBytes } from '@/lib/readUri';
import { WORKSPACE_PROMPT, contextFor, type Doc } from '@/lib/workspaceSearch';
import { pageText } from '@/lib/workspaceCore';
import { useLife, type DriveFile } from '@/store/life';
import type { Att } from '@/lib/attachments';
import { fmtBytes } from '@/lib/attachments';
import { weekdayShortDate } from '@/lib/format';
import { useWorkspace } from '@/store/workspace';
import { useWorkspaceChat, type WsAction } from '@/store/workspaceChat';

export const WORKSPACE_FOLDER = 'Workspace';
const cache = new Map<string, string>();

/** Tutti i file del workspace: quelli caricati qui (cartella «Workspace» di LifeDrive) e quelli collegati alle pagine. */
export function workspaceFiles(): DriveFile[] {
  const drive = useLife.getState().drive;
  const linked = new Set([...useWorkspace.getState().pages.flatMap((p) => p.files), ...useWorkspaceChat.getState().linked]);
  return drive.filter((f) => f.folder === WORKSPACE_FOLDER || linked.has(f.id));
}

/** Il testo di un file, letto sul telefono (testo, CSV, Excel, PowerPoint, Word, PDF con testo). null se non si legge. */
export async function fileText(f: DriveFile): Promise<string | null> {
  if (!f.uri) return null;
  if (cache.has(f.uri)) return cache.get(f.uri)!;
  let text: string | null = null;
  try {
    const dt = docTypeOf(f.n);
    if (dt === 'txt' || dt === 'csv' || dt === 'md') text = await readTextFile(f.uri);
    else if ((dt === 'xlsx' || dt === 'pptx' || dt === 'docx') && /\.(xlsx|pptx|docx)$/i.test(f.n)) text = officeText(await readUriBytes(f.uri), dt);
    else if (dt === 'pdf') { const r = await readLocally({ uri: f.uri, name: f.n, mime: 'application/pdf' }); text = r.kind === 'text' ? r.text : null; }
  } catch { text = null; }
  if (text) cache.set(f.uri, text);
  return text;
}

const teamCache = new Map<string, string | null>();
/** Il testo dei file dei team di cui fai parte (si scaricano solo se ci sei ancora dentro: lo decide il server). */
async function teamDocs(unreadable: string[]): Promise<Doc[]> {
  const out: Doc[] = [];
  for (const tm of useTeams.getState().teams) {
    const l = await listTeamFiles(tm.id); if (!l.ok) continue;
    for (const f of l.data.slice(0, 40) as TeamFile[]) {
      if (!teamCache.has(f.path)) {
        let tx: string | null = null;
        if (f.size <= 8 * 1024 * 1024) { const d = await downloadTeamFile(f); if (d.ok) tx = await textFromBytes(f.name, d.data); }
        teamCache.set(f.path, tx);
      }
      const tx = teamCache.get(f.path);
      if (tx) out.push({ id: `t:${f.id}`, source: `${f.name} (${tm.name})`, text: tx }); else unreadable.push(f.name);
    }
  }
  return out;
}
async function textFromBytes(name: string, bytes: Uint8Array): Promise<string | null> {
  try {
    const dt = docTypeOf(name);
    if (dt === 'txt' || dt === 'csv' || dt === 'md') return new TextDecoder().decode(bytes);
    if ((dt === 'xlsx' || dt === 'pptx' || dt === 'docx') && /\.(xlsx|pptx|docx)$/i.test(name)) return officeText(bytes, dt);
  } catch { /* non leggibile */ }
  return null;
}

/** Tutto ciò che si può cercare e interrogare: pagine, database, commenti e file (anche quelli dei team). */
export async function workspaceDocs(): Promise<{ docs: Doc[]; unreadable: string[] }> {
  const docs: Doc[] = useWorkspace.getState().pages.map((p) => ({ id: `p:${p.id}`, source: p.title || t('Pagina senza titolo'), text: pageText(p) })).filter((d) => d.text.trim());
  const unreadable: string[] = [];
  for (const f of workspaceFiles()) {
    const tx = await fileText(f);
    if (tx) docs.push({ id: `f:${f.id}`, source: f.n, text: tx }); else unreadable.push(f.n);
  }
  try { docs.push(...(await teamDocs(unreadable))); } catch { /* senza team */ }
  return { docs, unreadable };
}

export type SearchHit = { kind: 'page' | 'file'; id: string; title: string; snippet: string };
/** Cerca in pagine e file (per nome subito, e per contenuto nei file già letti o leggibili). */
export async function searchWorkspace(q: string): Promise<SearchHit[]> {
  const needle = q.trim().toLowerCase(); if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const p of useWorkspace.getState().pages) {
    const tx = pageText(p); const i = tx.toLowerCase().indexOf(needle);
    if (i >= 0) hits.push({ kind: 'page', id: p.id, title: p.title || t('Pagina senza titolo'), snippet: tx.slice(Math.max(0, i - 30), i + 80).replace(/\n/g, ' ') });
  }
  for (const f of workspaceFiles()) {
    const inName = f.n.toLowerCase().includes(needle);
    const tx = await fileText(f); const i = tx ? tx.toLowerCase().indexOf(needle) : -1;
    if (inName || i >= 0) hits.push({ kind: 'file', id: f.id, title: f.n, snippet: i >= 0 && tx ? tx.slice(Math.max(0, i - 30), i + 80).replace(/\n/g, ' ') : '' });
  }
  return hits.slice(0, 40);
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Salva nel Drive del workspace i file allegati in chat e dice quali sono (nuovi o già presenti). */
export function saveAttachments(atts: Att[]): DriveFile[] {
  const life = useLife.getState(); const out: DriveFile[] = [];
  for (const a of atts) {
    if (a.kind !== 'document' || !a.uri) continue;
    const existing = life.drive.find((f) => f.uri === a.uri || (f.n === a.name && f.s === (fmtBytes(a.size ?? 0) || '—')));
    if (a.text && a.uri) cache.set(a.uri, a.text);
    if (existing) { if (existing.folder !== WORKSPACE_FOLDER) useWorkspaceChat.getState().set({ linked: [...new Set([...useWorkspaceChat.getState().linked, existing.id])] }); out.push(existing); continue; }
    const id = uid();
    const f: DriveFile = { id, n: a.name, s: fmtBytes(a.size ?? 0) || '—', folder: WORKSPACE_FOLDER, date: weekdayShortDate(), uri: a.uri, src: 'Workspace', tag: 'Workspace' };
    life.addFile(f); out.push(f);
  }
  return out;
}

async function answerFrom(question: string, ids: string[] | null): Promise<void> {
  const chat = useWorkspaceChat.getState();
  if (!aiServerConfigured) { chat.push({ who: 'ai', text: t('Per rispondere serve il collegamento con l\'AI: lo attivi in Intelligenza di Theia.') }); return; }
  let docs: Doc[] = []; const unreadable: string[] = []; let about = '';
  if (ids?.length) {
    const files = useLife.getState().drive.filter((f) => ids.includes(f.id));
    for (const f of files) { const tx = await fileText(f); if (tx) docs.push({ id: `f:${f.id}`, source: f.n, text: tx }); else unreadable.push(f.n); }
    about = files.map((f) => f.n).join(', ');
  } else { const r = await workspaceDocs(); docs = r.docs; unreadable.push(...r.unreadable); }
  const ctx = contextFor(question, docs, ids?.length ? 22000 : 18000);
  if (!ctx.text) {
    chat.push({ who: 'ai', text: ids?.length ? t('Non riesco a leggere il testo di «{0}»: se è una scansione o una foto, caricala come PDF con testo o dimmi cosa cercare.', about) : t('Non trovo niente su questo nel workspace. Controlla che il file sia caricato e leggibile.') + (unreadable.length ? ` ${t('Non riesco a leggere: {0}.', unreadable.slice(0, 3).join(', '))}` : '') });
    return;
  }
  if (!(await askSend('data', t('Solo i brani dei documenti del workspace che c\'entrano con la domanda, i nomi dei file e le ultime battute di questa chat di lavoro. Nessun dato personale dell\'app e nessun messaggio della Theia personale.')))) { chat.push({ who: 'ai', text: t('Va bene, non invio niente. I tuoi documenti restano sul telefono.') }); return; }
  logSend('data', ctx.text.length, ctx.sources);
  try {
    const hist = useWorkspaceChat.getState().log.slice(-7, -1).map((m) => `${m.who === 'me' ? 'Utente' : 'Theia Lavoro'}: ${m.text.replace(/\s+/g, ' ').slice(0, 500)}`);
    const names = [...docs.map((d) => d.source), ...unreadable];
    const q = about ? `(Stiamo parlando del file: ${about}) ${question}` : question;
    const reply = await aiChatRaw(WORKSPACE_PROMPT(ctx.text, q, hist, names));
    chat.push({ who: 'ai', text: reply.trim() || t('Risposta vuota dal server.'), sources: ctx.sources });
  } catch (e) { chat.push({ who: 'ai', text: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }); }
}

/**
 * Un messaggio a Theia Lavoro. Con file allegati: li salva nel Drive del workspace e parla di quelli. Con un file scelto: parla di quello.
 * Senza né l'uno né l'altro: prima chiede «vuoi indicare tu il file?»; se dici di no, cerca in tutti.
 */
export async function sendWork(text: string, atts: Att[] = []): Promise<void> {
  const chat = useWorkspaceChat.getState();
  const saved = saveAttachments(atts);
  const skipped = atts.filter((a) => a.kind !== 'document').length;
  chat.push({ who: 'me', text: text.trim() || (saved.length ? t('Ho caricato un file') : ''), files: saved.map((f) => f.n) });
  if (saved.length) { chat.set({ focus: saved.map((f) => f.id), mode: 'ask', pending: undefined }); chat.push({ who: 'ai', text: t('Fatto: ho salvato {0} nel Drive del workspace.{1}', saved.map((f) => `«${f.n}»`).join(', '), skipped ? ` ${t('Le foto qui non le leggo.')}` : '') }); }
  const q = text.trim();
  if (!q) { if (saved.length) chat.push({ who: 'ai', text: t('Cosa vuoi sapere su questo file?') }); return; }
  const st = useWorkspaceChat.getState();
  if (st.focus.length) { await answerFrom(q, st.focus); return; }
  if (st.mode === 'all') { await answerFrom(q, null); return; }
  chat.set({ pending: q });
  chat.push({ who: 'ai', text: t('Vuoi indicare tu il file su cui lavorare? Rispondo più in fretta e con più precisione. Se non sai quale, o non vuoi, lo cerco io in tutti i file.'), actions: [{ label: t('Scelgo io il file'), op: 'pick' }, { label: t('No, cerca tu'), op: 'all' }] });
}

/** Una scelta nei pulsanti di Theia Lavoro. */
export async function workAction(op: WsAction['op']): Promise<'pick' | void> {
  const chat = useWorkspaceChat.getState();
  const q = chat.pending;
  if (op === 'pick') return 'pick';
  if (op === 'all') { chat.set({ mode: 'all', pending: undefined }); if (q) await answerFrom(q, null); return; }
  chat.set({ pending: undefined });
}
/** Ho scelto il file: se c'era una domanda in attesa, ci rispondo. */
export async function focusFile(id: string): Promise<void> {
  const chat = useWorkspaceChat.getState();
  chat.set({ focus: [id], mode: 'ask' });
  const f = useLife.getState().drive.find((x) => x.id === id);
  const q = chat.pending;
  if (q) { chat.set({ pending: undefined }); await answerFrom(q, [id]); } else chat.push({ who: 'ai', text: t('Ok, parliamo di «{0}». Cosa vuoi sapere?', f?.n ?? '') });
}
export const clearFocus = () => useWorkspaceChat.getState().set({ focus: [], mode: 'ask' });
