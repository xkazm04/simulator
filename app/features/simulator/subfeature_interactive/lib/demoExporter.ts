/**
 * DemoExporter - Package interactive demos as self-contained HTML files
 *
 * Creates standalone HTML files with embedded:
 * - Game engine code (minified)
 * - Physics simulation
 * - Image assets (base64)
 * - Configuration
 *
 * The exported file runs without any server or dependencies.
 */

import { GameMechanicsType, MechanicsConfig } from './mechanicsTemplates';

export interface ExportOptions {
  /** Game mechanics type */
  mechanics: GameMechanicsType;
  /** Mechanics configuration */
  config: MechanicsConfig;
  /** Image URL or base64 data */
  imageData: string;
  /** Title for the exported demo */
  title: string;
  /** Description for metadata */
  description: string;
  /** Include debug rendering */
  includeDebug: boolean;
  /** Compression level (0-9) */
  compressionLevel: number;
}

export interface ExportResult {
  /** The HTML content */
  html: string;
  /** Size in bytes */
  size: number;
  /** Estimated load time (seconds) */
  estimatedLoadTime: number;
}

/**
 * Convert image URL to base64 data URL
 */
async function imageToBase64(imageUrl: string): Promise<string> {
  // If already base64, return as-is
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  // Fetch and convert to base64
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generate the embedded game engine code
 * This is a self-contained version that doesn't depend on external modules
 */
function generateEngineCode(mechanics: GameMechanicsType, includeDebug: boolean): string {
  // Minified game engine code that works standalone
  return `
// Standalone Game Engine (no dependencies)
class PhysicsWorld {
  constructor(config) {
    this.config = {
      gravity: { x: 0, y: 1 },
      bounds: { width: 800, height: 600 },
      airFriction: 0.01,
      ...config
    };
    this.bodies = new Map();
    this.isRunning = false;
    this.lastTime = 0;
  }

  createBody(id, x, y, w, h, type, opts = {}) {
    const body = {
      id, x, y, w, h, type,
      vx: 0, vy: 0,
      isStatic: opts.isStatic || false,
      friction: opts.friction || 0.3,
      restitution: opts.restitution || 0.1
    };
    this.bodies.set(id, body);
    return body;
  }

  createPlayer(id, x, y, w, h) {
    return this.createBody(id, x, y, w, h, 'player');
  }

  createPlatform(id, x, y, w, h) {
    return this.createBody(id, x, y, w, h, 'platform', { isStatic: true, friction: 0.8 });
  }

  createBounds() {
    const { width, height } = this.config.bounds;
    this.createPlatform('__ground', width/2, height + 50, width + 100, 100);
  }

  setVelocity(id, vel) {
    const body = this.bodies.get(id);
    if (body) { body.vx = vel.x; body.vy = vel.y; }
  }

  getVelocity(id) {
    const body = this.bodies.get(id);
    return body ? { x: body.vx, y: body.vy } : null;
  }

  getPosition(id) {
    const body = this.bodies.get(id);
    return body ? { x: body.x, y: body.y } : null;
  }

  isGrounded(id) {
    const body = this.bodies.get(id);
    if (!body) return false;
    const ground = this.config.bounds.height - 50 - body.h/2;
    return body.y >= ground - 2;
  }

  update(dt) {
    if (!this.isRunning) return;
    const fixedDt = 1/60;

    for (const [, body] of this.bodies) {
      if (body.isStatic) continue;

      // Apply gravity
      body.vy += this.config.gravity.y * 0.5;

      // Apply air friction
      body.vx *= (1 - this.config.airFriction);

      // Update position
      body.x += body.vx;
      body.y += body.vy;

      // Ground collision
      const groundY = this.config.bounds.height - 50 - body.h/2;
      if (body.y > groundY) {
        body.y = groundY;
        body.vy = 0;
      }

      // Wall collisions
      const minX = body.w/2;
      const maxX = this.config.bounds.width - body.w/2;
      if (body.x < minX) { body.x = minX; body.vx = 0; }
      if (body.x > maxX) { body.x = maxX; body.vx = 0; }
    }
  }

  start() { this.isRunning = true; }
  stop() { this.isRunning = false; }
  getAllBodies() { return Array.from(this.bodies.values()); }
}

class InputManager {
  constructor() {
    this.pressed = new Set();
    this.justPressed = new Set();
    this.movement = { x: 0, y: 0 };
    this.bindings = {
      ArrowLeft: 'moveLeft', KeyA: 'moveLeft',
      ArrowRight: 'moveRight', KeyD: 'moveRight',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      ArrowDown: 'moveDown', KeyS: 'moveDown',
      Escape: 'pause', KeyR: 'reset'
    };
  }

  attach(el) {
    window.addEventListener('keydown', e => {
      const action = this.bindings[e.code];
      if (action) {
        e.preventDefault();
        if (!this.pressed.has(action)) this.justPressed.add(action);
        this.pressed.add(action);
      }
    });
    window.addEventListener('keyup', e => {
      const action = this.bindings[e.code];
      if (action) this.pressed.delete(action);
    });

    // Touch controls
    let touchStartX = 0;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      touchStartX = touch.clientX - rect.left;
      if (touchStartX < rect.width / 3) this.pressed.add('moveLeft');
      else if (touchStartX > rect.width * 2/3) this.pressed.add('moveRight');
      else this.justPressed.add('jump');
    }, { passive: false });
    el.addEventListener('touchend', () => {
      this.pressed.delete('moveLeft');
      this.pressed.delete('moveRight');
    });
  }

  update() {
    this.movement.x = 0;
    this.movement.y = 0;
    if (this.pressed.has('moveLeft')) this.movement.x -= 1;
    if (this.pressed.has('moveRight')) this.movement.x += 1;
    if (this.pressed.has('moveUp')) this.movement.y -= 1;
    if (this.pressed.has('moveDown')) this.movement.y += 1;
  }

  clear() {
    this.justPressed.clear();
  }

  isAction(a) { return this.pressed.has(a); }
  wasJustPressed(a) { return this.justPressed.has(a); }
}

// Game-specific mechanics
const MECHANICS = {
  platformer: {
    init(world, config) {
      world.createBounds();
      world.createPlayer('player', config.startX, config.startY, 30, 40);
      world.createPlatform('plat1', config.bounds.width/2, config.bounds.height - 50, config.bounds.width - 100, 20);
      world.createPlatform('plat2', 200, config.bounds.height - 150, 200, 20);
      world.createPlatform('plat3', 500, config.bounds.height - 250, 200, 20);
    },
    update(world, input, state) {
      const vel = world.getVelocity('player');
      if (!vel) return state;

      let vx = input.movement.x * 5;
      let vy = vel.y;

      if (input.wasJustPressed('jump') && (state.grounded || state.doubleJump)) {
        vy = state.grounded ? -12 : -10;
        if (!state.grounded) state.doubleJump = false;
      }

      if (world.isGrounded('player')) {
        state.grounded = true;
        state.doubleJump = true;
      } else {
        state.grounded = false;
      }

      world.setVelocity('player', { x: vx, y: vy });
      const pos = world.getPosition('player');
      if (pos) state.playerPos = pos;
      return state;
    }
  },
  'top-down': {
    init(world, config) {
      world.config.gravity = { x: 0, y: 0 };
      world.createBounds();
      world.createPlayer('player', config.startX, config.startY, 30, 30);
    },
    update(world, input, state) {
      world.setVelocity('player', { x: input.movement.x * 4, y: input.movement.y * 4 });
      const pos = world.getPosition('player');
      if (pos) state.playerPos = pos;
      return state;
    }
  },
  puzzle: {
    init(world, config) {
      world.config.gravity = { x: 0, y: 0.5 };
      world.createBounds();
      world.createPlayer('player', config.startX, config.startY, 30, 30);
      world.createPlatform('floor', config.bounds.width/2, config.bounds.height - 30, config.bounds.width - 60, 20);
    },
    update(world, input, state) {
      const vel = world.getVelocity('player');
      if (!vel) return state;
      world.setVelocity('player', { x: input.movement.x * 3, y: vel.y });
      const pos = world.getPosition('player');
      if (pos) state.playerPos = pos;
      return state;
    }
  }
};
MECHANICS.shooter = MECHANICS['top-down'];
`;
}

/**
 * Generate the render loop code
 */
function generateRenderCode(mechanics: GameMechanicsType, includeDebug: boolean): string {
  return `
function createGame(canvas, imageData, config) {
  const ctx = canvas.getContext('2d');
  const world = new PhysicsWorld(config);
  const input = new InputManager();
  const mech = MECHANICS['${mechanics}'] || MECHANICS.platformer;

  let state = {
    playerPos: { x: config.startX, y: config.startY },
    grounded: false,
    doubleJump: true,
    paused: false,
    time: 0
  };

  // Load background image
  const bgImage = new Image();
  bgImage.src = imageData;

  function render() {
    const { width, height } = config.bounds;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw background image
    if (bgImage.complete) {
      ctx.globalAlpha = 0.4;
      const scale = Math.max(width / bgImage.width, height / bgImage.height);
      const imgW = bgImage.width * scale;
      const imgH = bgImage.height * scale;
      ctx.drawImage(bgImage, (width - imgW) / 2, (height - imgH) / 2, imgW, imgH);
      ctx.globalAlpha = 1;
    }

    // Draw platforms
    ctx.fillStyle = '#334155';
    for (const body of world.getAllBodies()) {
      if (body.type === 'platform' && !body.id.startsWith('__')) {
        ctx.fillRect(body.x - body.w/2, body.y - body.h/2, body.w, body.h);
      }
    }

    // Draw player
    ctx.fillStyle = '#22d3ee';
    const player = world.bodies.get('player');
    if (player) {
      ctx.fillRect(player.x - player.w/2, player.y - player.h/2, player.w, player.h);
    }

    ${includeDebug ? `
    // Debug info
    ctx.fillStyle = '#22d3ee';
    ctx.font = '12px monospace';
    ctx.fillText('Position: ' + Math.round(state.playerPos.x) + ', ' + Math.round(state.playerPos.y), 10, 20);
    ctx.fillText('Grounded: ' + state.grounded, 10, 35);
    ctx.fillText('Time: ' + state.time.toFixed(1) + 's', 10, 50);
    ` : ''}

    // Controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px monospace';
    ctx.fillText('Arrow keys / WASD to move • Space to jump • R to reset', 10, height - 10);
  }

  let lastTime = 0;
  function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    input.update();

    if (input.wasJustPressed('pause')) state.paused = !state.paused;
    if (input.wasJustPressed('reset')) {
      world.bodies.get('player').x = config.startX;
      world.bodies.get('player').y = config.startY;
      world.setVelocity('player', { x: 0, y: 0 });
    }

    if (!state.paused) {
      world.update(dt);
      state = mech.update(world, input, state);
      state.time += dt / 1000;
    }

    input.clear();
    render();
    requestAnimationFrame(loop);
  }

  // Initialize
  mech.init(world, config);
  world.start();
  input.attach(canvas);
  canvas.focus();
  requestAnimationFrame(loop);

  return { world, input, getState: () => state };
}
`;
}

/**
 * Generate the full HTML document
 */
function generateHTML(
  engineCode: string,
  renderCode: string,
  imageBase64: string,
  options: ExportOptions
): string {
  const { title, description, config } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="description" content="${description}">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: #0a0a0a;
      overflow: hidden;
      font-family: system-ui, sans-serif;
    }
    #container {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column;
    }
    #game-canvas {
      max-width: 100%; max-height: 90vh;
      border: 1px solid #334155;
      border-radius: 8px;
      background: #0f172a;
      touch-action: none;
    }
    #info {
      margin-top: 12px;
      color: #64748b;
      font-size: 11px;
      text-align: center;
    }
    #loading {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      color: #22d3ee;
      font-size: 14px;
    }
    @media (max-width: 600px) {
      #game-canvas { width: 100%; height: auto; border-radius: 0; border-left: none; border-right: none; }
      #info { padding: 0 16px; }
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="loading">Loading...</div>
    <canvas id="game-canvas" tabindex="0"></canvas>
    <div id="info">
      <strong>${title}</strong> | Created with Simulator
    </div>
  </div>

  <script>
    // Embedded Game Engine
    ${engineCode}

    // Render Loop
    ${renderCode}

    // Configuration
    const CONFIG = {
      bounds: { width: ${config.bounds.width}, height: ${config.bounds.height} },
      startX: ${config.startPosition.x},
      startY: ${config.startPosition.y}
    };

    // Image Data
    const IMAGE_DATA = "${imageBase64}";

    // Initialize
    window.addEventListener('DOMContentLoaded', () => {
      const canvas = document.getElementById('game-canvas');
      const loading = document.getElementById('loading');

      canvas.width = CONFIG.bounds.width;
      canvas.height = CONFIG.bounds.height;

      loading.style.display = 'none';
      canvas.style.display = 'block';

      createGame(canvas, IMAGE_DATA, CONFIG);
    });
  </script>
</body>
</html>`;
}

/**
 * Export a playable demo as standalone HTML
 */
export async function exportDemo(options: ExportOptions): Promise<ExportResult> {
  // Convert image to base64 if needed
  const imageBase64 = await imageToBase64(options.imageData);

  // Generate code
  const engineCode = generateEngineCode(options.mechanics, options.includeDebug);
  const renderCode = generateRenderCode(options.mechanics, options.includeDebug);

  // Generate HTML
  const html = generateHTML(engineCode, renderCode, imageBase64, options);

  // Calculate size
  const size = new Blob([html]).size;
  const estimatedLoadTime = size / (1024 * 1024); // Rough estimate: 1MB/s

  return {
    html,
    size,
    estimatedLoadTime,
  };
}

/**
 * Trigger download of the exported HTML
 */
export function downloadExport(result: ExportResult, filename: string): void {
  const blob = new Blob([result.html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Estimate export size without generating full export
 */
export function estimateExportSize(imageDataUrl: string): number {
  // Base engine + HTML size (approximately 15KB)
  const baseSize = 15 * 1024;

  // Image size (base64 is ~33% larger than binary)
  const imageSize = imageDataUrl.length * 0.75;

  return Math.round(baseSize + imageSize);
}
