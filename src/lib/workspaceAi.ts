import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { askTheiaFiles } from '@/lib/theia';
import { readLocally } from '@/lib/bills/files';
import { readTextFile } from '@/lib/chatMedia';
import { downloadTeamFile, listTeamFiles, type TeamFile } from '@/lib/teams';
import { useTeams } from '@/store/teams';
import { docTypeOf } from '@/lib/attachments';
import { officeText } from '@/lib/officeText';
import { readUriBytes } from '@/lib/readUri';
import { WORKSPACE_PROMPT, contextFor, type Doc } from '@/lib/workspaceSearch';
import { pageText } from '@/lib/workspaceCore';
import { parseTaskLines } from '@/lib/workspaceViews';
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

const mimeOf = (n: string): string | null => (/\.pdf$/i.test(n) ? 'application/pdf' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.png$/i.test(n) ? 'image/png' : null);

/** Il file scelto non si legge sul telefono (scansione, foto): dopo il consenso lo legge l'AI e risponde alla domanda. */
async function aiReadFocused(question: string): Promise<void> {
  const chat = useWorkspaceChat.getState(); const id = chat.focus[0]; const f = useLife.getState().drive.find((x) => x.id === id);
  if (!f?.uri) { chat.push({ who: 'ai', text: t('Non trovo più il file: caricalo di nuovo.') }); return; }
  const mime = mimeOf(f.n); if (!mime) { chat.push({ who: 'ai', text: t('Questo tipo di file non lo posso far leggere all\'AI.') }); return; }
  if (!(await askSend('files', f.n))) { chat.push({ who: 'ai', text: t('Va bene, non invio niente: il file resta sul tuo telefono.') }); return; }
  logSend('files', 0, [mime]);
  try {
    const r = await askTheiaFiles(`${question}\n\n${t('Rispondi in italiano usando solo ciò che c\'è nel documento. Se la risposta non c\'è, dillo.')}`, [{ uri: f.uri, mime }]);
    chat.push({ who: 'ai', text: r.reply.trim() || t('Risposta vuota dal server.'), sources: [f.n] });
  } catch (e) { chat.push({ who: 'ai', text: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }); }
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
    if (ids?.length === 1) {
      const f = useLife.getState().drive.find((x) => x.id === ids[0]);
      const mime = f ? mimeOf(f.n) : null;
      const gone = !f?.uri;
      if (gone) { chat.push({ who: 'ai', text: t('Il file «{0}» non è più sul telefono (il collegamento si è perso). Caricalo di nuovo dal pulsante «Carica file».', about) }); return; }
      if (mime && aiServerConfigured) {
        chat.set({ pending: question });
        chat.push({ who: 'ai', text: t('Sul telefono non riesco a leggere il testo di «{0}»: di solito è una scansione, una foto o un PDF con un formato particolare. Posso farlo leggere all\'AI: invio solo questo file e solo se me lo permetti.', about), actions: [{ label: t('Leggilo con l\'AI'), op: 'ai' }, { label: t('No, grazie'), op: 'dismiss' }] });
        return;
      }
    }
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
  if (op === 'ai') { chat.set({ pending: undefined }); if (q) await aiReadFocused(q); return; }
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

/** Theia legge una pagina e la riassume (in cima alla pagina) o ne estrae i task in un database. */
export async function pageAi(pid: string, op: 'summary' | 'tasks'): Promise<{ ok: boolean; msg: string; id?: string }> {
  const ws = useWorkspace.getState(); const page = ws.pages.find((p) => p.id === pid);
  if (!page) return { ok: false, msg: t('Pagina non trovata.') };
  const body = pageText(page).slice(0, 14000);
  if (body.trim().length < 20) return { ok: false, msg: t('La pagina è troppo corta: scrivi qualcosa e riprova.') };
  if (!aiServerConfigured) return { ok: false, msg: t('Per questo serve il collegamento con l\'AI: lo attivi in Intelligenza di Theia.') };
  if (!(await askSend('data', t('Solo il testo di questa pagina. Nessun altro dato dell\'app.')))) return { ok: false, msg: t('Va bene, non invio niente.') };
  logSend('data', body.length, [page.title || 'pagina']);
  try {
    if (op === 'summary') {
      const r = await aiChatRaw(`Riassumi in italiano, in massimo 5 punti brevi e chiari, il testo seguente. Un punto per riga, ognuno inizia con "- ". Nessuna introduzione.\n\n${body}`);
      const lines = r.split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 6);
      if (!lines.length) return { ok: false, msg: t('Risposta vuota dal server.') };
      lines.forEach((tx) => ws.addBlock(pid, 'bullet', tx));
      ws.addBlock(pid, 'h', t('Riassunto di Theia'));
      // il titolo va prima dei punti: riordina
      const cur = useWorkspace.getState().pages.find((p) => p.id === pid)!; const n = lines.length;
      const tail = cur.blocks.slice(-(n + 1)); const head = cur.blocks.slice(0, -(n + 1));
      ws.patch(pid, { blocks: [tail[tail.length - 1]!, ...tail.slice(0, -1), ...head] });
      return { ok: true, msg: t('Ho messo il riassunto in cima alla pagina.') };
    }
    const r = await aiChatRaw(`Dal testo seguente estrai i compiti da fare (azioni concrete). Rispondi solo con un elenco, un compito per riga nel formato "- compito | GG/MM" (la data solo se è scritta nel testo, altrimenti ometti il "|"). Massimo 20 righe.\n\n${body}`);
    const items = parseTaskLines(r);
    if (!items.length) return { ok: false, msg: t('Non ho trovato compiti in questa pagina.') };
    const id = ws.fromTemplate(pid, 'compiti', page.teamId);
    ws.patch(id, { title: t('Task da «{0}»', page.title || t('pagina')), rows: [] });
    ws.addRows(id, items);
    return { ok: true, msg: t('Ho creato {0} task in un database nelle sottopagine.', String(items.length)), id };
  } catch (e) { return { ok: false, msg: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }; }
}
