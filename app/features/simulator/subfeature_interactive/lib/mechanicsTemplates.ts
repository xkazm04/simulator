/**
 * MechanicsTemplates - Premade game behavior sets
 *
 * Provides composable game mechanics templates for different game types:
 * - Platformer: Jump physics, wall sliding, double jump
 * - Top-Down: 8-directional movement, rotation to mouse
 * - Puzzle: Grid-based movement, push mechanics
 *
 * Each template provides:
 * - Initial world setup (bodies, constraints)
 * - Per-frame update logic
 * - Input-to-action mapping
 */

import { PhysicsWorld, PhysicsBody, createPhysicsWorldForGameType } from './physicsWorld';
import { InputManager, InputState, createInputManagerForGameType } from './inputManager';

export type GameMechanicsType = 'platformer' | 'top-down' | 'puzzle' | 'shooter' | 'fps' | 'third-person';

export interface MechanicsConfig {
  /** Player movement speed */
  moveSpeed: number;
  /** Jump force (platformer) */
  jumpForce: number;
  /** Max fall speed (platformer) */
  maxFallSpeed: number;
  /** Allow double jump (platformer) */
  doubleJump: boolean;
  /** Allow wall jump (platformer) */
  wallJump: boolean;
  /** Player size */
  playerSize: { width: number; height: number };
  /** Starting position */
  startPosition: { x: number; y: number };
  /** World bounds */
  bounds: { width: number; height: number };
  /** Enable debug rendering */
  debug: boolean;
}

export interface GameState {
  /** Player position */
  playerPosition: { x: number; y: number };
  /** Player velocity */
  playerVelocity: { x: number; y: number };
  /** Is player grounded */
  isGrounded: boolean;
  /** Is player touching wall */
  isTouchingWall: 'left' | 'right' | null;
  /** Has double jump available */
  hasDoubleJump: boolean;
  /** Game score */
  score: number;
  /** Game time (seconds) */
  time: number;
  /** Is game paused */
  isPaused: boolean;
  /** Game over state */
  isGameOver: boolean;
  /** Collectibles collected */
  collectibles: number;
}

export interface MechanicsTemplate {
  /** Template type */
  type: GameMechanicsType;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Default configuration */
  defaultConfig: MechanicsConfig;
  /** Initialize the world with template-specific setup */
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => void;
  /** Update game state each frame */
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ) => GameState;
  /** Render debug info (optional) */
  renderDebug?: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => void;
}

// ============================================
// Platformer Template
// ============================================

