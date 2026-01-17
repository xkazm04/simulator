/**
 * InputManager - Unified keyboard/mouse/touch input handling
 *
 * Provides a consistent input abstraction layer for game controls:
 * - Keyboard input with configurable key bindings
 * - Mouse position, clicks, and drag tracking
 * - Touch controls with gesture recognition
 * - Virtual gamepad for mobile devices
 * - Action mapping system for game mechanics
 */

export type InputAction =
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'jump'
  | 'action'
  | 'secondary'
  | 'pause'
  | 'reset';

export type KeyBinding = {
  action: InputAction;
  keys: string[];
};

export interface MouseState {
  x: number;
  y: number;
  /** Position relative to canvas (0-1) */
  normalizedX: number;
  normalizedY: number;
  isDown: boolean;
  button: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragDeltaX: number;
  dragDeltaY: number;
}

export interface TouchState {
  isActive: boolean;
  touches: Array<{
    id: number;
    x: number;
    y: number;
    normalizedX: number;
    normalizedY: number;
  }>;
  /** Primary touch for single-finger gestures */
  primary: {
    x: number;
    y: number;
    normalizedX: number;
    normalizedY: number;
  } | null;
  /** Pinch gesture state */
  pinch: {
    active: boolean;
    scale: number;
    center: { x: number; y: number };
  };
  /** Swipe gesture state */
  swipe: {
    active: boolean;
    direction: 'left' | 'right' | 'up' | 'down' | null;
    velocity: number;
  };
}

export interface VirtualJoystickState {
  active: boolean;
  angle: number; // Radians
  magnitude: number; // 0-1
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export interface InputState {
  /** Currently pressed actions */
  actions: Set<InputAction>;
  /** Actions that were just pressed this frame */
  justPressed: Set<InputAction>;
  /** Actions that were just released this frame */
  justReleased: Set<InputAction>;
  /** Mouse state */
  mouse: MouseState;
  /** Touch state */
  touch: TouchState;
  /** Virtual joystick state */
  joystick: VirtualJoystickState;
  /** Movement vector (combined from keyboard/joystick) */
  movement: { x: number; y: number };
}

const DEFAULT_KEY_BINDINGS: KeyBinding[] = [
  { action: 'moveLeft', keys: ['ArrowLeft', 'KeyA'] },
  { action: 'moveRight', keys: ['ArrowRight', 'KeyD'] },
  { action: 'moveUp', keys: ['ArrowUp', 'KeyW'] },
  { action: 'moveDown', keys: ['ArrowDown', 'KeyS'] },
  { action: 'jump', keys: ['Space', 'KeyW', 'ArrowUp'] },
  { action: 'action', keys: ['KeyE', 'Enter'] },
  { action: 'secondary', keys: ['KeyQ', 'ShiftLeft'] },
  { action: 'pause', keys: ['Escape', 'KeyP'] },
  { action: 'reset', keys: ['KeyR'] },
];

/**
 * InputManager class - Handles all input sources uniformly
 */
export class InputManager {
  private element: HTMLElement | null = null;
  private keyBindings: Map<string, InputAction> = new Map();
  private pressedKeys: Set<string> = new Set();
  private previousActions: Set<InputAction> = new Set();
  private currentActions: Set<InputAction> = new Set();
  private justPressedActions: Set<InputAction> = new Set();
  private justReleasedActions: Set<InputAction> = new Set();

  private mouseState: MouseState = {
    x: 0,
    y: 0,
    normalizedX: 0.5,
    normalizedY: 0.5,
    isDown: false,
    button: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
  };

  private touchState: TouchState = {
    isActive: false,
    touches: [],
    primary: null,
    pinch: { active: false, scale: 1, center: { x: 0, y: 0 } },
    swipe: { active: false, direction: null, velocity: 0 },
  };

  private joystickState: VirtualJoystickState = {
    active: false,
    angle: 0,
    magnitude: 0,
    x: 0,
    y: 0,
  };

