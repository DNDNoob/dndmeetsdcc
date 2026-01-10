import React, { createContext, useContext, ReactNode } from 'react';
import { useFirebaseStore } from '../hooks/useFirebaseStore';

type GameContextType = ReturnType<typeof useFirebaseStore>;

const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const store = useFirebaseStore();
  
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
