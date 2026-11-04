import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import type { Ability } from '@/lib/gameData';

/**
 * The campaign's ability library. Index.tsx provides it so spells, items and mobs deep in the
 * component tree (casting, the DM's mob panel, the mob creator) can read linked abilities
 * without threading props through every view.
 */
interface AbilitiesContextValue {
  abilities: Ability[];
  /** Saves a new library ability (used by "Make my own copy" on a link) */
  addAbility?: (ability: Ability) => Promise<void>;
  iconImages: Record<string, string>;
}

const AbilitiesContext = createContext<AbilitiesContextValue>({ abilities: [], iconImages: {} });

interface AbilitiesProviderProps extends AbilitiesContextValue {
  children: ReactNode;
}

export function AbilitiesProvider({ abilities, addAbility, iconImages, children }: AbilitiesProviderProps) {
  const value = useMemo(() => ({ abilities, addAbility, iconImages }), [abilities, addAbility, iconImages]);
  return <AbilitiesContext.Provider value={value}>{children}</AbilitiesContext.Provider>;
}

export function useAbilityLibrary() {
  return useContext(AbilitiesContext);
}
