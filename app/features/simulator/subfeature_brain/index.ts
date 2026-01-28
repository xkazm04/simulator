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
export { BrainProvider, useBrainContext } from './BrainContext';

// Hooks
export { useBrain } from './hooks/useBrain';

// Lib
export * from './lib/simulatorAI';
export * from './lib/llmPrompts';
export * from './lib/visionExamples';

// Components
export { CentralBrain } from './components/CentralBrain';
export { DirectorControl } from './components/DirectorControl';
export { SmartBreakdown } from './components/SmartBreakdown';
export { BaseImageInput } from './components/BaseImageInput';
export { FeedbackPanel } from './components/FeedbackPanel';
export { PosterOverlay } from './components/PosterOverlay';
export { PosterFullOverlay } from './components/PosterFullOverlay';
export { PresetSelector } from './components/PresetSelector';
export { AutoplayControls } from './components/AutoplayControls';
export type { AutoplayControlsProps } from './components/AutoplayControls';