  private touchStartPosition: { x: number; y: number } | null = null;
  private touchStartTime = 0;
  private initialPinchDistance = 0;

  private enabled = true;
  private listeners: Array<() => void> = [];

  constructor(bindings: KeyBinding[] = DEFAULT_KEY_BINDINGS) {
    this.setKeyBindings(bindings);
  }

  /**
   * Set key bindings
   */
  setKeyBindings(bindings: KeyBinding[]): void {
    this.keyBindings.clear();
    for (const binding of bindings) {
      for (const key of binding.keys) {
        this.keyBindings.set(key, binding.action);
      }
    }
  }

  /**
   * Add a key binding
   */
  addKeyBinding(key: string, action: InputAction): void {
    this.keyBindings.set(key, action);
  }

  /**
   * Attach to an HTML element (canvas or container)
   */
  attach(element: HTMLElement): void {
    this.element = element;

    // Keyboard events (attach to window for global capture)
    const onKeyDown = this.handleKeyDown.bind(this);
    const onKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse events
    const onMouseDown = this.handleMouseDown.bind(this);
    const onMouseUp = this.handleMouseUp.bind(this);
    const onMouseMove = this.handleMouseMove.bind(this);
    const onMouseLeave = this.handleMouseLeave.bind(this);
    element.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseleave', onMouseLeave);

    // Touch events
    const onTouchStart = this.handleTouchStart.bind(this);
    const onTouchMove = this.handleTouchMove.bind(this);
    const onTouchEnd = this.handleTouchEnd.bind(this);
    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);

    // Prevent context menu on right-click
    const onContextMenu = (e: Event) => e.preventDefault();
    element.addEventListener('contextmenu', onContextMenu);

    // Store cleanup functions
    this.listeners = [
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => element.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => element.removeEventListener('mousemove', onMouseMove),
      () => element.removeEventListener('mouseleave', onMouseLeave),
      () => element.removeEventListener('touchstart', onTouchStart),
      () => element.removeEventListener('touchmove', onTouchMove),
      () => element.removeEventListener('touchend', onTouchEnd),
      () => element.removeEventListener('touchcancel', onTouchEnd),
      () => element.removeEventListener('contextmenu', onContextMenu),
    ];
  }

  /**
   * Detach from element and cleanup
   */
  detach(): void {
    this.listeners.forEach((cleanup) => cleanup());
    this.listeners = [];
    this.element = null;
    this.reset();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't capture input when focused on input elements
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const action = this.keyBindings.get(e.code);
    if (action) {
      e.preventDefault();
      this.pressedKeys.add(e.code);
      this.currentActions.add(action);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.enabled) return;

    const action = this.keyBindings.get(e.code);
    if (action) {
      this.pressedKeys.delete(e.code);

      // Only remove action if no other key bound to same action is pressed
      const stillPressed = Array.from(this.keyBindings.entries()).some(
        ([key, act]) => act === action && this.pressedKeys.has(key)
      );

      if (!stillPressed) {
        this.currentActions.delete(action);
      }
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.enabled || !this.element) return;

    const rect = this.element.getBoundingClientRect();
    this.mouseState.isDown = true;
    this.mouseState.button = e.button;
    this.mouseState.dragStartX = e.clientX - rect.left;
    this.mouseState.dragStartY = e.clientY - rect.top;
    this.mouseState.isDragging = false;
    this.mouseState.dragDeltaX = 0;
    this.mouseState.dragDeltaY = 0;

    // Left click = action
    if (e.button === 0) {
      this.currentActions.add('action');
    }
    // Right click = secondary
    if (e.button === 2) {
      this.currentActions.add('secondary');
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.enabled) return;

    this.mouseState.isDown = false;
    this.mouseState.isDragging = false;

    if (e.button === 0) {
      this.currentActions.delete('action');
    }
    if (e.button === 2) {
      this.currentActions.delete('secondary');
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.enabled || !this.element) return;

    const rect = this.element.getBoundingClientRect();
    this.mouseState.x = e.clientX - rect.left;
    this.mouseState.y = e.clientY - rect.top;
    this.mouseState.normalizedX = this.mouseState.x / rect.width;
    this.mouseState.normalizedY = this.mouseState.y / rect.height;

    if (this.mouseState.isDown) {
      this.mouseState.dragDeltaX = this.mouseState.x - this.mouseState.dragStartX;
      this.mouseState.dragDeltaY = this.mouseState.y - this.mouseState.dragStartY;

      // Start dragging after 5px threshold
      if (
        !this.mouseState.isDragging &&
        (Math.abs(this.mouseState.dragDeltaX) > 5 ||
          Math.abs(this.mouseState.dragDeltaY) > 5)
      ) {
        this.mouseState.isDragging = true;
      }
    }
  }

