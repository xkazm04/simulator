/**
 * Roster Filtering & Sorting Library
 * Provides filtering, sorting, and tag-based organization for character collections.
 */

import type { Character, CharacterStatus } from '../types';

// =============================================================================
// Filter Types
// =============================================================================

export type SortField = 'name' | 'created_at' | 'updated_at' | 'quality_score' | 'reference_count';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
  label: string;
}

export interface FilterState {
  searchQuery: string;
  status: CharacterStatus | 'all';
  tags: string[];
  minQuality: number | null;
  maxQuality: number | null;
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

export interface RosterState {
  viewMode: ViewMode;
  filters: FilterState;
  sort: SortOption;
}

// =============================================================================
// Sort Options
// =============================================================================

export const SORT_OPTIONS: SortOption[] = [
  { field: 'name', direction: 'asc', label: 'Name (A-Z)' },
  { field: 'name', direction: 'desc', label: 'Name (Z-A)' },
  { field: 'created_at', direction: 'desc', label: 'Newest First' },
  { field: 'created_at', direction: 'asc', label: 'Oldest First' },
  { field: 'quality_score', direction: 'desc', label: 'Highest Quality' },
  { field: 'quality_score', direction: 'asc', label: 'Lowest Quality' },
  { field: 'reference_count', direction: 'desc', label: 'Most References' },
  { field: 'reference_count', direction: 'asc', label: 'Fewest References' },
];

export const DEFAULT_SORT: SortOption = SORT_OPTIONS[2]; // Newest First

export const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  status: 'all',
  tags: [],
  minQuality: null,
  maxQuality: null,
  dateRange: { from: null, to: null },
};

export const DEFAULT_ROSTER_STATE: RosterState = {
  viewMode: 'list',
  filters: DEFAULT_FILTERS,
  sort: DEFAULT_SORT,
};

// =============================================================================
// Tag Management
// =============================================================================

const TAGS_STORAGE_KEY = 'character-studio-tags';
const CHARACTER_TAGS_STORAGE_KEY = 'character-tags-map';

export interface TagInfo {
  name: string;
  color: string;
  count: number;
}

const TAG_COLORS = [
  '#00d4ff', // cyan
  '#ff6b9d', // pink
  '#a855f7', // purple
  '#00ff88', // green
  '#ffaa00', // amber
  '#ff5555', // red
  '#5588ff', // blue
  '#88ff88', // lime
];

/**
 * Get all available tags from local storage
 */
export function getAllTags(): TagInfo[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(TAGS_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as TagInfo[];
  } catch {
    return [];
  }
}

/**
 * Save tags to local storage
 */
export function saveTags(tags: TagInfo[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
}

/**
 * Create a new tag
 */
export function createTag(name: string): TagInfo {
  const tags = getAllTags();
  const existingTag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existingTag) return existingTag;

  const colorIndex = tags.length % TAG_COLORS.length;
  const newTag: TagInfo = {
    name: name.trim(),
    color: TAG_COLORS[colorIndex],
    count: 0,
  };

  tags.push(newTag);
  saveTags(tags);
  return newTag;
}

/**
 * Delete a tag and remove from all characters
 */
export function deleteTag(tagName: string): void {
  // Remove from tag list
  const tags = getAllTags().filter((t) => t.name !== tagName);
  saveTags(tags);

  // Remove from character mappings
  const charTags = getCharacterTagsMap();
  for (const charId of Object.keys(charTags)) {
    charTags[charId] = charTags[charId].filter((t) => t !== tagName);
  }
  saveCharacterTagsMap(charTags);
}

/**
 * Get tags for a specific character
 */
export function getCharacterTags(characterId: string): string[] {
  const charTags = getCharacterTagsMap();
  return charTags[characterId] || [];
}

/**
 * Set tags for a character
 */
export function setCharacterTags(characterId: string, tags: string[]): void {
  const charTags = getCharacterTagsMap();
  charTags[characterId] = tags;
  saveCharacterTagsMap(charTags);
  updateTagCounts();
}

