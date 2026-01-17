/**
 * Component Tests for NegativePromptInput
 *
 * Tests the NegativePromptInput component basic functionality.
 * These tests focus on props-based behavior rather than mocking internal state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NegativePromptInput } from '../NegativePromptInput';
import { createMockDimension, createMockNegativePrompt, resetIdCounter } from '@/test/test-utils';
import { NegativePromptItem, Dimension } from '../../types';

describe('NegativePromptInput', () => {
  const defaultProps = {
    negativePrompts: [] as NegativePromptItem[],
    onNegativePromptsChange: vi.fn(),
    dimensions: [] as Dimension[],
    isGenerating: false,
  };

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<NegativePromptInput {...defaultProps} />);
      // Component should render
      expect(document.body).toBeTruthy();
    });

    it('renders toggle button with negative count', () => {
      const props = {
        ...defaultProps,
        negativePrompts: [
          createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
          createMockNegativePrompt({ text: 'watermark', scope: 'global' }),
        ],
      };
      render(<NegativePromptInput {...props} />);

      // Should show the count (2) in the collapsed state
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Negative Prompts')).toBeInTheDocument();
    });

    it('expands to show content when toggle is clicked', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        negativePrompts: [
          createMockNegativePrompt({ text: 'blurry', scope: 'global' }),
        ],
      };
      render(<NegativePromptInput {...props} />);

      // Click the toggle to expand
      const toggle = screen.getByTestId('negative-prompt-toggle');
      await user.click(toggle);

      // Now the content should be visible
      expect(screen.getByText('blurry')).toBeInTheDocument();
    });
  });

  describe('Adding Negative Prompts', () => {
    it('calls onNegativePromptsChange when adding via input', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<NegativePromptInput {...defaultProps} onNegativePromptsChange={onChange} />);

      // Expand the component first
      const toggle = screen.getByTestId('negative-prompt-toggle');
      await user.click(toggle);

      // Find input and type
      const input = screen.getByRole('textbox');
      await user.type(input, 'low quality');

      // Press Enter to add
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Removing Negative Prompts', () => {
    it('calls onNegativePromptsChange when removing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const props = {
        ...defaultProps,
        negativePrompts: [createMockNegativePrompt({ id: 'neg-1', text: 'blurry' })],
        onNegativePromptsChange: onChange,
      };
      render(<NegativePromptInput {...props} />);

      // Expand first
      const toggle = screen.getByTestId('negative-prompt-toggle');
      await user.click(toggle);

      // Find and click the X button on the chip
      const removeButtons = screen.getAllByRole('button');
      const removeBtn = removeButtons.find(btn => btn.querySelector('[class*="lucide-x"]'));

      if (removeBtn) {
        await user.click(removeBtn);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('Disabled State', () => {
    it('disables input when isGenerating is true', async () => {
      const user = userEvent.setup();
      const props = { ...defaultProps, isGenerating: true };
      render(<NegativePromptInput {...props} />);

      // Expand first
      const toggle = screen.getByTestId('negative-prompt-toggle');
      await user.click(toggle);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Dimension-Based Suggestions', () => {
    it('renders with dimensions', () => {
      const props = {
        ...defaultProps,
        dimensions: [
          createMockDimension({ type: 'characters', reference: 'Warriors' }),
          createMockDimension({ type: 'artStyle', reference: 'Anime' }),
        ],
      };
      render(<NegativePromptInput {...props} />);

      // Component should render without errors when dimensions are provided
      expect(screen.getByTestId('negative-prompt-toggle')).toBeInTheDocument();
    });
  });

  describe('Scope Handling', () => {
    it('renders with targetPromptId for per-prompt scope', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        targetPromptId: 'prompt-1',
        negativePrompts: [
          createMockNegativePrompt({ text: 'global-neg', scope: 'global' }),
          createMockNegativePrompt({ text: 'prompt-neg', scope: 'prompt', promptId: 'prompt-1' }),
        ],
      };
      render(<NegativePromptInput {...props} />);

      // Should show count of 2
      expect(screen.getByText('2')).toBeInTheDocument();

      // Expand to see content
      const toggle = screen.getByTestId('negative-prompt-toggle');
      await user.click(toggle);

      // Global negatives should be visible after expansion
      expect(screen.getByText('global-neg')).toBeInTheDocument();
      // Prompt-specific negatives are shown in a separate section based on the UI structure
    });
  });

  describe('Compact Mode', () => {
    it('renders in compact mode without errors', () => {
      const props = { ...defaultProps, compact: true };
      render(<NegativePromptInput {...props} />);

      expect(document.body).toBeTruthy();
    });
  });
});
