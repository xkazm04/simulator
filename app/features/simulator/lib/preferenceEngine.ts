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
} from '../types';

// IndexedDB configuration for preference storage
const DB_NAME = 'simulator_preferences_db';
const DB_VERSION = 1;
const PROFILE_STORE = 'preference_profiles';
const FEEDBACK_STORE = 'prompt_feedback';
const PATTERN_STORE = 'prompt_patterns';

let dbInstance: IDBDatabase | null = null;

// ============================================================================
// IndexedDB Setup
// ============================================================================

function openPreferenceDB(): Promise<IDBDatabase> {
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
        // Create default profile
        const defaultProfile: PreferenceProfile = {
          id: DEFAULT_PROFILE_ID,
          preferences: [],
          patterns: [],
          totalFeedbackCount: 0,
          positiveCount: 0,
          negativeCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        resolve(defaultProfile);
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