  private handleMouseLeave(): void {
    // Keep tracking mouse state even when leaving
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.enabled || !this.element) return;
    e.preventDefault();

    const rect = this.element.getBoundingClientRect();
    this.touchState.isActive = true;
    this.touchState.touches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
      normalizedX: (t.clientX - rect.left) / rect.width,
      normalizedY: (t.clientY - rect.top) / rect.height,
    }));

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.touchStartPosition = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
      this.touchStartTime = Date.now();
      this.touchState.primary = {
        x: this.touchStartPosition.x,
        y: this.touchStartPosition.y,
        normalizedX: this.touchStartPosition.x / rect.width,
        normalizedY: this.touchStartPosition.y / rect.height,
      };

      // Touch in left half = virtual joystick
      if (this.touchState.primary.normalizedX < 0.5) {
        this.joystickState.active = true;
      } else {
        // Touch in right half = action
        this.currentActions.add('action');
      }
    }

    // Two-finger touch = pinch
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      this.touchState.pinch.active = true;
      this.touchState.pinch.scale = 1;
      this.touchState.pinch.center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
      };
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.enabled || !this.element) return;
    e.preventDefault();

    const rect = this.element.getBoundingClientRect();
    this.touchState.touches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
      normalizedX: (t.clientX - rect.left) / rect.width,
      normalizedY: (t.clientY - rect.top) / rect.height,
    }));

    // Single touch - update virtual joystick or swipe
    if (e.touches.length === 1 && this.touchStartPosition) {
      const touch = e.touches[0];
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;

      this.touchState.primary = {
        x: currentX,
        y: currentY,
        normalizedX: currentX / rect.width,
        normalizedY: currentY / rect.height,
      };

      if (this.joystickState.active) {
        // Virtual joystick input
        const dx = currentX - this.touchStartPosition.x;
        const dy = currentY - this.touchStartPosition.y;
        const maxRadius = 60; // Virtual joystick radius

        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxRadius);
        const angle = Math.atan2(dy, dx);

        this.joystickState.magnitude = distance / maxRadius;
        this.joystickState.angle = angle;
        this.joystickState.x = Math.cos(angle) * this.joystickState.magnitude;
        this.joystickState.y = Math.sin(angle) * this.joystickState.magnitude;

        // Convert to movement actions
        if (this.joystickState.magnitude > 0.3) {
          if (this.joystickState.x < -0.3) this.currentActions.add('moveLeft');
          else this.currentActions.delete('moveLeft');

          if (this.joystickState.x > 0.3) this.currentActions.add('moveRight');
          else this.currentActions.delete('moveRight');

          if (this.joystickState.y < -0.3) this.currentActions.add('moveUp');
          else this.currentActions.delete('moveUp');

          if (this.joystickState.y > 0.3) this.currentActions.add('moveDown');
          else this.currentActions.delete('moveDown');
        } else {
          this.currentActions.delete('moveLeft');
          this.currentActions.delete('moveRight');
          this.currentActions.delete('moveUp');
          this.currentActions.delete('moveDown');
        }
      }
    }

    // Two-finger touch - pinch
    if (e.touches.length === 2 && this.touchState.pinch.active) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      this.touchState.pinch.scale = distance / this.initialPinchDistance;
      this.touchState.pinch.center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
      };
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.enabled) return;

    // Detect swipe gesture
    if (
      e.changedTouches.length === 1 &&
      this.touchStartPosition &&
      !this.joystickState.active
    ) {
      const touch = e.changedTouches[0];
      const rect = this.element?.getBoundingClientRect();
      if (rect) {
        const endX = touch.clientX - rect.left;
        const endY = touch.clientY - rect.top;
        const dx = endX - this.touchStartPosition.x;
        const dy = endY - this.touchStartPosition.y;
        const elapsed = Date.now() - this.touchStartTime;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / elapsed;

        // Swipe threshold: 50px distance, 0.3px/ms velocity
        if (distance > 50 && velocity > 0.3) {
          this.touchState.swipe.active = true;
          this.touchState.swipe.velocity = velocity;

          if (Math.abs(dx) > Math.abs(dy)) {
            this.touchState.swipe.direction = dx > 0 ? 'right' : 'left';
          } else {
            this.touchState.swipe.direction = dy > 0 ? 'down' : 'up';
          }

          // Convert swipe to action
          if (this.touchState.swipe.direction === 'up') {
            this.justPressedActions.add('jump');
          }
        }
      }
    }

    // Reset state when all touches end
    if (e.touches.length === 0) {
      this.touchState.isActive = false;
      this.touchState.touches = [];
      this.touchState.primary = null;
      this.touchState.pinch = { active: false, scale: 1, center: { x: 0, y: 0 } };
      this.touchStartPosition = null;

      // Reset joystick
      this.joystickState.active = false;
      this.joystickState.magnitude = 0;
      this.joystickState.x = 0;
      this.joystickState.y = 0;

      // Clear movement actions
      this.currentActions.delete('moveLeft');
      this.currentActions.delete('moveRight');
      this.currentActions.delete('moveUp');
      this.currentActions.delete('moveDown');
      this.currentActions.delete('action');
    }
  }

  /**
   * Update input state (call each frame before reading input)
   */
  update(): void {
    // Calculate just pressed and just released
    this.justPressedActions.clear();
    this.justReleasedActions.clear();

    for (const action of this.currentActions) {
      if (!this.previousActions.has(action)) {
        this.justPressedActions.add(action);
      }
    }

    for (const action of this.previousActions) {
      if (!this.currentActions.has(action)) {
        this.justReleasedActions.add(action);
      }
    }

    // Store current as previous for next frame
    this.previousActions = new Set(this.currentActions);

    // Clear one-frame states
    this.touchState.swipe.active = false;
    this.touchState.swipe.direction = null;
  }

  /**
   * Get current input state
   */
  getState(): InputState {
    // Calculate movement vector from keyboard or joystick
    let movementX = 0;
    let movementY = 0;

    if (this.currentActions.has('moveLeft')) movementX -= 1;
    if (this.currentActions.has('moveRight')) movementX += 1;
    if (this.currentActions.has('moveUp')) movementY -= 1;
    if (this.currentActions.has('moveDown')) movementY += 1;

    // Override with joystick if active
    if (this.joystickState.active && this.joystickState.magnitude > 0.1) {
      movementX = this.joystickState.x;
      movementY = this.joystickState.y;
    }

    // Normalize diagonal movement
    const length = Math.sqrt(movementX * movementX + movementY * movementY);
    if (length > 1) {
      movementX /= length;
      movementY /= length;
    }

    return {
      actions: new Set(this.currentActions),
      justPressed: new Set(this.justPressedActions),
      justReleased: new Set(this.justReleasedActions),
      mouse: { ...this.mouseState },
      touch: { ...this.touchState },
      joystick: { ...this.joystickState },
      movement: { x: movementX, y: movementY },
    };
  }

  /**
   * Check if an action is currently active
   */
  isActionActive(action: InputAction): boolean {
    return this.currentActions.has(action);
  }

  /**
   * Check if an action was just pressed this frame
   */
  wasActionJustPressed(action: InputAction): boolean {
    return this.justPressedActions.has(action);
  }

  /**
   * Check if an action was just released this frame
   */
  wasActionJustReleased(action: InputAction): boolean {
    return this.justReleasedActions.has(action);
  }

  /**
   * Enable/disable input handling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * Reset all input state
   */
  reset(): void {
    this.pressedKeys.clear();
    this.currentActions.clear();
    this.previousActions.clear();
    this.justPressedActions.clear();
    this.justReleasedActions.clear();
    this.mouseState = {
      x: 0,
      y: 0,
      normalizedX: 0.5,
      normalizedY: 0.5,
      isDown: false,
      button: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
    };
    this.touchState = {
      isActive: false,
      touches: [],
      primary: null,
      pinch: { active: false, scale: 1, center: { x: 0, y: 0 } },
      swipe: { active: false, direction: null, velocity: 0 },
    };
    this.joystickState = {
      active: false,
      angle: 0,
      magnitude: 0,
      x: 0,
      y: 0,
    };
  }

  /**
   * Check if device supports touch
   */
  static isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

