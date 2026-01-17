/**
 * PhysicsWorld - Matter.js integration for 2D physics simulation
 *
 * Provides a physics engine wrapper for interactive WebGL demos with:
 * - Collision detection and response
 * - Gravity and force simulation
 * - Body creation helpers (player, platforms, obstacles)
 * - Performance-optimized updates at 60fps target
 */

import Matter from 'matter-js';

export interface PhysicsConfig {
  /** Gravity vector (default: { x: 0, y: 1 }) */
  gravity: { x: number; y: number };
  /** World bounds (pixels) */
  bounds: { width: number; height: number };
  /** Enable collision detection */
  enableCollisions: boolean;
  /** Timestep for physics updates (default: 1000/60) */
  timestep: number;
  /** Air friction (0-1) */
  airFriction: number;
  /** Enable sleeping bodies for performance */
  enableSleeping: boolean;
}

export interface PhysicsBody {
  id: string;
  body: Matter.Body;
  type: 'player' | 'platform' | 'obstacle' | 'projectile' | 'trigger' | 'dynamic';
  /** Custom data attached to the body */
  userData?: Record<string, unknown>;
}

export interface CollisionEvent {
  bodyA: PhysicsBody;
  bodyB: PhysicsBody;
  pairs: Matter.Pair[];
}

export type CollisionCallback = (event: CollisionEvent) => void;

const DEFAULT_CONFIG: PhysicsConfig = {
  gravity: { x: 0, y: 1 },
  bounds: { width: 800, height: 600 },
  enableCollisions: true,
  timestep: 1000 / 60,
  airFriction: 0.01,
  enableSleeping: true,
};

/**
 * PhysicsWorld class - Manages Matter.js physics simulation
 */
export class PhysicsWorld {
  private engine: Matter.Engine;
  private world: Matter.World;
  private runner: Matter.Runner | null = null;
  private bodies: Map<string, PhysicsBody> = new Map();
  private config: PhysicsConfig;
  private collisionCallbacks: {
    start: CollisionCallback[];
    end: CollisionCallback[];
    active: CollisionCallback[];
  } = { start: [], end: [], active: [] };
  private isRunning = false;
  private lastTimestamp = 0;
  private accumulatedTime = 0;

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create engine with configuration
    this.engine = Matter.Engine.create({
      gravity: this.config.gravity,
      enableSleeping: this.config.enableSleeping,
    });
    this.world = this.engine.world;

