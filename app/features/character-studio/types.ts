/**
 * Character Studio - Type Definitions
 * Types for the Character Foundry UI
 */

// =============================================================================
// API Types (matching coordinator schemas)
// =============================================================================

export type CharacterStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface CharacterReference {
  id: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  face_quality: number | null;
  width: number | null;
  height: number | null;
}

export interface Character {
  id: string;
  name: string;
  description: string | null;
  status: CharacterStatus;
  quality_score: number | null;
  reference_count: number;
  primary_thumbnail_url: string | null;
  created_at: string;
  updated_at?: string;
  references?: CharacterReference[];
  extra_data?: Record<string, unknown>;
}

export interface CharacterListResponse {
  characters: Character[];
  total: number;
}

export interface CharacterDNA {
  character_id: string;
  version: string;
  face_embedding: string; // base64
  style_embedding: string | null; // base64
  pose_data: {
    keypoints?: number[][];
    orientations?: number[];
  } | null;
  extra_data: Record<string, unknown>;
}

export interface CharacterRefinementStats {
  refinement_count: number;
  approved_count: number;
  rejected_count: number;
  generation_count: number;
  dna_version: number;
  refinement_score: number | null;
  last_refined_at: string | null;
  approval_rate: number | null;
}

export interface CharacterFeedback {
  id: string;
  character_id: string;
  job_id: string | null;
  feedback_type: 'approved' | 'rejected';
  similarity_score: number | null;
  used_for_refinement: boolean;
  created_at: string;
}

// =============================================================================
// Worker & Job Types
// =============================================================================

export type WorkerStatus = 'online' | 'busy' | 'offline';

export interface Worker {
  id: string;
  name: string;
  gpu_model: string;
  vram_gb: number;
  status: WorkerStatus;
  avg_generation_time: number;
  price_per_job: number;
  jobs_completed: number;
  rating: number | null;
}

export interface WorkerListResponse {
  workers: Worker[];
  total: number;
}

export type JobStatus = 'pending' | 'assigned' | 'accepted' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface Job {
  id: string;
  status: JobStatus;
  model: string;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  sampler: string;
  estimated_credits: number;
  actual_credits: number | null;
  retry_count: number;
  character_id: string | null;
  character_weight: number | null;
  error_message: string | null;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
  generation_time_ms: number | null;
}

