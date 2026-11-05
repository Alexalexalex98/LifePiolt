import { t } from '@/i18n/core';
import { askSend } from '@/lib/aiConsent';
import { analyze, type Access, type DocKind, type DocResult } from '@/lib/docClassify';
import { readUriBytes } from '@/lib/readUri';
import { askTheiaFiles } from '@/lib/theia';
import { fileText } from '@/lib/workspaceAi';
import { myUserId, raw, type Res } from '@/lib/teams';
import { db, pushWorkEvent, q, run } from '@/lib/teamWork';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { useDocs, type TeamDoc } from '@/store/docs';
import { useLife, type DriveFile } from '@/store/life';

/** Documenti di lavoro sul server: ogni file viene letto, riconosciuto e salvato nella cartella giusta con i permessi giusti (li decide il server). */
export type Picked = { uri: string; name: string; mime?: string; size?: number };

/** Legge il file sul telefono e lo riconosce. `text` è null se non si legge (scansione, foto): serve l'AI o la compilazione a mano. */
export async function readAndAnalyze(f: Picked): Promise<{ result: DocResult; text: string | null }> {
  const text = await fileText({ id: '', n: f.name, s: '', folder: '', date: '', uri: f.uri } as DriveFile);
  return { result: analyze(f.name, text ?? ''), text };
}
/** Con il consenso dell'utente: l'AI trascrive il testo di una scansione o di una foto, poi si riconosce come sempre. */
export async function readWithAi(f: Picked): Promise<{ result: DocResult; text: string } | null> {
  if (!(await askSend('files', f.name))) return null;
  try {
    const r = await askTheiaFiles('Trascrivi tutto il testo di questo documento, riga per riga, senza commenti.', [{ uri: f.uri, mime: f.mime ?? 'application/pdf' }]);
    return r.reply ? { result: analyze(f.name, r.reply), text: r.reply } : null;
  } catch { return null; }
}

export async function listDocs(team: string): Promise<Res<TeamDoc[]>> {
  return run(async () => {
    const rows = await q<TeamDoc[]>((await db()).from('team_docs').select('*').eq('team_id', team).order('created_at', { ascending: false }));
    useDocs.getState().set(team, rows); return rows;
  });
}

export type NewDoc = { team: string; file: Picked; kind: DocKind; title: string; fields: Record<string, string>; access: Access; person?: string | null; due?: string | null; amount?: number | null; currency?: 'CHF' | 'EUR' | null };
/** Carica il file nella cartella giusta e salva la scheda. Se ha una scadenza la mette anche nel Plan (etichetta Lavoro). */
export const saveDoc = (d: NewDoc) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const bytes = await readUriBytes(d.file.uri);
  if (bytes.length > 25 * 1024 * 1024) throw new Error(t('Il file supera i 25 MB.'));
  const folder = d.access === 'person' ? `p-${d.person}` : d.access;
  if (d.access === 'person' && !d.person) throw new Error(t('Scegli a quale persona si riferisce.'));
  const path = `${d.team}/${folder}/${Date.now().toString(36)}-${d.file.name.replace(/[^\w.\-]+/g, '_')}`;
  const c = await raw();
  const up = await c.storage.from('team-docs').upload(path, bytes, { contentType: d.file.mime ?? 'application/octet-stream', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const id = newEventId();
  try {
    await q((await db()).from('team_docs').insert({ id, team_id: d.team, kind: d.kind, title: d.title.trim() || d.file.name, fields: d.fields, access: d.access, person: d.person ?? null, due: d.due ?? null, amount: d.amount ?? null, currency: d.currency ?? null, path, file_name: d.file.name, mime: d.file.mime ?? null, size: bytes.length, created_by: me }));
  } catch (e) { await c.storage.from('team-docs').remove([path]); throw e; }
  if (d.due) {
    const label = d.kind === 'contract' ? t('Scade il contratto') : d.kind === 'invoice' || d.kind === 'bill' ? t('Da pagare') : t('Scadenza');
    const ev = { time: '09:00', title: `${label}: ${d.title}`.slice(0, 190), dur: 30, color: WORK_COLOR_ID, team: d.team, wid: newEventId(), by: me };
    useLife.getState().addEvent(d.due, ev); void pushWorkEvent(d.due, ev);
  }
  await listDocs(d.team);
  return id;
});

export const updateDoc = (doc: TeamDoc, patch: Partial<Pick<TeamDoc, 'status' | 'title' | 'fields' | 'due' | 'amount' | 'currency' | 'kind'>>) => run(async () => { await q((await db()).from('team_docs').update(patch).eq('id', doc.id)); await listDocs(doc.team_id); });
export const deleteDoc = (doc: TeamDoc) => run(async () => {
  const c = await raw();
  await q((await db()).from('team_docs').delete().eq('id', doc.id));
  await c.storage.from('team-docs').remove([doc.path]);
  await listDocs(doc.team_id);
});
export const downloadDoc = (doc: TeamDoc) => run(async () => {
  const r = await (await raw()).storage.from('team-docs').download(doc.path);
  if (r.error || !r.data) throw new Error(r.error?.message || t('Non riesco a scaricare il file.'));
  return new Uint8Array(await r.data.arrayBuffer());
});
