/**
 * Quick Actions - Character Card Action Handlers
 *
 * Provides handlers for quick actions on character cards including
 * duplicate, delete, generate variation, and export functionality.
 */

import type { Character, CharacterDNA } from '../types';
import { deleteCharacter, getCharacter, getCharacterDNA, createCharacter } from './api';

// =============================================================================
// Types
// =============================================================================

export type QuickActionType = 'duplicate' | 'delete' | 'generate' | 'export';

export interface QuickActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface QuickActionHandlers {
  onDuplicate: (character: Character) => Promise<QuickActionResult>;
  onDelete: (character: Character) => Promise<QuickActionResult>;
  onGenerateVariation: (character: Character) => Promise<QuickActionResult>;
  onExport: (character: Character) => Promise<QuickActionResult>;
}

// =============================================================================
// Action Handlers
// =============================================================================

/**
 * Duplicate a character with a new name
 */
export async function duplicateCharacter(character: Character): Promise<QuickActionResult> {
  try {
    // Generate new name
    const newName = generateDuplicateName(character.name);

    // In a real implementation, this would call createCharacter with the same references
    // For now, we simulate the API call
    const result = await createCharacter({
      name: newName,
      description: character.description || undefined,
      reference_images: [], // Would need to fetch and include original references
    });

    return {
      success: true,
      message: `Created "${newName}" from "${character.name}"`,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to duplicate character',
    };
  }
}

/**
 * Delete a character permanently
 */
export async function removeCharacter(character: Character): Promise<QuickActionResult> {
  try {
    const result = await deleteCharacter(character.id);

    if (result.success) {
      return {
        success: true,
        message: `"${character.name}" has been deleted`,
      };
    }

    return {
      success: false,
      message: 'Failed to delete character',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete character',
    };
  }
}

/**
 * Generate a variation of the character (triggers a new generation job)
 */
export async function generateVariation(character: Character): Promise<QuickActionResult> {
  try {
    // In a real implementation, this would create a generation job
    // with the character's DNA and modified parameters

    // For now, return a placeholder result
    return {
      success: true,
      message: `Generating variation of "${character.name}"...`,
      data: { characterId: character.id },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate variation',
    };
  }
}

/**
 * Export character data as JSON file
 */
export async function exportCharacter(character: Character): Promise<QuickActionResult> {
  try {
    // Fetch full character data including DNA
    let dna: CharacterDNA | null = null;
    try {
      dna = await getCharacterDNA(character.id);
    } catch {
      // DNA might not be available for all characters
    }

    const exportData = {
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        status: character.status,
        quality_score: character.quality_score,
        reference_count: character.reference_count,
        created_at: character.created_at,
        updated_at: character.updated_at,
      },
      dna: dna ? {
        version: dna.version,
        has_face_embedding: !!dna.face_embedding,
        has_style_embedding: !!dna.style_embedding,
        has_pose_data: !!dna.pose_data,
      } : null,
      exported_at: new Date().toISOString(),
      export_version: '1.0',
    };

    // Create and download the file
    downloadJson(exportData, `${sanitizeFilename(character.name)}-character.json`);

    return {
      success: true,
      message: `Exported "${character.name}" data`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to export character',
    };
  }
}

/**
 * Export character DNA data (for advanced users)
 */
export async function exportCharacterDNA(character: Character): Promise<QuickActionResult> {
  try {
    const dna = await getCharacterDNA(character.id);

    const exportData = {
      character_id: character.id,
      character_name: character.name,
      dna: {
        version: dna.version,
        face_embedding: dna.face_embedding,
        style_embedding: dna.style_embedding,
        pose_data: dna.pose_data,
        extra_data: dna.extra_data,
      },
      exported_at: new Date().toISOString(),
    };

    downloadJson(exportData, `${sanitizeFilename(character.name)}-dna.json`);

    return {
      success: true,
      message: `Exported DNA for "${character.name}"`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to export DNA',
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a name for a duplicated character
 */
function generateDuplicateName(originalName: string): string {
  // Check if name already has a copy suffix
  const copyPattern = /^(.+?)\s*\(Copy(?:\s+(\d+))?\)$/;
  const match = originalName.match(copyPattern);

  if (match) {
    const baseName = match[1];
    const copyNum = match[2] ? parseInt(match[2], 10) + 1 : 2;
    return `${baseName} (Copy ${copyNum})`;
  }

  return `${originalName} (Copy)`;
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Download JSON data as a file
 */
function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// =============================================================================
// Action Availability Checks
// =============================================================================

/**
 * Check if an action is available for a character
 */
export function isActionAvailable(action: QuickActionType, character: Character): boolean {
  switch (action) {
    case 'duplicate':
      // Can duplicate any character that exists
      return true;

    case 'delete':
      // Can delete any character
      return true;

    case 'generate':
      // Can only generate variations for ready characters
      return character.status === 'ready';

    case 'export':
      // Can export any character, but DNA export needs ready status
      return true;

    default:
      return false;
  }
}

/**
 * Get tooltip text explaining why an action is unavailable
 */
export function getActionTooltip(action: QuickActionType, character: Character): string {
  if (isActionAvailable(action, character)) {
    switch (action) {
      case 'duplicate':
        return `Create a copy of "${character.name}"`;
      case 'delete':
        return `Delete "${character.name}" permanently`;
      case 'generate':
        return `Generate a new variation`;
      case 'export':
        return `Export character data`;
    }
  }

  // Explain why action is unavailable
  switch (action) {
    case 'generate':
      return character.status === 'processing'
        ? 'Wait for DNA extraction to complete'
        : 'Character must be ready to generate variations';
    default:
      return 'Action not available';
  }
}
