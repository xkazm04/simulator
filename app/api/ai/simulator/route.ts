import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, HTTP_STATUS } from '@/app/utils/apiErrorHandling';
import { getUnifiedProvider } from '@/app/lib/ai';
import {
  SmartBreakdownRequest,
  ElementToDimensionRequest,
  LabelToDimensionRequest,
  FeedbackToDimensionRequest,
  GenerateWithFeedbackRequest,
  RefineFeedbackRequest,
  SimulatorAction,
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
 * Endpoints:
 * - POST ?action=breakdown - Smart Breakdown
 * - POST ?action=element-to-dimension - Element to Dimension
 * - POST ?action=label-to-dimension - Label to Dimension refinement
 * - POST ?action=feedback-to-dimension - Apply feedback to dimensions
 * - POST ?action=generate-with-feedback - Generate prompts
 * - POST ?action=refine-feedback - Refine based on change input
 */

async function callClaude(systemPrompt: string, userPrompt: string, feature: string): Promise<string> {
  const provider = getUnifiedProvider();
  const response = await provider.generateText({
    systemPrompt,
    userPrompt,
    maxTokens: 2000,
    metadata: { feature },
  }, 'claude');
  return response.text;
}

function parseJsonResponse(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }
  return JSON.parse(jsonMatch[0]);
}

async function handleSmartBreakdown(body: SmartBreakdownRequest) {
  const { userInput } = body;
  if (!userInput || userInput.trim().length < 5) {
    return createErrorResponse('Input too short', HTTP_STATUS.BAD_REQUEST);
  }

  const response = await callClaude(
    BREAKDOWN_SYSTEM_PROMPT,
    createBreakdownPrompt(userInput),
    'smart-breakdown'
  );
  return NextResponse.json(parseJsonResponse(response));
}

async function handleElementToDimension(body: ElementToDimensionRequest) {
  const { elements } = body;
  if (!elements || elements.length === 0) {
    return createErrorResponse('No elements provided', HTTP_STATUS.BAD_REQUEST);
  }

  const response = await callClaude(
    ELEMENT_TO_DIM_SYSTEM_PROMPT,
    createElementToDimPrompt(elements),
    'element-to-dimension'
  );
  return NextResponse.json(parseJsonResponse(response));
}

async function handleLabelToDimension(body: LabelToDimensionRequest) {
  if (!body.acceptedElement || !body.currentDimensions) {
    return createErrorResponse('Missing required fields', HTTP_STATUS.BAD_REQUEST);
  }

  const response = await callClaude(
    LABEL_TO_DIM_SYSTEM_PROMPT,
    createLabelToDimPrompt(body),
    'label-to-dimension'
  );
  return NextResponse.json(parseJsonResponse(response));
}

async function handleFeedbackToDimension(body: FeedbackToDimensionRequest) {
  if (!body.feedback || !body.currentDimensions) {
    return createErrorResponse('Missing required fields', HTTP_STATUS.BAD_REQUEST);
  }

  if (!body.feedback.positive?.trim() && !body.feedback.negative?.trim()) {
    return NextResponse.json({
      success: true,
      affectedDimensions: [],
      unaffectedDimensions: body.currentDimensions.map(d => d.type),
      reasoning: 'No feedback provided',
    });
  }

  const response = await callClaude(
    FEEDBACK_TO_DIM_SYSTEM_PROMPT,
    createFeedbackToDimPrompt(body),
    'feedback-to-dimension'
  );
  return NextResponse.json(parseJsonResponse(response));
}

async function handleGenerateWithFeedback(body: GenerateWithFeedbackRequest) {
  if (!body.baseImage?.trim()) {
    return createErrorResponse('Base image description is required', HTTP_STATUS.BAD_REQUEST);
  }

  const response = await callClaude(
    GENERATE_WITH_FEEDBACK_SYSTEM_PROMPT,
    createGenerateWithFeedbackPrompt(body),
    'generate-with-feedback'
  );

  const parsed = parseJsonResponse(response) as {
    prompts?: Array<{ id?: string; elements?: Array<{ id?: string }> }>;
  };

  // Ensure all IDs are present
  if (parsed.prompts) {
    parsed.prompts = parsed.prompts.map((p, idx) => ({
      ...p,
      id: p.id || `prompt-${Date.now()}-${idx}`,
      elements: (p.elements || []).map((e, eIdx) => ({
        ...e,
        id: e.id || `elem-${Date.now()}-${idx}-${eIdx}`,
      })),
    }));
  }

  return NextResponse.json(parsed);
}

async function handleRefineFeedback(body: RefineFeedbackRequest) {
  if (!body.changeFeedback?.trim()) {
    return NextResponse.json({
      success: true,
      refinedPrompt: body.basePrompt,
      refinedDimensions: [],
      changes: [],
      reasoning: 'No feedback provided',
    });
  }

  const response = await callClaude(
    REFINE_FEEDBACK_SYSTEM_PROMPT,
    createRefineFeedbackPrompt(body),
    'refine-feedback'
  );
  return NextResponse.json(parseJsonResponse(response));
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') as SimulatorAction;
    const body = await request.json();

    switch (action) {
      case 'breakdown':
        return handleSmartBreakdown(body);
      case 'element-to-dimension':
        return handleElementToDimension(body);
      case 'label-to-dimension':
        return handleLabelToDimension(body);
      case 'feedback-to-dimension':
        return handleFeedbackToDimension(body);
      case 'generate-with-feedback':
        return handleGenerateWithFeedback(body);
      case 'refine-feedback':
        return handleRefineFeedback(body);
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
