/**
 * useAutoplayEventLog - Event logging system for autoplay activity
 *
 * Manages a log of events during autoplay for display in the activity modal.
 * Events are categorized as 'text' (prompt/dimension changes) or 'image'
 * (generation/evaluation events) for display in left/right sidebars.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { AutoplayEventType, AutoplayLogEntry, AutoplayPhase } from '../types';

const MAX_EVENTS = 100;

export interface UseAutoplayEventLogReturn {
  /** All events in the log */
  events: AutoplayLogEntry[];
  /** Events filtered to text category */
  textEvents: AutoplayLogEntry[];
  /** Events filtered to image category */
  imageEvents: AutoplayLogEntry[];
  /** Add a new event to the log */
  addEvent: (
    type: AutoplayEventType,
    message: string,
    details?: AutoplayLogEntry['details']
  ) => void;
  /** Clear all events */
  clearEvents: () => void;
  /** Get the most recent event */
  latestEvent: AutoplayLogEntry | null;
}

/**
 * Determine the category for an event type
 * Text: dimension changes, prompt generation, feedback
 * Image: generation status, evaluation, saving
 */
function getEventCategory(type: AutoplayEventType): 'text' | 'image' {
  switch (type) {
    // Text-related events
    case 'prompt_generated':
    case 'dimension_adjusted':
    case 'feedback_applied':
    case 'phase_started':
    case 'phase_completed':
    case 'iteration_complete':
      return 'text';

    // Image-related events
    case 'image_generating':
    case 'image_complete':
    case 'image_failed':
    case 'image_approved':
    case 'image_rejected':
    case 'image_saved':
    case 'poster_generating':
    case 'poster_selected':
    case 'hud_generating':
    case 'hud_complete':
    // Polish events are image-related
    case 'polish_started':
    case 'image_polished':
    case 'polish_no_improvement':
    case 'polish_error':
    case 'polish_skipped':
      return 'image';

    // Errors can appear in both, default to text
    case 'error':
    case 'timeout':
      return 'text';

    default:
      return 'text';
  }
}

export function useAutoplayEventLog(): UseAutoplayEventLogReturn {
  const [events, setEvents] = useState<AutoplayLogEntry[]>([]);

  /**
   * Add an event to the log
   */
  const addEvent = useCallback((
    type: AutoplayEventType,
    message: string,
    details?: AutoplayLogEntry['details']
  ) => {
    const entry: AutoplayLogEntry = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      type,
      category: getEventCategory(type),
      message,
      details,
    };

    setEvents(prev => {
      const updated = [...prev, entry];
      // Prune oldest events if we exceed max
      if (updated.length > MAX_EVENTS) {
        return updated.slice(-MAX_EVENTS);
      }
      return updated;
    });
  }, []);

  /**
   * Clear all events
   */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  /**
   * Filter events by category
   */
  const textEvents = useMemo(
    () => events.filter(e => e.category === 'text'),
    [events]
  );

  const imageEvents = useMemo(
    () => events.filter(e => e.category === 'image'),
    [events]
  );

  /**
   * Get the most recent event
   */
  const latestEvent = useMemo(
    () => events.length > 0 ? events[events.length - 1] : null,
    [events]
  );

  return {
    events,
    textEvents,
    imageEvents,
    addEvent,
    clearEvents,
    latestEvent,
  };
}

/**
 * Helper to create a log event callback for passing to other hooks
 */
export type LogEventCallback = (
  type: AutoplayEventType,
  message: string,
  details?: AutoplayLogEntry['details']
) => void;
