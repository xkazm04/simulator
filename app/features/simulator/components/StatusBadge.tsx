'use client';

import { memo } from 'react';
import { Circle, Clock, CheckCircle2, Pencil, Archive, Sparkles } from 'lucide-react';

/**
 * Project status types
 */
export type ProjectStatus = 'draft' | 'active' | 'complete' | 'archived';

/**
 * Calculate project status from project data
 */
export function calculateProjectStatus(project: {
  updated_at: string;
  created_at: string;
  hasContent?: boolean;
  isComplete?: boolean;
  isArchived?: boolean;
}): ProjectStatus {
  // Check explicit flags first
  if (project.isArchived) return 'archived';
  if (project.isComplete) return 'complete';

  // Check if project has meaningful content
  if (!project.hasContent) return 'draft';

  // Check recent activity (active if updated in last 24 hours)
  const updatedAt = new Date(project.updated_at);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceUpdate < 24) return 'active';

  return 'draft';
}

/**
 * Status configuration
 */
const STATUS_CONFIG: Record<
  ProjectStatus,
  {
    icon: typeof Circle;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  draft: {
    icon: Pencil,
    label: 'Draft',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    description: 'Work in progress',
  },
  active: {
    icon: Sparkles,
    label: 'Active',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    description: 'Recently updated',
  },
  complete: {
    icon: CheckCircle2,
    label: 'Complete',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    description: 'Finished project',
  },
  archived: {
    icon: Archive,
    label: 'Archived',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    description: 'No longer active',
  },
};

interface StatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * StatusBadge - Visual status indicator for projects
 */
export const StatusBadge = memo(function StatusBadge({
  status,
  size = 'sm',
  showLabel = true,
  showIcon = true,
  className = '',
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      badge: 'px-1.5 py-0.5 text-[10px]',
      icon: 10,
      gap: 'gap-1',
    },
    md: {
      badge: 'px-2 py-1 text-xs',
      icon: 12,
      gap: 'gap-1.5',
    },
    lg: {
      badge: 'px-3 py-1.5 text-sm',
      icon: 14,
      gap: 'gap-2',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.badge}
        font-mono uppercase tracking-wider
        rounded-full border
        ${config.bgColor} ${config.borderColor} ${config.color}
        ${className}
      `}
      title={config.description}
    >
      {showIcon && <Icon size={sizes.icon} />}
      {showLabel && config.label}
    </span>
  );
});

/**
 * TimestampDisplay - Relative time formatting
 */
interface TimestampDisplayProps {
  date: string | Date;
  prefix?: string;
  className?: string;
}

export const TimestampDisplay = memo(function TimestampDisplay({
  date,
  prefix = '',
  className = '',
}: TimestampDisplayProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  let timeString: string;

  if (diffSeconds < 60) {
    timeString = 'just now';
  } else if (diffMinutes < 60) {
    timeString = `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    timeString = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    timeString = `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    timeString = `${diffWeeks}w ago`;
  } else if (diffMonths < 12) {
    timeString = `${diffMonths}mo ago`;
  } else {
    timeString = dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-slate-500 ${className}`}
      title={dateObj.toLocaleString()}
    >
      <Clock size={10} />
      <span className="font-mono text-[10px]">
        {prefix && `${prefix} `}
        {timeString}
      </span>
    </span>
  );
});

/**
 * GenerationCountBadge - Show number of generations
 */
interface GenerationCountBadgeProps {
  count: number;
  className?: string;
}

export const GenerationCountBadge = memo(function GenerationCountBadge({
  count,
  className = '',
}: GenerationCountBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5
        bg-purple-500/10 border border-purple-500/20 rounded-full
        text-purple-400 font-mono text-[10px]
        ${className}
      `}
      title={`${count} generation${count === 1 ? '' : 's'}`}
    >
      <Sparkles size={10} />
      {count}
    </span>
  );
});

export default StatusBadge;
