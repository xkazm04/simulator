/**
 * Interactive Subfeature - Interactive prototype generation
 *
 * Handles interactive mode selection, preview, and physics-based demos:
 * - Mode toggle (static, hover, click, etc.)
 * - Interactive prototype preview modal
 * - Physics-based playable demos
 * - Game mechanics templates (platformer, top-down, puzzle)
 * - Exportable standalone HTML demos
 */

// Components
export { InteractiveModeToggle } from './components/InteractiveModeToggle';
export { InteractivePreviewModal } from './components/InteractivePreviewModal';
export { MechanicsSelector } from './components/MechanicsSelector';
export { ExportButton } from './components/ExportButton';
export { PhysicsWebGLDemo } from './components/PhysicsWebGLDemo';
export { HotspotEditor } from './components/HotspotEditor';

// Library exports
export * from './lib';
