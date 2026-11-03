import { t } from '@/i18n/core';
import { exerciseById } from '@/lib/mindLibrary';
import { diaryCsv, diaryHtml, type DiaryInput } from '@/lib/wellbeing/diaryExport';
import { useApp } from '@/store/app';
import { useHealth } from '@/store/health';
import { useMindSpace } from '@/store/mindSpace';
import { NOTE_LABEL, useWellbeing } from '@/store/wellbeing';

const answerText = (a: unknown): string => (Array.isArray(a) ? a.join(', ') : String(a ?? '')).slice(0, 160);

export function collectDiary(days: number, includeNotes: boolean): DiaryInput {
  const h = useHealth.getState(); const wb = useWellbeing.getState();
  const now = Date.now();
  const sl = (h.series?.sleep ?? []).slice(-7);
  return {
    name: useApp.getState().account?.name || undefined,
    from: now - days * 86400000, to: now + 86400000,
    moods: h.moods ?? [],
    exercises: useMindSpace.getState().entries.map((e) => ({ ts: e.ts, title: exerciseById(e.ex)?.title ?? e.ex, answers: Object.values(e.answers).map(answerText).filter(Boolean).join(' · ') })),
    results: wb.results.map((r) => ({ ts: r.ts, kind: r.kind, score: r.score, max: r.max, label: r.label })),
    notes: includeNotes ? wb.notes.map((n) => ({ ts: n.ts, kind: NOTE_LABEL[n.kind] ?? n.kind, note: n.note })) : [],
    sleepAvg: sl.length ? sl.reduce((a, b) => a + b, 0) / sl.length : undefined,
  };
}

/** Crea il file (PDF o CSV) e apre il menu di condivisione: lo scegli tu a chi mandarlo. Niente parte da solo. */
export async function shareDiary(kind: 'pdf' | 'csv', days: number, includeNotes: boolean): Promise<{ ok: boolean; message?: string }> {
  try {
    const input = collectDiary(days, includeNotes);
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: t('La condivisione dei file non è disponibile su questo dispositivo.') };
    if (kind === 'pdf') {
      const Print = await import('expo-print');
      const { uri } = await Print.printToFileAsync({ html: diaryHtml(input) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('Il tuo diario del benessere'), UTI: 'com.adobe.pdf' });
    } else {
      const { File, Paths } = await import('expo-file-system');
      const file = new File(Paths.cache, `diario-benessere-${new Date().toISOString().slice(0, 10)}.csv`);
      if (file.exists) file.delete();
      file.create(); file.write(`﻿${diaryCsv(input)}`);
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: t('Il tuo diario del benessere'), UTI: 'public.comma-separated-values-text' });
    }
    return { ok: true };
  } catch { return { ok: false, message: t('Non sono riuscito a creare il file: riprova.') }; }
}
