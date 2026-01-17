# Simulator Core User Flow

This document describes the chronological user flow through the Simulator feature, mapping each step to the relevant code files.

## Overview Architecture

```
app/features/simulator/
├── SimulatorFeature.tsx              # Root component with provider hierarchy
├── SimulatorContext.tsx              # Cross-subfeature coordination
├── types.ts                          # Shared TypeScript definitions
│
├── subfeature_dimensions/            # Dimension management
├── subfeature_brain/                 # Source analysis & director control
├── subfeature_prompts/               # Generated prompts & elements
├── subfeature_panels/                # Side panel saved images
├── subfeature_project/               # Project management header
├── subfeature_comparison/            # Prompt comparison modal
├── subfeature_interactive/           # Interactive prototype modes
│
├── components/variants/OnionLayout.tsx  # Main layered ring UI composition
├── hooks/                            # Shared hooks (useProject, useImageGeneration, etc.)
└── lib/                              # Shared utilities (motion, semanticColors, etc.)
```

---

## User Flow Steps

### 1. Project Creation & Initial Setup

**User Action:** Opens Simulator, creates/selects project

**Code Files:**
- `SimulatorFeature.tsx:64-95` - Auto-initialize projects on mount
- `subfeature_project/components/SimulatorHeader.tsx` - Header with project selector
- `subfeature_project/components/ProjectSelector.tsx` - Dropdown for project management
- `hooks/useProject.ts` - Project CRUD operations, state persistence

**Flow:**
1. `SimulatorFeature` mounts and calls `project.loadProjects()`
2. If no projects exist, creates "Demo" project automatically
3. `ProjectSelector` allows creating/renaming/deleting/duplicating projects
4. Project state is persisted via `useProject.saveState()`

---

### 2. Image Analysis from Picture

**User Action:** Uploads an image to analyze as base reference

**Code Files:**
- `subfeature_brain/components/CentralBrain.tsx:246-261` - BaseImageInput container
- `subfeature_brain/components/BaseImageInput.tsx` - Image upload UI with AI parsing
- `subfeature_brain/lib/simulatorAI.ts:203-215` - `describeImage()` API call
- `app/api/ai/image-describe/route.ts` - Gemini Vision API endpoint

**Flow:**
1. User clicks upload in `BaseImageInput`
2. Image file is converted to data URL
3. `handleImageParse()` calls `describeImage()` API
4. Gemini Vision analyzes image structure (format, swappable content, etc.)
5. Results populate:
   - Base description text
   - Suggested dimensions (auto-filled)
   - Suggested output mode

**Integration Points:**
- `BrainContext` stores: `baseImage`, `baseImageFile`, `isParsingImage`, `imageParseError`
- `DimensionsContext` receives auto-detected dimensions via callback

---

### 3. Smart Breakdown (Alternative to Image)

**User Action:** Types a creative vision sentence (e.g., "Baldur's Gate in Star Wars")

**Code Files:**
- `subfeature_brain/components/SmartBreakdown.tsx` - Text input UI
- `subfeature_brain/lib/simulatorAI.ts:126-138` - `smartBreakdown()` API call
- `app/api/ai/simulator/route.ts:134-165` - Anthropic Claude parsing

**Flow:**
1. User enters vision text
2. `smartBreakdown()` sends to Claude API
3. AI parses into structured components:
   - Base image format description
   - Dimension suggestions with confidence
   - Suggested output mode
4. `handleSmartBreakdownApply()` updates Brain + Dimensions contexts

---

### 4. Dimension Configuration

**User Action:** Edits dimension cards (environment, art style, characters, etc.)

**Code Files:**
- `subfeature_dimensions/components/DimensionColumn.tsx` - Left/right dimension columns
- `subfeature_dimensions/components/DimensionCard.tsx` - Individual dimension input
- `subfeature_dimensions/components/DimensionGrid.tsx` - Add new dimension UI
- `subfeature_dimensions/hooks/useDimensions.ts` - All dimension handlers
- `subfeature_dimensions/lib/defaultDimensions.ts` - Presets and examples

