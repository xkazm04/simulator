/**
 * Interactive Components Showcase Page
 *
 * Demo page showcasing:
 * 1. Game Prompt Generator - Creates comprehensive prompts for AI Studio
 * 2. Image Region Editor - Draw rectangles with notes for inpainting/editing
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  MousePointer2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Square,
  Edit3,
  X,
} from 'lucide-react';

// Sample image URL (placeholder)
const SAMPLE_IMAGE_URL =
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80';

// ============================================
// Game Prompt Generator Section
// ============================================

interface GamePromptConfig {
  gameStyle: string;
  universe: string;
  playerClass: string;
  environment: string;
  enemyTypes: string;
  uiElements: string;
  cameraView: string;
  visualStyle: string;
}

const defaultConfig: GamePromptConfig = {
  gameStyle: 'Action RPG (Diablo-like)',
  universe: 'Star Wars',
  playerClass: 'Jedi Knight with dual lightsabers',
  environment: 'Ancient Sith temple on a volcanic planet',
  enemyTypes: 'Sith Acolytes, Battle Droids, Sith Wraiths',
  uiElements: 'Health/Force bars, minimap, ability hotbar, loot indicators',
  cameraView: 'Isometric top-down with slight tilt',
  visualStyle: 'Dark, atmospheric with glowing lightsaber effects',
};

function generateGamePrompt(config: GamePromptConfig): string {
  return `# Complete One-Shot Game Development Prompt for AI Studio

## OBJECTIVE
Create a fully playable ${config.gameStyle} game set in the ${config.universe} universe. The entire game should be generated in a single response as a complete, self-contained HTML file with embedded CSS and JavaScript.

## GAME SPECIFICATIONS

### Core Gameplay
- **Genre**: ${config.gameStyle}
- **Universe/Theme**: ${config.universe}
- **Player Character**: ${config.playerClass}
- **Camera**: ${config.cameraView}
- **Visual Style**: ${config.visualStyle}

### Player Mechanics
- WASD or arrow keys for movement
- Mouse click for primary attack (melee combo system)
- Number keys 1-4 for special abilities with cooldowns
- Space bar for dodge/roll with invincibility frames
- Tab to open inventory/character screen
- E to interact with objects/NPCs

### Combat System
- Basic attack combo (3-hit sequence)
- 4 unique abilities with visual effects and cooldowns:
  1. Force Push - knockback enemies in cone
  2. Saber Throw - ranged attack that returns
  3. Force Lightning/Healing - channeled ability
  4. Ultimate - screen-clearing devastation attack
- Enemies drop health orbs, credits, and equipment
- Critical hit system with visual feedback

### Enemy Types
${config.enemyTypes}
- Each enemy type has unique attack patterns
- Boss enemies with multiple phases
- Enemy health bars visible on hover

### Environment
- **Setting**: ${config.environment}
- Destructible objects (crates, pillars)
- Environmental hazards (lava pools, collapsing floors)
- Interactive elements (doors, switches, treasure chests)
- Multiple connected rooms/areas

### UI Elements (${config.uiElements})
- Player health bar (top-left)
- Resource/mana bar below health
- Minimap (top-right corner)
- Ability hotbar with cooldown indicators (bottom-center)
- Enemy health bars above enemies
- Damage numbers floating up from hits
- XP bar and level indicator
- Gold/credits counter
- Inventory grid (when opened)
- Floating combat text (damage, critical, status effects)

### Progression System
- Experience points from kills
- Level up with stat increases
- Lootable equipment with rarity tiers (Common, Rare, Epic, Legendary)
- Equipment affects player stats visually

### Audio (describe in code comments where sounds would play)
- Attack swing sounds
- Ability activation sounds
- Enemy death sounds
- Ambient environmental sounds
- Victory/level-up jingles

## TECHNICAL REQUIREMENTS

### Code Structure
\`\`\`
<!DOCTYPE html>
<html>
<head>
  <title>${config.universe} - ${config.gameStyle}</title>
  <style>
    /* All game styles here */
    /* Canvas styling, UI overlays, animations */
  </style>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <div id="ui-overlay">
    <!-- Health bars, minimap, ability bar HTML -->
  </div>
  <script>
    // Complete game logic:
    // - Game loop with requestAnimationFrame
    // - Entity system (Player, Enemies, Projectiles)
    // - Collision detection
    // - Combat calculations
    // - Particle effects
    // - State management
    // - Input handling
    // - UI updates
  </script>