const platformerTemplate: MechanicsTemplate = {
  type: 'platformer',
  name: 'Platformer',
  description: 'Classic side-scrolling platformer with jump physics',
  defaultConfig: {
    moveSpeed: 5,
    jumpForce: 0.012,
    maxFallSpeed: 15,
    doubleJump: true,
    wallJump: true,
    playerSize: { width: 30, height: 40 },
    startPosition: { x: 100, y: 300 },
    bounds: { width: 800, height: 600 },
    debug: false,
  },
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => {
    // Create world boundaries
    world.createBounds();

    // Create player
    world.createPlayer(
      'player',
      config.startPosition.x,
      config.startPosition.y,
      config.playerSize.width,
      config.playerSize.height,
      { friction: 0.001 }
    );

    // Create some default platforms
    const platformWidth = 200;
    const platformHeight = 20;

    // Ground platform
    world.createPlatform(
      'platform_ground',
      config.bounds.width / 2,
      config.bounds.height - 50,
      config.bounds.width - 100,
      platformHeight
    );

    // Floating platforms
    world.createPlatform(
      'platform_1',
      200,
      config.bounds.height - 150,
      platformWidth,
      platformHeight
    );

    world.createPlatform(
      'platform_2',
      500,
      config.bounds.height - 250,
      platformWidth,
      platformHeight
    );

    world.createPlatform(
      'platform_3',
      300,
      config.bounds.height - 350,
      platformWidth,
      platformHeight
    );

    // Add a collectible trigger
    world.createTrigger(
      'collectible_1',
      600,
      config.bounds.height - 300,
      30,
      30
    );
  },
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ): GameState => {
    const newState = { ...state };
    const player = world.getBody('player');

    if (!player || state.isPaused) {
      return newState;
    }

    // Get current velocity
    const velocity = world.getVelocity('player');
    if (!velocity) return newState;

    let newVelX = velocity.x;
    let newVelY = velocity.y;

    // Check grounded state
    newState.isGrounded = world.isGrounded('player');

    // Reset double jump when grounded
    if (newState.isGrounded) {
      newState.hasDoubleJump = true;
    }

    // Horizontal movement
    const moveSpeed = 5;
    if (input.movement.x !== 0) {
      newVelX = input.movement.x * moveSpeed;
    } else {
      // Friction when not moving
      newVelX *= 0.8;
    }

    // Jump
    if (input.justPressed.has('jump')) {
      if (newState.isGrounded) {
        newVelY = -12;
      } else if (newState.hasDoubleJump) {
        newVelY = -10;
        newState.hasDoubleJump = false;
      }
    }

    // Clamp fall speed
    if (newVelY > 15) {
      newVelY = 15;
    }

    world.setVelocity('player', { x: newVelX, y: newVelY });

    // Update position in state
    const position = world.getPosition('player');
    if (position) {
      newState.playerPosition = position;
      newState.playerVelocity = { x: newVelX, y: newVelY };
    }

    // Update time
    newState.time += deltaTime / 1000;

    return newState;
  },
  renderDebug: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => {
    // Draw player hitbox
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      state.playerPosition.x - config.playerSize.width / 2,
      state.playerPosition.y - config.playerSize.height / 2,
      config.playerSize.width,
      config.playerSize.height
    );

    // Draw debug info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`Grounded: ${state.isGrounded}`, 10, 20);
    ctx.fillText(`Velocity: (${state.playerVelocity.x.toFixed(1)}, ${state.playerVelocity.y.toFixed(1)})`, 10, 35);
    ctx.fillText(`Double Jump: ${state.hasDoubleJump}`, 10, 50);
  },
};

// ============================================
// Top-Down Template
// ============================================

const topDownTemplate: MechanicsTemplate = {
  type: 'top-down',
  name: 'Top-Down',
  description: '8-directional movement with mouse aiming',
  defaultConfig: {
    moveSpeed: 4,
    jumpForce: 0, // Not used in top-down
    maxFallSpeed: 0,
    doubleJump: false,
    wallJump: false,
    playerSize: { width: 30, height: 30 },
    startPosition: { x: 400, y: 300 },
    bounds: { width: 800, height: 600 },
    debug: false,
  },
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => {
    // Create world boundaries
    world.createBounds();

    // Create player (circular for top-down)
    world.createCircle(
      'player',
      config.startPosition.x,
      config.startPosition.y,
      config.playerSize.width / 2,
      'player'
    );

    // Create some obstacles
    world.createObstacle('wall_1', 200, 200, 100, 20, true);
    world.createObstacle('wall_2', 600, 400, 100, 20, true);
    world.createObstacle('wall_3', 400, 300, 20, 100, true);

    // Create pushable objects
    world.createCircle('crate_1', 300, 250, 20, 'dynamic');
    world.createCircle('crate_2', 500, 350, 20, 'dynamic');
  },
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ): GameState => {
    const newState = { ...state };
    const player = world.getBody('player');

    if (!player || state.isPaused) {
      return newState;
    }

    // Direct velocity control for top-down
    const moveSpeed = 4;
    const velocity = {
      x: input.movement.x * moveSpeed,
      y: input.movement.y * moveSpeed,
    };

    world.setVelocity('player', velocity);

    // Update position in state
    const position = world.getPosition('player');
    if (position) {
      newState.playerPosition = position;
      newState.playerVelocity = velocity;
    }

    // Update time
    newState.time += deltaTime / 1000;

    return newState;
  },
  renderDebug: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => {
    // Draw player hitbox
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      state.playerPosition.x,
      state.playerPosition.y,
      config.playerSize.width / 2,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Draw debug info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`Position: (${state.playerPosition.x.toFixed(0)}, ${state.playerPosition.y.toFixed(0)})`, 10, 20);
    ctx.fillText(`Velocity: (${state.playerVelocity.x.toFixed(1)}, ${state.playerVelocity.y.toFixed(1)})`, 10, 35);
  },
};