**Features:**
- **Change value:** `handleDimensionChange(id, field, value)`
- **Adjust weight:** 0.0-1.0 influence slider
- **Filter mode:** Include/exclude/only
- **Transform mode:** Replace/blend/accent
- **Remove dimension:** `handleDimensionRemove(id)`
- **Add dimension:** Via DimensionGrid presets
- **Reorder:** Drag-and-drop via `handleReorderDimensions()`

---

### 5. Generation via Director Control

**User Action:** Enters change feedback and clicks Generate

**Code Files:**
- `subfeature_brain/components/DirectorControl.tsx` - Extracted control panel
- `subfeature_brain/lib/simulatorAI.ts:247-282` - `refineFeedback()` API
- `app/api/ai/simulator/route.ts:800-920` - `handleRefineFeedback()` endpoint
- `SimulatorContext.tsx` - `handleGenerate()` coordination

**Flow (with Change feedback):**
1. User enters text in "What to Change" input
2. On Generate click, `handleGenerateWithRefinement()`:
   a. If change feedback exists:
      - Calls `refineFeedback()` API
      - LLM evaluates feedback against base prompt + dimensions
      - Updates base prompt and/or dimensions as needed
      - Clears change input
   b. Calls `simulator.handleGenerate()` for prompt generation
3. Prompts context receives new generated prompts
4. Image generation auto-triggers for new prompts

**Director Control UI (Two-row design):**
- Row 1: Mode selection (Concept/Gameplay/Poster) + Interactive mode toggle
- Row 2: Generate button + Undo/Redo history

---

### 6. Image Generation

**User Action:** (Automatic after prompt generation)

**Code Files:**
- `hooks/useImageGeneration.ts` - Leonardo AI integration
- `app/api/ai/generate-images/route.ts` - Leonardo API endpoint
- `SimulatorFeature.tsx:189-202` - Auto-trigger effect

**Flow:**
1. Effect detects new prompts without images
2. `generateImagesFromPrompts()` sends to Leonardo API
3. Polling tracks generation status
4. Images appear in PromptCards as they complete

**Tracking (to prevent re-generation on deletion):**
- `submittedForGenerationRef` tracks which prompt IDs have been submitted
- Cleared on project switch/reset, preserved on image deletion

---

### 7. Review Generated Images

**User Action:** Clicks on a generated prompt card to view details

**Code Files:**
- `subfeature_prompts/components/PromptCard.tsx` - Card with image preview
- `subfeature_prompts/components/PromptDetailModal.tsx` - Full detail modal
- `subfeature_prompts/components/ElementChip.tsx` - Lockable element labels

**Features in Modal:**
- Full image preview
- Complete prompt text
- Element chips (lockable for preservation)
- Rating (up/down)
- Copy prompt button
- Start (save to panel) button

---

### 8. Element Extraction & Acceptance

**User Action:** Locks an element, then clicks "Accept" to refine dimensions

**Code Files:**
- `subfeature_prompts/components/PromptDetailModal.tsx:135-180` - Accept flow
- `SimulatorContext.tsx:onAcceptElement()` - Coordination
- `subfeature_brain/lib/simulatorAI.ts:162-177` - `labelToDimension()` API
- `app/api/ai/simulator/route.ts:357-412` - Gentle dimension refinement

**Current Issue (Identified):**
Elements are hard-appended to dimensions. **Improvement needed:**
- LLM should evaluate whether to update or leave each dimension
- Use `labelToDimension()` API for intelligent merging
- Preserve user's existing work, only enhance related dimensions

**Proper Flow (after fix):**
1. User locks desired elements in PromptDetailModal
2. Clicks "Accept" on an element
3. `onAcceptElement()` calls `labelToDimension()` API
4. LLM evaluates element against current dimensions
5. Only directly related dimensions are gently modified
6. Most dimensions remain unchanged (minimal intensity)

---

### 9. Re-generation with Changes

**User Action:** Uses Director Control to iterate

**Code Files:**
- `subfeature_brain/components/DirectorControl.tsx` - Change input + Generate
- Same flow as Step 5

