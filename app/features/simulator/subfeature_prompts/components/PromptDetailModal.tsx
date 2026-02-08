
'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ThumbsUp, ThumbsDown, Lock, Unlock, Zap, ImageIcon } from 'lucide-react';
import { GeneratedPrompt, PromptElement, GeneratedImage } from '../../types';
import { ElementChip } from './ElementChip';
import { IconButton } from '@/app/components/ui';
import { fadeIn, modalContent, transitions } from '../../lib/motion';

interface PromptDetailModalProps {
    prompt: GeneratedPrompt | null;
    isOpen: boolean;
    onClose: () => void;
    onRate: (id: string, rating: 'up' | 'down' | null) => void;
    onLock: (id: string) => void;
    onLockElement: (promptId: string, elementId: string) => void;
    onAcceptElement?: (element: PromptElement) => void;
    acceptingElementId?: string | null;
    generatedImage?: GeneratedImage;
    onStartImage?: (promptId: string) => void;
    isSavedToPanel?: boolean;
    /** Callback when prompt is copied - for toast notifications */
    onCopy?: (promptId: string) => void;
}

export function PromptDetailModal({
    prompt,
    isOpen,
    onClose,
    onRate,
    onLock,
    onLockElement,
    onAcceptElement,
    acceptingElementId,
    generatedImage,
    onStartImage,
    isSavedToPanel = false,
    onCopy,
}: PromptDetailModalProps) {
    const [justCopied, setJustCopied] = React.useState(false);

    if (!isOpen || !prompt) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(prompt.prompt);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
            onCopy?.(prompt.id);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleRate = (rating: 'up' | 'down') => {
        if (prompt.rating === rating) {
            onRate(prompt.id, null);
        } else {
            onRate(prompt.id, rating);
        }
    };

    const hasImage = generatedImage?.status === 'complete' && generatedImage?.url;

    // Lock handler - also saves image to panel when locking (if image exists and not already saved)
    const handleLockWithSave = () => {
        onLock(prompt.id);
        // Save to panel when locking if image exists and not already saved
        if (!prompt.locked && hasImage && !isSavedToPanel && onStartImage) {
            onStartImage(prompt.id);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    variants={fadeIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={transitions.normal}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                />

                <motion.div
                    variants={modalContent}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={transitions.normal}
                    className="relative w-[96vw] max-w-[96vw] bg-surface-primary border border-slate-700 radius-lg overflow-hidden flex flex-col max-h-[92vh] shadow-floating"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-cyan-500/10 radius-sm border border-cyan-500/20">
                                <Zap size={14} className="text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="type-body font-medium text-slate-200">Scene {prompt.sceneNumber}</h3>
                                <p className="type-label font-mono text-cyan-400 capitalize">{prompt.sceneType}</p>
                            </div>
                        </div>
                        <IconButton
                            size="md"
                            variant="subtle"
                            colorScheme="default"
                            onClick={onClose}
                            data-testid="prompt-detail-close-btn"
                            label="Close"
                        >
                            <X size={16} />
                        </IconButton>
                    </div>

                    {/* Body - Image row + elements, no scrolling */}
                    <div className="flex-1 flex flex-col min-h-0" data-testid="prompt-detail-modal-body">
                        {/* Top: Image + Prompt sidebar */}
                        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                            {/* Left: Image (height-constrained, 16:9 centered) */}
                            <div className="flex-1 min-w-0 min-h-0 bg-black/40 flex items-center justify-center p-3">
                                <div className="relative h-full aspect-video max-w-full radius-md overflow-hidden border border-slate-700/50">
                                    {hasImage ? (
                                        <Image
                                            src={generatedImage.url!}
                                            alt={prompt.sceneType}
                                            fill
                                            className="object-cover"
                                            sizes="70vw"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/60">
                                            <div className="p-4 rounded-full bg-slate-800/60">
                                                <ImageIcon size={32} className="text-slate-600" />
                                            </div>
                                            <span className="font-mono type-label text-slate-600 uppercase">
                                                {generatedImage?.status === 'generating' || generatedImage?.status === 'pending'
                                                    ? 'Generating...'
                                                    : generatedImage?.status === 'failed'
                                                        ? 'Generation Failed'
                                                        : 'No Image Generated'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Prompt text sidebar */}
                            <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-2 p-3 border-l border-slate-800/60 bg-slate-900/30 min-h-0">
                                <h4 className="type-body-sm font-medium text-slate-400 uppercase tracking-wider shrink-0">Prompt Text</h4>
                                <div className={`flex-1 p-3 radius-md border overflow-y-auto custom-scrollbar min-h-0 ${prompt.locked ? 'border-green-500/20 bg-green-500/5' : 'border-slate-800 bg-slate-900/40'}`}>
                                    <p className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {prompt.prompt.split(/(".*?"|\d+)/g).map((part, i) => {
                                            if (part && part.startsWith('"') && part.endsWith('"')) {
                                                return <span key={i} className="text-amber-400">{part}</span>;
                                            }
                                            if (!isNaN(Number(part)) && part.trim() !== '') {
                                                return <span key={i} className="text-cyan-400 font-bold">{part}</span>;
                                            }
                                            return <span key={i}>{part}</span>;
                                        })}
                                    </p>
                                </div>

                                {/* Quick actions */}
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={handleCopy}
                                        data-testid="prompt-detail-copy-btn"
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 radius-md border text-xs font-medium transition-colors ${justCopied
                                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                            : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        {justCopied ? <Check size={12} /> : <Copy size={12} />}
                                        {justCopied ? 'Copied' : 'Copy'}
                                    </button>
                                    <button
                                        onClick={handleLockWithSave}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 radius-md border text-xs font-medium transition-colors ${prompt.locked || isSavedToPanel
                                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                            : 'border-slate-700 text-slate-500 hover:text-green-400 hover:bg-slate-800'
                                            }`}
                                        title={hasImage && !isSavedToPanel ? 'Lock prompt and save image' : prompt.locked ? 'Unlock prompt' : 'Lock prompt'}
                                    >
                                        {prompt.locked || isSavedToPanel ? <Lock size={12} /> : <Unlock size={12} />}
                                        {isSavedToPanel ? 'Saved' : prompt.locked ? 'Locked' : 'Lock & Save'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Elements (compact, always visible) */}
                        <div className="shrink-0 px-3 py-2 border-t border-slate-800/40">
                            <div className="flex items-center gap-3">
                                <span className="type-label font-mono text-slate-500 uppercase tracking-wider shrink-0">Elements</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {prompt.elements.map((element) => (
                                        <ElementChip
                                            key={element.id}
                                            element={element}
                                            onToggleLock={(elementId) => onLockElement(prompt.id, elementId)}
                                            onAccept={onAcceptElement}
                                            isAccepting={acceptingElementId === element.id}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleRate('up')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 radius-md border text-xs font-medium transition-colors ${prompt.rating === 'up'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'border-slate-800 text-slate-500 hover:text-green-400 hover:bg-slate-800'
                                    }`}
                            >
                                <ThumbsUp size={14} />
                                Like
                            </button>
                            <button
                                onClick={() => handleRate('down')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 radius-md border text-xs font-medium transition-colors ${prompt.rating === 'down'
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                    : 'border-slate-800 text-slate-500 hover:text-red-400 hover:bg-slate-800'
                                    }`}
                            >
                                <ThumbsDown size={14} />
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 radius-md border border-slate-700 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
