/**
 * Panels Subfeature - Side panel image management
 *
 * Handles saved images in left/right side panels:
 * - Panel slots for displaying saved images
 * - Modal for viewing/editing saved images
 */

// Components
export { SidePanel } from './components/SidePanel';
export { SidePanelSlot } from './components/SidePanelSlot';
export { SavedImageModal } from './components/SavedImageModal';

// Lib utilities
export { regenerateImage, buildHudPrompt } from './lib';
export type { RegenerationRequest, RegenerationResponse } from './lib';
