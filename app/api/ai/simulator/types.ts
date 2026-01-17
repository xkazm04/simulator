/**
 * Types for Simulator AI API
 */

export interface SmartBreakdownRequest {
  userInput: string;
}

export interface ElementToDimensionRequest {
  elements: Array<{ text: string; category: string }>;
}

export interface LabelToDimensionRequest {
  acceptedElement: { text: string; category: string };
  currentDimensions: Array<{ type: string; reference: string }>;
}

export interface FeedbackToDimensionRequest {
  feedback: { positive: string; negative: string };
  currentDimensions: Array<{ type: string; reference: string }>;
}

export interface GenerateWithFeedbackRequest {
  baseImage: string;
  dimensions: Array<{ type: string; label: string; reference: string }>;
  feedback: { positive: string; negative: string };
  outputMode: 'gameplay' | 'concept' | 'poster';
  lockedElements: Array<{ id: string; text: string; category: string; locked: boolean }>;
}

export interface RefineFeedbackRequest {
  basePrompt: string;
  dimensions: Array<{ type: string; label: string; reference: string; id: string }>;
  changeFeedback: string;
  outputMode: 'gameplay' | 'concept' | 'poster';
}

export type SimulatorAction =
  | 'breakdown'
  | 'element-to-dimension'
  | 'label-to-dimension'
  | 'feedback-to-dimension'
  | 'generate-with-feedback'
  | 'refine-feedback';
