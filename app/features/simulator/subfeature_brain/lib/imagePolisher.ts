/**
 * imagePolisher - Gemini-based image polish service
 *
 * Converts evaluation feedback into targeted Gemini polish instructions
 * and executes polish operations to improve image quality.
 *
 * Two polish tracks:
 * 1. Rescue Polish (50-69 score): Polish to reach 70+ approval
 * 2. Excellence Polish (70-89 score): Polish approved images to exceptional quality
 */

import {
  ImageEvaluation,
  PolishConfig,
  PolishDecision,
  PolishResult,
  DEFAULT_POLISH_CONFIG,
} from '../../types';
import { EvaluationCriteria } from './imageEvaluator';

// ============================================
// Improvement to Polish Instruction Mapping
// ============================================

/**
 * Maps common evaluation improvement keywords to targeted Gemini polish instructions.
 * Keywords are matched case-insensitively against evaluation.improvements[].
 */
const IMPROVEMENT_TO_POLISH_MAP: Record<string, string> = {
  // Technical quality issues
  blur: 'Sharpen and enhance detail clarity throughout the image',
  blurry: 'Sharpen and enhance detail clarity throughout the image',
  artifact: 'Remove visual artifacts, noise, and rendering glitches while preserving composition',
  artifacts: 'Remove visual artifacts, noise, and rendering glitches while preserving composition',
  deform: 'Fix anatomical deformations, incorrect proportions, and unnatural poses',
  deformation: 'Fix anatomical deformations, incorrect proportions, and unnatural poses',
  render: 'Improve rendering quality, surface detail, and material definition',
  rendering: 'Improve rendering quality, surface detail, and material definition',
  quality: 'Enhance overall image quality and technical execution',
  noise: 'Reduce noise and grain while maintaining detail',
  distort: 'Correct distortions and perspective issues',

  // Anatomical/character issues
  hand: 'Fix hand anatomy - correct number of fingers with natural positioning',
  hands: 'Fix hand anatomy - correct number of fingers with natural positioning',
  finger: 'Correct finger count and positioning for natural appearance',
  face: 'Improve facial features and expression clarity',
  eye: 'Correct eye alignment and expression',
  body: 'Fix body proportions and anatomical accuracy',

  // Goal fit issues
  style: 'Enhance style consistency and artistic coherence throughout',
  atmosphere: 'Intensify atmosphere, mood, and environmental ambiance',
  composition: 'Improve compositional balance, visual flow, and focal point clarity',
  detail: 'Add missing details and enrich the scene with visual interest',
  details: 'Add missing details and enrich the scene with visual interest',
  match: 'Better align the image with the intended creative vision',
  prompt: 'Strengthen adherence to the original prompt direction',

  // Mode-specific issues (gameplay)
  ui: 'Add more prominent and authentic game UI elements (HUD, health bars, minimap)',
  hud: 'Enhance HUD visibility with genre-appropriate placement and styling',
  interface: 'Add clear game interface elements that feel authentic to the genre',
  gameplay: 'Make the image feel more like an authentic in-game screenshot',

  // Mode-specific issues (concept)
  clean: 'Remove any accidental UI artifacts for pure concept art presentation',
  overlay: 'Remove unwanted overlay elements for clean concept visualization',

  // Color and lighting
  color: 'Improve color harmony, saturation balance, and palette cohesion',
  lighting: 'Enhance lighting quality, shadows, and illumination consistency',
  contrast: 'Improve contrast and tonal range for visual impact',
  saturation: 'Balance color saturation for more vibrant yet natural appearance',
  dark: 'Brighten dark areas while maintaining mood and atmosphere',
  bright: 'Balance overly bright areas for better detail visibility',

  // Creative polish
  creative: 'Add unique creative flourishes and distinctive visual interest',
  unique: 'Enhance distinctive elements that make the image memorable',
  realistic: 'Enhance realism and photographic quality where appropriate',
  dramatic: 'Intensify dramatic lighting, contrast, and visual impact',
  polish: 'Apply overall refinement and professional polish',
  refine: 'Refine details and enhance overall presentation quality',
};

/**
 * Excellence polish templates for approved images that could be elevated further.
 * These focus on enhancement rather than fixing issues.
 */
const EXCELLENCE_TEMPLATES = {
  gameplay: {
    subtle: `Enhance this game screenshot with subtle professional polish:
- Sharpen UI elements for crisp readability
- Add subtle atmospheric effects (light particles, ambient glow)
- Enhance color grading for cinematic feel
- Refine material quality and surface details`,

    creative: `Elevate this gameplay to showcase-quality:
- Intensify the mood and atmospheric depth
- Add dynamic lighting effects and volumetric elements
- Enhance material reflections and surface quality
- Make it feel like a AAA marketing screenshot`,
  },

  concept: {
    subtle: `Polish this concept art with subtle refinements:
- Enhance brush strokes and artistic detail
- Improve color harmony and tonal balance
- Add atmospheric depth and dimension
- Refine compositional focal points`,

    creative: `Elevate to gallery-quality concept art:
- Add painterly flourishes and artistic touches
- Intensify emotional impact and mood
- Enhance unique stylistic elements
- Achieve master artist level of polish and refinement`,
  },
};

