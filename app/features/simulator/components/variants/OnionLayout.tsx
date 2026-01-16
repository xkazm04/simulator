
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Command, Film, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { SimulatorLayoutProps } from '../../types';
import { BaseImageInput } from '../BaseImageInput';
import { FeedbackPanel } from '../FeedbackPanel';
import { DimensionGrid } from '../DimensionGrid';
import { PromptOutput } from '../PromptOutput';
import { SmartBreakdown } from '../SmartBreakdown';
import { SidePanel } from '../SidePanel';
import { PosterOverlay } from '../PosterOverlay';
import { IconButton, Toast, useToast } from '@/app/components/ui';
import { fadeIn, slideDown, transitions, EASE, DURATION, useReducedMotion, getReducedMotionTransitions } from '../../lib/motion';

export function OnionLayout({
    baseImage,
    setBaseImage,
    baseImageFile,
    setBaseImageFile,
    handleImageParse,
    isParsingImage,
    imageParseError,
    dimensions,
    handleDimensionChange,
    handleDimensionWeightChange,
    handleDimensionFilterModeChange,
    handleDimensionTransformModeChange,
    handleDimensionRemove,
    handleDimensionAdd,
    handleDimensionReorder,
    generatedPrompts,
    handlePromptRate,
    handlePromptLock,
    handleElementLock,
    handleCopy,
    handleAcceptElement,
    acceptingElementId,
    handleDropElementOnDimension,
    feedback,
    setFeedback,
    isGenerating,
    handleGenerate,
    canGenerate,
    outputMode,
    setOutputMode,
    handleSmartBreakdownApply,
    onConvertElementsToDimensions,
    onViewPrompt,
    // Side panel props
    leftPanelSlots = [],
    rightPanelSlots = [],
    onRemovePanelImage,
    onViewPanelImage,
    // Image generation props
    generatedImages = [],
    isGeneratingImages = false,
    onStartImage,
    savedPromptIds = new Set(),
    // Delete generations
    onDeleteGenerations,
    // Poster props
    projectPoster,
    showPosterOverlay = false,
    onTogglePosterOverlay,
    isGeneratingPoster = false,
    // Interactive prototype props
    interactiveMode = 'static',
    availableInteractiveModes = ['static'],
    onInteractiveModeChange,
    interactivePrototypes,
    isGeneratingPrototype = false,
    onGeneratePrototype,
    onViewInteractivePrototype,
    // Comparison props
    onOpenComparison,
    // Negative prompt props
    negativePrompts = [],
    onNegativePromptsChange,
    // Prompt history props
    promptHistory,
    onPromptUndo,
    onPromptRedo,
}: SimulatorLayoutProps) {
    const hasLockedPrompts = generatedPrompts.some((p) => p.locked);
    const lockedElements = generatedPrompts.flatMap((p) => p.elements.filter((e) => e.locked));

    // Reduced motion support for accessibility (WCAG 2.1 Level AAA)
    const prefersReducedMotion = useReducedMotion();
    const motionTransitions = getReducedMotionTransitions(prefersReducedMotion);
    const panelDuration = prefersReducedMotion ? 0 : DURATION.panel;

    // Toast for copy confirmation
    const { showToast, toastProps } = useToast();

    // Collapsible section states
    const [leftParamsExpanded, setLeftParamsExpanded] = React.useState(true);
    const [rightParamsExpanded, setRightParamsExpanded] = React.useState(true);
    const [topPromptsExpanded, setTopPromptsExpanded] = React.useState(true);
    const [bottomPromptsExpanded, setBottomPromptsExpanded] = React.useState(true);

    // 2. Keyboard shortcut (Ctrl+Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canGenerate && !isGenerating && !isGeneratingPoster) {
                handleGenerate();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canGenerate, isGenerating, isGeneratingPoster, handleGenerate]);

    // Copy handler with toast notification
    const onCopyWrapper = (id: string) => {
        handleCopy(id);
        showToast('Prompt copied to clipboard', 'success');
    };

    // Split dimensions for left/right columns
    const midPoint = Math.ceil(dimensions.length / 2);
    const leftDimensions = dimensions.slice(0, midPoint);
    const rightDimensions = dimensions.slice(midPoint);

    // Reorder handlers for split dimension columns
    const handleLeftReorder = (reorderedLeft: typeof leftDimensions) => {
        handleDimensionReorder([...reorderedLeft, ...rightDimensions]);
    };
    const handleRightReorder = (reorderedRight: typeof rightDimensions) => {
        handleDimensionReorder([...leftDimensions, ...reorderedRight]);
    };

    // Split prompts for top/bottom
    const topPrompts = generatedPrompts.slice(0, 2);
    const bottomPrompts = generatedPrompts.slice(2);

    return (
        <div className="h-full w-full bg-surface-primary text-slate-200 flex overflow-hidden p-lg gap-lg font-sans selection:bg-amber-900/50 selection:text-amber-100 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-surface-primary to-surface-primary pointer-events-none" />

            {/* Copy Toast */}
            <Toast {...toastProps} data-testid="copy-toast" />

            {/* Left Border: Image Placeholders */}
            <SidePanel
                side="left"
                slots={leftPanelSlots}
                onRemoveImage={onRemovePanelImage}
                onViewImage={onViewPanelImage}
            />

            {/* Main Layout */}
            <div className="flex-1 flex flex-col h-full gap-md overflow-hidden z-10 w-full max-w-7xl mx-auto">

                {/* Top Generated Prompts - Collapsible */}
                <motion.div
                    className="shrink-0 w-full relative group"
                    initial={false}
                    animate={{ height: topPromptsExpanded ? 180 : 36 }}
                    transition={{ duration: panelDuration, ease: EASE.default }}
                >
                    <div className="absolute inset-0 bg-surface-primary/50 radius-lg border border-slate-700/60 overflow-hidden backdrop-blur-sm">
                        {/* Collapse toggle */}
                        <IconButton
                            size="xs"
                            variant="solid"
                            colorScheme="default"
                            onClick={() => setTopPromptsExpanded(!topPromptsExpanded)}
                            data-testid="top-prompts-collapse-btn"
                            label={topPromptsExpanded ? 'Collapse top prompts' : 'Expand top prompts'}
                            className="absolute top-sm right-sm z-20"
                        >
                            <motion.div
                                animate={{ rotate: topPromptsExpanded ? 0 : 180 }}
                                transition={motionTransitions.normal}
                            >
                                <ChevronUp size={14} />
                            </motion.div>
                        </IconButton>

                        {/* Section label when collapsed */}
                        <AnimatePresence>
                            {!topPromptsExpanded && (
                                <motion.div
                                    variants={fadeIn}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="absolute inset-0 flex items-center justify-center"
                                >
                                    <span className="font-mono type-label text-slate-600 uppercase tracking-wider">Generated Images (1-2)</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content - only render when expanded */}
                        <AnimatePresence>
                            {topPromptsExpanded && (
                                <motion.div
                                    variants={fadeIn}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={motionTransitions.normal}
                                    className="relative h-full"
                                >
                                    {/* Placeholder Background (Visible when empty) */}
                                    {topPrompts.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                            <div className="flex gap-4">
                                                {[1, 2].map(i => (
                                                    <div key={i} className="w-64 h-32 border-2 border-dashed border-slate-700/50 radius-lg flex items-center justify-center">
                                                        <span className="font-mono type-label text-slate-500">RESERVED_SLOT_0{i}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="relative h-full p-3">
                                        <PromptOutput
                                            prompts={topPrompts}
                                            onRate={handlePromptRate}
                                            onLock={handlePromptLock}
                                            onLockElement={handleElementLock}
                                            onAcceptElement={handleAcceptElement}
                                            acceptingElementId={acceptingElementId}
                                            onCopy={onCopyWrapper}
                                            onViewPrompt={onViewPrompt}
                                            generatedImages={generatedImages}
                                            onStartImage={onStartImage}
                                            savedPromptIds={savedPromptIds}
                                            onOpenComparison={onOpenComparison}
                                            isGenerating={isGenerating}
                                            skeletonCount={2}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Middle Layer: Dimensions - Center Brain - Dimensions */}
                {/* ITEMS-STRETCH ensures matched heights */}
                <div className="flex-1 flex gap-lg min-h-0 items-stretch">

                    {/* Left Dimensions Column - Collapsible */}
                    <motion.div
                        className="flex flex-col gap-sm overflow-hidden bg-slate-900/10 radius-lg border border-white/5 p-sm backdrop-blur-sm shrink-0"
                        initial={false}
                        animate={{ width: leftParamsExpanded ? 288 : 36 }}
                        transition={{ duration: panelDuration, ease: EASE.default }}
                    >
                        {/* Header with toggle */}
                        <div className={`flex items-center gap-2 px-2 py-1 type-body-sm uppercase tracking-widest text-white/90 font-medium shrink-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] ${!leftParamsExpanded ? 'flex-col h-full' : ''}`}>
                            {leftParamsExpanded ? (
                                <>
                                    <div className="h-px bg-slate-700 flex-1" />
                                    <span className="whitespace-nowrap">Parameters A</span>
                                    <div className="h-px bg-slate-700 flex-1" />
                                </>
                            ) : null}
                            <IconButton
                                size="sm"
                                variant="solid"
                                colorScheme="default"
                                onClick={() => setLeftParamsExpanded(!leftParamsExpanded)}
                                data-testid="left-params-collapse-btn"
                                label={leftParamsExpanded ? 'Collapse left parameters' : 'Expand left parameters'}
                                className="shrink-0"
                            >
                                <motion.div
                                    animate={{ rotate: leftParamsExpanded ? 0 : 180 }}
                                    transition={motionTransitions.normal}
                                >
                                    <ChevronLeft size={12} />
                                </motion.div>
                            </IconButton>
                            {!leftParamsExpanded && (
                                <span className="type-label text-slate-600 whitespace-nowrap flex-1 flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PARAMS A</span>
                            )}
                        </div>

                        {/* Content - only render when expanded */}
                        <AnimatePresence>
                            {leftParamsExpanded && (
                                <motion.div
                                    variants={fadeIn}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={motionTransitions.normal}
                                    className="flex-1 overflow-y-auto pr-2 custom-scrollbar"
                                >
                                    <div className="pb-2">
                                        <DimensionGrid
                                            dimensions={leftDimensions}
                                            onChange={handleDimensionChange}
                                            onWeightChange={handleDimensionWeightChange}
                                            onFilterModeChange={handleDimensionFilterModeChange}
                                            onTransformModeChange={handleDimensionTransformModeChange}
                                            onRemove={handleDimensionRemove}
                                            onAdd={handleDimensionAdd}
                                            onReorder={handleLeftReorder}
                                            onDropElement={handleDropElementOnDimension}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Center Core: Brain (Breakdown + Feedback) */}
                    {/* FLEX makes it stretch to fill height */}
                    <div className="flex-1 relative group flex flex-col w-full min-w-0">
                        {/* Animated border gradient */}
                        <div className={`absolute -inset-[2px] bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-amber-500/30 radius-lg blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-1000 ${isGenerating ? 'animate-pulse' : ''}`} />
                        {/* Outer glow shadow */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-amber-500/10 radius-lg blur-xl opacity-40 pointer-events-none" />

                        <div className="relative flex-1 bg-surface-primary/95 backdrop-blur-xl radius-lg border border-white/10 flex flex-col shadow-floating overflow-hidden">

                            {/* 6. Status Glow Indicator */}
                            {isGenerating && (
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-shimmer z-50"></div>
                            )}

                            {/* Top Half: Input & Analysis - forced spacing at top handled by padding */}
                            <div className="flex-1 overflow-y-auto p-lg custom-scrollbar">
                                <div className="mb-md flex items-center justify-between">
                                    <span className="type-body-sm uppercase tracking-widest text-white font-medium flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>
                                        Source Analysis
                                    </span>

                                    {/* Poster toggle button - only show if poster exists or generating */}
                                    {(projectPoster || isGeneratingPoster) && onTogglePosterOverlay && (
                                        <button
                                            onClick={onTogglePosterOverlay}
                                            data-testid="poster-toggle-btn"
                                            className={`px-2 py-1 type-label font-mono radius-sm transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
                                                showPosterOverlay
                                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                    : 'text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600'
                                            }`}
                                        >
                                            <Film size={10} />
                                            {showPosterOverlay ? 'SHOW INPUTS' : 'VIEW POSTER'}
                                        </button>
                                    )}
                                </div>

                                {/* Poster overlay or regular content */}
                                <AnimatePresence mode="wait">
                                    {showPosterOverlay ? (
                                        <motion.div
                                            key="poster"
                                            variants={slideDown}
                                            initial="initial"
                                            animate="animate"
                                            exit="exit"
                                            transition={motionTransitions.normal}
                                        >
                                            <PosterOverlay
                                                poster={projectPoster || null}
                                                isGenerating={isGeneratingPoster}
                                            />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="inputs"
                                            variants={slideDown}
                                            initial="initial"
                                            animate="animate"
                                            exit="exit"
                                            transition={motionTransitions.normal}
                                        >
                                            <SmartBreakdown
                                                onApply={handleSmartBreakdownApply}
                                                isDisabled={isGenerating}
                                            />

                                            <div className="mt-lg">
                                                <BaseImageInput
                                                    value={baseImage}
                                                    onChange={setBaseImage}
                                                    imageFile={baseImageFile}
                                                    onImageChange={setBaseImageFile}
                                                    onImageParse={handleImageParse}
                                                    isParsingImage={isParsingImage}
                                                    parseError={imageParseError}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-slate-800/50 w-full shrink-0" />

                            {/* Bottom Half: Feedback & Controls */}
                            <div className="p-lg bg-black/20 shrink-0">
                                <div className="mb-sm flex items-center justify-between">
                                    <span className="type-body-sm uppercase tracking-widest text-white font-medium flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                                        Director Control
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {/* Delete Images button - only show when there are generated images */}
                                        {generatedImages.length > 0 && onDeleteGenerations && (
                                            <button
                                                onClick={onDeleteGenerations}
                                                disabled={isGeneratingImages}
                                                data-testid="delete-images-btn"
                                                className="type-label text-red-400/70 font-mono flex items-center gap-1 border border-red-900/50 radius-sm px-1.5 py-0.5 hover:bg-red-950/30 hover:border-red-800/50 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                                            >
                                                <Trash2 size={9} /> <span>DELETE IMAGES</span>
                                            </button>
                                        )}
                                        <div className="type-label text-slate-600 font-mono flex items-center gap-1 border border-slate-800 radius-sm px-1.5 py-0.5">
                                            <Command size={9} /> <Zap size={9} /> <span>CTRL+ENTER</span>
                                        </div>
                                    </div>
                                </div>

                                <FeedbackPanel
                                    feedback={feedback}
                                    onFeedbackChange={setFeedback}
                                    onGenerate={handleGenerate}
                                    isGenerating={isGenerating}
                                    isGeneratingPoster={isGeneratingPoster}
                                    canGenerate={canGenerate}
                                    hasLockedPrompts={hasLockedPrompts}
                                    lockedElements={lockedElements}
                                    outputMode={outputMode}
                                    onOutputModeChange={setOutputMode}
                                    onConvertElementsToDimensions={onConvertElementsToDimensions}
                                    variant="stacked"
                                    interactiveMode={interactiveMode}
                                    availableInteractiveModes={availableInteractiveModes}
                                    onInteractiveModeChange={onInteractiveModeChange}
                                    negativePrompts={negativePrompts}
                                    onNegativePromptsChange={onNegativePromptsChange}
                                    dimensions={dimensions}
                                    promptHistory={promptHistory}
                                    onPromptUndo={onPromptUndo}
                                    onPromptRedo={onPromptRedo}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Dimensions Column - Collapsible */}
                    <motion.div
                        className="flex flex-col gap-sm overflow-hidden bg-slate-900/10 radius-lg border border-white/5 p-sm backdrop-blur-sm shrink-0"
                        initial={false}
                        animate={{ width: rightParamsExpanded ? 288 : 36 }}
                        transition={{ duration: panelDuration, ease: EASE.default }}
                    >
                        {/* Header with toggle */}
                        <div className={`flex items-center gap-2 px-2 py-1 type-body-sm uppercase tracking-widest text-white/90 font-medium shrink-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] ${!rightParamsExpanded ? 'flex-col h-full' : ''}`}>
                            <IconButton
                                size="sm"
                                variant="solid"
                                colorScheme="default"
                                onClick={() => setRightParamsExpanded(!rightParamsExpanded)}
                                data-testid="right-params-collapse-btn"
                                label={rightParamsExpanded ? 'Collapse right parameters' : 'Expand right parameters'}
                                className="shrink-0"
                            >
                                <motion.div
                                    animate={{ rotate: rightParamsExpanded ? 0 : 180 }}
                                    transition={motionTransitions.normal}
                                >
                                    <ChevronRight size={12} />
                                </motion.div>
                            </IconButton>
                            {rightParamsExpanded ? (
                                <>
                                    <div className="h-px bg-slate-700 flex-1" />
                                    <span className="whitespace-nowrap">Parameters B</span>
                                    <div className="h-px bg-slate-700 flex-1" />
                                </>
                            ) : (
                                <span className="type-label text-slate-600 whitespace-nowrap flex-1 flex items-center justify-center" style={{ writingMode: 'vertical-rl' }}>PARAMS B</span>
                            )}
                        </div>

                        {/* Content - only render when expanded */}
                        <AnimatePresence>
                            {rightParamsExpanded && (
                                <motion.div
                                    variants={fadeIn}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={motionTransitions.normal}
                                    className="flex-1 overflow-y-auto pl-2 custom-scrollbar"
                                >
                                    <div className="pb-2">
                                        <DimensionGrid
                                            dimensions={rightDimensions}
                                            onChange={handleDimensionChange}
                                            onWeightChange={handleDimensionWeightChange}
                                            onFilterModeChange={handleDimensionFilterModeChange}
                                            onTransformModeChange={handleDimensionTransformModeChange}
                                            onRemove={handleDimensionRemove}
                                            onAdd={handleDimensionAdd}
                                            onReorder={handleRightReorder}
                                            onDropElement={handleDropElementOnDimension}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                </div>

                {/* Bottom Generated Prompts - Collapsible */}
                <motion.div
                    className="shrink-0 w-full relative group"
                    initial={false}
                    animate={{ height: bottomPromptsExpanded ? 180 : 36 }}
                    transition={{ duration: panelDuration, ease: EASE.default }}
                >
                    <div className="absolute inset-0 bg-surface-primary/50 radius-lg border border-slate-700/60 overflow-hidden backdrop-blur-sm">
                        {/* Collapse toggle */}
                        <IconButton
                            size="xs"
                            variant="solid"
                            colorScheme="default"
                            onClick={() => setBottomPromptsExpanded(!bottomPromptsExpanded)}
                            data-testid="bottom-prompts-collapse-btn"
                            label={bottomPromptsExpanded ? 'Collapse bottom prompts' : 'Expand bottom prompts'}
                            className="absolute top-sm right-sm z-20"
                        >
                            <motion.div
                                animate={{ rotate: bottomPromptsExpanded ? 0 : 180 }}
                                transition={motionTransitions.normal}
                            >
                                <ChevronDown size={14} />
                            </motion.div>
                        </IconButton>

                        {/* Section label when collapsed */}
                        <AnimatePresence>
                            {!bottomPromptsExpanded && (
                                <motion.div
                                    variants={fadeIn}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="absolute inset-0 flex items-center justify-center"
                                >
                                    <span className="font-mono type-label text-slate-600 uppercase tracking-wider">Generated Images (3-4)</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content - only render when expanded */}
                        <AnimatePresence>
                            {bottomPromptsExpanded && (
                                <motion.div
                                    variants={fadeIn}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={motionTransitions.normal}
                                    className="relative h-full"
                                >
                                    {/* Placeholder Background (Visible when empty) */}
                                    {bottomPrompts.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                            <div className="flex gap-4">
                                                {[1, 2].map(i => (
                                                    <div key={i} className="w-64 h-32 border-2 border-dashed border-slate-700/50 radius-lg flex items-center justify-center">
                                                        <span className="font-mono type-label text-slate-500">RESERVED_SLOT_0{i + 2}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="relative h-full p-3">
                                        <PromptOutput
                                            prompts={bottomPrompts}
                                            onRate={handlePromptRate}
                                            onLock={handlePromptLock}
                                            onLockElement={handleElementLock}
                                            onAcceptElement={handleAcceptElement}
                                            acceptingElementId={acceptingElementId}
                                            onCopy={onCopyWrapper}
                                            onViewPrompt={onViewPrompt}
                                            generatedImages={generatedImages}
                                            onStartImage={onStartImage}
                                            savedPromptIds={savedPromptIds}
                                            onOpenComparison={onOpenComparison}
                                            isGenerating={isGenerating}
                                            skeletonCount={2}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* Right Border: Image Placeholders */}
            <SidePanel
                side="right"
                slots={rightPanelSlots}
                onRemoveImage={onRemovePanelImage}
                onViewImage={onViewPanelImage}
            />
        </div>
    );
}
