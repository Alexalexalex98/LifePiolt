import tr from '@/data/translations.json';
import { useApp, type Language } from '@/store/app';

type Dict = Record<string, any>;
const translations = tr as unknown as Record<Language, Dict>;

export function translate(language: Language, key: string): string {
  return (translations[language]?.[key] as string) || (translations.Italiano[key] as string) || key;
}

export function sectionNamesFor(language: Language): Record<string, string> {
  return { ...translations.Italiano.sectionNames, ...(translations[language]?.sectionNames || {}) };
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