// ============================================
// Output Mode Normalization
// ============================================

/**
 * Normalize any output mode to the two polish categories.
 * Polish templates are fundamentally "has game UI" vs "no game UI".
 * - gameplay → gameplay (has HUD/UI)
 * - All others (sketch, trailer, poster, realistic, concept) → concept (no HUD/UI)
 */
function normalizePolishMode(outputMode: string): 'gameplay' | 'concept' {
  return outputMode === 'gameplay' ? 'gameplay' : 'concept';
}

// ============================================
// Polish Decision Logic
// ============================================

/**
 * Determine what action to take based on evaluation score and config.
 *
 * Decision matrix:
 * - Score >= excellenceCeiling (90+): SAVE (already excellent)
 * - Score >= approvalThreshold (70+): SAVE or EXCELLENCE POLISH
 * - Score >= rescueFloor (50+): RESCUE POLISH
 * - Score < rescueFloor (<50): REJECT
 */
export function decidePolishAction(
  evaluation: ImageEvaluation,
  config: Partial<PolishConfig> = {},
  outputMode: string = 'gameplay',
  approvalThreshold: number = 70
): PolishDecision {
  const fullConfig = { ...DEFAULT_POLISH_CONFIG, ...config };
  const { score } = evaluation;
  const normalizedMode = normalizePolishMode(outputMode);

  // Already excellent - save without polish
  if (score >= fullConfig.excellenceCeiling) {
    return {
      action: 'save',
      reason: `Score ${score} is already excellent (>= ${fullConfig.excellenceCeiling})`,
    };
  }

  // Approved but could be elevated
  if (score >= approvalThreshold) {
    if (fullConfig.excellenceEnabled && score < fullConfig.excellenceCeiling) {
      const polishPrompt = buildExcellencePolishPrompt(
        evaluation,
        normalizedMode,
        fullConfig.excellenceIntensity
      );
      return {
        action: 'polish',
        reason: `Score ${score} is approved but can be elevated to excellence`,
        polishPrompt,
        polishType: 'excellence',
      };
    }
    return {
      action: 'save',
      reason: `Score ${score} meets approval threshold`,
    };
  }

  // Near-approval - attempt rescue polish
  if (score >= fullConfig.rescueFloor && fullConfig.rescueEnabled) {
    const polishPrompt = buildRescuePolishPrompt(evaluation, normalizedMode);
    return {
      action: 'polish',
      reason: `Score ${score} is ${approvalThreshold - score} points from approval - attempting rescue polish`,
      polishPrompt,
      polishType: 'rescue',
    };
  }

  // Too far gone - reject
  return {
    action: 'reject',
    reason: `Score ${score} is below rescue floor (${fullConfig.rescueFloor}) - needs full regeneration`,
  };
}

// ============================================
// Polish Prompt Builders
// ============================================

/**
 * Build a rescue polish prompt from evaluation feedback.
 * Focus: Fix specific issues to reach approval threshold.
 */
export function buildRescuePolishPrompt(
  evaluation: ImageEvaluation,
  outputMode: 'gameplay' | 'concept'
): string {
  const instructions: string[] = [];

  // Map improvements to polish instructions
  for (const improvement of evaluation.improvements || []) {
    const lowerImprovement = improvement.toLowerCase();

    for (const [keyword, instruction] of Object.entries(IMPROVEMENT_TO_POLISH_MAP)) {
      if (lowerImprovement.includes(keyword)) {
        if (!instructions.includes(instruction)) {
          instructions.push(instruction);
        }
        break;
      }
    }
  }

  // Add score-based priority instructions
  const priorities: string[] = [];

  if (evaluation.technicalScore !== undefined && evaluation.technicalScore < 60) {
    priorities.push('PRIORITY: Fix technical quality issues (artifacts, blur, deformations)');
  }
  if (evaluation.goalFitScore !== undefined && evaluation.goalFitScore < 60) {
    priorities.push('PRIORITY: Better match the intended creative vision and prompt');
  }
  if (evaluation.aestheticScore !== undefined && evaluation.aestheticScore < 60) {
    priorities.push('PRIORITY: Enhance visual appeal, composition, and color harmony');
  }
  if (evaluation.modeCompliance === false) {
    if (outputMode === 'gameplay') {
      priorities.push('CRITICAL: Add visible game UI elements (HUD, health bars, minimap)');
    } else {
      priorities.push('CRITICAL: Remove any game UI overlays for clean concept art');
    }
  }

  // Build strengths preservation note
  const strengthsNote = evaluation.strengths?.length
    ? `\nPRESERVE THESE STRENGTHS:\n${evaluation.strengths.slice(0, 3).map(s => `- ${s}`).join('\n')}`
    : '';

  // Combine into final prompt
  const prioritySection = priorities.length > 0
    ? priorities.join('\n') + '\n\n'
    : '';

  const instructionSection = instructions.length > 0
    ? instructions.slice(0, 5).join('\n- ')
    : 'Enhance overall quality, fix visible issues, and improve visual appeal';

  return `Polish this ${outputMode === 'gameplay' ? 'game screenshot' : 'concept art'} with targeted improvements:

${prioritySection}IMPROVEMENTS NEEDED:
- ${instructionSection}
${strengthsNote}

Keep the core composition and subject matter intact. Apply focused refinements that address the specific issues while preserving what works well. The goal is to elevate quality without fundamentally changing the image.`;
}