    // Setup collision events
    this.setupCollisionEvents();
  }

  private setupCollisionEvents(): void {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      this.handleCollision(event, 'start');
    });

    Matter.Events.on(this.engine, 'collisionEnd', (event) => {
      this.handleCollision(event, 'end');
    });

    Matter.Events.on(this.engine, 'collisionActive', (event) => {
      this.handleCollision(event, 'active');
    });
  }

  private handleCollision(
    event: Matter.IEventCollision<Matter.Engine>,
    type: 'start' | 'end' | 'active'
  ): void {
    const callbacks = this.collisionCallbacks[type];
    if (callbacks.length === 0) return;

    for (const pair of event.pairs) {
      const bodyA = this.findBodyByMatterBody(pair.bodyA);
      const bodyB = this.findBodyByMatterBody(pair.bodyB);

      if (bodyA && bodyB) {
        const collisionEvent: CollisionEvent = {
          bodyA,
          bodyB,
          pairs: [pair],
        };

        callbacks.forEach((cb) => cb(collisionEvent));
      }
    }
  }

  private findBodyByMatterBody(matterBody: Matter.Body): PhysicsBody | undefined {
    for (const [, physicsBody] of this.bodies) {
      if (physicsBody.body.id === matterBody.id) {
        return physicsBody;
      }
    }
    return undefined;
  }

  /**
   * Register collision callback
   */
  onCollision(type: 'start' | 'end' | 'active', callback: CollisionCallback): () => void {
    this.collisionCallbacks[type].push(callback);
    return () => {
      const index = this.collisionCallbacks[type].indexOf(callback);
      if (index > -1) {
        this.collisionCallbacks[type].splice(index, 1);
      }
    };
  }

  /**
   * Create a player body (dynamic, with friction)
   */
  createPlayer(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: Record<string, unknown> = {}
  ): PhysicsBody {
    const body = Matter.Bodies.rectangle(x, y, width, height, {
      friction: 0.3,
      frictionAir: this.config.airFriction,
      restitution: 0.1,
      density: 0.001,
      label: 'player',
      ...options,
    } as Matter.IChamferableBodyDefinition);

    Matter.Composite.add(this.world, body);

    const physicsBody: PhysicsBody = {
      id,
      body,
      type: 'player',
      userData: {},
    };

    this.bodies.set(id, physicsBody);
    return physicsBody;
  }

  /**
   * Create a platform body (static)
   */
  createPlatform(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: Record<string, unknown> = {}
  ): PhysicsBody {
    const body = Matter.Bodies.rectangle(x, y, width, height, {
      isStatic: true,
      friction: 0.8,
      label: 'platform',
      ...options,
    } as Matter.IChamferableBodyDefinition);

    Matter.Composite.add(this.world, body);

    const physicsBody: PhysicsBody = {
      id,
      body,
      type: 'platform',
      userData: {},
    };

    this.bodies.set(id, physicsBody);
    return physicsBody;
  }

  /**
   * Create an obstacle body (dynamic or static)
   */
  createObstacle(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    isStatic = false,
    options: Record<string, unknown> = {}
  ): PhysicsBody {
    const body = Matter.Bodies.rectangle(x, y, width, height, {
      isStatic,
      friction: 0.5,
      restitution: 0.5,
      label: 'obstacle',
      ...options,
    } as Matter.IChamferableBodyDefinition);

    Matter.Composite.add(this.world, body);

    const physicsBody: PhysicsBody = {
      id,
      body,
      type: 'obstacle',
      userData: {},
    };

    this.bodies.set(id, physicsBody);
    return physicsBody;
  }

  /**
   * Create a circular body (useful for balls, bullets)
   */
  createCircle(
    id: string,
    x: number,
    y: number,
    radius: number,
    type: PhysicsBody['type'] = 'dynamic',
    options: Record<string, unknown> = {}
  ): PhysicsBody {
    const body = Matter.Bodies.circle(x, y, radius, {
      isStatic: type === 'platform',
      friction: 0.3,
      frictionAir: this.config.airFriction,
      restitution: 0.6,
      label: type,
      ...options,
    } as Matter.IChamferableBodyDefinition);

    Matter.Composite.add(this.world, body);

    const physicsBody: PhysicsBody = {
      id,
      body,
      type,
      userData: {},
    };

    this.bodies.set(id, physicsBody);
    return physicsBody;
  }

  /**
   * Create a trigger zone (non-colliding sensor)
   */
  createTrigger(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: Record<string, unknown> = {}
  ): PhysicsBody {
    const body = Matter.Bodies.rectangle(x, y, width, height, {
      isStatic: true,
      isSensor: true,
      label: 'trigger',
      ...options,
    } as Matter.IChamferableBodyDefinition);

    Matter.Composite.add(this.world, body);

    const physicsBody: PhysicsBody = {
      id,
      body,
      type: 'trigger',
      userData: {},
    };

    this.bodies.set(id, physicsBody);
    return physicsBody;
  }

  /**
   * Create world boundaries (walls)
   */
  createBounds(padding = 50): void {
    const { width, height } = this.config.bounds;
    const thickness = 100;

    // Ground
    this.createPlatform(
      '__ground',
      width / 2,
      height + thickness / 2,
      width + padding * 2,
      thickness
    );

    // Ceiling
    this.createPlatform(
      '__ceiling',
      width / 2,
      -thickness / 2,
      width + padding * 2,
      thickness
    );

    // Left wall
    this.createPlatform(
      '__leftWall',
      -thickness / 2,
      height / 2,
      thickness,
      height + padding * 2
    );

    // Right wall
    this.createPlatform(
      '__rightWall',
      width + thickness / 2,
      height / 2,
      thickness,
      height + padding * 2
    );
  }

  /**
   * Apply force to a body
   */
  applyForce(id: string, force: { x: number; y: number }): void {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      Matter.Body.applyForce(physicsBody.body, physicsBody.body.position, force);
    }
  }

  /**
   * Set velocity of a body
   */
  setVelocity(id: string, velocity: { x: number; y: number }): void {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      Matter.Body.setVelocity(physicsBody.body, velocity);
    }
  }

  /**
   * Get velocity of a body
   */
  getVelocity(id: string): { x: number; y: number } | null {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      return { ...physicsBody.body.velocity };
    }
    return null;
  }

  /**
   * Set position of a body
   */
  setPosition(id: string, position: { x: number; y: number }): void {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      Matter.Body.setPosition(physicsBody.body, position);
    }
  }

  /**
   * Get position of a body
   */
  getPosition(id: string): { x: number; y: number } | null {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      return { x: physicsBody.body.position.x, y: physicsBody.body.position.y };
    }
    return null;
  }

  /**
   * Get rotation angle of a body (radians)
   */
  getAngle(id: string): number | null {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      return physicsBody.body.angle;
    }
    return null;
  }

  /**
   * Remove a body from the world
   */
  removeBody(id: string): void {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      Matter.Composite.remove(this.world, physicsBody.body);
      this.bodies.delete(id);
    }
  }

  /**
   * Get a body by ID
   */
  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id);
  }

  /**
   * Get all bodies
   */
  getAllBodies(): PhysicsBody[] {
    return Array.from(this.bodies.values());
  }

  /**
   * Get bodies by type
   */
  getBodiesByType(type: PhysicsBody['type']): PhysicsBody[] {
    return Array.from(this.bodies.values()).filter((b) => b.type === type);
  }

  /**
   * Check if a body is grounded (touching platform below)
   */
  isGrounded(id: string): boolean {
    const physicsBody = this.bodies.get(id);
    if (!physicsBody) return false;

    const collisions = Matter.Query.collides(
      physicsBody.body,
      this.getBodiesByType('platform').map((b) => b.body)
    );

    return collisions.some((collision) => {
      const normal = collision.normal;
      // Check if collision is from below (platform supporting the body)
      return normal.y < -0.5;
    });
  }

  /**
   * Update physics simulation (call each frame)
   */
  update(timestamp: number): void {
    if (!this.isRunning) return;

    // Calculate delta time
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      return;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Accumulate time and run fixed timestep updates
    this.accumulatedTime += delta;

    // Cap accumulated time to prevent spiral of death
    if (this.accumulatedTime > this.config.timestep * 5) {
      this.accumulatedTime = this.config.timestep * 5;
    }

    while (this.accumulatedTime >= this.config.timestep) {
      Matter.Engine.update(this.engine, this.config.timestep);
      this.accumulatedTime -= this.config.timestep;
    }
  }

  /**
   * Start the physics simulation
   */
  start(): void {
    this.isRunning = true;
    this.lastTimestamp = 0;
    this.accumulatedTime = 0;
  }

  /**
   * Stop the physics simulation
   */
  stop(): void {
    this.isRunning = false;
    if (this.runner) {
      Matter.Runner.stop(this.runner);
      this.runner = null;
    }
  }

  /**
   * Pause the physics simulation
   */
  pause(): void {
    this.isRunning = false;
  }

  /**
   * Resume the physics simulation
   */
  resume(): void {
    this.isRunning = true;
    this.lastTimestamp = performance.now();
  }

  /**
   * Reset the physics world
   */
  reset(): void {
    // Remove all non-boundary bodies
    const bodiesToRemove = Array.from(this.bodies.keys()).filter(
      (id) => !id.startsWith('__')
    );
    bodiesToRemove.forEach((id) => this.removeBody(id));

    this.lastTimestamp = 0;
    this.accumulatedTime = 0;
  }

  /**
   * Set gravity
   */
  setGravity(x: number, y: number): void {
    this.config.gravity = { x, y };
    this.engine.gravity.x = x;
    this.engine.gravity.y = y;
  }

  /**
   * Update world bounds
   */
  setBounds(width: number, height: number): void {
    this.config.bounds = { width, height };
    // Remove old boundaries
    ['__ground', '__ceiling', '__leftWall', '__rightWall'].forEach((id) => {
      this.removeBody(id);
    });
    // Create new boundaries
    this.createBounds();
  }

  /**
   * Get engine for advanced operations
   */
  getEngine(): Matter.Engine {
    return this.engine;
  }

  /**
   * Get world for advanced operations
   */
  getWorld(): Matter.World {
    return this.world;
  }

  /**
   * Check if simulation is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Serialize the current state for export
   */
  serialize(): string {
    const state = {
      config: this.config,
      bodies: Array.from(this.bodies.entries()).map(([id, pb]) => ({
        id,
        type: pb.type,
        position: { x: pb.body.position.x, y: pb.body.position.y },
        angle: pb.body.angle,
        velocity: pb.body.velocity,
        isStatic: pb.body.isStatic,
        userData: pb.userData,
        // Store shape info
        vertices: pb.body.vertices.map((v) => ({ x: v.x, y: v.y })),
      })),
    };
    return JSON.stringify(state);
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.stop();
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.bodies.clear();
    this.collisionCallbacks = { start: [], end: [], active: [] };
  }
}

/**
 * Create a pre-configured physics world for a specific game type
 */
export function createPhysicsWorldForGameType(
  gameType: 'platformer' | 'top-down' | 'puzzle' | 'shooter',
  bounds: { width: number; height: number }
): PhysicsWorld {
  const configs: Record<string, Partial<PhysicsConfig>> = {
    platformer: {
      gravity: { x: 0, y: 1 },
      airFriction: 0.01,
      enableSleeping: false, // Keep player responsive
    },
    'top-down': {
      gravity: { x: 0, y: 0 }, // No gravity for top-down
      airFriction: 0.1, // Higher friction for immediate stops
      enableSleeping: true,
    },
    puzzle: {
      gravity: { x: 0, y: 0.5 }, // Light gravity for puzzle physics
      airFriction: 0.05,
      enableSleeping: true,
    },
    shooter: {
      gravity: { x: 0, y: 0.3 }, // Light gravity for projectiles
      airFriction: 0.001, // Low air friction for fast projectiles
      enableSleeping: false,
    },
  };

  return new PhysicsWorld({
    ...configs[gameType],
    bounds,
  });
}
