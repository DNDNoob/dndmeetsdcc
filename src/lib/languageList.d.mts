export interface LanguageInfo {
  id: string;
  name: string;
  description?: string;
}

export const DEFAULT_LANGUAGE_ID: string;
export const TELEPATHIC_LANGUAGE_ID: string;
export const BEAST_LANGUAGE_ID: string;
export const PLANT_LANGUAGE_ID: string;
export const DEAD_LANGUAGE_ID: string;
export const GESTURE_LANGUAGE_IDS: string[];
export const REAL_LANGUAGES: Record<string, string>;
export const BUILT_IN_LANGUAGES: LanguageInfo[];
export function mobLanguageIds(mob: { languages?: string[] } | null | undefined): string[];
export function languageName(id: string, custom?: LanguageInfo[]): string;

interface KnowsLanguagesLike {
  languages?: string[];
  languageEffects?: { languageId: string }[];
  itemLanguages?: string[];
  telepathic?: boolean;
}
export function crawlerLanguageIds(crawler: KnowsLanguagesLike | null | undefined): string[];
export function crawlerUnderstands(crawler: KnowsLanguagesLike | null | undefined, languageId: string | undefined): boolean;
