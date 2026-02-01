/**
 * ProjectContext - Provides shared project state across the app
 *
 * This context wraps useProject to ensure all components share the same
 * project state instance, solving the issue where multiple useProject()
 * calls created independent state instances.
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useProject } from '../hooks/useProject';

type ProjectContextValue = ReturnType<typeof useProject>;

const ProjectContext = createContext<ProjectContextValue | null>(null);

export interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const project = useProject();

  return (
    <ProjectContext.Provider value={project}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}
