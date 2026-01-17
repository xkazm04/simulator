/**
 * DimensionsContext - Provides dimension state and actions to the component tree
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useDimensions, DimensionsState, DimensionsActions } from './hooks/useDimensions';

type DimensionsContextValue = DimensionsState & DimensionsActions;

const DimensionsContext = createContext<DimensionsContextValue | null>(null);

export interface DimensionsProviderProps {
  children: ReactNode;
}

export function DimensionsProvider({ children }: DimensionsProviderProps) {
  const dimensions = useDimensions();

  return (
    <DimensionsContext.Provider value={dimensions}>
      {children}
    </DimensionsContext.Provider>
  );
}

export function useDimensionsContext(): DimensionsContextValue {
  const context = useContext(DimensionsContext);
  if (!context) {
    throw new Error('useDimensionsContext must be used within a DimensionsProvider');
  }
  return context;
}
