/**
 * Preference Engine - User preference learning and storage
 *
 * Learns user preferences from feedback and stores them in IndexedDB.
 * Provides methods to query preferences and apply them to prompt generation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  UserPreference,
  PreferenceProfile,
  PromptPattern,
  PromptFeedback,
  LearnedContext,
  DimensionType,
  GeneratedPrompt,
  GenerationSession,
  DimensionCombinationPattern,
  StylePreference,
  SmartSuggestion,
  EnhancedLearnedContext,
  Dimension,
} from '../types';

// IndexedDB configuration for preference storage
const DB_NAME = 'simulator_preferences_db';
const DB_VERSION = 2; // Upgraded for new stores
const PROFILE_STORE = 'preference_profiles';
const FEEDBACK_STORE = 'prompt_feedback';
const PATTERN_STORE = 'prompt_patterns';
const SESSION_STORE = 'generation_sessions';
const DIMENSION_PATTERN_STORE = 'dimension_patterns';
const STYLE_PREFERENCE_STORE = 'style_preferences';
const SUGGESTION_STORE = 'smart_suggestions';

let dbInstance: IDBDatabase | null = null;

/**
 * Check if running on client side (not SSR)
 */
function isClientSide(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Create a default profile for SSR fallback
 */
function createDefaultProfile(): PreferenceProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    preferences: [],
    patterns: [],
    totalFeedbackCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// IndexedDB Setup
// ============================================================================

function openPreferenceDB(): Promise<IDBDatabase> {
  // Guard against SSR - IndexedDB not available on server
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available on server'));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open preference database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create store for preference profiles
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        const profileStore = db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
        profileStore.createIndex('userId', 'userId', { unique: false });
      }

      // Create store for individual feedback items
      if (!db.objectStoreNames.contains(FEEDBACK_STORE)) {
        const feedbackStore = db.createObjectStore(FEEDBACK_STORE, { keyPath: 'id' });
        feedbackStore.createIndex('promptId', 'promptId', { unique: false });
        feedbackStore.createIndex('sessionId', 'sessionId', { unique: false });
        feedbackStore.createIndex('rating', 'rating', { unique: false });
        feedbackStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create store for learned patterns
      if (!db.objectStoreNames.contains(PATTERN_STORE)) {
        const patternStore = db.createObjectStore(PATTERN_STORE, { keyPath: 'id' });
        patternStore.createIndex('type', 'type', { unique: false });
        patternStore.createIndex('confidence', 'confidence', { unique: false });
      }

      // Create store for generation sessions (Phase 1: Time metrics)
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        sessionStore.createIndex('successful', 'successful', { unique: false });
      }

      // Create store for dimension combination patterns (Phase 2)
      if (!db.objectStoreNames.contains(DIMENSION_PATTERN_STORE)) {
        const dimPatternStore = db.createObjectStore(DIMENSION_PATTERN_STORE, { keyPath: 'id' });
        dimPatternStore.createIndex('successRate', 'successRate', { unique: false });
        dimPatternStore.createIndex('usageCount', 'usageCount', { unique: false });
      }

      // Create store for style preferences (Phase 2)
      if (!db.objectStoreNames.contains(STYLE_PREFERENCE_STORE)) {
        const styleStore = db.createObjectStore(STYLE_PREFERENCE_STORE, { keyPath: 'id' });
        styleStore.createIndex('category', 'category', { unique: false });
        styleStore.createIndex('strength', 'strength', { unique: false });
      }

      // Create store for smart suggestions (Phase 3)
      if (!db.objectStoreNames.contains(SUGGESTION_STORE)) {
        const suggestionStore = db.createObjectStore(SUGGESTION_STORE, { keyPath: 'id' });
        suggestionStore.createIndex('type', 'type', { unique: false });
        suggestionStore.createIndex('accepted', 'accepted', { unique: false });
        suggestionStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ============================================================================
// Preference Profile Management
// ============================================================================

const DEFAULT_PROFILE_ID = 'default-user-profile';

/**
 * Get or create the default preference profile
 */
export async function getPreferenceProfile(): Promise<PreferenceProfile> {
  // Return empty profile on server-side
  if (!isClientSide()) {
    return createDefaultProfile();
  }

  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILE_STORE], 'readonly');
    const store = transaction.objectStore(PROFILE_STORE);
    const request = store.get(DEFAULT_PROFILE_ID);

    request.onerror = () => reject(new Error('Failed to get profile'));
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        resolve(createDefaultProfile());
      }
    };
  });
}

/**
 * Save the preference profile
 */
export async function savePreferenceProfile(profile: PreferenceProfile): Promise<void> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILE_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILE_STORE);
    const request = store.put({ ...profile, updatedAt: new Date().toISOString() });

    request.onerror = () => reject(new Error('Failed to save profile'));
    request.onsuccess = () => resolve();
  });
}

