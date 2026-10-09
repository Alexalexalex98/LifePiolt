import tr from '@/data/translations.json';
import { translateText } from '@/i18n/core';
import type { LangCode } from '@/i18n/languages';
import { useApp } from '@/store/app';

type Dict = Record<string, any>;
const translations = tr as unknown as Record<string, Dict>;
/** Le prime quattro lingue hanno il vecchio dizionario a chiavi (stAccount...); le altre passano dal catalogo (testo italiano -> lingua). */
const OLD: Partial<Record<LangCode, string>> = { it: 'Italiano', en: 'English', de: 'Deutsch', fr: 'Français' };

export function translate(language: LangCode, key: string): string {
  const old = OLD[language];
  if (old) return (translations[old]?.[key] as string) || (translations.Italiano[key] as string) || key;
  const base = (translations.Italiano[key] as string) || key;
  return translateText(base);
}

export function sectionNamesFor(language: LangCode): Record<string, string> {
  const old = OLD[language];
  const base = { ...translations.Italiano.sectionNames, ...((old && translations[old]?.sectionNames) || {}) } as Record<string, string>;
  return old ? base : Object.fromEntries(Object.entries(base).map(([k, v]) => [k, translateText(v)]));
}

/** Hook: restituisce t() nella lingua scelta. */
export function useT() {
  const language = useApp((s) => s.language);
  return (key: string) => translate(language, key);
}

export function useSectionNames() {
  const language = useApp((s) => s.language);
  return sectionNamesFor(language);
}
