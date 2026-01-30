/**
 * Interactive Subfeature - Interactive prototype generation
 *
 * Handles interactive mode selection, preview, and physics-based demos:
 * - Mode toggle (static, hover, click, etc.)
 * - Interactive prototype preview modal
 * - Physics-based playable demos
 * - Game mechanics templates (platformer, top-down, puzzle, fps, third-person)
 * - Key binding / input remapping
 * - Mobile touch controls
 * - Exportable standalone HTML demos
 */

// Components
export { InteractiveModeToggle } from './components/InteractiveModeToggle';
export { InteractivePreviewModal } from './components/InteractivePreviewModal';
export { MechanicsSelector } from './components/MechanicsSelector';
export { ExportButton } from './components/ExportButton';
export { PhysicsWebGLDemo } from './components/PhysicsWebGLDemo';
export { HotspotEditor } from './components/HotspotEditor';
export { CameraPresetBar } from './components/CameraPresetBar';

// Input mapping and touch controls (from components folder)
export { InputMapper } from '../components/InputMapper';
export { TouchControls } from '../components/TouchControls';

// Library exports
export * from './lib';