/**
 * Add a tag to a character
 */
export function addTagToCharacter(characterId: string, tagName: string): void {
  const currentTags = getCharacterTags(characterId);
  if (currentTags.includes(tagName)) return;

  // Create tag if it doesn't exist
  createTag(tagName);

  // Add to character
  setCharacterTags(characterId, [...currentTags, tagName]);
}

/**
 * Remove a tag from a character
 */
export function removeTagFromCharacter(characterId: string, tagName: string): void {
  const currentTags = getCharacterTags(characterId);
  setCharacterTags(characterId, currentTags.filter((t) => t !== tagName));
}

function getCharacterTagsMap(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};

  const stored = localStorage.getItem(CHARACTER_TAGS_STORAGE_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function saveCharacterTagsMap(map: Record<string, string[]>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHARACTER_TAGS_STORAGE_KEY, JSON.stringify(map));
}

function updateTagCounts(): void {
  const charTags = getCharacterTagsMap();
  const tags = getAllTags();

  // Reset counts
  const countMap: Record<string, number> = {};
  for (const charId of Object.keys(charTags)) {
    for (const tag of charTags[charId]) {
      countMap[tag] = (countMap[tag] || 0) + 1;
    }
  }

  // Update tag counts
  const updatedTags = tags.map((t) => ({
    ...t,
    count: countMap[t.name] || 0,
  }));

  saveTags(updatedTags);
}

// =============================================================================
// Filtering Functions
// =============================================================================

/**
 * Check if a character matches the search query
 */
function matchesSearch(character: Character, query: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();

  return (
    character.name.toLowerCase().includes(lowerQuery) ||
    (character.description?.toLowerCase().includes(lowerQuery) ?? false)
  );
}

/**
 * Check if a character matches the status filter
 */
function matchesStatus(character: Character, status: CharacterStatus | 'all'): boolean {
  return status === 'all' || character.status === status;
}

/**
 * Check if a character matches the tag filter
 */
function matchesTags(characterId: string, filterTags: string[]): boolean {
  if (filterTags.length === 0) return true;
  const charTags = getCharacterTags(characterId);
  return filterTags.every((tag) => charTags.includes(tag));
}

/**
 * Check if a character matches the quality range filter
 */
function matchesQualityRange(
  character: Character,
  minQuality: number | null,
  maxQuality: number | null
): boolean {
  const quality = character.quality_score ?? 0;

  if (minQuality !== null && quality < minQuality) return false;
  if (maxQuality !== null && quality > maxQuality) return false;

  return true;
}

/**
 * Check if a character matches the date range filter
 */
function matchesDateRange(
  character: Character,
  from: string | null,
  to: string | null
): boolean {
  const createdAt = new Date(character.created_at);

  if (from && createdAt < new Date(from)) return false;
  if (to && createdAt > new Date(to)) return false;

  return true;
}

/**
 * Filter characters based on filter state
 */
export function filterCharacters(
  characters: Character[],
  filters: FilterState
): Character[] {
  return characters.filter((character) => {
    return (
      matchesSearch(character, filters.searchQuery) &&
      matchesStatus(character, filters.status) &&
      matchesTags(character.id, filters.tags) &&
      matchesQualityRange(character, filters.minQuality, filters.maxQuality) &&
      matchesDateRange(character, filters.dateRange.from, filters.dateRange.to)
    );
  });
}

// =============================================================================
// Sorting Functions
// =============================================================================

/**
 * Sort characters based on sort option
 */
