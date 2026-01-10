import React, { createContext, useContext, ReactNode } from 'react';
import { useDataStore } from '../hooks/useDataStore';

type GameContextType = ReturnType<typeof useDataStore>;

const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const store = useDataStore();
  
  return (
    <GameContext.Provider value={store}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
