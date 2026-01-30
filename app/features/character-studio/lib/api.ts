/**
 * Character Studio - Coordinator API Client
 * Handles all communication with the hive-coordinator backend
 */

import type {
  Character,
  CharacterListResponse,
  CharacterDNA,
  CharacterRefinementStats,
  CharacterFeedback,
  CreateCharacterRequest,
  CreateCharacterResponse,
  AddReferencesRequest,
  AddReferencesResponse,
  FeedbackRequest,
  RefinementRequest,
  RefinementResponse,
  Worker,
  WorkerListResponse,
  Job,
  JobCreateResponse,
  CreateJobRequest,
  Developer,
  StudioSettings,
} from '../types';

// =============================================================================
// Settings Management
// =============================================================================

const SETTINGS_KEY = 'character-studio-settings';

export function getSettings(): StudioSettings | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StudioSettings;
  } catch {
    return null;
  }
}

export function saveSettings(settings: StudioSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SETTINGS_KEY);
}

// =============================================================================
// API Client
// =============================================================================

class CoordinatorAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'CoordinatorAPIError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const settings = getSettings();
  if (!settings?.coordinatorUrl || !settings?.apiKey) {
    throw new CoordinatorAPIError('Not configured', 401, 'Please configure API settings');
  }

  const url = `${settings.coordinatorUrl}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-Key': settings.apiKey,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new CoordinatorAPIError(
        `API request failed: ${response.status}`,
        response.status,
        errorData.detail || response.statusText
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof CoordinatorAPIError) {
      throw error;
    }
    throw new CoordinatorAPIError(
      'Network error',
      0,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// =============================================================================
// Developer API
// =============================================================================

export async function validateCredentials(): Promise<Developer> {
  return apiRequest<Developer>('/v1/developers/me');
}

export async function getDeveloperBalance(): Promise<{ credits_balance: number }> {
  return apiRequest('/v1/developers/me/balance');
}

// =============================================================================
// Character API
// =============================================================================

export async function listCharacters(
  status?: string,
  limit = 20,
  offset = 0
): Promise<CharacterListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return apiRequest<CharacterListResponse>(`/v1/characters/?${params.toString()}`);
}

export async function getCharacter(characterId: string): Promise<Character> {
  return apiRequest<Character>(`/v1/characters/${characterId}`);
}

export async function createCharacter(
  data: CreateCharacterRequest
): Promise<CreateCharacterResponse> {
  return apiRequest<CreateCharacterResponse>('/v1/characters/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCharacter(
  characterId: string,
  data: { name?: string; description?: string }
): Promise<Character> {
  return apiRequest<Character>(`/v1/characters/${characterId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCharacter(characterId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/v1/characters/${characterId}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Character DNA API
// =============================================================================

export async function getCharacterDNA(characterId: string): Promise<CharacterDNA> {
  return apiRequest<CharacterDNA>(`/v1/characters/${characterId}/dna`);
}

export async function addCharacterReferences(
  characterId: string,
  data: AddReferencesRequest
): Promise<AddReferencesResponse> {
  return apiRequest<AddReferencesResponse>(`/v1/characters/${characterId}/references`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCharacterReference(
  characterId: string,
  referenceId: string
): Promise<{ success: boolean; new_reference_count: number }> {
  return apiRequest(`/v1/characters/${characterId}/references/${referenceId}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Feedback & Refinement API
// =============================================================================

export async function submitFeedback(
  characterId: string,
  data: FeedbackRequest
): Promise<CharacterFeedback> {
  return apiRequest<CharacterFeedback>(`/v1/characters/${characterId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listFeedback(
  characterId: string,
  feedbackType?: 'approved' | 'rejected',
  limit = 20,
  offset = 0
): Promise<{ feedback: CharacterFeedback[]; total: number }> {
  const params = new URLSearchParams();
  if (feedbackType) params.set('feedback_type', feedbackType);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return apiRequest(`/v1/characters/${characterId}/feedback?${params.toString()}`);
}

export async function getRefinementStats(
  characterId: string
): Promise<CharacterRefinementStats> {
  return apiRequest<CharacterRefinementStats>(`/v1/characters/${characterId}/refinement`);
}

export async function triggerRefinement(
  characterId: string,
  data?: RefinementRequest
): Promise<RefinementResponse> {
  return apiRequest<RefinementResponse>(`/v1/characters/${characterId}/refinement`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

// =============================================================================
// Worker & Marketplace API
// =============================================================================

export async function listWorkers(
  status?: string,
  limit = 20,
  offset = 0
): Promise<WorkerListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return apiRequest<WorkerListResponse>(`/v1/marketplace/workers?${params.toString()}`);
}

export async function getMarketplaceStats(): Promise<{
  total_workers: number;
  online_workers: number;
  total_jobs_completed: number;
  average_job_time: number;
}> {
  return apiRequest('/v1/marketplace/stats');
}

// =============================================================================
// Job API
// =============================================================================

export async function createJob(data: CreateJobRequest): Promise<JobCreateResponse> {
  return apiRequest<JobCreateResponse>('/v1/jobs/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getJob(jobId: string): Promise<Job> {
  return apiRequest<Job>(`/v1/jobs/${jobId}`);
}

export async function listJobs(
  limit = 20,
  offset = 0
): Promise<{ jobs: Job[]; total: number }> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return apiRequest(`/v1/jobs/?${params.toString()}`);
}

export async function cancelJob(jobId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/v1/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
}

// =============================================================================
// Polling Utilities
// =============================================================================

export async function pollJobCompletion(
  jobId: string,
  onProgress?: (job: Job) => void,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<Job> {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await getJob(jobId);

    if (onProgress) {
      onProgress(job);
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new CoordinatorAPIError(
    'Job polling timeout',
    408,
    'Job did not complete within expected time'
  );
}

export async function pollCharacterReady(
  characterId: string,
  onProgress?: (character: Character) => void,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<Character> {
  for (let i = 0; i < maxAttempts; i++) {
    const character = await getCharacter(characterId);

    if (onProgress) {
      onProgress(character);
    }

    if (character.status === 'ready' || character.status === 'failed') {
      return character;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new CoordinatorAPIError(
    'Character polling timeout',
    408,
    'Character extraction did not complete within expected time'
  );
}

// =============================================================================
// Image Utilities
// =============================================================================

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:image/...;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function filesToBase64(files: File[]): Promise<string[]> {
  return Promise.all(files.map(fileToBase64));
}

export function base64ToImageUrl(base64: string, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

// =============================================================================
// Export API Error for external use
// =============================================================================

export { CoordinatorAPIError };

// =============================================================================
// Character Traits API (Local Storage + Mock Generation)
// =============================================================================

import type {
  CharacterTrait,
  TraitCategory,
  TraitHistoryEntry,
  CharacterTraits,
} from '../types';

const TRAITS_STORAGE_KEY_PREFIX = 'character-studio-traits-';

/**
 * Generate mock traits from DNA data
 * In production, this would come from the backend
 */
function generateTraitsFromDNA(characterId: string, dna: CharacterDNA | null): CharacterTrait[] {
  // Generate deterministic but varied traits based on character ID
  const hash = characterId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const facialTraits: CharacterTrait[] = [
    {
      id: `${characterId}-face-shape`,
      category: 'facial',
      name: 'Face Shape',
      value: ['Oval', 'Round', 'Square', 'Heart', 'Oblong'][hash % 5],
      weight: 0.9,
      confidence: 0.85 + random(hash + 1) * 0.15,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-eye-color`,
      category: 'facial',
      name: 'Eye Color',
      value: ['Brown', 'Blue', 'Green', 'Hazel', 'Gray'][(hash + 1) % 5],
      weight: 0.85,
      confidence: 0.9 + random(hash + 2) * 0.1,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-eye-shape`,
      category: 'facial',
      name: 'Eye Shape',
      value: ['Almond', 'Round', 'Hooded', 'Upturned', 'Downturned'][(hash + 2) % 5],
      weight: 0.8,
      confidence: 0.75 + random(hash + 3) * 0.2,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-nose-type`,
      category: 'facial',
      name: 'Nose Type',
      value: ['Straight', 'Roman', 'Button', 'Aquiline', 'Wide'][(hash + 3) % 5],
      weight: 0.7,
      confidence: 0.7 + random(hash + 4) * 0.25,
      editable: true,
      source: 'extracted',
    },
  ];

  const styleTraits: CharacterTrait[] = [
    {
      id: `${characterId}-hair-color`,
      category: 'style',
      name: 'Hair Color',
      value: ['Black', 'Brown', 'Blonde', 'Red', 'Gray'][(hash + 4) % 5],
      weight: 0.85,
      confidence: 0.92 + random(hash + 5) * 0.08,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-hair-style`,
      category: 'style',
      name: 'Hair Style',
      value: ['Short', 'Medium', 'Long', 'Curly', 'Wavy'][(hash + 5) % 5],
      weight: 0.75,
      confidence: 0.8 + random(hash + 6) * 0.15,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-skin-tone`,
      category: 'style',
      name: 'Skin Tone',
      value: ['Fair', 'Light', 'Medium', 'Tan', 'Dark'][(hash + 6) % 5],
      weight: 0.9,
      confidence: 0.88 + random(hash + 7) * 0.12,
      editable: true,
      source: 'extracted',
    },
  ];

  const poseTraits: CharacterTrait[] = [
    {
      id: `${characterId}-default-pose`,
      category: 'pose',
      name: 'Default Pose',
      value: ['Frontal', 'Three-quarter', 'Profile', 'Slight tilt', 'Dynamic'][(hash + 7) % 5],
      weight: 0.6,
      confidence: 0.7 + random(hash + 8) * 0.2,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-body-type`,
      category: 'pose',
      name: 'Body Type',
      value: ['Athletic', 'Slim', 'Average', 'Muscular', 'Curvy'][(hash + 8) % 5],
      weight: 0.65,
      confidence: 0.65 + random(hash + 9) * 0.25,
      editable: true,
      source: 'extracted',
    },
  ];

  const expressionTraits: CharacterTrait[] = [
    {
      id: `${characterId}-default-expression`,
      category: 'expression',
      name: 'Default Expression',
      value: ['Neutral', 'Slight smile', 'Serious', 'Confident', 'Thoughtful'][(hash + 9) % 5],
      weight: 0.5,
      confidence: 0.6 + random(hash + 10) * 0.3,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-expression-intensity`,
      category: 'expression',
      name: 'Expression Intensity',
      value: ['Subtle', 'Moderate', 'Pronounced', 'Dramatic', 'Minimal'][(hash + 10) % 5],
      weight: 0.4,
      confidence: 0.55 + random(hash + 11) * 0.35,
      editable: true,
      source: 'extracted',
    },
  ];

  const identityTraits: CharacterTrait[] = [
    {
      id: `${characterId}-age-range`,
      category: 'identity',
      name: 'Age Range',
      value: ['Young adult', 'Adult', 'Middle-aged', 'Mature', 'Elder'][(hash + 11) % 5],
      weight: 0.95,
      confidence: 0.75 + random(hash + 12) * 0.2,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-distinguishing-feature`,
      category: 'identity',
      name: 'Distinguishing Feature',
      value: ['None', 'Freckles', 'Dimples', 'Scar', 'Mole'][(hash + 12) % 5],
      weight: 0.7,
      confidence: 0.6 + random(hash + 13) * 0.3,
      editable: true,
      source: 'extracted',
    },
    {
      id: `${characterId}-facial-hair`,
      category: 'identity',
      name: 'Facial Hair',
      value: ['None', 'Stubble', 'Beard', 'Mustache', 'Goatee'][(hash + 13) % 5],
      weight: 0.75,
      confidence: 0.85 + random(hash + 14) * 0.15,
      editable: true,
      source: 'extracted',
    },
  ];

  return [
    ...facialTraits,
    ...styleTraits,
    ...poseTraits,
    ...expressionTraits,
    ...identityTraits,
  ];
}

/**
 * Load traits for a character from local storage or generate from DNA
 */
export function loadCharacterTraits(characterId: string, dna: CharacterDNA | null): CharacterTraits {
  if (typeof window === 'undefined') {
    return {
      characterId,
      version: 1,
      traits: generateTraitsFromDNA(characterId, dna),
      history: [],
      lastModified: new Date().toISOString(),
    };
  }

  const stored = localStorage.getItem(`${TRAITS_STORAGE_KEY_PREFIX}${characterId}`);
  if (stored) {
    try {
      return JSON.parse(stored) as CharacterTraits;
    } catch {
      // Fall through to generate new traits
    }
  }

  // Generate new traits from DNA
  const newTraits: CharacterTraits = {
    characterId,
    version: 1,
    traits: generateTraitsFromDNA(characterId, dna),
    history: [],
    lastModified: new Date().toISOString(),
  };

  saveCharacterTraits(newTraits);
  return newTraits;
}

/**
 * Save traits to local storage
 */
export function saveCharacterTraits(traits: CharacterTraits): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    `${TRAITS_STORAGE_KEY_PREFIX}${traits.characterId}`,
    JSON.stringify(traits)
  );
}

/**
 * Update a single trait and record history
 */
export function updateCharacterTrait(
  currentTraits: CharacterTraits,
  traitId: string,
  newValue: string,
  newWeight: number
): CharacterTraits {
  const trait = currentTraits.traits.find((t) => t.id === traitId);
  if (!trait) return currentTraits;

  // Create history entry
  const historyEntry: TraitHistoryEntry = {
    id: `${traitId}-${Date.now()}`,
    traitId,
    previousValue: trait.value,
    newValue,
    previousWeight: trait.weight,
    newWeight,
    timestamp: new Date().toISOString(),
    source: 'user',
  };

  // Update the trait
  const updatedTraits = currentTraits.traits.map((t) =>
    t.id === traitId
      ? { ...t, value: newValue, weight: newWeight, source: 'user' as const }
      : t
  );

  const updated: CharacterTraits = {
    ...currentTraits,
    version: currentTraits.version + 1,
    traits: updatedTraits,
    history: [...currentTraits.history, historyEntry],
    lastModified: new Date().toISOString(),
  };

  saveCharacterTraits(updated);
  return updated;
}

/**
 * Revert a trait to a previous state from history
 */
export function revertCharacterTrait(
  currentTraits: CharacterTraits,
  traitId: string,
  historyEntryId: string
): CharacterTraits {
  const historyEntry = currentTraits.history.find((h) => h.id === historyEntryId);
  if (!historyEntry) return currentTraits;

  const trait = currentTraits.traits.find((t) => t.id === traitId);
  if (!trait) return currentTraits;

  // Create new history entry for the revert
  const revertHistoryEntry: TraitHistoryEntry = {
    id: `${traitId}-revert-${Date.now()}`,
    traitId,
    previousValue: trait.value,
    newValue: historyEntry.previousValue,
    previousWeight: trait.weight,
    newWeight: historyEntry.previousWeight,
    timestamp: new Date().toISOString(),
    source: 'user',
  };

  // Update the trait to previous value
  const updatedTraits = currentTraits.traits.map((t) =>
    t.id === traitId
      ? {
          ...t,
          value: historyEntry.previousValue,
          weight: historyEntry.previousWeight,
          source: 'user' as const,
        }
      : t
  );

  const updated: CharacterTraits = {
    ...currentTraits,
    version: currentTraits.version + 1,
    traits: updatedTraits,
    history: [...currentTraits.history, revertHistoryEntry],
    lastModified: new Date().toISOString(),
  };

  saveCharacterTraits(updated);
  return updated;
}

/**
 * Clear all traits for a character (useful for testing or reset)
 */
export function clearCharacterTraits(characterId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${TRAITS_STORAGE_KEY_PREFIX}${characterId}`);
}
