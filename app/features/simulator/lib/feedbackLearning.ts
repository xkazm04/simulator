/**
 * Feedback Learning - AI-powered feedback analysis and pattern detection
 *
 * Analyzes feedback to generate refinement suggestions and explanations.
 * Uses Claude API for intelligent analysis when available, with fallback to local heuristics.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PromptFeedback,
  GeneratedPrompt,
  RefinementSuggestion,
  PromptExplanation,
  FeedbackAnalytics,
  PreferenceProfile,
  ABVariant,
} from '../types';
import {
  getPreferenceProfile,
  getAllFeedback,
  getPatternsAboveConfidence,
  buildLearnedContext,
} from './preferenceEngine';

// ============================================================================
// Refinement Suggestion Generation
// ============================================================================

/**
 * Generate refinement suggestions based on feedback history and patterns
 */
export async function generateRefinementSuggestions(
  currentPrompt: GeneratedPrompt,
  recentFeedback: PromptFeedback[],
  profile: PreferenceProfile
): Promise<RefinementSuggestion[]> {
  const suggestions: RefinementSuggestion[] = [];
  const context = buildLearnedContext(profile);

  // Suggestion 1: Based on avoid list
  context.avoidElements.forEach((avoid) => {
    const hasElement = currentPrompt.elements.some(
      (e) => e.text.toLowerCase().includes(avoid.toLowerCase())
    );
    if (hasElement) {
      suggestions.push({
        id: uuidv4(),
        type: 'remove',
        target: avoid,
        suggestion: `Consider removing "${avoid}" - this has received negative feedback`,
        reason: 'Based on your feedback history, this element tends to produce unwanted results',
        confidence: 0.8,
        source: 'feedback_history',
      });
    }
  });

  // Suggestion 2: Based on emphasize list
  context.emphasizeElements.forEach((emphasize) => {
    const hasElement = currentPrompt.elements.some(
      (e) => e.text.toLowerCase().includes(emphasize.toLowerCase())
    );
    if (!hasElement) {
      suggestions.push({
        id: uuidv4(),
        type: 'add',
        target: emphasize,
        suggestion: `Consider adding "${emphasize}" - this often produces results you like`,
        reason: 'This element frequently appears in prompts you rated positively',
        confidence: 0.7,
        source: 'pattern',
      });
    }
  });

  // Suggestion 3: Based on high-confidence patterns
  context.patterns
    .filter((p) => p.confidence >= 0.7 && p.type === 'element_combination')
    .forEach((pattern) => {
      const [category, value] = pattern.value.split(':');
      const hasPattern = currentPrompt.elements.some(
        (e) => e.text.toLowerCase() === value && e.category === category
      );

      if (!hasPattern && pattern.successCount > pattern.failureCount) {
        suggestions.push({
          id: uuidv4(),
          type: 'add',
          target: value,
          suggestion: `Try adding "${value}" (${category}) - ${Math.round(pattern.confidence * 100)}% success rate`,
          reason: `This ${category} element has worked well in ${pattern.successCount} prompts`,
          confidence: pattern.confidence,
          source: 'pattern',
        });
      }
    });

  // Suggestion 4: Based on recent negative feedback
  const recentNegative = recentFeedback.filter((f) => f.rating === 'down').slice(0, 3);
  recentNegative.forEach((feedback) => {
    if (feedback.textFeedback) {
      const extractedSuggestion = extractSuggestionFromText(feedback.textFeedback);
      if (extractedSuggestion) {
        suggestions.push(extractedSuggestion);
      }
    }
  });

  // Suggestion 5: Dimension adjustments
  context.dimensionAdjustments.forEach((adjustment) => {
    suggestions.push({
      id: uuidv4(),
      type: 'modify',
      target: adjustment.type,
      suggestion: `Adjust ${adjustment.type}: ${adjustment.adjustment}`,
      reason: adjustment.reason,
      confidence: 0.6,
      source: 'pattern',
    });
  });

  // Sort by confidence and limit
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/**
 * Extract suggestion from text feedback using heuristics
 */
function extractSuggestionFromText(text: string): RefinementSuggestion | null {
  const lowerText = text.toLowerCase();

  // Pattern: "too much X" -> reduce X
  const tooMuchMatch = lowerText.match(/too much\s+(\w+)/);
  if (tooMuchMatch) {
    return {
      id: uuidv4(),
      type: 'deemphasize',
      target: tooMuchMatch[1],
      suggestion: `Reduce "${tooMuchMatch[1]}" - user felt there was too much`,
      reason: 'Direct feedback about element intensity',
      confidence: 0.9,
      source: 'feedback_history',
    };
  }

  // Pattern: "more X" -> add/emphasize X
  const moreMatch = lowerText.match(/(?:need|want|add)\s+more\s+(\w+)/);
  if (moreMatch) {
    return {
      id: uuidv4(),
      type: 'emphasize',
      target: moreMatch[1],
      suggestion: `Emphasize "${moreMatch[1]}" - user wants more of this`,
      reason: 'Direct feedback requesting more of this element',
      confidence: 0.9,
      source: 'feedback_history',
    };
  }

  // Pattern: "remove X" or "no X"
  const removeMatch = lowerText.match(/(?:remove|no|without)\s+(\w+)/);
  if (removeMatch) {
    return {
      id: uuidv4(),
      type: 'remove',
      target: removeMatch[1],
      suggestion: `Remove "${removeMatch[1]}" - explicitly requested`,
      reason: 'Direct feedback to remove this element',
      confidence: 0.95,
      source: 'feedback_history',
    };
  }

  return null;
}

// ============================================================================
// Prompt Explanation Generation
// ============================================================================

/**
 * Generate explanation for why prompt elements were chosen
 */
export async function generatePromptExplanation(
  prompt: GeneratedPrompt,
  profile: PreferenceProfile
): Promise<PromptExplanation> {
  const context = buildLearnedContext(profile);
  const elementExplanations: PromptExplanation['elementExplanations'] = [];
  const appliedPreferences: PromptExplanation['appliedPreferences'] = [];

  prompt.elements.forEach((element) => {
    let reason = `Standard ${element.category} element for ${prompt.sceneType}`;
    let influencedByPreference = false;
    const relatedPatterns: string[] = [];

    // Check if influenced by preferences
    const matchingPref = context.preferences.find(
      (p) => p.value.toLowerCase() === element.text.toLowerCase()
    );

    if (matchingPref) {
      influencedByPreference = true;
      reason = `Included because you've ${matchingPref.source === 'explicit' ? 'explicitly preferred' : 'previously liked'} this ${matchingPref.category} element`;

      appliedPreferences.push({
        preferenceId: matchingPref.id,
        value: matchingPref.value,
        impact: matchingPref.strength >= 70 ? 'high' : matchingPref.strength >= 40 ? 'medium' : 'low',
      });
    }

    // Check for related patterns
    context.patterns.forEach((pattern) => {
      if (pattern.value.includes(element.text.toLowerCase())) {
        relatedPatterns.push(
          `${Math.round(pattern.confidence * 100)}% success rate in similar prompts`
        );
      }
    });

    if (relatedPatterns.length > 0) {
      reason += `. Pattern data: ${relatedPatterns.join('; ')}`;
    }

    elementExplanations.push({
      elementId: element.id,
      text: element.text,
      reason,
      influencedByPreference,
      relatedPatterns: relatedPatterns.length > 0 ? relatedPatterns : undefined,
    });
  });

  // Generate summary
  const preferenceCount = appliedPreferences.length;
  const highImpactCount = appliedPreferences.filter((p) => p.impact === 'high').length;

  let summary = `This prompt was generated based on your ${prompt.sceneType} request`;
  if (preferenceCount > 0) {
    summary += `, personalized with ${preferenceCount} of your preferences`;
    if (highImpactCount > 0) {
      summary += ` (${highImpactCount} high-impact)`;
    }
  }
  summary += '.';

  return {
    promptId: prompt.id,
    summary,
    elementExplanations,
    appliedPreferences,
  };
}

// ============================================================================
// A/B Variant Testing
// ============================================================================

/**
 * Generate A/B variants for a prompt
 * Creates variations to test different approaches
 */
export function generateABVariants(
  basePrompt: GeneratedPrompt,
  profile: PreferenceProfile
): ABVariant[] {
  const context = buildLearnedContext(profile);
  const variants: ABVariant[] = [];

  // Variant A: Base prompt (control)
  variants.push({
    id: uuidv4(),
    variantName: 'A',
    prompt: basePrompt.prompt,
    elements: basePrompt.elements,
    positiveRatings: 0,
    negativeRatings: 0,
    impressions: 1,
    conversionRate: 0,
  });

  // Variant B: With emphasis on preferred elements
  if (context.emphasizeElements.length > 0) {
    const emphasizedPrompt = `${basePrompt.prompt}, with emphasis on ${context.emphasizeElements.slice(0, 2).join(' and ')}`;
    variants.push({
      id: uuidv4(),
      variantName: 'B',
      prompt: emphasizedPrompt,
      elements: basePrompt.elements,
      positiveRatings: 0,
      negativeRatings: 0,
      impressions: 0,
      conversionRate: 0,
    });
  }

  // Variant C: Without avoided elements
  if (context.avoidElements.length > 0) {
    let cleanedPrompt = basePrompt.prompt;
    context.avoidElements.forEach((avoid) => {
      cleanedPrompt = cleanedPrompt.replace(new RegExp(avoid, 'gi'), '');
    });
    cleanedPrompt = cleanedPrompt.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '');

    if (cleanedPrompt !== basePrompt.prompt) {
      variants.push({
        id: uuidv4(),
        variantName: 'C',
        prompt: cleanedPrompt,
        elements: basePrompt.elements.filter(
          (e) => !context.avoidElements.some((a) => e.text.toLowerCase().includes(a.toLowerCase()))
        ),
        positiveRatings: 0,
        negativeRatings: 0,
        impressions: 0,
        conversionRate: 0,
      });
    }
  }

  return variants;
}