// ============================================
// Puzzle Template
// ============================================

const puzzleTemplate: MechanicsTemplate = {
  type: 'puzzle',
  name: 'Puzzle',
  description: 'Physics-based puzzle with push mechanics',
  defaultConfig: {
    moveSpeed: 3,
    jumpForce: 0,
    maxFallSpeed: 5,
    doubleJump: false,
    wallJump: false,
    playerSize: { width: 30, height: 30 },
    startPosition: { x: 100, y: 500 },
    bounds: { width: 800, height: 600 },
    debug: false,
  },
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => {
    // Create world boundaries
    world.createBounds();

    // Create player
    world.createPlayer(
      'player',
      config.startPosition.x,
      config.startPosition.y,
      config.playerSize.width,
      config.playerSize.height
    );

    // Create puzzle elements
    // Platforms
    world.createPlatform('floor', config.bounds.width / 2, config.bounds.height - 30, config.bounds.width - 60, 20);

    // Pushable blocks
    world.createObstacle('block_1', 300, config.bounds.height - 60, 40, 40, false, { density: 0.002 });
    world.createObstacle('block_2', 400, config.bounds.height - 60, 40, 40, false, { density: 0.002 });

    // Goal trigger
    world.createTrigger('goal', 700, config.bounds.height - 60, 50, 40);

    // Ramps and obstacles
    world.createPlatform('ramp', 550, config.bounds.height - 80, 100, 20);
  },
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ): GameState => {
    const newState = { ...state };
    const player = world.getBody('player');

    if (!player || state.isPaused) {
      return newState;
    }

    // Get current velocity
    const velocity = world.getVelocity('player');
    if (!velocity) return newState;

    let newVelX = velocity.x;
    const newVelY = velocity.y;

    // Horizontal movement only
    const moveSpeed = 3;
    if (input.movement.x !== 0) {
      newVelX = input.movement.x * moveSpeed;
    } else {
      newVelX *= 0.9;
    }

    world.setVelocity('player', { x: newVelX, y: newVelY });

    // Update position in state
    const position = world.getPosition('player');
    if (position) {
      newState.playerPosition = position;
      newState.playerVelocity = { x: newVelX, y: newVelY };
    }

    // Check grounded state
    newState.isGrounded = world.isGrounded('player');

    // Update time
    newState.time += deltaTime / 1000;

    return newState;
  },
  renderDebug: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => {
    // Draw player hitbox
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      state.playerPosition.x - config.playerSize.width / 2,
      state.playerPosition.y - config.playerSize.height / 2,
      config.playerSize.width,
      config.playerSize.height
    );

    // Draw debug info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`Score: ${state.score}`, 10, 20);
    ctx.fillText(`Time: ${state.time.toFixed(1)}s`, 10, 35);
  },
};

// ============================================
// FPS (First-Person Shooter) Template
// ============================================