export function sortCharacters(
  characters: Character[],
  sort: SortOption
): Character[] {
  const sorted = [...characters];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'updated_at':
        const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        comparison = aUpdated - bUpdated;
        break;
      case 'quality_score':
        comparison = (a.quality_score ?? 0) - (b.quality_score ?? 0);
        break;
      case 'reference_count':
        comparison = a.reference_count - b.reference_count;
        break;
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filter and sort characters in one operation
 */
export function processCharacters(
  characters: Character[],
  state: RosterState
): Character[] {
  const filtered = filterCharacters(characters, state.filters);
  return sortCharacters(filtered, state.sort);
}

// =============================================================================
// URL State Serialization (for shareable links)
// =============================================================================

/**
 * Serialize roster state to URL search params
 */
export function serializeRosterState(state: RosterState): URLSearchParams {
  const params = new URLSearchParams();

  // View mode
  params.set('view', state.viewMode);

  // Sort
  params.set('sort', state.sort.field);
  params.set('dir', state.sort.direction);

  // Filters
  if (state.filters.searchQuery) {
    params.set('q', state.filters.searchQuery);
  }
  if (state.filters.status !== 'all') {
    params.set('status', state.filters.status);
  }
  if (state.filters.tags.length > 0) {
    params.set('tags', state.filters.tags.join(','));
  }
  if (state.filters.minQuality !== null) {
    params.set('minQ', state.filters.minQuality.toString());
  }
  if (state.filters.maxQuality !== null) {
    params.set('maxQ', state.filters.maxQuality.toString());
  }
  if (state.filters.dateRange.from) {
    params.set('from', state.filters.dateRange.from);
  }
  if (state.filters.dateRange.to) {
    params.set('to', state.filters.dateRange.to);
  }

  return params;
}

/**
 * Parse roster state from URL search params
 */
export function parseRosterState(params: URLSearchParams): Partial<RosterState> {
  const state: Partial<RosterState> = {};

  // View mode
  const view = params.get('view');
  if (view === 'grid' || view === 'list') {
    state.viewMode = view;
  }

  // Sort
  const sortField = params.get('sort') as SortField | null;
  const sortDir = params.get('dir') as SortDirection | null;
  if (sortField && sortDir) {
    const matchingSort = SORT_OPTIONS.find(
      (s) => s.field === sortField && s.direction === sortDir
    );
    if (matchingSort) {
      state.sort = matchingSort;
    }
  }

  // Filters
  const filters: Partial<FilterState> = {};

  const q = params.get('q');
  if (q) filters.searchQuery = q;

  const status = params.get('status') as CharacterStatus | null;
  if (status) filters.status = status;

  const tags = params.get('tags');
  if (tags) filters.tags = tags.split(',');

  const minQ = params.get('minQ');
  if (minQ) filters.minQuality = parseFloat(minQ);

  const maxQ = params.get('maxQ');
  if (maxQ) filters.maxQuality = parseFloat(maxQ);

  const from = params.get('from');
  const to = params.get('to');
  if (from || to) {
    filters.dateRange = { from: from || null, to: to || null };
  }

  if (Object.keys(filters).length > 0) {
    state.filters = { ...DEFAULT_FILTERS, ...filters };
  }

  return state;
}

// =============================================================================
// Statistics
// =============================================================================

export interface RosterStats {
  total: number;
  byStatus: Record<CharacterStatus, number>;
  averageQuality: number;
  totalReferences: number;
  tagUsage: TagInfo[];
}

/**
 * Calculate statistics for the roster
 */
export function calculateRosterStats(characters: Character[]): RosterStats {
  const byStatus: Record<CharacterStatus, number> = {
    pending: 0,
    processing: 0,
    ready: 0,
    failed: 0,
  };

  let qualitySum = 0;
  let qualityCount = 0;
  let totalRefs = 0;

  for (const char of characters) {
    byStatus[char.status]++;
    if (char.quality_score !== null) {
      qualitySum += char.quality_score;
      qualityCount++;
    }
    totalRefs += char.reference_count;
  }

  return {
    total: characters.length,
    byStatus,
    averageQuality: qualityCount > 0 ? qualitySum / qualityCount : 0,
    totalReferences: totalRefs,
    tagUsage: getAllTags().sort((a, b) => b.count - a.count),
  };
}

// =============================================================================
// Debounced Search Helper
// =============================================================================

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
