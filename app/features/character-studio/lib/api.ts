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