/**
 * Build an excellence polish prompt for approved images.
 * Focus: Elevate from good to exceptional quality.
 */
export function buildExcellencePolishPrompt(
  evaluation: ImageEvaluation,
  outputMode: 'gameplay' | 'concept',
  intensity: 'subtle' | 'creative'
): string {
  const template = EXCELLENCE_TEMPLATES[outputMode][intensity];

  // Add score-specific enhancements
  const enhancements: string[] = [];

  if (evaluation.technicalScore !== undefined && evaluation.technicalScore < 85) {
    enhancements.push('Enhance technical quality and fine detail');
  }
  if (evaluation.aestheticScore !== undefined && evaluation.aestheticScore < 85) {
    enhancements.push('Boost visual appeal and artistic refinement');
  }
  if (evaluation.goalFitScore !== undefined && evaluation.goalFitScore < 85) {
    enhancements.push('Strengthen alignment with the creative vision');
  }

  // Preserve confirmed strengths
  const strengthsNote = evaluation.strengths?.length
    ? `\n\nCRITICAL - PRESERVE THESE STRENGTHS:\n${evaluation.strengths.map(s => `- ${s}`).join('\n')}`
    : '';

  const enhancementSection = enhancements.length > 0
    ? `\n\nADDITIONAL FOCUS:\n${enhancements.map(e => `- ${e}`).join('\n')}`
    : '';

  return `${template}${strengthsNote}${enhancementSection}

The image is already approved quality. Apply professional polish to make it exceptional while preserving its strengths.`;
}

// ============================================
// Polish API Client
// ============================================

/**
 * Request payload for the polish-image API endpoint
 */
export interface PolishRequest {
  /** URL of the image to polish */
  imageUrl: string;
  /** Prompt ID for tracking */
  promptId: string;
  /** Polish prompt built from evaluation feedback */
  polishPrompt: string;
  /** Original evaluation criteria (for re-evaluation) */
  criteria: EvaluationCriteria;
  /** Aspect ratio to maintain */
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  /** Type of polish operation */
  polishType: 'rescue' | 'excellence';
  /** Minimum score improvement required to accept polish */
  minScoreImprovement?: number;
  /** Original score before polish (for comparison) */
  originalScore?: number;
}

/**
 * Execute a polish operation via the API.
 *
 * @param request - Polish request parameters
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise<PolishResult>
 */
export async function polishImage(
  request: PolishRequest,
  signal?: AbortSignal
): Promise<PolishResult> {
  const response = await fetch('/api/ai/polish-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      improved: false,
      error: errorData.error || `Polish failed: ${response.status}`,
    };
  }

  const data = await response.json();
  return data;
}

/**
 * Execute polish with timeout protection.
 *
 * @param request - Polish request parameters
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @param signal - Optional external AbortSignal
 * @returns Promise<PolishResult>
 */
export async function polishImageWithTimeout(
  request: PolishRequest,
  timeoutMs: number = 30000,
  signal?: AbortSignal
): Promise<PolishResult> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine external signal with timeout signal
  const combinedSignal = signal
    ? createCombinedSignal(signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    return await polishImage(request, combinedSignal);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        improved: false,
        error: 'Polish operation timed out',
      };
    }
    return {
      success: false,
      improved: false,
      error: error instanceof Error ? error.message : 'Unknown error during polish',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create a combined AbortSignal that aborts when either signal aborts.
 */
function createCombinedSignal(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const abort = () => controller.abort();

  signal1.addEventListener('abort', abort);
  signal2.addEventListener('abort', abort);

  // Check if either is already aborted
  if (signal1.aborted || signal2.aborted) {
    controller.abort();
  }

  return controller.signal;
}
