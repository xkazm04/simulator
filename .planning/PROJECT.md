# Project Showcase Modal

## What This Is

A full-screen immersive modal that presents completed Simulator projects as cinematic showcases. When viewers click a poster in the gallery, they enter a dark, dramatic presentation of the project's creative journey - base image, transformation dimensions, and all generated images/videos - designed to fit entirely within the viewport without scrolling.

## Core Value

The generated content is the hero - everything else gets out of the way. Minimal chrome, maximum visual impact.

## Requirements

### Validated

<!-- Existing Simulator capabilities this feature builds on -->

- [x] Project data persistence (dimensions, prompts, images, videos) — existing
- [x] Poster gallery at /posters with click handling — existing
- [x] ProjectShowcaseModal component structure — existing (to be redesigned)
- [x] Image/video storage and retrieval via API — existing
- [x] Dimension data model with type, reference, weight — existing

### Active

<!-- New showcase modal requirements -->

- [ ] Full-screen modal overlay with ESC/X to close
- [ ] Immersive/cinematic visual design - dark background, dramatic lighting effects, minimal UI chrome
- [ ] Single viewport layout - all content fits without scrolling
- [ ] Base image display showing the original reference
- [ ] Dimensions displayed as subtle labels/tags near base image or in corner
- [ ] Mixed grid of generated images and videos as primary content
- [ ] Click-to-expand interaction for images/videos showing full size + associated prompt
- [ ] Video playback inline with image grid (mixed media gallery)
- [ ] Read-only presentation mode (no editing capabilities)
- [ ] Responsive design for different screen sizes while maintaining single-viewport goal

### Out of Scope

- Editing project content from showcase — this is view-only presentation
- Social sharing features — may add later but not v1
- Print/export functionality — future enhancement
- Animation transitions between projects — single project view only
- Comments/reactions system — not a social platform

## Context

This is a brownfield addition to the existing Simulator application. The Simulator already has:
- A subfeature architecture with contexts (BrainContext, DimensionsContext, PromptsContext)
- Project persistence via SQLite and API routes
- A poster gallery page at `/app/posters/page.tsx`
- Existing `ProjectShowcaseModal` component that needs complete redesign

The showcase modal should consume existing project data but present it in a completely new, cinematic layout optimized for viewing rather than editing.

**Key data available per project:**
- Base image (text description or uploaded image data)
- Dimensions array (type, label, reference, weight, filterMode, transformMode)
- Generated prompts (sceneType, prompt text, elements, negativePrompt)
- Panel images (generated images with URLs and associated prompt IDs)
- Videos (if generated via Leonardo Seedance)

## Constraints

- **Tech stack**: Must use existing Next.js 16 / React 19 / Tailwind CSS 4 / Framer Motion stack
- **Data source**: Must consume existing project API endpoints and data structures
- **Performance**: Modal should load quickly - consider lazy loading large images
- **Accessibility**: Must support keyboard navigation (ESC to close, arrow keys for gallery if applicable)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full-screen modal vs dedicated page | Modal keeps context, no URL change, faster to close | — Pending |
| Single viewport layout | Cinematic impact, no scroll distraction | — Pending |
| Mixed image/video grid | Unified presentation of all generated media | — Pending |
| Subtle dimension labels | Focus on visuals, not metadata | — Pending |

---
*Last updated: 2026-01-27 after initialization*
