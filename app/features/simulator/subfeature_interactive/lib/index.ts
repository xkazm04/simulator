/**
 * Interactive Subfeature Library Index
 *
 * Export all interactive demo libraries for easy importing.
 */

// Physics engine
export { PhysicsWorld, createPhysicsWorldForGameType } from './physicsWorld';
export type { PhysicsConfig, PhysicsBody, CollisionEvent, CollisionCallback } from './physicsWorld';

// Input management
export {
  InputManager,
  createInputManager,
  createInputManagerForGameType,
  getBindingsForGameType,
  getInputSchemePreset,
  getPresetsForGameType,
  getKeyDisplayName,
  serializeBindings,
  deserializeBindings,
  saveBindingsToStorage,
  loadBindingsFromStorage,
  INPUT_SCHEME_PRESETS,
  KEY_DISPLAY_NAMES,
  ACTION_DISPLAY_NAMES,
} from './inputManager';
export type {
  InputAction,
  KeyBinding,
  MouseState,
  TouchState,
  VirtualJoystickState,
  InputState,
  InputSchemePreset,
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

// Camera presets
export {
  CAMERA_PRESETS,
  DEFAULT_AUTOPLAY_CONFIG,
  getPreset,
  normalizedToWorld,
  applyPresetToCamera,
  lerpPosition,
  easingFunctions,
  applyEasing,
  CameraAutoPlayer,
} from './cameraPresets';
export type {
  CameraPresetId,
  CameraPreset,
  AutoPlayConfig,
} from './cameraPresets';

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