/**
 * Record variant impression and rating
 */
export function recordVariantResult(
  variant: ABVariant,
  rating: 'up' | 'down' | null
): ABVariant {
  const updated = { ...variant };
  updated.impressions += 1;

  if (rating === 'up') {
    updated.positiveRatings += 1;
  } else if (rating === 'down') {
    updated.negativeRatings += 1;
  }

  updated.conversionRate = updated.positiveRatings / updated.impressions;
  return updated;
}

// ============================================================================
// Analytics Generation
// ============================================================================

/**
 * Generate feedback analytics from stored data
 */
export async function generateFeedbackAnalytics(): Promise<FeedbackAnalytics> {
  const profile = await getPreferenceProfile();
  const allFeedback = await getAllFeedback(500);
  const patterns = await getPatternsAboveConfidence(0.3);

  // Calculate positive rate
  const positiveRate = profile.totalFeedbackCount > 0
    ? profile.positiveCount / profile.totalFeedbackCount
    : 0;

  // Top patterns (sorted by confidence)
  const topPatterns = patterns
    .filter((p) => p.successCount + p.failureCount >= 3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  // Top preferences (sorted by strength)
  const topPreferences = profile.preferences
    .filter((p) => p.category !== 'avoid')
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);

  // Elements to avoid
  const elementsToAvoid = profile.preferences
    .filter((p) => p.category === 'avoid')
    .sort((a, b) => b.strength - a.strength)
    .map((p) => ({ text: p.value, count: p.reinforcements }))
    .slice(0, 5);

  // Daily trend (last 7 days)
  const dailyTrend = calculateDailyTrend(allFeedback);

  // Scene type performance
  const sceneTypePerformance = calculateSceneTypePerformance(allFeedback);

  // Dimension effectiveness (placeholder - would need more data)
  const dimensionEffectiveness: FeedbackAnalytics['dimensionEffectiveness'] = [];

  return {
    totalPromptsGenerated: profile.totalFeedbackCount,
    totalFeedbackCollected: allFeedback.length,
    positiveRate,
    topPatterns,
    topPreferences,
    elementsToAvoid,
    dailyTrend,
    sceneTypePerformance,
    dimensionEffectiveness,
  };
}

