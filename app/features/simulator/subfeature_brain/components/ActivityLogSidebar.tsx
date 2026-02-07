/**
 * ActivityLogSidebar - Scrollable log display for autoplay events
 *
 * Improvements:
 * - 11px minimum text for readability
 * - Alternating row backgrounds for scan-ability
 * - React.memo to prevent unnecessary re-renders
 * - Timestamps always visible (compact)
 */

'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import {
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

export interface ActivityLogSidebarProps {
  title: string;
  events: AutoplayLogEntry[];
  side: 'left' | 'right';
  emptyMessage: string;
}

/**
 * Get color class for an event type
 */
function getEventColor(type: AutoplayEventType): string {
  switch (type) {
    case 'image_approved':
    case 'image_saved':
    case 'image_complete':
    case 'poster_selected':
    case 'hud_complete':
    case 'phase_completed':
    case 'image_polished':
      return 'text-green-400';

    case 'image_failed':
    case 'image_rejected':
    case 'error':
    case 'timeout':
    case 'polish_error':
      return 'text-red-400';

    case 'image_generating':
    case 'poster_generating':
    case 'hud_generating':
    case 'polish_started':
      return 'text-purple-400';

    case 'prompt_generated':
    case 'phase_started':
    case 'iteration_complete':
    case 'polish_skipped':
      return 'text-cyan-400';

    case 'dimension_adjusted':
    case 'feedback_applied':
    case 'polish_no_improvement':
      return 'text-amber-400';

    default:
      return 'text-slate-400';
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
    case 'image_polished':
      return CheckCircle;

    case 'image_failed':
    case 'image_rejected':
    case 'error':
    case 'polish_error':
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

    case 'polish_started':
    case 'polish_no_improvement':
    case 'polish_skipped':
      return Wand2;

    default:
      return AlertCircle;
  }
}

/**
 * Format timestamp compactly
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Score bar - compact visual score indicator
 */
function ScoreBar({ score, label }: { score: number; label?: string }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-[9px] text-slate-600 w-8">{label}</span>}
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className={`text-[9px] font-mono ${textColor}`}>{score}</span>
    </div>
  );
}

/**
 * Single-row event entry with expandable evaluation details
 */
const EventRow = memo(function EventRow({ event, isOdd }: { event: AutoplayLogEntry; isOdd: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const color = getEventColor(event.type);
  const Icon = getEventIcon(event.type);

  // Only evaluation events are expandable
  const hasDetails = (event.type === 'image_approved' || event.type === 'image_rejected')
    && event.details?.score !== undefined;

  return (
    <div
      className={`px-1.5 py-1 rounded group ${
        isOdd ? 'bg-white/[0.02]' : ''
      } hover:bg-white/[0.05] transition-colors ${hasDetails ? 'cursor-pointer' : ''}`}
      title={hasDetails ? 'Click to expand details' : event.message}
      onClick={hasDetails ? () => setExpanded(!expanded) : undefined}
    >
      {/* Main row */}
      <div className="flex items-start gap-1.5">
        <Icon size={11} className={`${color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <span className={`text-[11px] leading-tight block truncate ${color}`}>
            {event.message}
          </span>
        </div>
        <span className="text-[9px] text-slate-600 font-mono shrink-0 mt-0.5">
          {formatTime(event.timestamp).slice(0, 5)}
        </span>
      </div>

      {/* Expandable details */}
      {expanded && hasDetails && event.details && (
        <div className="mt-1 ml-4 space-y-1 pb-0.5">
          <ScoreBar score={event.details.score!} label="Score" />
          {event.details.feedback && (
            <p className="text-[9px] text-slate-500 leading-tight line-clamp-3">
              {event.details.feedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

function ActivityLogSidebarInner({
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
    <div className="flex flex-col h-full bg-black/20">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-slate-800/50 bg-black/30 shrink-0">
        <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
          {side === 'left' ? (
            <Sparkles size={10} className="text-cyan-400" />
          ) : (
            <Image size={10} className="text-purple-400" />
          )}
          {title}
          {events.length > 0 && (
            <span className="ml-auto text-slate-600 font-mono text-[10px]">{events.length}</span>
          )}
        </h3>
      </div>

      {/* Events list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-0.5 py-0.5"
        style={{ scrollBehavior: 'smooth' }}
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-slate-600 text-center px-2">{emptyMessage}</p>
          </div>
        ) : (
          events.map((event, index) => (
            <EventRow key={event.id} event={event} isOdd={index % 2 === 1} />
          ))
        )}
      </div>
    </div>
  );
}

/** Memoized to prevent re-renders when parent state changes but events haven't */
export const ActivityLogSidebar = memo(ActivityLogSidebarInner, (prev, next) => {
  return (
    prev.events.length === next.events.length &&
    prev.title === next.title &&
    prev.side === next.side &&
    prev.emptyMessage === next.emptyMessage &&
    // Check last event ID to detect actual changes
    (prev.events.length === 0 ||
      prev.events[prev.events.length - 1].id === next.events[next.events.length - 1].id)
  );
});

export default ActivityLogSidebar;
