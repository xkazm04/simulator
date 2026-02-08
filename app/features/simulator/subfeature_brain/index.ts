/**
 * Brain Subfeature - Manages base image, feedback, and generation controls
 *
 * The "brain" is the central control area that:
 * - Accepts source images and descriptions
 * - Parses images with AI vision
 * - Manages feedback (preserve/change)
 * - Controls output mode (gameplay/concept/poster)
 */

// Context
export { BrainProvider, useBrainContext, useBrainState, useBrainActions } from './BrainContext';

// Hooks
export { useBrain } from './hooks/useBrain';
export { useWhatif } from './hooks/useWhatif';
export type { WhatifPair } from './hooks/useWhatif';

// Lib
export * from './lib/simulatorAI';
export * from './lib/posterEvaluator';
export * from './lib/imagePolisher';

// Components
export { CentralBrain } from './components/CentralBrain';
export { DirectorControl } from './components/DirectorControl';
export { SmartBreakdown } from './components/SmartBreakdown';
export { BaseImageInput } from './components/BaseImageInput';
export { PosterOverlay } from './components/PosterOverlay';
export { PosterFullOverlay } from './components/PosterFullOverlay';
export { ViewModeSwitcher } from './components/BrainTabSwitcher';
export { WhatIfPanel } from './components/WhatIfPanel';
export { AutoplaySetupModal } from './components/AutoplaySetupModal';
export type { AutoplaySetupModalProps, AutoplayModalMode } from './components/AutoplaySetupModal';
export { ActivityLogSidebar } from './components/ActivityLogSidebar';
export type { ActivityLogSidebarProps } from './components/ActivityLogSidebar';
export { ActivityProgressCenter } from './components/ActivityProgressCenter';
export type { ActivityProgressCenterProps } from './components/ActivityProgressCenter';
