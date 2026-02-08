import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, HTTP_STATUS } from '@/app/utils/apiErrorHandling';
import { getUnifiedProvider, parseAIJsonResponse } from '@/app/lib/ai';
import {
  SmartBreakdownRequest,
  ElementToDimensionRequest,
  LabelToDimensionRequest,
  FeedbackToDimensionRequest,
  GenerateWithFeedbackRequest,
  RefineFeedbackRequest,
  SimulatorAction,
  DimensionTransformation,
} from './types';
import {
  BREAKDOWN_SYSTEM_PROMPT,
  ELEMENT_TO_DIM_SYSTEM_PROMPT,
  LABEL_TO_DIM_SYSTEM_PROMPT,
  FEEDBACK_TO_DIM_SYSTEM_PROMPT,
  GENERATE_WITH_FEEDBACK_SYSTEM_PROMPT,
  REFINE_FEEDBACK_SYSTEM_PROMPT,
  createBreakdownPrompt,
  createElementToDimPrompt,
  createLabelToDimPrompt,
  createFeedbackToDimPrompt,
  createGenerateWithFeedbackPrompt,
  createRefineFeedbackPrompt,
} from './prompts';

/**
 * Simulator AI API - Uses Claude for all LLM operations
 *
 * All endpoints implement the DimensionTransformation pattern:
 * - POST ?action=breakdown - Smart Breakdown (text → dimensions)
 * - POST ?action=element-to-dimension - Element to Dimension (elements → dimensions)
 * - POST ?action=label-to-dimension - Label to Dimension (element + dims → refined dims)
 * - POST ?action=feedback-to-dimension - Apply feedback (feedback + dims → adjusted dims)
 * - POST ?action=generate-with-feedback - Generate prompts (dims + context → prompts)
 * - POST ?action=refine-feedback - Refine based on change (prompt + feedback → refined)
 */

// ============================================================================
// TRANSFORMATION EXECUTOR
// ============================================================================

/**
 * Execute a dimension transformation - unified execution path for all transformers
 */
async function executeTransformation<TInput, TOutput>(
  transformation: DimensionTransformation<TInput, TOutput>,
  input: TInput
): Promise<NextResponse> {
  // Step 1: Validate input
  const validationError = transformation.validate(input);
  if (validationError) {
    return createErrorResponse(validationError, HTTP_STATUS.BAD_REQUEST);
  }

  // Step 2: Call Claude with system + user prompts
  const provider = getUnifiedProvider();
  const response = await provider.generateText({
    systemPrompt: transformation.systemPrompt,
    userPrompt: transformation.createUserPrompt(input),
    maxTokens: transformation.maxTokens ?? 2000,
    metadata: { feature: transformation.featureName },
  }, 'claude');

  // Step 3: Parse JSON response
  const parsed = parseAIJsonResponse(response.text);

  // Step 4: Optional post-processing
  const output = transformation.postProcess
    ? transformation.postProcess(parsed, input)
    : parsed as TOutput;

  return NextResponse.json(output);
}

// ============================================================================
// TRANSFORMATION DEFINITIONS
// ============================================================================

const smartBreakdown: DimensionTransformation<SmartBreakdownRequest, unknown> = {
  action: 'breakdown',
  featureName: 'smart-breakdown',
  systemPrompt: BREAKDOWN_SYSTEM_PROMPT,
  validate: (input) =>
    !input.userInput || input.userInput.trim().length < 5
      ? 'Input too short'
      : null,
  createUserPrompt: (input) => createBreakdownPrompt(input.userInput),
};

const elementToDimension: DimensionTransformation<ElementToDimensionRequest, unknown> = {
  action: 'element-to-dimension',
  featureName: 'element-to-dimension',
  systemPrompt: ELEMENT_TO_DIM_SYSTEM_PROMPT,
  validate: (input) =>
    !input.elements || input.elements.length === 0
      ? 'No elements provided'
      : null,
  createUserPrompt: (input) => createElementToDimPrompt(input.elements),
};