const fpsTemplate: MechanicsTemplate = {
  type: 'fps',
  name: 'FPS',
  description: 'First-person shooter with WASD movement and mouse look',
  defaultConfig: {
    moveSpeed: 5,
    jumpForce: 0.01,
    maxFallSpeed: 10,
    doubleJump: false,
    wallJump: false,
    playerSize: { width: 30, height: 50 },
    startPosition: { x: 400, y: 300 },
    bounds: { width: 800, height: 600 },
    debug: false,
  },
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => {
    // Create world boundaries
    world.createBounds();

    // Create player (represented as circle for FPS - camera position)
    world.createCircle(
      'player',
      config.startPosition.x,
      config.startPosition.y,
      config.playerSize.width / 2,
      'player'
    );

    // Create room layout with walls
    world.createObstacle('wall_north', config.bounds.width / 2, 50, config.bounds.width - 100, 20, true);
    world.createObstacle('wall_south', config.bounds.width / 2, config.bounds.height - 50, config.bounds.width - 100, 20, true);
    world.createObstacle('wall_west', 50, config.bounds.height / 2, 20, config.bounds.height - 100, true);
    world.createObstacle('wall_east', config.bounds.width - 50, config.bounds.height / 2, 20, config.bounds.height - 100, true);

    // Create some cover objects
    world.createObstacle('cover_1', 200, 200, 60, 40, true);
    world.createObstacle('cover_2', 600, 400, 80, 40, true);
    world.createObstacle('cover_3', 400, 300, 40, 80, true);

    // Create target triggers
    world.createTrigger('target_1', 700, 150, 30, 30);
    world.createTrigger('target_2', 150, 450, 30, 30);
    world.createTrigger('target_3', 500, 500, 30, 30);
  },
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ): GameState => {
    const newState = { ...state };
    const player = world.getBody('player');

    if (!player || state.isPaused) {
      return newState;
    }

    // FPS-style movement with strafing
    const moveSpeed = 5;
    const velocity = {
      x: input.movement.x * moveSpeed,
      y: input.movement.y * moveSpeed,
    };

    world.setVelocity('player', velocity);

    // Update position in state
    const position = world.getPosition('player');
    if (position) {
      newState.playerPosition = position;
      newState.playerVelocity = velocity;
    }

    // Update time
    newState.time += deltaTime / 1000;

    return newState;
  },
  renderDebug: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => {
    // Draw player hitbox (circle for FPS)
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      state.playerPosition.x,
      state.playerPosition.y,
      config.playerSize.width / 2,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Draw crosshair
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    const crosshairSize = 10;
    const cx = config.bounds.width / 2;
    const cy = config.bounds.height / 2;
    ctx.beginPath();
    ctx.moveTo(cx - crosshairSize, cy);
    ctx.lineTo(cx + crosshairSize, cy);
    ctx.moveTo(cx, cy - crosshairSize);
    ctx.lineTo(cx, cy + crosshairSize);
    ctx.stroke();

    // Draw debug info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`Position: (${state.playerPosition.x.toFixed(0)}, ${state.playerPosition.y.toFixed(0)})`, 10, 20);
    ctx.fillText(`Score: ${state.score}`, 10, 35);
    ctx.fillText(`Time: ${state.time.toFixed(1)}s`, 10, 50);
  },
};

// ============================================
// Third-Person Template
// ============================================

