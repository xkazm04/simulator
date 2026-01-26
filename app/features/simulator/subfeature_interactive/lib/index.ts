/**
 * Interactive Subfeature Library Index
 *
 * Export all interactive demo libraries for easy importing.
 */

// Physics engine
export { PhysicsWorld, createPhysicsWorldForGameType } from './physicsWorld';
export type { PhysicsConfig, PhysicsBody, CollisionEvent, CollisionCallback } from './physicsWorld';

// Input management
export { InputManager, createInputManager, createInputManagerForGameType } from './inputManager';
export type {
  InputAction,
  KeyBinding,
  MouseState,
  TouchState,
  VirtualJoystickState,
  InputState,
} from './inputManager';

// Game mechanics templates
export {
  GameEngine,
  getMechanicsTemplate,
  createInitialGameState,
  suggestMechanicsForImage,
  MECHANICS_TEMPLATES,
} from './mechanicsTemplates';
export type {
  GameMechanicsType,
  MechanicsConfig,
  GameState,
  MechanicsTemplate,
  GameEngineConfig,
} from './mechanicsTemplates';

// Camera controller
export { CameraController, createCameraForGameType } from './cameraController';
export type {
  CameraMode,
  CameraConfig,
  CameraState,
  CinematicKeyframe,
} from './cameraController';

// Demo exporter
export {
  exportDemo,
  downloadExport,
  formatFileSize,
  estimateExportSize,
} from './demoExporter';
export type { ExportOptions, ExportResult } from './demoExporter';

// Hotspot types and utilities
export {
  createHotspot,
  calculateBoundsFromDraw,
  isValidBounds,
  applyActionToHotspot,
  screenToNormalized,
  isPointInHotspot,
  getResizeHandleAtPoint,
  applyResize,
} from './hotspotTypes';
export type {
  Hotspot,
  HotspotBounds,
  DrawState,
  ResizeHandle,
  ResizeState,
  DragState,
  HotspotEditorMode,
  HotspotEditorState,
  HotspotActionConfig,
  HotspotActionType,
} from './hotspotTypes';
