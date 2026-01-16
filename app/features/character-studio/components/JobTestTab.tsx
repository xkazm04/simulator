'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, CheckCircle2, XCircle, Clock, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import type { Job, JobStatus, Worker, JobCreateResponse } from '../types';
import { createJob, getJob, listWorkers } from '../lib/api';

// Hash prompt using SHA-256
async function hashPrompt(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface JobTestTabProps {
  workers: Worker[];
}

const STATUS_CONFIG: Record<JobStatus, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'text-yellow-400', icon: Clock, label: 'Pending' },
  assigned: { color: 'text-blue-400', icon: Clock, label: 'Assigned' },
  accepted: { color: 'text-blue-400', icon: Clock, label: 'Accepted' },
  processing: { color: 'text-cyan-400', icon: Loader2, label: 'Processing' },
  completed: { color: 'text-green-400', icon: CheckCircle2, label: 'Completed' },
  failed: { color: 'text-red-400', icon: XCircle, label: 'Failed' },
  cancelled: { color: 'text-gray-400', icon: XCircle, label: 'Cancelled' },
  expired: { color: 'text-orange-400', icon: AlertTriangle, label: 'Expired' },
};

export function JobTestTab({ workers: initialWorkers }: JobTestTabProps) {
  // Form state
  const [prompt, setPrompt] = useState('a beautiful sunset over mountains, photorealistic, 8k');
  const [model, setModel] = useState('flux-schnell');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(20);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  // Generate a test pubkey (in real app, this would come from wallet/crypto)
  const [developerPubkey] = useState(() => {
    // Generate a random hex string as a test pubkey
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined') {
      crypto.getRandomValues(array);
    }
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  });

  // Job state
  const [jobCreateResponse, setJobCreateResponse] = useState<JobCreateResponse | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workers state
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers);

  // Refresh workers
  const refreshWorkers = useCallback(async () => {
    try {
      const response = await listWorkers('online');
      setWorkers(response.workers);
    } catch (err) {
      console.error('Failed to refresh workers:', err);
    }
  }, []);

  // Submit job
  const handleSubmitJob = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setCurrentJob(null);
    setJobCreateResponse(null);

    try {
      // Hash the prompt for privacy
      const promptHash = await hashPrompt(prompt.trim());

      const response = await createJob({
        model,
        width,
        height,
        steps,
        developer_pubkey: developerPubkey,
        prompt_hash: promptHash,
        worker_id: selectedWorkerId || undefined,
      });

      setJobCreateResponse(response);

      // Start polling for job status
      setIsPolling(true);
      pollJobStatus(response.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  }, [prompt, model, width, height, selectedWorkerId]);

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    const maxAttempts = 120; // 4 minutes with 2s interval
    const intervalMs = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const job = await getJob(jobId);
        setCurrentJob(job);

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          setIsPolling(false);
          return;
        }
      } catch (err) {
        console.error('Error polling job:', err);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    setIsPolling(false);
    setError('Job polling timeout');
  }, []);

  const statusConfig = currentJob ? STATUS_CONFIG[currentJob.status] : null;
  const StatusIcon = statusConfig?.icon || Clock;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-mono text-lg uppercase tracking-wider text-white mb-1">
          Job Test
        </h2>
        <p className="text-sm text-slate-500">
          Submit test image generation jobs to the coordinator
        </p>
      </div>

      <div className="flex gap-6 flex-1">
        {/* Left: Form */}
        <div className="flex-1 space-y-4">
          {/* Prompt */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your image generation prompt..."
              className="w-full h-32 px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10
                       text-white placeholder-slate-600 text-sm resize-none
                       focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>

          {/* Model & Dimensions */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10
                         text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="flux-schnell">Flux Schnell</option>
                <option value="flux-dev">Flux Dev</option>
                <option value="sdxl">SDXL</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                Width
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                step={64}
                min={256}
                max={2048}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10
                         text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                Height
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                step={64}
                min={256}
                max={2048}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10
                         text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                Steps
              </label>
              <input
                type="number"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                min={1}
                max={100}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10
                         text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Worker Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Target Worker (optional)
              </label>
              <button
                onClick={refreshWorkers}
                className="text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                Refresh
              </button>
            </div>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10
                       text-white text-sm focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Auto (best available)</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} - {worker.gpu_model} ({worker.status})
                </option>
              ))}
            </select>
            {workers.length === 0 && (
              <p className="mt-1 text-[10px] text-amber-400">
                No workers online. Register a worker in the Hive app first.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitJob}
            disabled={isSubmitting || isPolling || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30
                     text-cyan-400 font-mono text-sm uppercase tracking-wider
                     hover:from-cyan-500/30 hover:to-purple-500/30
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : isPolling ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Polling Status...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Job
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Info Note */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Test Mode Note</p>
                <p className="text-amber-400/70 mt-1">
                  This creates a job on the coordinator. For actual image generation, the prompt
                  needs to be delivered to the worker via WebRTC. The job will remain pending until
                  a worker accepts it.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Job Status & Result */}
        <div className="w-96 space-y-4">
          {/* Job Creation Response */}
          {jobCreateResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-slate-900/50 border border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Job Created
                </span>
                <span className="text-cyan-400 font-mono text-xs">
                  {jobCreateResponse.estimated_credits} credits
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Job ID:</span>
                  <span className="text-white font-mono text-xs">{jobCreateResponse.id.slice(0, 8)}...</span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5">
                  <span className="text-slate-500 text-[10px] uppercase">WebRTC Signaling</span>
                  <div className="mt-1 p-2 rounded bg-slate-800 text-[10px] font-mono text-slate-400 break-all">
                    {jobCreateResponse.signaling_ws_url.slice(0, 60)}...
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Job Status Card */}
          {currentJob && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-slate-900/50 border border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Job Status
                </span>
                <div className={`flex items-center gap-1.5 ${statusConfig?.color}`}>
                  <StatusIcon size={14} className={currentJob.status === 'processing' ? 'animate-spin' : ''} />
                  <span className="font-mono text-xs uppercase">{statusConfig?.label}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Model:</span>
                  <span className="text-white text-xs">{currentJob.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dimensions:</span>
                  <span className="text-white text-xs">{currentJob.width}x{currentJob.height}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Steps:</span>
                  <span className="text-white text-xs">{currentJob.steps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created:</span>
                  <span className="text-white text-xs">
                    {new Date(currentJob.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {currentJob.assigned_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned:</span>
                    <span className="text-white text-xs">
                      {new Date(currentJob.assigned_at).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {currentJob.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed:</span>
                    <span className="text-white text-xs">
                      {new Date(currentJob.completed_at).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {currentJob.generation_time_ms && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gen Time:</span>
                    <span className="text-white text-xs">
                      {(currentJob.generation_time_ms / 1000).toFixed(2)}s
                    </span>
                  </div>
                )}
                {currentJob.error_message && (
                  <div className="mt-2 p-2 rounded bg-red-500/10 text-red-400 text-xs">
                    {currentJob.error_message}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Completed Job Note */}
          {currentJob?.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg bg-green-500/10 border border-green-500/30"
            >
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle2 size={16} />
                <span className="font-mono text-xs uppercase">Job Completed</span>
              </div>
              <p className="text-xs text-green-400/70">
                The image was delivered via WebRTC directly to the client.
                In a production app, you would receive the image data through
                the WebRTC data channel.
              </p>
            </motion.div>
          )}

          {/* Empty State */}
          {!jobCreateResponse && !currentJob && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="p-4 rounded-full bg-slate-900/50 border border-white/5 mb-4">
                <ImageIcon size={32} className="text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">No job submitted yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Enter a prompt and submit to generate an image
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobTestTab;
