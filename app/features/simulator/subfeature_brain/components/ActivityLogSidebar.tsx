/**
 * ActivityLogSidebar - Scrollable log display for autoplay events
 *
 * Displays events in a scrollable sidebar with:
 * - Auto-scroll to bottom on new events
 * - Color-coded event types
 * - Timestamp display
 * - Expandable details for events with extra info
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Image,
  RefreshCw,
  Zap,
  Wand2,
} from 'lucide-react';
import { AutoplayLogEntry, AutoplayEventType } from '../../types';
import { fadeIn, transitions } from '../../lib/motion';
import { semanticColors } from '../../lib/semanticColors';

export interface ActivityLogSidebarProps {
  title: string;
  events: AutoplayLogEntry[];
  side: 'left' | 'right';
  emptyMessage: string;
}

/**
 * Get color classes for an event type
 */
function getEventColors(type: AutoplayEventType): {
  icon: string;
  text: string;
  bg: string;
} {
  switch (type) {
    // Success events (green)
    case 'image_approved':
    case 'image_saved':
    case 'image_complete':
    case 'poster_selected':
    case 'hud_complete':
    case 'phase_completed':
    case 'image_polished': // Polish success
      return {
        icon: semanticColors.success.text,
        text: 'text-green-300',
        bg: semanticColors.success.bg,
      };

    // Error events (red)
    case 'image_failed':
    case 'image_rejected':
    case 'error':
    case 'timeout':
    case 'polish_error': // Polish failure
      return {
        icon: semanticColors.error.text,
        text: 'text-red-300',
        bg: semanticColors.error.bg,
      };

    // Processing events (purple)
    case 'image_generating':
    case 'poster_generating':
    case 'hud_generating':
    case 'polish_started': // Polish in progress
      return {
        icon: semanticColors.processing.text,
        text: 'text-purple-300',
        bg: semanticColors.processing.bg,
      };

    // Info events (cyan)
    case 'prompt_generated':
    case 'phase_started':
    case 'iteration_complete':
    case 'polish_skipped': // Polish skipped (neutral)
      return {
        icon: semanticColors.primary.text,
        text: 'text-cyan-300',
        bg: semanticColors.primary.bg,
      };

    // Warning/change events (amber)
    case 'dimension_adjusted':
    case 'feedback_applied':
    case 'polish_no_improvement': // Polish didn't help (warning)
      return {
        icon: semanticColors.warning.text,
        text: 'text-amber-300',
        bg: semanticColors.warning.bg,
      };

    default:
      return {
        icon: 'text-slate-400',
        text: 'text-slate-300',
        bg: 'bg-slate-800/50',
      };
  }
}

/**
 * Get icon for an event type
 */
function getEventIcon(type: AutoplayEventType) {
  switch (type) {
    case 'image_approved':
    case 'image_saved':
    case 'phase_completed':
    case 'poster_selected':
    case 'hud_complete':
    case 'image_polished': // Polish success
      return CheckCircle;

    case 'image_failed':
    case 'image_rejected':
    case 'error':
    case 'polish_error': // Polish failure
      return XCircle;

    case 'timeout':
      return Clock;

    case 'image_generating':
    case 'poster_generating':
    case 'hud_generating':
      return RefreshCw;

    case 'image_complete':
      return Image;

    case 'prompt_generated':
    case 'phase_started':
      return Sparkles;

    case 'dimension_adjusted':
    case 'feedback_applied':
      return Zap;

    // Polish events
    case 'polish_started':
    case 'polish_no_improvement':
    case 'polish_skipped':
      return Wand2;

    default:
      return AlertCircle;
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Single event entry
 */
function EventEntry({ event }: { event: AutoplayLogEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getEventColors(event.type);
  const Icon = getEventIcon(event.type);
  const hasDetails = event.details && Object.keys(event.details).length > 0;

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className={`p-2 radius-sm border border-slate-800/50 ${colors.bg}`}
    >
      <div
        className={`flex items-start gap-2 ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {hasDetails && (
          <span className="text-slate-500 mt-0.5">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        <Icon size={14} className={`${colors.icon} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs ${colors.text} break-words`}>{event.message}</p>
          <span className="text-[10px] text-slate-600 font-mono">
            {formatTimestamp(event.timestamp)}
          </span>
        </div>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {isExpanded && event.details && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.fast}
            className="mt-2 pt-2 border-t border-slate-700/50"
          >
            <div className="space-y-1 text-[10px] font-mono">
              {event.details.phase && (
                <div className="flex gap-2">
                  <span className="text-slate-500">Phase:</span>
                  <span className="text-slate-300">{event.details.phase}</span>
                </div>
              )}
              {event.details.score !== undefined && (
                <div className="flex gap-2">
                  <span className="text-slate-500">Score:</span>
                  <span className={event.details.score >= 70 ? 'text-green-400' : 'text-amber-400'}>
                    {event.details.score}/100
                  </span>
                </div>
              )}
              {event.details.feedback && (
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500">Feedback:</span>
                  <span className="text-slate-300 whitespace-pre-wrap">{event.details.feedback}</span>
                </div>
              )}
              {event.details.dimension && (
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500">{event.details.dimension.type}:</span>
                  <span className="text-slate-500 line-through">{event.details.dimension.oldValue}</span>
                  <span className="text-amber-300">{event.details.dimension.newValue}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ActivityLogSidebar({
  title,
  events,
  side,
  emptyMessage,
}: ActivityLogSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className={`flex flex-col h-full ${side === 'left' ? 'border-r' : 'border-l'} border-slate-800`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
          {side === 'left' ? (
            <Sparkles size={12} className={semanticColors.primary.text} />
          ) : (
            <Image size={12} className={semanticColors.processing.text} />
          )}
          {title}
          {events.length > 0 && (
            <span className="ml-auto text-slate-600 font-mono">({events.length})</span>
          )}
        </h3>
      </div>

      {/* Events list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate-600 text-center px-4">{emptyMessage}</p>
          </div>
        ) : (
          events.map(event => (
            <EventEntry key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityLogSidebar;