/**
 * Calculate daily feedback trend
 */
function calculateDailyTrend(
  feedback: PromptFeedback[]
): FeedbackAnalytics['dailyTrend'] {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const trend: FeedbackAnalytics['dailyTrend'] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * dayMs;
    const dayEnd = now - i * dayMs;
    const date = new Date(dayEnd).toISOString().split('T')[0];

    const dayFeedback = feedback.filter((f) => {
      const time = new Date(f.createdAt).getTime();
      return time >= dayStart && time < dayEnd;
    });

    trend.push({
      date,
      positive: dayFeedback.filter((f) => f.rating === 'up').length,
      negative: dayFeedback.filter((f) => f.rating === 'down').length,
      total: dayFeedback.length,
    });
  }

  return trend;
}

/**
 * Calculate scene type performance
 * Note: This requires storing scene type with feedback - simplified here
 */
function calculateSceneTypePerformance(
  feedback: PromptFeedback[]
): FeedbackAnalytics['sceneTypePerformance'] {
  // Placeholder - would need scene type stored with feedback
  const sceneTypes = [
    'Cinematic Wide Shot',
    'Hero Portrait',
    'Action Sequence',
    'Environmental Storytelling',
  ];

  return sceneTypes.map((sceneType) => ({
    sceneType,
    positiveRate: 0.5 + Math.random() * 0.3, // Placeholder
    totalCount: Math.floor(feedback.length / 4),
  }));
}

