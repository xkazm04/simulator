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
  // Log raw response for debugging
  console.log('[parseJsonResponse] Raw response length:', text.length);

  // Step 1: Strip markdown code blocks if present
  let cleaned = text;

  // Remove ```json ... ``` or ``` ... ``` blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Step 2: Try to find JSON object with proper string handling
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) {
    console.error('[parseJsonResponse] No JSON found in:', cleaned.substring(0, 500));
    throw new Error('Could not find JSON object in response');
  }

  // Find the matching closing brace, properly handling strings
  let braceCount = 0;
  let endIdx = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = startIdx; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    console.error('[parseJsonResponse] Incomplete JSON. Brace count:', braceCount, 'Response preview:', cleaned.substring(0, 1000));
    throw new Error(`Could not find complete JSON object in response (unclosed braces: ${braceCount})`);
  }

  const jsonStr = cleaned.substring(startIdx, endIdx + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    // Log the problematic JSON for debugging
    console.error('[parseJsonResponse] Parse error:', parseError);
    console.error('[parseJsonResponse] JSON string:', jsonStr.substring(0, 1000));
    throw new Error(`Invalid JSON in response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }
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
