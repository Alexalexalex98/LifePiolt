import { tx } from './tx.ts';
import type { ProxyAsset, DocFormat } from './types.ts';

/**
 * Post-elaborazione dell'output: testo reso facile da capire in base al profilo, allegati salvabili in LifeDrive (locale).
 * Regole deterministiche e locali; il prompt di semplificazione serve per quando ci sara' un modello.
 */
export const SIMPLIFY_SYSTEM_PROMPT = `You adapt an AI answer for a specific reader. Keep every fact, number and name unchanged; never add information.
Rewrite in {LANGUAGE}, in plain words, short sentences, no jargon (explain any unavoidable term in a few words).
Reading style: {STYLE}  (direct = go to the point and say what to do; chatty = explain the why with some context; brief = one or two sentences, essentials only).
Put concrete actions as a short list at the end, starting with a verb. Do not use markdown headings, emojis or filler.
Do not include personal data about the reader that is not in the answer.`;

export type Profile = { answerStyle: string; lang?: string };
export type Simplified = { text: string; actions: string[]; shortened: boolean };

const ACTION = /^(fai|devi|dovresti|prova|controlla|aggiungi|ricorda|usa|apri|invia|scrivi|chiama|prenota|salva|do|try|check|add|remember|use|open|send|write|call|book|save|you should|you need to|prossimo passo|next step|azione)\b/i;

const stripMd = (s: string) => s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '')).replace(/^#{1,6}\s*/gm, '').replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(?<!\*)\*(?!\s)([^*\n]+)\*(?!\*)/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^\s*[*•]\s+/gm, '- ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

const sentences = (p: string): string[] => p.match(/[^.!?。！？]+[.!?。！？]+["')»]*|[^.!?。！？]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [p];

export function simplifyText(input: string, profile: Profile): Simplified {
  const style = profile.answerStyle === 'breve' || profile.answerStyle === 'discorsivo' ? profile.answerStyle : 'diretto';
  const cleaned = stripMd(input ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const maxUnits = style === 'breve' ? 2 : style === 'diretto' ? 6 : 14;
  const maxChars = style === 'breve' ? 280 : style === 'diretto' ? 700 : 1800;
  const actions: string[] = [];
  const units: string[] = [];
  for (const line of cleaned.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    const isList = /^(-|\d+[.)])\s+/.test(l);
    const body = l.replace(/^(-|\d+[.)])\s+/, '');
    if (isList) { units.push('- ' + body); if (ACTION.test(body)) actions.push(body); continue; }
    for (const s of sentences(l)) { units.push(s); if (ACTION.test(s)) actions.push(s); }
  }
  let out: string[] = [];
  let len = 0, cut = false;
  for (const u of units) {
    if (out.length >= maxUnits || len + u.length > maxChars) { cut = true; break; }
    out.push(u); len += u.length;
  }
  if (!out.length && units.length) { out = [units[0].slice(0, maxChars)]; cut = units.length > 1 || units[0].length > maxChars; }
  let text = out.join('\n');
  const shownActions = style === 'breve' ? [] : actions.slice(0, 3).filter((a) => !text.includes(a));
  if (shownActions.length) text += '\n\n' + tx('Cosa fare:') + '\n' + shownActions.map((a) => '- ' + a).join('\n');
  return { text, actions: actions.slice(0, 3), shortened: cut };
}

// --- allegati ---
export type Attachment = { id: string; kind: 'image' | 'audio' | 'document'; uri: string; mime: string; title: string; saveTo: 'lifedrive'; docFormat?: DocFormat; width?: number; height?: number };

export function toAttachment(asset: ProxyAsset, id: string, docFormat?: DocFormat): Attachment {
  return { id, kind: asset.kind, uri: asset.url, mime: asset.mime, title: asset.title, saveTo: 'lifedrive', ...(docFormat ? { docFormat } : {}), ...(asset.width ? { width: asset.width, height: asset.height } : {}) };
}

/** Voce per LifeDrive (locale): {n, s, folder, date, uri} come DriveFile senza id. */
export function driveEntry(a: Attachment, dateIso: string): { n: string; s: string; folder: string; date: string; uri: string } {
  const ext = a.docFormat ? { docx: 'docx', pdf: 'pdf', slides: 'pptx', sheet: 'xlsx' }[a.docFormat] : a.mime.split('/')[1]?.split(';')[0] || 'bin';
  const name = a.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Creazione di Theia';
  return { n: name.endsWith('.' + ext) ? name : `${name}.${ext}`, s: '—', folder: 'Creazioni di Theia', date: dateIso, uri: a.uri };
}