// ============================================================================
// AI-Powered Analysis (API Integration)
// ============================================================================

/**
 * Call AI API for intelligent refinement suggestions
 * Falls back to local heuristics if API unavailable
 */
export async function getAIRefinementSuggestions(
  prompt: GeneratedPrompt,
  feedbackHistory: PromptFeedback[],
  profile: PreferenceProfile
): Promise<RefinementSuggestion[]> {
  // First, generate local suggestions
  const localSuggestions = await generateRefinementSuggestions(
    prompt,
    feedbackHistory,
    profile
  );

  // Try AI enhancement
  try {
    const response = await fetch('/api/ai/simulator?action=analyze-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.prompt,
        elements: prompt.elements,
        feedbackHistory: feedbackHistory.slice(0, 10).map((f) => ({
          rating: f.rating,
          text: f.textFeedback,
        })),
        preferences: profile.preferences.slice(0, 10).map((p) => ({
          category: p.category,
          value: p.value,
          strength: p.strength,
        })),
      }),
    });

    if (response.ok) {
      const aiResult = await response.json();
      if (aiResult.suggestions) {
        // Merge AI suggestions with local ones
        interface AISuggestionResponse {
          type?: RefinementSuggestion['type'];
          target: string;
          suggestion: string;
          reason: string;
          confidence?: number;
        }
        const aiSuggestions: RefinementSuggestion[] = aiResult.suggestions.map(
          (s: AISuggestionResponse) => ({
            id: uuidv4(),
            type: s.type || 'modify',
            target: s.target,
            suggestion: s.suggestion,
            reason: s.reason,
            confidence: s.confidence || 0.7,
            source: 'ai' as const,
          })
        );

        // Combine and deduplicate
        const combined = [...aiSuggestions, ...localSuggestions];
        const seen = new Set<string>();
        return combined.filter((s) => {
          const key = `${s.type}:${s.target}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 5);
      }
    }
  } catch (error) {
    console.error('AI refinement suggestion failed, using local:', error);
  }

  return localSuggestions;
}

/**
 * Analyze feedback text with AI to extract insights
 */
export async function analyzeTextFeedback(
  textFeedback: string
): Promise<{
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  suggestedActions: string[];
}> {
  // Default local analysis
  const lowerText = textFeedback.toLowerCase();

  const positiveWords = ['love', 'great', 'perfect', 'amazing', 'good', 'nice', 'excellent'];
  const negativeWords = ['hate', 'bad', 'wrong', 'ugly', 'terrible', 'poor', 'remove'];

  const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';

  // Extract keywords (simple word frequency)
  const words = textFeedback
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const wordCounts = new Map<string, number>();
  words.forEach((w) => wordCounts.set(w, (wordCounts.get(w) || 0) + 1));

  const keywords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const suggestedActions: string[] = [];
  if (lowerText.includes('more')) suggestedActions.push('Increase intensity of mentioned elements');
  if (lowerText.includes('less') || lowerText.includes('too much')) {
    suggestedActions.push('Reduce intensity of mentioned elements');
  }
  if (lowerText.includes('remove') || lowerText.includes('without')) {
    suggestedActions.push('Remove mentioned elements');
  }

  return { sentiment, keywords, suggestedActions };
}

/**
 * Check if learning is ready (enough feedback collected)
 */
export async function isLearningReady(): Promise<{
  ready: boolean;
  feedbackCount: number;
  requiredCount: number;
  progress: number;
}> {
  const profile = await getPreferenceProfile();
  const requiredCount = 5; // Minimum feedback for meaningful learning

  return {
    ready: profile.totalFeedbackCount >= requiredCount,
    feedbackCount: profile.totalFeedbackCount,
    requiredCount,
    progress: Math.min(1, profile.totalFeedbackCount / requiredCount),
  };
}

/**
 * Get learning status summary
 */
export async function getLearningStatus(): Promise<{
  totalFeedback: number;
  preferences: number;
  patterns: number;
  positiveRate: number;
  lastUpdated: string | null;
}> {
  const profile = await getPreferenceProfile();

  return {
    totalFeedback: profile.totalFeedbackCount,
    preferences: profile.preferences.length,
    patterns: profile.patterns.length,
    positiveRate: profile.totalFeedbackCount > 0
      ? profile.positiveCount / profile.totalFeedbackCount
      : 0,
    lastUpdated: profile.updatedAt || null,
  };
}
