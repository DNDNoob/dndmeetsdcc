import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import type { Crawler, CustomLanguage } from '@/lib/gameData';
import { allLanguages, type Language } from '@/lib/languages';

/**
 * Languages and who is reading. Index.tsx provides it from useGameState so text written in a
 * language (items, quest notes) can be scrambled anywhere without threading props through every view.
 */
interface LanguagesContextValue {
  languages: Language[];            // built-in + custom
  customLanguages: CustomLanguage[];
  isAdmin: boolean;                 // the DM reads everything
  readerCrawler: Crawler | null;    // the viewer's own crawler
  createLanguage?: (name: string, description: string, crawlerId?: string) => Promise<void>;
  deleteLanguage?: (id: string) => Promise<void>;
}

const LanguagesContext = createContext<LanguagesContextValue>({
  languages: allLanguages([]),
  customLanguages: [],
  isAdmin: true,
  readerCrawler: null,
});

interface LanguagesProviderProps {
  customLanguages: CustomLanguage[];
  isAdmin: boolean;
  readerCrawler: Crawler | null;
  createLanguage: LanguagesContextValue['createLanguage'];
  deleteLanguage: LanguagesContextValue['deleteLanguage'];
  children: ReactNode;
}

export function LanguagesProvider({ customLanguages, isAdmin, readerCrawler, createLanguage, deleteLanguage, children }: LanguagesProviderProps) {
  const value = useMemo(
    () => ({ languages: allLanguages(customLanguages), customLanguages, isAdmin, readerCrawler, createLanguage, deleteLanguage }),
    [customLanguages, isAdmin, readerCrawler, createLanguage, deleteLanguage]
  );
  return <LanguagesContext.Provider value={value}>{children}</LanguagesContext.Provider>;
}

export function useLanguages() {
  return useContext(LanguagesContext);
}
