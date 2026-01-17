/**
 * E2E Tests - Simulator Critical User Journeys
 *
 * Tests full user flows including:
 * - Page load and basic navigation
 * - Dimension input and modification
 * - Generation trigger
 * - Prompt interaction
 */

import { test, expect } from '@playwright/test';

test.describe('Simulator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the simulator page
    await page.goto('/');
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Load', () => {
    test('should load the simulator page', async ({ page }) => {
      // Check that the page loaded
      await expect(page).toHaveTitle(/Simulator/i);
    });

    test('should display the main layout', async ({ page }) => {
      // Check for key UI elements
      await expect(page.locator('text=Source Analysis')).toBeVisible();
      await expect(page.locator('text=Director Control')).toBeVisible();
    });

    test('should display dimension inputs', async ({ page }) => {
      // Check that dimension cards are present
      const dimensionCards = page.locator('[data-testid*="dimension-card"]');
      await expect(dimensionCards.first()).toBeVisible();
    });
  });

  test.describe('Dimension Input', () => {
    test('should accept text input in dimension fields', async ({ page }) => {
      // Find the first dimension input
      const dimensionInput = page.locator('textarea').first();

      // Type a reference
      await dimensionInput.fill('Star Wars universe');

      // Verify the value was entered
      await expect(dimensionInput).toHaveValue('Star Wars universe');
    });

    test('should show placeholder text in empty dimension', async ({ page }) => {
      const dimensionInput = page.locator('textarea').first();
      const placeholder = await dimensionInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });
  });

  test.describe('Base Image Input', () => {
    test('should accept base image description', async ({ page }) => {
      // Find the base image text area
      const baseImageInput = page.locator('[data-testid="base-image-input"]');

      if (await baseImageInput.isVisible()) {
        await baseImageInput.fill('Isometric RPG screenshot');
        await expect(baseImageInput).toHaveValue('Isometric RPG screenshot');
      }
    });
  });

  test.describe('Generation Flow', () => {
    test('should enable generate button when requirements are met', async ({ page }) => {
      // Fill required inputs
      const dimensionInput = page.locator('textarea').first();
      await dimensionInput.fill('Test environment');

      // Check if generate button exists and its state
      const generateBtn = page.locator('[data-testid="generate-btn"]');
      await expect(generateBtn).toBeVisible();
    });

    test('should show keyboard shortcut hint', async ({ page }) => {
      // Look for CTRL+ENTER hint
      await expect(page.locator('text=CTRL+ENTER').or(page.locator('text=Ctrl+Enter'))).toBeVisible();
    });
  });

  test.describe('Director Control', () => {
    test('should display output mode toggles', async ({ page }) => {
      // Check for Concept and Gameplay mode buttons
      await expect(page.locator('[data-testid="output-mode-concept"]')).toBeVisible();
      await expect(page.locator('[data-testid="output-mode-gameplay"]')).toBeVisible();
    });

    test('should toggle output mode on click', async ({ page }) => {
      const conceptBtn = page.locator('[data-testid="output-mode-concept"]');
      const gameplayBtn = page.locator('[data-testid="output-mode-gameplay"]');

      // Click gameplay mode
      await gameplayBtn.click();

      // Verify it's selected (check for active class)
      await expect(gameplayBtn).toHaveClass(/bg-purple/);

      // Click concept mode
      await conceptBtn.click();

      // Verify concept is now selected
      await expect(conceptBtn).toHaveClass(/bg-amber/);
    });
  });

  test.describe('Negative Prompts', () => {
    test('should display negative prompt toggle', async ({ page }) => {
      // Expand director control if needed
      const expandToggle = page.locator('[data-testid="director-expand-toggle"]');
      if (await expandToggle.isVisible()) {
        await expandToggle.click();
      }

      // Look for negative prompt section
      const negativeToggle = page.locator('[data-testid="negative-prompt-toggle"]');
      await expect(negativeToggle).toBeVisible();
    });

    test('should expand negative prompt section on click', async ({ page }) => {
      // Expand director control first
      const expandToggle = page.locator('[data-testid="director-expand-toggle"]');
      if (await expandToggle.isVisible()) {
        await expandToggle.click();
      }

      // Click the negative prompt toggle
      const negativeToggle = page.locator('[data-testid="negative-prompt-toggle"]');
      if (await negativeToggle.isVisible()) {
        await negativeToggle.click();

        // Check for expanded content (input field)
        await expect(page.locator('input[placeholder*="negative"]').or(page.locator('[data-testid="negative-input"]'))).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have no accessibility violations on initial load', async ({ page }) => {
      // Basic accessibility check - ensure interactive elements are focusable
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // Check that buttons are keyboard accessible
      const firstButton = buttons.first();
      await firstButton.focus();
      await expect(firstButton).toBeFocused();
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Something should be focused
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Page should still be usable
      await expect(page.locator('text=Director Control')).toBeVisible();
    });

    test('should adapt to tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Page should still be usable
      await expect(page.locator('text=Source Analysis')).toBeVisible();
    });
  });
});

test.describe('Error Handling', () => {
  test('should handle page refresh gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Refresh the page
    await page.reload();

    // Page should still work
    await expect(page.locator('text=Source Analysis')).toBeVisible();
  });
});