// ============================================================================
// Feedback Storage
// ============================================================================

/**
 * Store feedback for a prompt
 */
export async function storeFeedback(feedback: PromptFeedback): Promise<void> {
  if (!isClientSide()) return;
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FEEDBACK_STORE], 'readwrite');
    const store = transaction.objectStore(FEEDBACK_STORE);
    const request = store.put(feedback);

    request.onerror = () => reject(new Error('Failed to store feedback'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all feedback for a specific prompt
 */
export async function getFeedbackForPrompt(promptId: string): Promise<PromptFeedback[]> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FEEDBACK_STORE], 'readonly');
    const store = transaction.objectStore(FEEDBACK_STORE);
    const index = store.index('promptId');
    const request = index.getAll(promptId);

    request.onerror = () => reject(new Error('Failed to get feedback'));
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Get all feedback (limited to most recent N items)
 */
export async function getAllFeedback(limit: number = 100): Promise<PromptFeedback[]> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FEEDBACK_STORE], 'readonly');
    const store = transaction.objectStore(FEEDBACK_STORE);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev'); // Newest first

    const results: PromptFeedback[] = [];

    request.onerror = () => reject(new Error('Failed to get feedback'));
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
  });
}

/**
 * Get feedback by rating type
 */
export async function getFeedbackByRating(rating: 'up' | 'down'): Promise<PromptFeedback[]> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FEEDBACK_STORE], 'readonly');
    const store = transaction.objectStore(FEEDBACK_STORE);
    const index = store.index('rating');
    const request = index.getAll(rating);

    request.onerror = () => reject(new Error('Failed to get feedback by rating'));
    request.onsuccess = () => resolve(request.result || []);
  });
}

// ============================================================================
// Pattern Storage
// ============================================================================

/**
 * Store or update a learned pattern
 */
export async function storePattern(pattern: PromptPattern): Promise<void> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PATTERN_STORE], 'readwrite');
    const store = transaction.objectStore(PATTERN_STORE);
    const request = store.put(pattern);

    request.onerror = () => reject(new Error('Failed to store pattern'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all patterns above a confidence threshold
 */
export async function getPatternsAboveConfidence(threshold: number = 0.5): Promise<PromptPattern[]> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PATTERN_STORE], 'readonly');
    const store = transaction.objectStore(PATTERN_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error('Failed to get patterns'));
    request.onsuccess = () => {
      const patterns = (request.result || []).filter(
        (p: PromptPattern) => p.confidence >= threshold
      );
      resolve(patterns);
    };
  });
}

/**
 * Get patterns by type
 */
export async function getPatternsByType(
  type: PromptPattern['type']
): Promise<PromptPattern[]> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PATTERN_STORE], 'readonly');
    const store = transaction.objectStore(PATTERN_STORE);
    const index = store.index('type');
    const request = index.getAll(type);

    request.onerror = () => reject(new Error('Failed to get patterns by type'));
    request.onsuccess = () => resolve(request.result || []);
  });
}

// ============================================================================
// Preference Learning
// ============================================================================

/**
 * Category mapping from element categories to preference categories
 */
const ELEMENT_TO_PREFERENCE_CATEGORY: Record<string, UserPreference['category']> = {
  composition: 'composition',
  setting: 'setting',
  subject: 'subject',
  style: 'style',
  mood: 'mood',
  lighting: 'mood',
  quality: 'quality',
};

/**
 * Learn preferences from a piece of feedback
 */