/**
 * Create default input manager with standard game controls
 */
export function createInputManager(): InputManager {
  return new InputManager(DEFAULT_KEY_BINDINGS);
}

/**
 * Create input manager for specific game type
 */
export function createInputManagerForGameType(
  gameType: 'platformer' | 'top-down' | 'puzzle' | 'shooter'
): InputManager {
  const bindings: Record<string, KeyBinding[]> = {
    platformer: [
      { action: 'moveLeft', keys: ['ArrowLeft', 'KeyA'] },
      { action: 'moveRight', keys: ['ArrowRight', 'KeyD'] },
      { action: 'jump', keys: ['Space', 'ArrowUp', 'KeyW'] },
      { action: 'action', keys: ['KeyE', 'ShiftLeft'] },
      { action: 'pause', keys: ['Escape'] },
      { action: 'reset', keys: ['KeyR'] },
    ],
    'top-down': [
      { action: 'moveLeft', keys: ['ArrowLeft', 'KeyA'] },
      { action: 'moveRight', keys: ['ArrowRight', 'KeyD'] },
      { action: 'moveUp', keys: ['ArrowUp', 'KeyW'] },
      { action: 'moveDown', keys: ['ArrowDown', 'KeyS'] },
      { action: 'action', keys: ['Space', 'KeyE'] },
      { action: 'secondary', keys: ['ShiftLeft', 'KeyQ'] },
      { action: 'pause', keys: ['Escape'] },
      { action: 'reset', keys: ['KeyR'] },
    ],
    puzzle: [
      { action: 'moveLeft', keys: ['ArrowLeft', 'KeyA'] },
      { action: 'moveRight', keys: ['ArrowRight', 'KeyD'] },
      { action: 'moveUp', keys: ['ArrowUp', 'KeyW'] },
      { action: 'moveDown', keys: ['ArrowDown', 'KeyS'] },
      { action: 'action', keys: ['Space', 'KeyE', 'Enter'] },
      { action: 'secondary', keys: ['KeyZ', 'Backspace'] }, // Undo
      { action: 'pause', keys: ['Escape'] },
      { action: 'reset', keys: ['KeyR'] },
    ],
    shooter: [
      { action: 'moveLeft', keys: ['KeyA'] },
      { action: 'moveRight', keys: ['KeyD'] },
      { action: 'moveUp', keys: ['KeyW'] },
      { action: 'moveDown', keys: ['KeyS'] },
      { action: 'action', keys: ['Space'] }, // Shoot (also mouse)
      { action: 'secondary', keys: ['KeyE', 'ShiftLeft'] }, // Special
      { action: 'jump', keys: ['Space'] },
      { action: 'pause', keys: ['Escape'] },
      { action: 'reset', keys: ['KeyR'] },
    ],
  };

  return new InputManager(bindings[gameType] || DEFAULT_KEY_BINDINGS);
}
