/**
 * PromptsContext - Provides prompts state and actions to the component tree
 * Handles automatic persistence to the project API.
 */

'use client';

import React, { createContext, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import { usePrompts, PromptsState, PromptsActions, UsePromptsOptions } from './hooks/usePrompts';
import { useProjectContext } from '../contexts';
import { GeneratedPrompt } from '../types';

type PromptsContextValue = PromptsState & PromptsActions;

const PromptsContext = createContext<PromptsContextValue | null>(null);

export interface PromptsProviderProps {
  children: ReactNode;
}

export function PromptsProvider({ children }: PromptsProviderProps) {
  const project = useProjectContext();
  const projectIdRef = useRef<string | null>(null);

  // Track project ID changes
  useEffect(() => {
    projectIdRef.current = project.currentProject?.id || null;
  }, [project.currentProject?.id]);

  // Persist prompts to API
  const onSavePrompts = useCallback(async (prompts: GeneratedPrompt[]) => {
    const projectId = projectIdRef.current;
    if (!projectId) return;

    try {
      await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: prompts.map(p => ({
          id: p.id,
          sceneNumber: p.sceneNumber,
          sceneType: p.sceneType,
          prompt: p.prompt,
          copied: p.copied,
          rating: p.rating,
          locked: p.locked,
          elements: p.elements,
        })) }),
      });
    } catch (err) {
      console.error('[PromptsProvider] Failed to save prompts:', err);
    }
  }, []);

  // Delete all prompts from API
  const onDeletePrompts = useCallback(async () => {
    const projectId = projectIdRef.current;
    if (!projectId) return;

    try {
      await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.error('[PromptsProvider] Failed to delete prompts:', err);
    }
  }, []);

  const options: UsePromptsOptions = {
    onSavePrompts,
    onDeletePrompts,
  };

  const prompts = usePrompts(options);

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
