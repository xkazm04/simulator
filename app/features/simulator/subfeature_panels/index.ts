/**
 * Panels Subfeature - Side panel image management
 *
 * Handles saved images in left/right side panels:
 * - Panel slots for displaying saved images
 * - Modal for viewing/editing saved images
 */

// Components
export { SidePanel, SLOTS_PER_COLUMN, SLOTS_PER_SIDE } from './components/SidePanel';
export { SidePanelSlot } from './components/SidePanelSlot';
export { SavedImageModal } from './components/SavedImageModal';
export { UploadImageModal } from './components/UploadImageModal';

// Lib utilities
export { regenerateImage, buildHudPrompt } from './lib';
export type { RegenerationRequest, RegenerationResponse } from './lib';