const thirdPersonTemplate: MechanicsTemplate = {
  type: 'third-person',
  name: 'Third-Person',
  description: 'Third-person camera with character controller',
  defaultConfig: {
    moveSpeed: 4,
    jumpForce: 0.012,
    maxFallSpeed: 12,
    doubleJump: false,
    wallJump: false,
    playerSize: { width: 35, height: 50 },
    startPosition: { x: 400, y: 400 },
    bounds: { width: 800, height: 600 },
    debug: false,
  },
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => {
    // Create world boundaries
    world.createBounds();

    // Create player (capsule-like for third-person)
    world.createPlayer(
      'player',
      config.startPosition.x,
      config.startPosition.y,
      config.playerSize.width,
      config.playerSize.height,
      { friction: 0.002 }
    );

    // Create ground
    world.createPlatform(
      'ground',
      config.bounds.width / 2,
      config.bounds.height - 30,
      config.bounds.width - 60,
      20
    );

    // Create terrain features
    world.createPlatform('hill_1', 200, config.bounds.height - 80, 150, 20);
    world.createPlatform('hill_2', 450, config.bounds.height - 120, 120, 20);
    world.createPlatform('hill_3', 650, config.bounds.height - 160, 100, 20);

    // Create obstacles
    world.createObstacle('rock_1', 300, config.bounds.height - 60, 40, 40, true);
    world.createObstacle('tree_1', 550, config.bounds.height - 80, 20, 60, true);

    // Create collectibles
    world.createTrigger('coin_1', 200, config.bounds.height - 130, 20, 20);
    world.createTrigger('coin_2', 450, config.bounds.height - 170, 20, 20);
    world.createTrigger('coin_3', 650, config.bounds.height - 210, 20, 20);
  },
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ): GameState => {
    const newState = { ...state };
    const player = world.getBody('player');

    if (!player || state.isPaused) {
      return newState;
    }

    // Get current velocity
    const velocity = world.getVelocity('player');
    if (!velocity) return newState;

    let newVelX = velocity.x;
    let newVelY = velocity.y;

    // Check grounded state
    newState.isGrounded = world.isGrounded('player');

    // Horizontal movement with acceleration/deceleration
    const moveSpeed = 4;
    const acceleration = 0.8;
    const deceleration = 0.85;

    if (input.movement.x !== 0) {
      newVelX += input.movement.x * acceleration;
      // Clamp to max speed
      if (Math.abs(newVelX) > moveSpeed) {
        newVelX = Math.sign(newVelX) * moveSpeed;
      }
    } else {
      // Deceleration
      newVelX *= deceleration;
      if (Math.abs(newVelX) < 0.1) newVelX = 0;
    }

    // Jump
    if (input.justPressed.has('jump') && newState.isGrounded) {
      newVelY = -10;
    }

    // Clamp fall speed
    if (newVelY > 12) {
      newVelY = 12;
    }

    world.setVelocity('player', { x: newVelX, y: newVelY });

    // Update position in state
    const position = world.getPosition('player');
    if (position) {
      newState.playerPosition = position;
      newState.playerVelocity = { x: newVelX, y: newVelY };
    }

    // Update time
    newState.time += deltaTime / 1000;

    return newState;
  },
  renderDebug: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => {
    // Draw player hitbox (capsule approximation)
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    const x = state.playerPosition.x;
    const y = state.playerPosition.y;
    const w = config.playerSize.width;
    const h = config.playerSize.height;
    const radius = w / 2;

    // Draw capsule shape
    ctx.beginPath();
    // Top arc
    ctx.arc(x, y - h / 2 + radius, radius, Math.PI, 0);
    // Right side
    ctx.lineTo(x + radius, y + h / 2 - radius);
    // Bottom arc
    ctx.arc(x, y + h / 2 - radius, radius, 0, Math.PI);
    // Left side
    ctx.lineTo(x - radius, y - h / 2 + radius);
    ctx.closePath();
    ctx.stroke();

    // Draw facing direction indicator
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(x, y - h / 2 + radius / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw debug info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`Grounded: ${state.isGrounded}`, 10, 20);
    ctx.fillText(`Velocity: (${state.playerVelocity.x.toFixed(1)}, ${state.playerVelocity.y.toFixed(1)})`, 10, 35);
    ctx.fillText(`Score: ${state.score}`, 10, 50);
  },
};

// ============================================
// Shooter Template (Enhanced)
// ============================================

const shooterTemplate: MechanicsTemplate = {
  type: 'shooter',
  name: 'Shooter',
  description: 'Twin-stick style shooter with projectile combat',
  defaultConfig: {
    moveSpeed: 4.5,
    jumpForce: 0,
    maxFallSpeed: 0,
    doubleJump: false,
    wallJump: false,
    playerSize: { width: 28, height: 28 },
    startPosition: { x: 400, y: 300 },
    bounds: { width: 800, height: 600 },
    debug: false,
  },
  initialize: (world: PhysicsWorld, config: MechanicsConfig) => {
    // Create world boundaries
    world.createBounds();

    // Create player
    world.createCircle(
      'player',
      config.startPosition.x,
      config.startPosition.y,
      config.playerSize.width / 2,
      'player'
    );

    // Create arena layout
    world.createObstacle('wall_1', 200, 150, 100, 20, true);
    world.createObstacle('wall_2', 600, 150, 100, 20, true);
    world.createObstacle('wall_3', 200, 450, 100, 20, true);
    world.createObstacle('wall_4', 600, 450, 100, 20, true);
    world.createObstacle('pillar', 400, 300, 40, 40, true);

    // Create enemies (as triggers for demo)
    world.createTrigger('enemy_1', 150, 150, 25, 25);
    world.createTrigger('enemy_2', 650, 150, 25, 25);
    world.createTrigger('enemy_3', 150, 450, 25, 25);
    world.createTrigger('enemy_4', 650, 450, 25, 25);
  },
  update: (
    world: PhysicsWorld,
    input: InputState,
    state: GameState,
    deltaTime: number
  ): GameState => {
    const newState = { ...state };
    const player = world.getBody('player');

    if (!player || state.isPaused) {
      return newState;
    }

    // Twin-stick movement
    const moveSpeed = 4.5;
    const velocity = {
      x: input.movement.x * moveSpeed,
      y: input.movement.y * moveSpeed,
    };

    world.setVelocity('player', velocity);

    // Update position in state
    const position = world.getPosition('player');
    if (position) {
      newState.playerPosition = position;
      newState.playerVelocity = velocity;
    }

    // Update time
    newState.time += deltaTime / 1000;

    return newState;
  },
  renderDebug: (ctx: CanvasRenderingContext2D, state: GameState, config: MechanicsConfig) => {
    // Draw player
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      state.playerPosition.x,
      state.playerPosition.y,
      config.playerSize.width / 2,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Draw aiming line
    ctx.strokeStyle = '#ff0000';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.playerPosition.x, state.playerPosition.y);
    ctx.lineTo(state.playerPosition.x + 50, state.playerPosition.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw debug info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`Position: (${state.playerPosition.x.toFixed(0)}, ${state.playerPosition.y.toFixed(0)})`, 10, 20);
    ctx.fillText(`Score: ${state.score}`, 10, 35);
  },
};