// Response from job creation (includes WebRTC signaling info)
export interface JobCreateResponse {
  id: string;
  status: JobStatus;
  estimated_credits: number;
  signaling_ws_url: string;
  signaling_token: string;
  ice_servers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

// =============================================================================
// Studio Settings
// =============================================================================

export interface StudioSettings {
  coordinatorUrl: string;
  apiKey: string;
  developerName?: string;
  developerId?: string;
  defaultWorkerTier?: string;
}

// =============================================================================
// UI State Types
// =============================================================================

export type ViewMode = 'portrait' | 'constellation' | 'comparison' | 'job-test';

export interface StudioState {
  selectedCharacterId: string | null;
  viewMode: ViewMode;
  isSettingsOpen: boolean;
  isWizardOpen: boolean;
  isSidebarCollapsed: boolean;
  isInspectorCollapsed: boolean;
}

// =============================================================================
// Generation Presets
// =============================================================================

export type PresetType = 'portrait' | 'action' | 'scene' | 'concept';

export interface GenerationPreset {
  id: PresetType;
  label: string;
  icon: string;
  promptTemplate: string;
  characterWeight: number;
  cfgScale: number;
  description: string;
}

export const GENERATION_PRESETS: GenerationPreset[] = [
  {
    id: 'portrait',
    label: 'Portrait',
    icon: '🎯',
    promptTemplate: 'professional portrait photo of {name}, studio lighting, detailed face',
    characterWeight: 0.9,
    cfgScale: 7.5,
    description: 'High-fidelity portrait with maximum face consistency',
  },
  {
    id: 'action',
    label: 'Action',
    icon: '🎭',
    promptTemplate: '{name} in dynamic action pose, motion blur, cinematic',
    characterWeight: 0.75,
    cfgScale: 8.0,
    description: 'Dynamic pose with moderate face consistency',
  },
  {
    id: 'scene',
    label: 'Scene',
    icon: '🌄',
    promptTemplate: '{name} in {scene}, environmental lighting, atmosphere',
    characterWeight: 0.8,
    cfgScale: 7.0,
    description: 'Character in environment with balanced consistency',
  },
  {
    id: 'concept',
    label: 'Concept',
    icon: '🎨',
    promptTemplate: 'concept art of {name}, detailed illustration, artistic style',
    characterWeight: 0.85,
    cfgScale: 9.0,
    description: 'Artistic interpretation with style preservation',
  },
];

// =============================================================================
// DNA Visualization Types
// =============================================================================

export interface DNANode {
  index: number;
  value: number;
  normalizedValue: number; // 0-1 for visualization
  strand: 'face' | 'style';
}

export interface HelixConfig {
  nodeCount: number;
  rotationSpeed: number; // seconds per rotation
  helixRadius: number;
  helixHeight: number;
  nodeSize: number;
  faceColor: string;
  styleColor: string;
  connectionColor: string;
}

export const DEFAULT_HELIX_CONFIG: HelixConfig = {
  nodeCount: 20,
  rotationSpeed: 20,
  helixRadius: 40,
  helixHeight: 200,
  nodeSize: 6,
  faceColor: '#00d4ff',
  styleColor: '#ff6b9d',
  connectionColor: 'rgba(255,255,255,0.2)',
};

// =============================================================================
// Radar Chart Types
// =============================================================================

export interface RadarMetric {
  id: string;
  label: string;
  value: number; // 0-100
  color: string;
}

export interface ConsistencyMetrics {
  faceConsistency: number;
  styleCoherence: number;
  poseVariety: number;
  qualityScore: number;
  refinementMaturity: number;
}

// =============================================================================
// Creation Wizard Types
// =============================================================================

export type WizardStep = 'name' | 'upload' | 'quality' | 'confirm';

export interface WizardState {
  step: WizardStep;
  name: string;
  description: string;
  images: File[];
  imagePreviews: string[];
  isProcessing: boolean;
  error: string | null;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CreateCharacterRequest {
  name: string;
  description?: string;
  reference_images: string[]; // base64
}

export interface CreateCharacterResponse {
  id: string;
  name: string;
  status: CharacterStatus;
  reference_count: number;
  estimated_completion_seconds: number;
}

export interface AddReferencesRequest {
  images: string[]; // base64
}

export interface AddReferencesResponse {
  added_count: number;
  new_reference_count: number;
  status: CharacterStatus;
}

export interface FeedbackRequest {
  job_id: string;
  feedback_type: 'approved' | 'rejected';
  image_hash: string;
  image_data?: string; // base64, required for approved
}

export interface RefinementRequest {
  min_similarity?: number;
  max_feedback_count?: number;
}

export interface RefinementResponse {
  success: boolean;
  feedback_processed: number;
  new_dna_version: number;
  new_refinement_score: number | null;
  message: string;
}

export interface CreateJobRequest {
  prompt?: string;
  model: string;
  width: number;
  height: number;
  steps: number;
  developer_pubkey: string;
  cfg_scale?: number;
  sampler?: string;
  prompt_hash?: string;
  is_nsfw?: boolean;
  callback_url?: string;
  payload_url?: string;
  character_id?: string;
  character_weight?: number;
  worker_id?: string;
}

// =============================================================================
// Developer Types
// =============================================================================

export interface Developer {
  id: string;
  email: string;
  name: string;
  credits_balance: number;
  created_at: string;
}

// =============================================================================
// Trait System Types
// =============================================================================

export type TraitCategory = 'facial' | 'style' | 'pose' | 'expression' | 'identity';

export interface CharacterTrait {
  id: string;
  category: TraitCategory;
  name: string;
  value: string;
  weight: number; // 0-1, importance for generation
  confidence: number; // 0-1, how confident the system is about this trait
  editable: boolean;
  source: 'extracted' | 'user' | 'refined';
}

export interface TraitHistoryEntry {
  id: string;
  traitId: string;
  previousValue: string;
  newValue: string;
  previousWeight: number;
  newWeight: number;
  timestamp: string;
  source: 'user' | 'refinement';
}

export interface CharacterTraits {
  characterId: string;
  version: number;
  traits: CharacterTrait[];
  history: TraitHistoryEntry[];
  lastModified: string;
}

export interface UpdateTraitRequest {
  traitId: string;
  value?: string;
  weight?: number;
}

export interface UpdateTraitsResponse {
  success: boolean;
  updatedTraits: CharacterTrait[];
  newVersion: number;
}

export const TRAIT_CATEGORY_INFO: Record<TraitCategory, { label: string; icon: string; color: string }> = {
  facial: { label: 'Facial Features', icon: 'Scan', color: '#00d4ff' },
  style: { label: 'Visual Style', icon: 'Palette', color: '#ff6b9d' },
  pose: { label: 'Pose & Body', icon: 'Move', color: '#a855f7' },
  expression: { label: 'Expression', icon: 'Smile', color: '#00ff88' },
  identity: { label: 'Identity Markers', icon: 'Fingerprint', color: '#ffaa00' },
};