**Flow:**
1. User enters change feedback (e.g., "make it darker", "add rain")
2. Generate triggers:
   a. `refineFeedback()` updates relevant base prompt/dimensions
   b. New prompts generated with updated setup
   c. Change input clears for next iteration

---

### 10. Save to Panel

**User Action:** Clicks "Start" on a prompt card

**Code Files:**
- `hooks/useImageGeneration.ts:309-371` - `saveImageToPanel()`
- `subfeature_panels/components/SidePanel.tsx` - Panel container
- `subfeature_panels/components/SidePanelSlot.tsx` - Individual slot
- `hooks/useLocalPersistedEntity.ts` - IndexedDB persistence

**Flow:**
1. User clicks "Start" on PromptCard
2. `handleStartImage()` finds completed image
3. `saveImageToPanel()` saves to next available slot (left→right)
4. Image persisted to IndexedDB for large base64 data

---

### 11. Gemini Re-generation (Saved Images)

**User Action:** Opens saved image modal, enters modification prompt

**Code Files:**
- `subfeature_panels/components/SavedImageModal.tsx` - Modal with regeneration
- `app/api/ai/gemini/route.ts` - Gemini image generation endpoint

**Features:**
- View original image (click to expand full-size)
- Enter modification prompt
- "Apply HUD" quick action (if gameUI dimension exists)
- Side-by-side comparison (original vs regenerated)
- Replace or cancel regenerated result
- Full-size preview overlay on click

---

### 12. Delete Images

**User Action:** Clicks "Delete Images" in Director Control

**Code Files:**
- `subfeature_brain/components/DirectorControl.tsx:280-289` - Delete button
- `hooks/useImageGeneration.ts:436-464` - `deleteAllGenerations()`
- `SimulatorFeature.tsx:401` - Passes handler to layout

**Flow:**
1. User clicks "DELETE IMAGES"
2. `deleteAllGenerations()`:
   - Stops all active polling
   - Clears `generatedImages` state immediately
   - Sends DELETE to Leonardo API (background)
3. **Does NOT clear** `submittedForGenerationRef` - prevents re-generation
4. Panel saved images are NOT affected (separate storage)

---

## Context Provider Hierarchy

```tsx
<DimensionsProvider>      // Dimension state & handlers
  <BrainProvider>         // Base image, feedback, output mode
    <PromptsProvider>     // Generated prompts, elements, history
      <SimulatorProvider> // Cross-subfeature coordination
        <SimulatorContent />
      </SimulatorProvider>
    </PromptsProvider>
  </BrainProvider>
</DimensionsProvider>
```

---

## Key API Endpoints

| Endpoint | Action | Purpose |
|----------|--------|---------|
| `/api/ai/simulator?action=breakdown` | POST | Smart text breakdown |
| `/api/ai/simulator?action=refine-feedback` | POST | Apply Change input to setup |
| `/api/ai/simulator?action=label-to-dimension` | POST | Gentle element→dimension refinement |
| `/api/ai/simulator?action=generate-with-feedback` | POST | Full generation pipeline |
| `/api/ai/image-describe` | POST | Gemini Vision image analysis |
| `/api/ai/generate-images` | POST/GET/DELETE | Leonardo AI image generation |
| `/api/ai/gemini` | POST | Gemini image regeneration |
| `/api/projects/[id]` | GET/PUT/DELETE | Project state persistence |

---

## Recent Improvements

1. **DirectorControl extracted** - Cleaner separation of concerns
2. **Change input LLM integration** - Feedback now properly evaluated by LLM before generation
3. **Preserve input removed** - Simplified UX, full-width Change input
4. **Full-size image preview** - Click images in SavedImageModal to expand
5. **Delete Images bug fixed** - No longer re-generates after deletion
6. **Duplicate files cleaned up** - Removed old component versions after subfeature migration

---

## Known Issues for Future Iteration

1. **Element acceptance flow** - Elements are appended rather than LLM-evaluated
2. **PromptDetailModal** - Element extraction could use smarter dimension matching
