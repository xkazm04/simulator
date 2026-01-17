/**
 * BrainContext - Provides brain state and actions to the component tree
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useBrain, BrainState, BrainActions } from './hooks/useBrain';

type BrainContextValue = BrainState & BrainActions;

const BrainContext = createContext<BrainContextValue | null>(null);

export interface BrainProviderProps {
  children: ReactNode;
}

export function BrainProvider({ children }: BrainProviderProps) {
  const brain = useBrain();

  return (
    <BrainContext.Provider value={brain}>
      {children}
    </BrainContext.Provider>
  );
}

export function useBrainContext(): BrainContextValue {
  const context = useContext(BrainContext);
  if (!context) {
    throw new Error('useBrainContext must be used within a BrainProvider');
  }
  return context;
}