const labelToDimension: DimensionTransformation<LabelToDimensionRequest, unknown> = {
  action: 'label-to-dimension',
  featureName: 'label-to-dimension',
  systemPrompt: LABEL_TO_DIM_SYSTEM_PROMPT,
  validate: (input) =>
    !input.acceptedElement || !input.currentDimensions
      ? 'Missing required fields'
      : null,
  createUserPrompt: (input) => createLabelToDimPrompt(input),
};

const feedbackToDimension: DimensionTransformation<FeedbackToDimensionRequest, unknown> = {
  action: 'feedback-to-dimension',
  featureName: 'feedback-to-dimension',
  systemPrompt: FEEDBACK_TO_DIM_SYSTEM_PROMPT,
  validate: (input) =>
    !input.feedback || !input.currentDimensions
      ? 'Missing required fields'
      : null,
  createUserPrompt: (input) => createFeedbackToDimPrompt(input),
};

const generateWithFeedback: DimensionTransformation<GenerateWithFeedbackRequest, unknown> = {
  action: 'generate-with-feedback',
  featureName: 'generate-with-feedback',
  systemPrompt: GENERATE_WITH_FEEDBACK_SYSTEM_PROMPT,
  maxTokens: 8000, // 4 full prompts (~1500 chars each) + adjustments + JSON structure
  validate: (input) =>
    !input.baseImage?.trim()
      ? 'Base image description is required'
      : null,
  createUserPrompt: (input) => createGenerateWithFeedbackPrompt(input),
  postProcess: (parsed) => {
    // Ensure all IDs are present
    const result = parsed as { prompts?: Array<{ id?: string; elements?: Array<{ id?: string }> }> };
    if (result.prompts) {
      result.prompts = result.prompts.map((p, idx) => ({
        ...p,
        id: p.id || `prompt-${Date.now()}-${idx}`,
        elements: (p.elements || []).map((e, eIdx) => ({
          ...e,
          id: e.id || `elem-${Date.now()}-${idx}-${eIdx}`,
        })),
      }));
    }
    return result;
  },
};

const refineFeedback: DimensionTransformation<RefineFeedbackRequest, unknown> = {
  action: 'refine-feedback',
  featureName: 'refine-feedback',
  systemPrompt: REFINE_FEEDBACK_SYSTEM_PROMPT,
  validate: () => null, // No validation error - empty feedback handled specially
  createUserPrompt: (input) => createRefineFeedbackPrompt(input),
};

// ============================================================================
// SPECIAL CASE HANDLERS (for early-return cases)
// ============================================================================

function handleFeedbackToDimensionSpecialCase(body: FeedbackToDimensionRequest): NextResponse | null {
  // Early return if no actual feedback
  if (!body.feedback.positive?.trim() && !body.feedback.negative?.trim()) {
    return NextResponse.json({
      success: true,
      affectedDimensions: [],
      unaffectedDimensions: body.currentDimensions.map(d => d.type),
      reasoning: 'No feedback provided',
    });
  }
  return null;
}

function handleRefineFeedbackSpecialCase(body: RefineFeedbackRequest): NextResponse | null {
  // Early return if no actual feedback
  if (!body.changeFeedback?.trim()) {
    return NextResponse.json({
      success: true,
      refinedPrompt: body.basePrompt,
      refinedDimensions: [],
      changes: [],
      reasoning: 'No feedback provided',
    });
  }
  return null;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') as SimulatorAction;
    const body = await request.json();

    switch (action) {
      case 'breakdown':
        return executeTransformation(smartBreakdown, body);

      case 'element-to-dimension':
        return executeTransformation(elementToDimension, body);

      case 'label-to-dimension':
        return executeTransformation(labelToDimension, body);

      case 'feedback-to-dimension': {
        const specialCase = handleFeedbackToDimensionSpecialCase(body);
        if (specialCase) return specialCase;
        return executeTransformation(feedbackToDimension, body);
      }

      case 'generate-with-feedback':
        return executeTransformation(generateWithFeedback, body);

      case 'refine-feedback': {
        const specialCase = handleRefineFeedbackSpecialCase(body);
        if (specialCase) return specialCase;
        return executeTransformation(refineFeedback, body);
      }

      default:
        return createErrorResponse(`Unknown action: ${action}`, HTTP_STATUS.BAD_REQUEST);
    }
  } catch (error) {
    console.error('Simulator AI error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to process request',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