</body>
</html>
\`\`\`

### Visual Effects (Pure JavaScript/Canvas)
- Lightsaber glow effect (radial gradients)
- Particle systems for abilities
- Screen shake on big hits
- Death animations (fade out)
- Ability cast animations
- Trail effects for fast movement

### Performance
- Object pooling for particles and projectiles
- Efficient collision detection (spatial partitioning if needed)
- Smooth 60fps gameplay
- Responsive controls

## DELIVERABLE
A single, complete HTML file that:
1. Opens directly in a browser
2. Requires no external dependencies
3. Is immediately playable
4. Includes all game systems listed above
5. Has at least 3 enemy types
6. Has at least one boss encounter
7. Runs smoothly for 5+ minutes of gameplay

## IMPORTANT NOTES
- This must be ONE COMPLETE FILE - do not split into multiple files
- Include ALL code - do not use placeholders like "// add more code here"
- Make it visually impressive with ${config.visualStyle} aesthetic
- The game should feel polished and fun to play immediately
- Use emojis or Unicode characters if needed for quick visual variety

Generate the complete game now.`;
}

function GamePromptGenerator() {
  const [config, setConfig] = useState<GamePromptConfig>(defaultConfig);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = () => {
    const prompt = generateGamePrompt(config);
    setGeneratedPrompt(prompt);
    setShowPreview(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfigChange = (key: keyof GamePromptConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Config Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(config).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-mono text-slate-400 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleConfigChange(key as keyof GamePromptConfig, e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        ))}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-mono uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Gamepad2 size={18} />
        Generate AI Studio Prompt
      </button>

      {/* Generated Prompt Preview */}
      <AnimatePresence>
        {showPreview && generatedPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-slate-400">
                Generated Prompt ({generatedPrompt.length} characters)
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2 text-sm"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy to Clipboard</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-slate-900 border border-slate-700 rounded-lg overflow-auto max-h-[400px] text-xs text-slate-300 whitespace-pre-wrap">
              {generatedPrompt}
            </pre>
            <p className="text-sm text-slate-500 italic">
              Copy this prompt and paste it into Google AI Studio, Claude, or any capable LLM to generate a complete playable game.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Image Region Editor Section
// ============================================

interface EditRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  note: string;
  type: 'add' | 'remove' | 'modify';
}

function ImageRegionEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [regions, setRegions] = useState<EditRegion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Partial<EditRegion> | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [regionType, setRegionType] = useState<'add' | 'remove' | 'modify'>('add');

  // Load sample image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
    };
    img.src = SAMPLE_IMAGE_URL;
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate image dimensions to fit
    const imgAspect = image.width / image.height;
    const canvasAspect = canvas.width / canvas.height;

    let drawWidth, drawHeight, drawX, drawY;
    if (imgAspect > canvasAspect) {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgAspect;
      drawX = 0;
      drawY = (canvas.height - drawHeight) / 2;
    } else {
      drawHeight = canvas.height;
      drawWidth = canvas.height * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
      drawY = 0;
    }

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    // Draw existing regions
    regions.forEach(region => {
      const isSelected = region.id === selectedRegion;

      // Region fill
      ctx.fillStyle = region.type === 'add'
        ? 'rgba(34, 197, 94, 0.2)'
        : region.type === 'remove'
          ? 'rgba(239, 68, 68, 0.2)'
          : 'rgba(168, 85, 247, 0.2)';
      ctx.fillRect(region.x, region.y, region.width, region.height);

      // Region border
      ctx.strokeStyle = region.type === 'add'
        ? 'rgb(34, 197, 94)'
        : region.type === 'remove'
          ? 'rgb(239, 68, 68)'
          : 'rgb(168, 85, 247)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [5, 5]);
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      ctx.setLineDash([]);

      // Label background
      const labelHeight = 20;
      const labelY = region.y - labelHeight - 4;
      const labelText = region.note || `${region.type.toUpperCase()} region`;
      ctx.font = '12px monospace';
      const textWidth = ctx.measureText(labelText).width + 8;

      ctx.fillStyle = region.type === 'add'
        ? 'rgb(34, 197, 94)'
        : region.type === 'remove'
          ? 'rgb(239, 68, 68)'
          : 'rgb(168, 85, 247)';
      ctx.fillRect(region.x, labelY, textWidth, labelHeight);

      // Label text
      ctx.fillStyle = 'white';
      ctx.fillText(labelText, region.x + 4, labelY + 14);
    });

    // Draw current drawing region
    if (currentRegion && currentRegion.width && currentRegion.height) {
      ctx.fillStyle = regionType === 'add'
        ? 'rgba(34, 197, 94, 0.3)'
        : regionType === 'remove'
          ? 'rgba(239, 68, 68, 0.3)'
          : 'rgba(168, 85, 247, 0.3)';
      ctx.fillRect(currentRegion.x!, currentRegion.y!, currentRegion.width, currentRegion.height);

      ctx.strokeStyle = regionType === 'add'
        ? 'rgb(34, 197, 94)'
        : regionType === 'remove'
          ? 'rgb(239, 68, 68)'
          : 'rgb(168, 85, 247)';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentRegion.x!, currentRegion.y!, currentRegion.width, currentRegion.height);
    }
  }, [image, regions, currentRegion, selectedRegion, regionType]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on existing region
    const clickedRegion = regions.find(r =>
      x >= r.x && x <= r.x + r.width &&
      y >= r.y && y <= r.y + r.height
    );

    if (clickedRegion) {
      setSelectedRegion(clickedRegion.id);
      return;
    }

    setSelectedRegion(null);
    setIsDrawing(true);
    setCurrentRegion({ x, y, width: 0, height: 0 });
  }, [regions]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentRegion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentRegion(prev => ({
      ...prev,
      width: x - prev!.x!,
      height: y - prev!.y!,
    }));
  }, [isDrawing, currentRegion]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentRegion) return;

    // Normalize negative dimensions
    let { x, y, width, height } = currentRegion as { x: number; y: number; width: number; height: number };
    if (width < 0) {
      x += width;
      width = -width;
    }
    if (height < 0) {
      y += height;
      height = -height;
    }

    // Only add if region is meaningful size
    if (width > 10 && height > 10) {
      const newRegion: EditRegion = {
        id: `region-${Date.now()}`,
        x,
        y,
        width,
        height,
        note: '',
        type: regionType,
      };
      setRegions(prev => [...prev, newRegion]);
      setEditingNote(newRegion.id);
      setNoteInput('');
    }

    setIsDrawing(false);
    setCurrentRegion(null);
  }, [isDrawing, currentRegion, regionType]);

  const handleSaveNote = (regionId: string) => {
    setRegions(prev => prev.map(r =>
      r.id === regionId ? { ...r, note: noteInput } : r
    ));
    setEditingNote(null);
    setNoteInput('');
  };

  const handleDeleteRegion = (regionId: string) => {
    setRegions(prev => prev.filter(r => r.id !== regionId));
    if (selectedRegion === regionId) setSelectedRegion(null);
    if (editingNote === regionId) setEditingNote(null);
  };

  const generateEditPrompt = () => {
    if (regions.length === 0) return '';

    let prompt = '# Image Editing Instructions\n\n';
    prompt += 'Please modify the image according to these region annotations:\n\n';

    regions.forEach((region, i) => {
      const action = region.type === 'add' ? 'ADD' : region.type === 'remove' ? 'REMOVE' : 'MODIFY';
      prompt += `## Region ${i + 1}: ${action}\n`;
      prompt += `- Position: (${Math.round(region.x)}, ${Math.round(region.y)})\n`;
      prompt += `- Size: ${Math.round(region.width)}x${Math.round(region.height)}\n`;
      prompt += `- Instructions: ${region.note || 'No specific instructions'}\n\n`;
    });

    return prompt;
  };

  const [copiedEditPrompt, setCopiedEditPrompt] = useState(false);
  const handleCopyEditPrompt = async () => {
    const prompt = generateEditPrompt();
    await navigator.clipboard.writeText(prompt);
    setCopiedEditPrompt(true);
    setTimeout(() => setCopiedEditPrompt(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-mono text-slate-400">Region Type:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setRegionType('add')}
            className={`px-3 py-1 rounded text-sm font-mono flex items-center gap-1 ${
              regionType === 'add'
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Plus size={14} />
            Add Element
          </button>
          <button
            onClick={() => setRegionType('remove')}
            className={`px-3 py-1 rounded text-sm font-mono flex items-center gap-1 ${
              regionType === 'remove'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Trash2 size={14} />
            Remove
          </button>
          <button
            onClick={() => setRegionType('modify')}
            className={`px-3 py-1 rounded text-sm font-mono flex items-center gap-1 ${
              regionType === 'modify'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Edit3 size={14} />
            Modify
          </button>
        </div>

        {regions.length > 0 && (
          <button
            onClick={() => setRegions([])}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-mono text-slate-300 ml-auto"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[400px] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full"
        />

        {/* Note editing modal */}
        <AnimatePresence>
          {editingNote && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-black/70 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 rounded-lg p-4 w-full max-w-md space-y-3">
                <h3 className="font-mono text-sm text-slate-300">Add note for this region:</h3>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g., 'Add a health bar HUD element here' or 'Remove the background object'"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm resize-none h-24"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      handleDeleteRegion(editingNote);
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                  >
                    Cancel & Delete
                  </button>
                  <button
                    onClick={() => handleSaveNote(editingNote)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <p className="text-sm text-slate-500">
        Click and drag to draw regions on the image. Each region can have a note describing what should be added, removed, or modified.
      </p>

      {/* Regions List */}
      {regions.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-sm text-slate-400">Defined Regions ({regions.length}):</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {regions.map((region, i) => (
              <div
                key={region.id}
                className={`flex items-center justify-between p-2 rounded border ${
                  selectedRegion === region.id
                    ? 'bg-slate-700 border-slate-500'
                    : 'bg-slate-800 border-slate-700'
                }`}
                onClick={() => setSelectedRegion(region.id)}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded ${
                    region.type === 'add' ? 'bg-green-500' :
                    region.type === 'remove' ? 'bg-red-500' : 'bg-purple-500'
                  }`} />
                  <span className="font-mono text-sm text-slate-300">
                    Region {i + 1}: {region.type.toUpperCase()}
                  </span>
                  {region.note && (
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">
                      - {region.note}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNote(region.id);
                      setNoteInput(region.note);
                    }}
                    className="p-1 hover:bg-slate-600 rounded"
                    title="Edit note"
                  >
                    <Edit3 size={14} className="text-slate-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRegion(region.id);
                    }}
                    className="p-1 hover:bg-slate-600 rounded"
                    title="Delete region"
                  >
                    <X size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={handleCopyEditPrompt}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono text-sm uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {copiedEditPrompt ? (
              <>
                <Check size={16} />
                Copied Edit Instructions!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy Edit Instructions for Image Generator
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Demo Section Component
// ============================================

function DemoSection({
  title,
  icon,
  color,
  children,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  description: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={`border ${color} rounded-lg overflow-hidden bg-slate-900/50`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-slate-400" />
        ) : (
          <ChevronDown className="text-slate-400" />
        )}
      </button>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="p-4 border-t border-slate-700"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function InteractivePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Interactive Tools Showcase</h1>
          <p className="text-slate-400">
            Tools for generating AI prompts and annotating images for editing
          </p>
        </div>

        <div className="space-y-6">
          {/* Game Prompt Generator */}
          <DemoSection
            title="Game Prompt Generator"
            icon={<Gamepad2 className="text-cyan-400" size={24} />}
            color="border-cyan-500/30"
            description="Generate comprehensive prompts for AI Studio to create playable games"
          >
            <GamePromptGenerator />
          </DemoSection>

          {/* Image Region Editor */}
          <DemoSection
            title="Image Region Editor"
            icon={<MousePointer2 className="text-purple-400" size={24} />}
            color="border-purple-500/30"
            description="Draw regions on images with notes for inpainting/editing instructions"
          >
            <ImageRegionEditor />
          </DemoSection>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-sm">
            Prototype tools - copy generated prompts to AI Studio for testing
          </p>
        </div>
      </div>
    </div>
  );
}