// ============================================
// Template Registry
// ============================================

export const MECHANICS_TEMPLATES: Record<GameMechanicsType, MechanicsTemplate> = {
  platformer: platformerTemplate,
  'top-down': topDownTemplate,
  puzzle: puzzleTemplate,
  shooter: shooterTemplate,
  fps: fpsTemplate,
  'third-person': thirdPersonTemplate,
};

/**
 * Get a mechanics template by type
 */
export function getMechanicsTemplate(type: GameMechanicsType): MechanicsTemplate {
  return MECHANICS_TEMPLATES[type];
}

/**
 * Create initial game state
 */
export function createInitialGameState(config: MechanicsConfig): GameState {
  return {
    playerPosition: { ...config.startPosition },
    playerVelocity: { x: 0, y: 0 },
    isGrounded: false,
    isTouchingWall: null,
    hasDoubleJump: true,
    score: 0,
    time: 0,
    isPaused: false,
    isGameOver: false,
    collectibles: 0,
  };
}

// ============================================
// Game Engine - Combines physics, input, mechanics
// ============================================

export interface GameEngineConfig {
  mechanics: GameMechanicsType;
  bounds: { width: number; height: number };
  customConfig?: Partial<MechanicsConfig>;
}

export class GameEngine {
  private world: PhysicsWorld;
  private input: InputManager;
  private template: MechanicsTemplate;
  private config: MechanicsConfig;
  private state: GameState;
  private animationId: number | null = null;
  private lastTime = 0;

  constructor(engineConfig: GameEngineConfig) {
    // Get template
    this.template = getMechanicsTemplate(engineConfig.mechanics);

    // Create config with overrides
    this.config = {
      ...this.template.defaultConfig,
      bounds: engineConfig.bounds,
      ...engineConfig.customConfig,
    };

    // Create physics world
    this.world = createPhysicsWorldForGameType(
      engineConfig.mechanics,
      engineConfig.bounds
    );

    // Create input manager
    this.input = createInputManagerForGameType(engineConfig.mechanics);

    // Initialize game state
    this.state = createInitialGameState(this.config);

    // Initialize world with template
    this.template.initialize(this.world, this.config);

    // Setup collision handlers
    this.setupCollisionHandlers();
  }

  private setupCollisionHandlers(): void {
    this.world.onCollision('start', (event) => {
      // Handle collectible collection
      if (event.bodyA.type === 'trigger' || event.bodyB.type === 'trigger') {
        const trigger = event.bodyA.type === 'trigger' ? event.bodyA : event.bodyB;
        const other = event.bodyA.type === 'trigger' ? event.bodyB : event.bodyA;

        if (other.type === 'player') {
          if (trigger.id.startsWith('collectible')) {
            this.state.collectibles++;
            this.state.score += 100;
            this.world.removeBody(trigger.id);
          } else if (trigger.id === 'goal') {
            this.state.isGameOver = true;
          }
        }
      }
    });
  }

  /**
   * Attach to canvas element
   */
  attach(canvas: HTMLCanvasElement): void {
    this.input.attach(canvas);
  }

  /**
   * Detach from canvas
   */
  detach(): void {
    this.input.detach();
  }

