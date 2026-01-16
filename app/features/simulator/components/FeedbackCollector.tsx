/**
 * FeedbackCollector - Rich feedback capture UI component
 *
 * Provides a detailed feedback interface that captures:
 * - Thumbs up/down rating
 * - Optional text feedback
 * - Element-specific likes/dislikes (click on elements)
 *
 * Design: Clean Manuscript style with semantic colors
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  X,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { GeneratedPrompt, PromptFeedback } from '../types';
import { semanticColors } from '../lib/semanticColors';
import { expandCollapse, transitions } from '../lib/motion';
import { processFeedback } from '../lib/preferenceEngine';

interface FeedbackCollectorProps {
  prompt: GeneratedPrompt;
  onFeedbackSubmit?: (feedback: PromptFeedback) => void;
  onRatingChange?: (promptId: string, rating: 'up' | 'down' | null) => void;
  sessionId?: string;
  compact?: boolean;
}

export function FeedbackCollector({
  prompt,
  onFeedbackSubmit,
  onRatingChange,
  sessionId,
  compact = false,
}: FeedbackCollectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [textFeedback, setTextFeedback] = useState('');
  const [likedElements, setLikedElements] = useState<Set<string>>(new Set());
  const [dislikedElements, setDislikedElements] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle rating change
  const handleRating = useCallback(
    (rating: 'up' | 'down') => {
      const newRating = prompt.rating === rating ? null : rating;
      onRatingChange?.(prompt.id, newRating);

      // Expand for detailed feedback on first rating
      if (newRating && !isExpanded) {
        setIsExpanded(true);
      }
    },
    [prompt.id, prompt.rating, onRatingChange, isExpanded]
  );

  // Toggle element like/dislike
  const handleElementToggle = useCallback(
    (elementId: string, type: 'like' | 'dislike') => {
      if (type === 'like') {
        setLikedElements((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(elementId)) {
            newSet.delete(elementId);
          } else {
            newSet.add(elementId);
            // Remove from dislikes if present
            setDislikedElements((d) => {
              const newD = new Set(d);
              newD.delete(elementId);
              return newD;
            });
          }
          return newSet;
        });
      } else {
        setDislikedElements((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(elementId)) {
            newSet.delete(elementId);
          } else {
            newSet.add(elementId);
            // Remove from likes if present
            setLikedElements((l) => {
              const newL = new Set(l);
              newL.delete(elementId);
              return newL;
            });
          }
          return newSet;
        });
      }
    },
    []
  );

  // Submit detailed feedback
  const handleSubmit = useCallback(async () => {
    if (!prompt.rating) return;

    setIsSubmitting(true);

    try {
      const feedback: PromptFeedback = {
        id: uuidv4(),
        promptId: prompt.id,
        rating: prompt.rating,
        textFeedback: textFeedback.trim() || undefined,
        likedElements: likedElements.size > 0 ? [...likedElements] : undefined,
        dislikedElements: dislikedElements.size > 0 ? [...dislikedElements] : undefined,
        createdAt: new Date().toISOString(),
        sessionId,
      };

      // Process feedback for learning
      await processFeedback(feedback, prompt);

      // Notify parent
      onFeedbackSubmit?.(feedback);

      // Show success and reset
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsExpanded(false);
        setTextFeedback('');
        setLikedElements(new Set());
        setDislikedElements(new Set());
      }, 1500);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    prompt,
    textFeedback,
    likedElements,
    dislikedElements,
    sessionId,
    onFeedbackSubmit,
  ]);

  // Close without submitting
  const handleClose = useCallback(() => {
    setIsExpanded(false);
    setTextFeedback('');
    setLikedElements(new Set());
    setDislikedElements(new Set());
  }, []);

  if (compact) {
    // Compact mode: just rating buttons
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleRating('up')}
          className={`p-1 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50
            ${prompt.rating === 'up'
              ? `${semanticColors.success.bg} ${semanticColors.success.text}`
              : 'text-slate-500 hover:text-green-400 hover:bg-green-500/10'
            }`}
          title="Thumbs up"
        >
          <ThumbsUp size={14} />
        </button>
        <button
          onClick={() => handleRating('down')}
          className={`p-1 radius-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50
            ${prompt.rating === 'down'
              ? `${semanticColors.error.bg} ${semanticColors.error.text}`
              : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
            }`}
          title="Thumbs down"
        >
          <ThumbsDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Rating row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleRating('up')}
          className={`flex items-center gap-1.5 px-2 py-1 radius-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50
            ${prompt.rating === 'up'
              ? `${semanticColors.success.bg} ${semanticColors.success.border} ${semanticColors.success.text} border`
              : 'text-slate-500 hover:text-green-400 hover:bg-green-500/10 border border-transparent'
            }`}
          title="This prompt worked well"
        >
          <ThumbsUp size={14} />
          <span className="type-label">Good</span>
        </button>

        <button
          onClick={() => handleRating('down')}
          className={`flex items-center gap-1.5 px-2 py-1 radius-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50
            ${prompt.rating === 'down'
              ? `${semanticColors.error.bg} ${semanticColors.error.border} ${semanticColors.error.text} border`
              : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent'
            }`}
          title="This prompt needs improvement"
        >
          <ThumbsDown size={14} />
          <span className="type-label">Needs work</span>
        </button>

        {prompt.rating && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-cyan-400 transition-colors type-label focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 radius-sm"
            title="Add more details"
          >
            <MessageSquare size={12} />
            <span>Tell us more</span>
          </button>
        )}
      </div>

      {/* Expanded feedback form */}
      <AnimatePresence>
        {isExpanded && prompt.rating && (
          <motion.div
            variants={expandCollapse}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div
              className={`p-3 radius-md border ${
                prompt.rating === 'up'
                  ? `${semanticColors.success.bg} ${semanticColors.success.border}`
                  : `${semanticColors.error.bg} ${semanticColors.error.border}`
              }`}
            >
              {/* Success message */}
              {showSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 py-4 text-green-400"
                >
                  <Sparkles size={20} />
                  <span className="type-body">Thanks! We&apos;ll learn from this.</span>
                </motion.div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="type-label text-slate-300">
                      {prompt.rating === 'up'
                        ? 'What did you like?'
                        : 'What should be different?'}
                    </span>
                    <button
                      onClick={handleClose}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 radius-sm"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Element selection */}
                  <div className="mb-3">
                    <span className="type-label text-slate-500 mb-2 block">
                      Click elements to {prompt.rating === 'up' ? 'highlight what worked' : 'mark for change'}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {prompt.elements.map((element) => {
                        const isLiked = likedElements.has(element.id);
                        const isDisliked = dislikedElements.has(element.id);

                        return (
                          <button
                            key={element.id}
                            onClick={() =>
                              handleElementToggle(
                                element.id,
                                prompt.rating === 'up' ? 'like' : 'dislike'
                              )
                            }
                            className={`px-2 py-1 radius-sm type-label transition-all focus:outline-none focus-visible:ring-2
                              ${isLiked
                                ? `${semanticColors.success.bg} ${semanticColors.success.border} ${semanticColors.success.text} border`
                                : isDisliked
                                ? `${semanticColors.error.bg} ${semanticColors.error.border} ${semanticColors.error.text} border`
                                : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:border-slate-600'
                              }`}
                            title={element.category}
                          >
                            {element.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Text feedback */}
                  <div className="mb-3">
                    <textarea
                      value={textFeedback}
                      onChange={(e) => setTextFeedback(e.target.value)}
                      placeholder={
                        prompt.rating === 'up'
                          ? 'What made this prompt work well? (optional)'
                          : 'What would you change? e.g., "too dark", "need more detail"'
                      }
                      className="w-full h-16 bg-slate-900/50 border border-slate-700/50 radius-md p-2 type-body-sm placeholder-slate-600 resize-none focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50"
                    />
                  </div>

                  {/* Submit button */}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleClose}
                      className="px-3 py-1.5 type-label text-slate-400 hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 radius-sm"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 radius-md type-label flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2
                        ${prompt.rating === 'up'
                          ? `${semanticColors.success.bg} ${semanticColors.success.text} hover:bg-green-500/30 focus-visible:ring-green-500/50`
                          : `${semanticColors.error.bg} ${semanticColors.error.text} hover:bg-red-500/30 focus-visible:ring-red-500/50`
                        }
                        ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check size={12} />
                          <span>Submit feedback</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FeedbackCollector;
