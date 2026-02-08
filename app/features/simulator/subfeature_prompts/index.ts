/**
 * Prompts Subfeature - Manages generated prompts and elements
 *
 * Handles the output side of the simulator:
 * - Generated prompts with scene types
 * - Prompt elements (composition, lighting, style, etc.)
 * - Element locking and feedback
 * - Prompt history (undo/redo)
 */

// Context
export { PromptsProvider, usePromptsContext, usePromptsState, usePromptsActions } from './PromptsContext';

// Hooks
export { usePrompts } from './hooks/usePrompts';
export { usePromptHistory } from './hooks/usePromptHistory';

// Lib
export { buildMockPromptWithElements } from './lib/promptBuilder';

// Components
export { PromptSection } from './components/PromptSection';
export { PromptOutput } from './components/PromptOutput';
export { PromptCard, SkeletonPromptCard } from './components/PromptCard';
export { ElementChip } from './components/ElementChip';
export { PromptDetailModal } from './components/PromptDetailModal';
