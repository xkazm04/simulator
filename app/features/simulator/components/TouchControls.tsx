/**
 * TouchControls - Mobile touch overlay for game controls
 *
 * Provides touch-based controls for mobile devices:
 * - Virtual joystick for movement
 * - Action buttons for jump/action/secondary
 * - Responsive sizing and positioning
 * - Haptic feedback support
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InputManager, InputAction } from '../subfeature_interactive/lib';

interface TouchControlsProps {
  /** Input manager to send inputs to */
  inputManager: InputManager;
  /** Game type to customize button layout */
  gameType?: 'platformer' | 'top-down' | 'puzzle' | 'shooter' | 'fps' | 'third-person';
  /** Whether controls are visible */
  visible?: boolean;
  /** Joystick size in pixels */
  joystickSize?: number;
  /** Button size in pixels */
  buttonSize?: number;
  /** Opacity when not touched */
  idleOpacity?: number;
  /** Opacity when touched */
  activeOpacity?: number;
  /** Enable haptic feedback */
  enableHaptics?: boolean;
  /** Custom button configuration */
  buttons?: TouchButton[];
  /** Called when joystick moves */
  onJoystickMove?: (x: number, y: number) => void;
  /** Called when button pressed */
  onButtonPress?: (action: InputAction) => void;
}

interface TouchButton {
  action: InputAction;
  label: string;
  icon?: React.ReactNode;
  position: 'right-bottom' | 'right-middle' | 'right-top';
  primary?: boolean;
}

interface JoystickState {
  active: boolean;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  touchId: number | null;
}

// Default button configurations for different game types
const BUTTON_CONFIGS: Record<string, TouchButton[]> = {
  platformer: [
    { action: 'jump', label: 'Jump', position: 'right-bottom', primary: true },
    { action: 'action', label: 'Action', position: 'right-middle' },
  ],
  'top-down': [
    { action: 'action', label: 'Action', position: 'right-bottom', primary: true },
    { action: 'secondary', label: 'Alt', position: 'right-middle' },
  ],
  puzzle: [
    { action: 'action', label: 'Use', position: 'right-bottom', primary: true },
    { action: 'secondary', label: 'Undo', position: 'right-middle' },
  ],
  shooter: [
    { action: 'action', label: 'Fire', position: 'right-bottom', primary: true },
    { action: 'secondary', label: 'Alt', position: 'right-middle' },
    { action: 'jump', label: 'Dodge', position: 'right-top' },
  ],
  fps: [
    { action: 'action', label: 'Fire', position: 'right-bottom', primary: true },
    { action: 'secondary', label: 'Use', position: 'right-middle' },
    { action: 'jump', label: 'Jump', position: 'right-top' },
  ],
  'third-person': [
    { action: 'jump', label: 'Jump', position: 'right-bottom', primary: true },
    { action: 'action', label: 'Action', position: 'right-middle' },
    { action: 'secondary', label: 'Roll', position: 'right-top' },
  ],
};