export function learnFromFeedback(
  feedback: PromptFeedback,
  prompt: GeneratedPrompt,
  existingPreferences: UserPreference[]
): UserPreference[] {
  const updatedPreferences = [...existingPreferences];
  const now = new Date().toISOString();

  // If positive rating, reinforce preferences for liked elements
  if (feedback.rating === 'up') {
    // Learn from liked elements or all elements if none specified
    const elementsToLearn = feedback.likedElements?.length
      ? prompt.elements.filter((e) => feedback.likedElements?.includes(e.id))
      : prompt.elements;

    elementsToLearn.forEach((element) => {
      const category = ELEMENT_TO_PREFERENCE_CATEGORY[element.category] || 'style';
      const existingPref = updatedPreferences.find(
        (p) => p.category === category && p.value.toLowerCase() === element.text.toLowerCase()
      );

      if (existingPref) {
        // Reinforce existing preference
        existingPref.strength = Math.min(100, existingPref.strength + 10);
        existingPref.reinforcements += 1;
        existingPref.updatedAt = now;
      } else {
        // Create new preference
        updatedPreferences.push({
          id: uuidv4(),
          category,
          value: element.text,
          strength: 30, // Start with moderate strength
          reinforcements: 1,
          source: 'inferred',
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  }

  // If negative rating, learn what to avoid
  if (feedback.rating === 'down') {
    // Learn from disliked elements or create avoid preferences
    const elementsToAvoid = feedback.dislikedElements?.length
      ? prompt.elements.filter((e) => feedback.dislikedElements?.includes(e.id))
      : [];

    elementsToAvoid.forEach((element) => {
      const existingAvoid = updatedPreferences.find(
        (p) => p.category === 'avoid' && p.value.toLowerCase() === element.text.toLowerCase()
      );

      if (existingAvoid) {
        existingAvoid.strength = Math.min(100, existingAvoid.strength + 15);
        existingAvoid.reinforcements += 1;
        existingAvoid.updatedAt = now;
      } else {
        updatedPreferences.push({
          id: uuidv4(),
          category: 'avoid',
          value: element.text,
          strength: 40,
          reinforcements: 1,
          source: 'inferred',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    // Extract keywords from text feedback to add to avoid list
    if (feedback.textFeedback) {
      const avoidKeywords = extractAvoidKeywords(feedback.textFeedback);
      avoidKeywords.forEach((keyword) => {
        const existingAvoid = updatedPreferences.find(
          (p) => p.category === 'avoid' && p.value.toLowerCase() === keyword.toLowerCase()
        );

        if (!existingAvoid) {
          updatedPreferences.push({
            id: uuidv4(),
            category: 'avoid',
            value: keyword,
            strength: 25,
            reinforcements: 1,
            source: 'explicit',
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    }
  }

  // Decay preferences that weren't reinforced (prevent stale preferences)
  return updatedPreferences.map((pref) => {
    if (pref.updatedAt !== now && pref.source === 'inferred') {
      return {
        ...pref,
        strength: Math.max(0, pref.strength - 1),
      };
    }
    return pref;
  }).filter((pref) => pref.strength > 0);
}

/**
 * Extract keywords to avoid from text feedback
 */
function extractAvoidKeywords(text: string): string[] {
  const avoidPhrases = [
    'too much', 'don\'t like', 'remove', 'less', 'no more',
    'hate', 'dislike', 'avoid', 'not', 'without',
  ];

  const keywords: string[] = [];
  const lowerText = text.toLowerCase();

  avoidPhrases.forEach((phrase) => {
    const index = lowerText.indexOf(phrase);
    if (index !== -1) {
      // Extract the word(s) after the avoid phrase
      const afterPhrase = lowerText.slice(index + phrase.length).trim();
      const words = afterPhrase.split(/[,.\s]+/).slice(0, 3);
      keywords.push(...words.filter((w) => w.length > 2));
    }
  });

  return [...new Set(keywords)];
}

/**
 * Learn patterns from a collection of feedback
 */
export function learnPatterns(
  feedbackHistory: Array<{ feedback: PromptFeedback; prompt: GeneratedPrompt }>,
  existingPatterns: PromptPattern[]
): PromptPattern[] {
  const patternMap = new Map<string, PromptPattern>();

  // Initialize with existing patterns
  existingPatterns.forEach((p) => patternMap.set(p.id, p));

  // Count element occurrences in positive vs negative prompts
  const elementCounts = new Map<string, { success: number; failure: number }>();

  feedbackHistory.forEach(({ feedback, prompt }) => {
    if (!feedback.rating) return;

    prompt.elements.forEach((element) => {
      const key = `${element.category}:${element.text.toLowerCase()}`;
      const counts = elementCounts.get(key) || { success: 0, failure: 0 };

      if (feedback.rating === 'up') {
        counts.success += 1;
      } else {
        counts.failure += 1;
      }

      elementCounts.set(key, counts);
    });
  });

  // Convert counts to patterns
  elementCounts.forEach((counts, key) => {
    const total = counts.success + counts.failure;

    if (total >= 3) { // Only create patterns with enough data
      const confidence = counts.success / total;
      const existingPattern = [...patternMap.values()].find(
        (p) => p.type === 'element_combination' && p.value === key
      );

      if (existingPattern) {
        existingPattern.successCount = counts.success;
        existingPattern.failureCount = counts.failure;
        existingPattern.confidence = confidence;
        existingPattern.updatedAt = new Date().toISOString();
      } else {
        const newPattern: PromptPattern = {
          id: uuidv4(),
          type: 'element_combination',
          value: key,
          successCount: counts.success,
          failureCount: counts.failure,
          confidence,
          updatedAt: new Date().toISOString(),
        };
        patternMap.set(newPattern.id, newPattern);
      }
    }
  });

  return [...patternMap.values()];
}

// ============================================================================
// Preference Application
// ============================================================================

/**
 * Build learned context for prompt generation
 */
export function buildLearnedContext(profile: PreferenceProfile): LearnedContext {
  const preferences = profile.preferences.filter((p) => p.strength >= 20);
  const patterns = profile.patterns.filter((p) => p.confidence >= 0.6);

  // Extract avoid elements
  const avoidElements = preferences
    .filter((p) => p.category === 'avoid')
    .map((p) => p.value);

  // Extract elements to emphasize (high-strength preferences)
  const emphasizeElements = preferences
    .filter((p) => p.category !== 'avoid' && p.strength >= 60)
    .map((p) => p.value);

  // Build dimension adjustments from style preferences
  const dimensionAdjustments: LearnedContext['dimensionAdjustments'] = [];

  const stylePrefs = preferences.filter((p) => p.category === 'style' && p.strength >= 50);
  if (stylePrefs.length > 0) {
    dimensionAdjustments.push({
      type: 'artStyle' as DimensionType,
      adjustment: stylePrefs.map((p) => p.value).join(', '),
      reason: 'User prefers these style elements',
    });
  }

  const moodPrefs = preferences.filter((p) => p.category === 'mood' && p.strength >= 50);
  if (moodPrefs.length > 0) {
    dimensionAdjustments.push({
      type: 'mood' as DimensionType,
      adjustment: moodPrefs.map((p) => p.value).join(', '),
      reason: 'User prefers these mood elements',
    });
  }

  return {
    preferences,
    patterns,
    avoidElements,
    emphasizeElements,
    dimensionAdjustments,
  };
}

/**
 * Score a prompt based on learned preferences
 * Returns a score from 0-100 indicating how well the prompt matches user preferences
 */
export function scorePromptWithPreferences(
  prompt: GeneratedPrompt,
  profile: PreferenceProfile
): number {
  let score = 50; // Start neutral
  const preferences = profile.preferences;

  prompt.elements.forEach((element) => {
    const matchingPref = preferences.find(
      (p) => p.value.toLowerCase() === element.text.toLowerCase()
    );

    if (matchingPref) {
      if (matchingPref.category === 'avoid') {
        // Penalize for avoided elements
        score -= matchingPref.strength * 0.3;
      } else {
        // Reward for preferred elements
        score += matchingPref.strength * 0.2;
      }
    }
  });

  // Check patterns
  profile.patterns.forEach((pattern) => {
    if (pattern.type === 'element_combination') {
      const [, value] = pattern.value.split(':');
      const hasElement = prompt.elements.some(
        (e) => e.text.toLowerCase() === value
      );

      if (hasElement) {
        // High-confidence patterns influence score
        score += (pattern.confidence - 0.5) * 20;
      }
    }
  });

  return Math.max(0, Math.min(100, score));
}

/**
 * Add explicit preference (from user action)
 */
export async function addExplicitPreference(
  category: UserPreference['category'],
  value: string,
  strength: number = 50
): Promise<void> {
  const profile = await getPreferenceProfile();
  const now = new Date().toISOString();

  const existingPref = profile.preferences.find(
    (p) => p.category === category && p.value.toLowerCase() === value.toLowerCase()
  );

  if (existingPref) {
    existingPref.strength = Math.min(100, existingPref.strength + strength);
    existingPref.reinforcements += 1;
    existingPref.source = 'explicit';
    existingPref.updatedAt = now;
  } else {
    profile.preferences.push({
      id: uuidv4(),
      category,
      value,
      strength,
      reinforcements: 1,
      source: 'explicit',
      createdAt: now,
      updatedAt: now,
    });
  }

  await savePreferenceProfile(profile);
}

/**
 * Remove a preference
 */
export async function removePreference(preferenceId: string): Promise<void> {
  const profile = await getPreferenceProfile();
  profile.preferences = profile.preferences.filter((p) => p.id !== preferenceId);
  await savePreferenceProfile(profile);
}

/**
 * Clear all preferences and patterns (reset learning)
 */
export async function clearAllLearning(): Promise<void> {
  const profile = await getPreferenceProfile();
  profile.preferences = [];
  profile.patterns = [];
  profile.totalFeedbackCount = 0;
  profile.positiveCount = 0;
  profile.negativeCount = 0;
  await savePreferenceProfile(profile);

  // Clear feedback store
  const db = await openPreferenceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FEEDBACK_STORE, PATTERN_STORE], 'readwrite');
    transaction.objectStore(FEEDBACK_STORE).clear();
    transaction.objectStore(PATTERN_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to clear learning data'));
  });
}

/**
 * Process feedback and update all learning systems
 */
export async function processFeedback(
  feedback: PromptFeedback,
  prompt: GeneratedPrompt
): Promise<PreferenceProfile> {
  if (!isClientSide()) {
    return createDefaultProfile();
  }
  // Store the feedback
  await storeFeedback(feedback);

  // Get current profile
  const profile = await getPreferenceProfile();

  // Update counts
  profile.totalFeedbackCount += 1;
  if (feedback.rating === 'up') {
    profile.positiveCount += 1;
  } else if (feedback.rating === 'down') {
    profile.negativeCount += 1;
  }

  // Learn preferences from this feedback
  profile.preferences = learnFromFeedback(feedback, prompt, profile.preferences);

  // Get all feedback for pattern learning (limit to recent 50)
  const allFeedback = await getAllFeedback(50);

  // We need to reconstruct prompts for pattern learning
  // For now, just update patterns based on this single feedback
  if (allFeedback.length >= 5) {
    // We have enough data to potentially learn patterns
    // This is simplified - in production you'd want to store prompt data with feedback
    profile.patterns = learnPatterns(
      [{ feedback, prompt }],
      profile.patterns
    );
  }

  // Save patterns
  for (const pattern of profile.patterns) {
    await storePattern(pattern);
  }

  // Save updated profile
  await savePreferenceProfile(profile);

  return profile;
}

/**
 * Export preferences as JSON (for backup/sharing)
 */
export async function exportPreferences(): Promise<string> {
  const profile = await getPreferenceProfile();
  const feedback = await getAllFeedback(1000);
  const patterns = await getPatternsAboveConfidence(0);

  return JSON.stringify({
    profile,
    feedback,
    patterns,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * Import preferences from JSON
 */
export async function importPreferences(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);

  if (data.profile) {
    await savePreferenceProfile(data.profile);
  }

  if (data.feedback) {
    for (const fb of data.feedback) {
      await storeFeedback(fb);
    }
  }

  if (data.patterns) {
    for (const pattern of data.patterns) {
      await storePattern(pattern);
    }
  }
}

// ============================================================================
// Phase 1: Enhanced Feedback Collection - Session & Time Tracking
// ============================================================================

let activeSession: GenerationSession | null = null;

/**
 * Start a new generation session for tracking time-to-satisfaction
 */
export function startGenerationSession(
  dimensions: Dimension[],
  baseImage: string,
  outputMode: 'gameplay' | 'concept' | 'poster'
): GenerationSession {
  const session: GenerationSession = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    iterationCount: 0,
    dimensionsSnapshot: dimensions.map((d) => ({
      type: d.type,
      reference: d.reference,
      weight: d.weight,
      filterMode: d.filterMode,
      transformMode: d.transformMode,
    })),
    baseImageSnapshot: baseImage,
    outputMode,
    successful: false,
    promptIds: [],
  };
  activeSession = session;
  return session;
}

/**
 * Record a generation iteration in the current session
 */
export function recordGenerationIteration(promptIds: string[]): void {
  if (activeSession) {
    activeSession.iterationCount += 1;
    activeSession.promptIds.push(...promptIds);
  }
}

/**
 * Mark the current session as satisfied (positive outcome)
 */
export async function markSessionSatisfied(
  feedback?: { positive: string; negative: string }
): Promise<GenerationSession | null> {
  if (!activeSession) return null;

  const now = new Date();
  activeSession.satisfiedAt = now.toISOString();
  activeSession.timeToSatisfaction =
    now.getTime() - new Date(activeSession.startedAt).getTime();
  activeSession.successful = true;
  activeSession.finalFeedback = feedback;

  await storeSession(activeSession);
  const completedSession = activeSession;
  activeSession = null;
  return completedSession;
}

/**
 * End session without satisfaction (abandoned or negative)
 */
export async function endSessionUnsuccessful(
  feedback?: { positive: string; negative: string }
): Promise<GenerationSession | null> {
  if (!activeSession) return null;

  activeSession.successful = false;
  activeSession.finalFeedback = feedback;

  await storeSession(activeSession);
  const completedSession = activeSession;
  activeSession = null;
  return completedSession;
}

/**
 * Get the current active session
 */
export function getActiveSession(): GenerationSession | null {
  return activeSession;
}

/**
 * Store a generation session in IndexedDB
 */
async function storeSession(session: GenerationSession): Promise<void> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSION_STORE], 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.put(session);

    request.onerror = () => reject(new Error('Failed to store session'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get recent successful sessions for learning
 * Note: We filter in JS because IndexedDB doesn't support boolean keys
 */
export async function getSuccessfulSessions(limit: number = 50): Promise<GenerationSession[]> {
  if (!isClientSide()) return [];
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SESSION_STORE], 'readonly');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error('Failed to get sessions'));
    request.onsuccess = () => {
      const sessions = (request.result || [])
        .filter((s: GenerationSession) => s.successful === true)
        .sort((a: GenerationSession, b: GenerationSession) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, limit);
      resolve(sessions);
    };
  });
}

/**
 * Calculate average time-to-satisfaction
 */
export async function getAverageTimeToSatisfaction(): Promise<{
  avgTime: number | null;
  avgIterations: number | null;
  sampleSize: number;
}> {
  const sessions = await getSuccessfulSessions(100);

  if (sessions.length === 0) {
    return { avgTime: null, avgIterations: null, sampleSize: 0 };
  }

  const timeSessions = sessions.filter((s) => s.timeToSatisfaction != null);
  const avgTime =
    timeSessions.length > 0
      ? timeSessions.reduce((sum, s) => sum + (s.timeToSatisfaction || 0), 0) / timeSessions.length
      : null;

  const avgIterations =
    sessions.reduce((sum, s) => sum + s.iterationCount, 0) / sessions.length;

  return {
    avgTime,
    avgIterations,
    sampleSize: sessions.length,
  };
}

// ============================================================================
// Phase 2: Enhanced Pattern Recognition - Dimension Combinations
// ============================================================================

/**
 * Learn dimension combination patterns from successful sessions
 */
export async function learnDimensionCombinations(): Promise<DimensionCombinationPattern[]> {
  if (!isClientSide()) return [];
  const sessions = await getSuccessfulSessions(100);
  const patternMap = new Map<string, DimensionCombinationPattern>();

  for (const session of sessions) {
    // Create a key from sorted dimension types
    const dimTypes = session.dimensionsSnapshot
      .map((d) => d.type)
      .sort()
      .join('|');

    const existing = patternMap.get(dimTypes);

    if (existing) {
      existing.usageCount += 1;
      existing.successfulReferences.push(
        ...session.dimensionsSnapshot.map((d) => d.reference).filter((r) => r)
      );
      // Update average weights
      for (const dim of session.dimensionsSnapshot) {
        if (existing.avgSuccessfulWeights[dim.type] != null) {
          existing.avgSuccessfulWeights[dim.type] =
            (existing.avgSuccessfulWeights[dim.type] + dim.weight) / 2;
        } else {
          existing.avgSuccessfulWeights[dim.type] = dim.weight;
        }
      }
      existing.updatedAt = new Date().toISOString();
    } else {
      const avgWeights: Record<DimensionType, number> = {} as Record<DimensionType, number>;
      for (const dim of session.dimensionsSnapshot) {
        avgWeights[dim.type] = dim.weight;
      }

      patternMap.set(dimTypes, {
        id: uuidv4(),
        dimensionTypes: session.dimensionsSnapshot.map((d) => d.type),
        successfulReferences: session.dimensionsSnapshot.map((d) => d.reference).filter((r) => r),
        successRate: 1, // Will be calculated when we have failure data
        usageCount: 1,
        avgSuccessfulWeights: avgWeights,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Store patterns
  const patterns = [...patternMap.values()];
  for (const pattern of patterns) {
    await storeDimensionPattern(pattern);
  }

  return patterns;
}

/**
 * Store a dimension combination pattern
 */
async function storeDimensionPattern(pattern: DimensionCombinationPattern): Promise<void> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DIMENSION_PATTERN_STORE], 'readwrite');
    const store = transaction.objectStore(DIMENSION_PATTERN_STORE);
    const request = store.put(pattern);

    request.onerror = () => reject(new Error('Failed to store dimension pattern'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get dimension patterns above a usage threshold
 */
export async function getDimensionPatterns(minUsage: number = 2): Promise<DimensionCombinationPattern[]> {
  if (!isClientSide()) return [];
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DIMENSION_PATTERN_STORE], 'readonly');
    const store = transaction.objectStore(DIMENSION_PATTERN_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error('Failed to get dimension patterns'));
    request.onsuccess = () => {
      const patterns = (request.result || []).filter(
        (p: DimensionCombinationPattern) => p.usageCount >= minUsage
      );
      resolve(patterns);
    };
  });
}

/**
 * Learn style preferences from prompt elements
 */
export async function learnStylePreferences(
  prompt: GeneratedPrompt,
  rating: 'up' | 'down'
): Promise<void> {
  const styleCategories: Record<string, StylePreference['category']> = {
    lighting: 'lighting',
    cinematic: 'lighting',
    dramatic: 'lighting',
    soft: 'lighting',
    render: 'rendering',
    realistic: 'rendering',
    stylized: 'rendering',
    'hand-painted': 'rendering',
    composition: 'composition',
    'wide shot': 'composition',
    'close-up': 'composition',
    portrait: 'composition',
    color: 'color',
    vibrant: 'color',
    muted: 'color',
    monochrome: 'color',
    texture: 'texture',
    detailed: 'detail',
    intricate: 'detail',
  };

  const db = await openPreferenceDB();

  for (const element of prompt.elements) {
    const lowerText = element.text.toLowerCase();

    for (const [keyword, category] of Object.entries(styleCategories)) {
      if (lowerText.includes(keyword)) {
        // Check if we already have this style preference
        const existing = await getStylePreference(category, element.text);

        if (existing) {
          if (rating === 'up') {
            existing.positiveAssociations += 1;
          } else {
            existing.negativeAssociations += 1;
          }
          existing.strength = Math.round(
            (existing.positiveAssociations /
              (existing.positiveAssociations + existing.negativeAssociations)) *
              100
          );
          existing.updatedAt = new Date().toISOString();
          await storeStylePreference(existing);
        } else {
          const newPref: StylePreference = {
            id: uuidv4(),
            category,
            value: element.text,
            strength: rating === 'up' ? 60 : 40,
            positiveAssociations: rating === 'up' ? 1 : 0,
            negativeAssociations: rating === 'down' ? 1 : 0,
            sourceDimensions: [],
            updatedAt: new Date().toISOString(),
          };
          await storeStylePreference(newPref);
        }
        break; // Only categorize once per element
      }
    }
  }
}

/**
 * Get a specific style preference
 */
async function getStylePreference(
  category: StylePreference['category'],
  value: string
): Promise<StylePreference | null> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STYLE_PREFERENCE_STORE], 'readonly');
    const store = transaction.objectStore(STYLE_PREFERENCE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error('Failed to get style preference'));
    request.onsuccess = () => {
      const prefs = request.result || [];
      const match = prefs.find(
        (p: StylePreference) =>
          p.category === category && p.value.toLowerCase() === value.toLowerCase()
      );
      resolve(match || null);
    };
  });
}

/**
 * Store a style preference
 */
async function storeStylePreference(pref: StylePreference): Promise<void> {
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STYLE_PREFERENCE_STORE], 'readwrite');
    const store = transaction.objectStore(STYLE_PREFERENCE_STORE);
    const request = store.put(pref);

    request.onerror = () => reject(new Error('Failed to store style preference'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all style preferences above a strength threshold
 */
export async function getStylePreferences(minStrength: number = 50): Promise<StylePreference[]> {
  if (!isClientSide()) return [];
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STYLE_PREFERENCE_STORE], 'readonly');
    const store = transaction.objectStore(STYLE_PREFERENCE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error('Failed to get style preferences'));
    request.onsuccess = () => {
      const prefs = (request.result || []).filter(
        (p: StylePreference) => p.strength >= minStrength
      );
      resolve(prefs);
    };
  });
}

// ============================================================================
// Phase 3: Smart Suggestions
// ============================================================================

/**
 * Generate smart suggestions based on user history and current context
 */
export async function generateSmartSuggestions(
  currentDimensions: Dimension[],
  baseImageDescription: string
): Promise<SmartSuggestion[]> {
  // Return empty on server-side
  if (!isClientSide()) {
    return [];
  }

  const suggestions: SmartSuggestion[] = [];
  const profile = await getPreferenceProfile();
  const dimensionPatterns = await getDimensionPatterns(2);
  const stylePrefs = await getStylePreferences(60);
  const sessions = await getSuccessfulSessions(20);

  // Suggestion 1: Recommend dimension types based on successful patterns
  if (dimensionPatterns.length > 0) {
    const currentTypes = new Set(currentDimensions.map((d) => d.type));
    const successfulPatterns = dimensionPatterns.sort((a, b) => b.usageCount - a.usageCount);

    for (const pattern of successfulPatterns.slice(0, 3)) {
      for (const dimType of pattern.dimensionTypes) {
        if (!currentTypes.has(dimType)) {
          suggestions.push({
            id: uuidv4(),
            type: 'dimension',
            suggestion: `Add ${dimType} dimension`,
            reason: `This dimension type appears in ${pattern.usageCount} of your successful generations`,
            confidence: Math.min(0.9, pattern.usageCount / 10 + 0.5),
            data: {
              dimensionType: dimType,
              weight: pattern.avgSuccessfulWeights[dimType] || 50,
            },
            shown: false,
            createdAt: new Date().toISOString(),
          });
          break; // Only one suggestion per pattern
        }
      }
    }
  }

  // Suggestion 2: Recommend weights based on successful patterns
  for (const dim of currentDimensions) {
    const relevantPatterns = dimensionPatterns.filter((p) =>
      p.dimensionTypes.includes(dim.type)
    );

    if (relevantPatterns.length > 0) {
      const avgWeight =
        relevantPatterns.reduce((sum, p) => sum + (p.avgSuccessfulWeights[dim.type] || 50), 0) /
        relevantPatterns.length;

      if (Math.abs(dim.weight - avgWeight) > 15) {
        suggestions.push({
          id: uuidv4(),
          type: 'weight',
          suggestion: `Adjust ${dim.type} weight to ${Math.round(avgWeight)}%`,
          reason: `Your successful generations typically use this weight`,
          confidence: 0.7,
          data: {
            dimensionType: dim.type,
            weight: Math.round(avgWeight),
          },
          shown: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // Suggestion 3: Recommend negative prompts based on avoid list
  const avoidPrefs = profile.preferences.filter((p) => p.category === 'avoid' && p.strength >= 40);
  if (avoidPrefs.length > 0) {
    const negativePrompt = avoidPrefs
      .slice(0, 5)
      .map((p) => p.value)
      .join(', ');

    suggestions.push({
      id: uuidv4(),
      type: 'negative_prompt',
      suggestion: `Add negative prompt: "${negativePrompt}"`,
      reason: `Based on elements you've rated negatively`,
      confidence: 0.8,
      data: {
        negativePrompt,
      },
      shown: false,
      createdAt: new Date().toISOString(),
    });
  }

  // Suggestion 4: Output mode based on history
  if (sessions.length >= 5) {
    const modeCount: Record<string, number> = {};
    for (const session of sessions) {
      modeCount[session.outputMode] = (modeCount[session.outputMode] || 0) + 1;
    }

    const mostUsedMode = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0];
    if (mostUsedMode && mostUsedMode[1] >= sessions.length * 0.6) {
      suggestions.push({
        id: uuidv4(),
        type: 'output_mode',
        suggestion: `Try ${mostUsedMode[0]} mode`,
        reason: `You've had success with this mode ${mostUsedMode[1]} times`,
        confidence: 0.6,
        data: {
          outputMode: mostUsedMode[0] as 'gameplay' | 'concept' | 'poster',
        },
        shown: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Sort by confidence and return top suggestions
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Record suggestion acceptance/rejection
 */
export async function recordSuggestionResponse(
  suggestionId: string,
  accepted: boolean
): Promise<void> {
  if (!isClientSide()) return;
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SUGGESTION_STORE], 'readwrite');
    const store = transaction.objectStore(SUGGESTION_STORE);
    const getRequest = store.get(suggestionId);

    getRequest.onerror = () => reject(new Error('Failed to get suggestion'));
    getRequest.onsuccess = () => {
      const suggestion = getRequest.result;
      if (suggestion) {
        suggestion.accepted = accepted;
        suggestion.shown = true;
        const putRequest = store.put(suggestion);
        putRequest.onerror = () => reject(new Error('Failed to update suggestion'));
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
}

/**
 * Store a suggestion
 */
export async function storeSuggestion(suggestion: SmartSuggestion): Promise<void> {
  if (!isClientSide()) return;
  const db = await openPreferenceDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SUGGESTION_STORE], 'readwrite');
    const store = transaction.objectStore(SUGGESTION_STORE);
    const request = store.put(suggestion);

    request.onerror = () => reject(new Error('Failed to store suggestion'));
    request.onsuccess = () => resolve();
  });
}

// ============================================================================
// Phase 4: Enhanced Learned Context for Adaptive Generation
// ============================================================================

/**
 * Build enhanced learned context with all Phase 1-4 features
 */
export async function buildEnhancedLearnedContext(
  currentDimensions: Dimension[]
): Promise<EnhancedLearnedContext> {
  const profile = await getPreferenceProfile();
  const baseContext = buildLearnedContext(profile);
  const dimensionPatterns = await getDimensionPatterns(2);
  const stylePrefs = await getStylePreferences(50);
  const sessions = await getSuccessfulSessions(20);

  // Calculate recommended weights from successful patterns
  const recommendedWeights: Record<DimensionType, number> = {} as Record<DimensionType, number>;
  for (const dim of currentDimensions) {
    const relevantPatterns = dimensionPatterns.filter((p) =>
      p.dimensionTypes.includes(dim.type)
    );
    if (relevantPatterns.length > 0) {
      recommendedWeights[dim.type] =
        relevantPatterns.reduce((sum, p) => sum + (p.avgSuccessfulWeights[dim.type] || 50), 0) /
        relevantPatterns.length;
    }
  }

  // Generate negative prompts from avoid preferences
  const suggestedNegativePrompts = profile.preferences
    .filter((p) => p.category === 'avoid' && p.strength >= 40)
    .map((p) => p.value);

  // Identify elements to auto-lock based on high-strength preferences
  const autoLockElements = profile.preferences
    .filter((p) => p.category !== 'avoid' && p.strength >= 80)
    .map((p) => p.value);

  // Calculate confidence based on data availability
  const hasEnoughData = profile.totalFeedbackCount >= 5;
  const confidence = hasEnoughData
    ? Math.min(0.9, profile.totalFeedbackCount / 20 + dimensionPatterns.length / 10)
    : 0.3;

  return {
    ...baseContext,
    suggestedNegativePrompts,
    recommendedWeights,
    autoLockElements,
    confidence,
    hasEnoughData,
    successfulCombinations: dimensionPatterns,
    stylePreferences: stylePrefs,
  };
}

/**
 * Get personalized negative prompts based on user history
 */
export async function getPersonalizedNegativePrompts(): Promise<string[]> {
  const profile = await getPreferenceProfile();

  return profile.preferences
    .filter((p) => p.category === 'avoid' && p.strength >= 30)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10)
    .map((p) => p.value);
}