  /**
   * Start the game loop
   */
  start(): void {
    this.world.start();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.world.stop();
  }

  /**
   * Pause the game
   */
  pause(): void {
    this.state.isPaused = true;
    this.world.pause();
  }

  /**
   * Resume the game
   */
  resume(): void {
    this.state.isPaused = false;
    this.world.resume();
  }

  /**
   * Reset the game
   */
  reset(): void {
    this.world.reset();
    this.state = createInitialGameState(this.config);
    this.template.initialize(this.world, this.config);
    this.setupCollisionHandlers();
  }

  /**
   * Main game loop
   */
  private loop = (timestamp: number): void => {
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Update input
    this.input.update();
    const inputState = this.input.getState();

    // Handle pause toggle
    if (inputState.justPressed.has('pause')) {
      if (this.state.isPaused) {
        this.resume();
      } else {
        this.pause();
      }
    }

    // Handle reset
    if (inputState.justPressed.has('reset')) {
      this.reset();
    }

    // Update physics
    this.world.update(timestamp);

    // Update game state
    this.state = this.template.update(
      this.world,
      inputState,
      this.state,
      deltaTime
    );

    // Continue loop
    this.animationId = requestAnimationFrame(this.loop);
  };

  /**
   * Get current game state
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get physics world
   */
  getWorld(): PhysicsWorld {
    return this.world;
  }

  /**
   * Get input manager
   */
  getInput(): InputManager {
    return this.input;
  }

  /**
   * Get mechanics template
   */
  getTemplate(): MechanicsTemplate {
    return this.template;
  }

  /**
   * Get configuration
   */
  getConfig(): MechanicsConfig {
    return { ...this.config };
  }

  /**
   * Render debug info
   */
  renderDebug(ctx: CanvasRenderingContext2D): void {
    if (this.template.renderDebug) {
      this.template.renderDebug(ctx, this.state, this.config);
    }

    // Render all physics bodies
    const bodies = this.world.getAllBodies();
    for (const body of bodies) {
      const pos = this.world.getPosition(body.id);
      if (!pos) continue;

      ctx.strokeStyle = body.type === 'player' ? '#00ff00' : '#666666';
      ctx.lineWidth = 1;

      // Draw vertices
      ctx.beginPath();
      const vertices = body.body.vertices;
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  /**
   * Serialize engine state for export
   */
  serialize(): string {
    return JSON.stringify({
      mechanics: this.template.type,
      config: this.config,
      state: this.state,
      physics: this.world.serialize(),
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stop();
    this.detach();
    this.world.dispose();
  }
}

/**
 * Analyze an image and suggest appropriate game mechanics
 * This is a simplified version - in production, this would use AI
 */
export function suggestMechanicsForImage(
  imageDescription: string,
  sceneType: string
): GameMechanicsType {
  const lowerDesc = imageDescription.toLowerCase();
  const lowerScene = sceneType.toLowerCase();

  // Platformer keywords
  if (
    lowerDesc.includes('platform') ||
    lowerDesc.includes('jump') ||
    lowerDesc.includes('side') ||
    lowerDesc.includes('mario') ||
    lowerDesc.includes('metroid') ||
    lowerScene.includes('action')
  ) {
    return 'platformer';
  }

  // Top-down keywords
  if (
    lowerDesc.includes('top') ||
    lowerDesc.includes('overhead') ||
    lowerDesc.includes('bird') ||
    lowerDesc.includes('zelda') ||
    lowerDesc.includes('rpg') ||
    lowerScene.includes('exploration')
  ) {
    return 'top-down';
  }

  // Puzzle keywords
  if (
    lowerDesc.includes('puzzle') ||
    lowerDesc.includes('block') ||
    lowerDesc.includes('sokoban') ||
    lowerDesc.includes('portal') ||
    lowerScene.includes('puzzle')
  ) {
    return 'puzzle';
  }

  // Shooter keywords
  if (
    lowerDesc.includes('shoot') ||
    lowerDesc.includes('fps') ||
    lowerDesc.includes('gun') ||
    lowerDesc.includes('combat') ||
    lowerScene.includes('combat')
  ) {
    return 'shooter';
  }

  // Default to platformer
  return 'platformer';
}