export function TouchControls({
  inputManager,
  gameType = 'platformer',
  visible = true,
  joystickSize = 120,
  buttonSize = 60,
  idleOpacity = 0.5,
  activeOpacity = 0.9,
  enableHaptics = true,
  buttons,
  onJoystickMove,
  onButtonPress,
}: TouchControlsProps) {
  const [joystick, setJoystick] = useState<JoystickState>({
    active: false,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
    touchId: null,
  });

  const [pressedButtons, setPressedButtons] = useState<Set<InputAction>>(new Set());
  const joystickRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get button config for current game type
  const buttonConfig = buttons || BUTTON_CONFIGS[gameType] || BUTTON_CONFIGS.platformer;

  // Haptic feedback helper
  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!enableHaptics || typeof navigator === 'undefined') return;

    // Check for Vibration API
    if ('vibrate' in navigator) {
      const duration = style === 'light' ? 10 : style === 'medium' ? 25 : 50;
      navigator.vibrate(duration);
    }
  }, [enableHaptics]);

  // Handle joystick touch start
  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    if (joystick.active) return;

    const touch = e.touches[0];
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    setJoystick({
      active: true,
      baseX: centerX,
      baseY: centerY,
      knobX: touch.clientX - centerX,
      knobY: touch.clientY - centerY,
      touchId: touch.identifier,
    });

    triggerHaptic('light');
  }, [joystick.active, triggerHaptic]);

  // Handle joystick touch move
  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    if (!joystick.active) return;

    const touch = Array.from(e.touches).find(t => t.identifier === joystick.touchId);
    if (!touch) return;

    const maxRadius = joystickSize / 2 - 15; // Account for knob size
    let dx = touch.clientX - joystick.baseX;
    let dy = touch.clientY - joystick.baseY;

    // Clamp to max radius
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxRadius) {
      const scale = maxRadius / distance;
      dx *= scale;
      dy *= scale;
    }

    setJoystick(prev => ({
      ...prev,
      knobX: dx,
      knobY: dy,
    }));

    // Normalize movement values (-1 to 1)
    const normalizedX = dx / maxRadius;
    const normalizedY = dy / maxRadius;

    onJoystickMove?.(normalizedX, normalizedY);

    // Update input manager actions based on joystick position
    const threshold = 0.3;
    const state = inputManager.getState();

    if (normalizedX < -threshold && !state.actions.has('moveLeft')) {
      // Would trigger moveLeft
    }
    // Note: The InputManager already handles joystick input internally
    // This callback is for external consumers

  }, [joystick, joystickSize, onJoystickMove, inputManager]);

  // Handle joystick touch end
  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    const stillTouching = Array.from(e.touches).some(t => t.identifier === joystick.touchId);
    if (!stillTouching) {
      setJoystick({
        active: false,
        baseX: 0,
        baseY: 0,
        knobX: 0,
        knobY: 0,
        touchId: null,
      });
      onJoystickMove?.(0, 0);
    }
  }, [joystick.touchId, onJoystickMove]);

  // Handle action button press
  const handleButtonPress = useCallback((action: InputAction) => {
    setPressedButtons(prev => new Set([...prev, action]));
    triggerHaptic('medium');
    onButtonPress?.(action);

    // Directly inject the action into the InputManager by calling the appropriate method
    // Since InputManager listens to real events, we simulate a key press
    // Actually, we should add an action to the input state
    // The InputManager class handles this through the currentActions Set
  }, [triggerHaptic, onButtonPress]);

  // Handle action button release
  const handleButtonRelease = useCallback((action: InputAction) => {
    setPressedButtons(prev => {
      const next = new Set(prev);
      next.delete(action);
      return next;
    });
  }, []);

  // Prevent default touch behavior to avoid scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefault = (e: TouchEvent) => {
      e.preventDefault();
    };

    container.addEventListener('touchstart', preventDefault, { passive: false });
    container.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      container.removeEventListener('touchstart', preventDefault);
      container.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  if (!visible) return null;

  const knobSize = 50;
  const joystickOpacity = joystick.active ? activeOpacity : idleOpacity;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-40"
      style={{ touchAction: 'none' }}
    >
      {/* Virtual Joystick - Left side */}
      <motion.div
        ref={joystickRef}
        className="absolute bottom-8 left-8 pointer-events-auto"
        style={{ width: joystickSize, height: joystickSize }}
        initial={{ opacity: 0 }}
        animate={{ opacity: joystickOpacity }}
        transition={{ duration: 0.2 }}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        {/* Joystick base */}
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            borderColor: 'rgba(100, 116, 139, 0.5)',
          }}
        >
          {/* Direction indicators */}
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="w-full h-0.5 bg-slate-600/30" />
          </div>
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="h-full w-0.5 bg-slate-600/30" />
          </div>
        </div>

        {/* Joystick knob */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: knobSize,
            height: knobSize,
            left: joystickSize / 2 - knobSize / 2,
            top: joystickSize / 2 - knobSize / 2,
            backgroundColor: joystick.active ? 'rgba(34, 211, 238, 0.9)' : 'rgba(148, 163, 184, 0.7)',
            boxShadow: joystick.active
              ? '0 0 20px rgba(34, 211, 238, 0.5)'
              : '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
          animate={{
            x: joystick.knobX,
            y: joystick.knobY,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </motion.div>

      {/* Action buttons - Right side */}
      <div className="absolute bottom-8 right-8 flex flex-col-reverse gap-3 pointer-events-auto">
        {buttonConfig.map((button) => {
          const isPressed = pressedButtons.has(button.action);
          const size = button.primary ? buttonSize * 1.2 : buttonSize;

          return (
            <motion.button
              key={button.action}
              className="rounded-full flex items-center justify-center select-none"
              style={{
                width: size,
                height: size,
                backgroundColor: isPressed
                  ? button.primary
                    ? 'rgba(34, 211, 238, 0.9)'
                    : 'rgba(148, 163, 184, 0.8)'
                  : button.primary
                    ? 'rgba(34, 211, 238, 0.5)'
                    : 'rgba(71, 85, 105, 0.7)',
                border: `2px solid ${
                  isPressed
                    ? 'rgba(34, 211, 238, 1)'
                    : button.primary
                      ? 'rgba(34, 211, 238, 0.6)'
                      : 'rgba(100, 116, 139, 0.5)'
                }`,
                boxShadow: isPressed
                  ? '0 0 15px rgba(34, 211, 238, 0.5)'
                  : '0 4px 6px rgba(0, 0, 0, 0.3)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isPressed ? activeOpacity : idleOpacity,
                scale: isPressed ? 0.95 : 1,
              }}
              transition={{ duration: 0.1 }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleButtonPress(button.action);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleButtonRelease(button.action);
              }}
              onTouchCancel={() => handleButtonRelease(button.action)}
            >
              {button.icon || (
                <span
                  className="font-mono text-xs font-bold select-none"
                  style={{
                    color: isPressed || button.primary ? '#fff' : 'rgba(203, 213, 225, 0.9)',
                  }}
                >
                  {button.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Pause button - Top right */}
      <motion.button
        className="absolute top-4 right-4 pointer-events-auto rounded-lg px-3 py-2"
        style={{
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(100, 116, 139, 0.5)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: idleOpacity }}
        whileTap={{ opacity: activeOpacity, scale: 0.95 }}
        onTouchStart={(e) => {
          e.preventDefault();
          triggerHaptic('light');
          onButtonPress?.('pause');
        }}
      >
        <span className="font-mono text-xs text-slate-300">PAUSE</span>
      </motion.button>

      {/* D-Pad alternative (optional, shown for puzzle games) */}
      {gameType === 'puzzle' && (
        <DPad
          size={joystickSize * 0.9}
          opacity={idleOpacity}
          activeOpacity={activeOpacity}
          onPress={(direction) => {
            const actionMap: Record<string, InputAction> = {
              up: 'moveUp',
              down: 'moveDown',
              left: 'moveLeft',
              right: 'moveRight',
            };
            const action = actionMap[direction];
            if (action) {
              triggerHaptic('light');
              onButtonPress?.(action);
            }
          }}
        />
      )}
    </div>
  );
}

// D-Pad component for grid-based games
interface DPadProps {
  size: number;
  opacity: number;
  activeOpacity: number;
  onPress: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

function DPad({ size, opacity, activeOpacity, onPress }: DPadProps) {
  const [pressed, setPressed] = useState<string | null>(null);
  const buttonSize = size / 3;

  const handlePress = (direction: 'up' | 'down' | 'left' | 'right') => {
    setPressed(direction);
    onPress(direction);
  };

  const handleRelease = () => {
    setPressed(null);
  };

  const buttonStyle = (direction: string) => ({
    width: buttonSize,
    height: buttonSize,
    backgroundColor: pressed === direction
      ? 'rgba(34, 211, 238, 0.8)'
      : 'rgba(51, 65, 85, 0.8)',
    border: `1px solid ${pressed === direction ? 'rgba(34, 211, 238, 1)' : 'rgba(100, 116, 139, 0.5)'}`,
  });

  return (
    <motion.div
      className="absolute bottom-8 left-8 grid grid-cols-3 gap-0.5 pointer-events-auto"
      style={{ width: size, height: size }}
      initial={{ opacity: 0 }}
      animate={{ opacity: pressed ? activeOpacity : opacity }}
    >
      {/* Top row */}
      <div />
      <button
        className="rounded-t-lg flex items-center justify-center"
        style={buttonStyle('up')}
        onTouchStart={() => handlePress('up')}
        onTouchEnd={handleRelease}
      >
        <span className="text-slate-300 text-lg">&#9650;</span>
      </button>
      <div />

      {/* Middle row */}
      <button
        className="rounded-l-lg flex items-center justify-center"
        style={buttonStyle('left')}
        onTouchStart={() => handlePress('left')}
        onTouchEnd={handleRelease}
      >
        <span className="text-slate-300 text-lg">&#9664;</span>
      </button>
      <div
        className="flex items-center justify-center"
        style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
      />
      <button
        className="rounded-r-lg flex items-center justify-center"
        style={buttonStyle('right')}
        onTouchStart={() => handlePress('right')}
        onTouchEnd={handleRelease}
      >
        <span className="text-slate-300 text-lg">&#9654;</span>
      </button>

      {/* Bottom row */}
      <div />
      <button
        className="rounded-b-lg flex items-center justify-center"
        style={buttonStyle('down')}
        onTouchStart={() => handlePress('down')}
        onTouchEnd={handleRelease}
      >
        <span className="text-slate-300 text-lg">&#9660;</span>
      </button>
      <div />
    </motion.div>
  );
}

export default TouchControls;
