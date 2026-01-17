/**
 * PromptsContext - Provides prompts state and actions to the component tree
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { usePrompts, PromptsState, PromptsActions } from './hooks/usePrompts';

type PromptsContextValue = PromptsState & PromptsActions;

const PromptsContext = createContext<PromptsContextValue | null>(null);

export interface PromptsProviderProps {
  children: ReactNode;
}

export function PromptsProvider({ children }: PromptsProviderProps) {
  const prompts = usePrompts();

  return (
    <PromptsContext.Provider value={prompts}>
      {children}
    </PromptsContext.Provider>
  );
}

export function usePromptsContext(): PromptsContextValue {
  const context = useContext(PromptsContext);
  if (!context) {
    throw new Error('usePromptsContext must be used within a PromptsProvider');
  }
  return context;
}
