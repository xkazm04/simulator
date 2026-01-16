# Simulator - What If Image Generator

A creative tool for combining cultural references (games, movies, art) to generate unique image prompts for AI image generators like Leonardo AI or Midjourney.

## Core Concept: Content-Swap Transformation

The simulator uses a **content-swap** approach:
- **PRESERVE** the base visual FORMAT (camera angles, UI layout, medium)
- **SWAP** the CONTENT within that structure

**Example:** "Baldur's Gate in Star Wars" means:
- Base format: Isometric RPG screenshot (preserved)
- Content swaps: tavern → cantina, wizard → Jedi, sword → lightsaber

## Features

### Main Simulator
- **Image Upload with AI Analysis**: Upload a reference image, Gemini Vision extracts structured description
- **Smart Breakdown**: Type a vision sentence, AI parses it into structured dimensions
- **Dimension Cards**: Environment, Art Style, Characters, Mood, Action, Technology, etc.
- **Output Modes**: Toggle between Gameplay (with HUD) and Concept Art (clean)
- **Iterative Refinement**: Lock prompts/elements, provide feedback, regenerate

### Feedback System
- **Lock Prompts**: Preserve entire prompts as references
- **Lock Elements**: Fine-grained control over individual aspects
- **Accept Elements**: AI refines dimensions based on what you like
- **Element to Dimension**: Convert locked elements into reusable dimension cards

### Character Studio
- Focused character generation (in development)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
├── features/simulator/
│   ├── SimulatorFeature.tsx      # Main component (thin wrapper)
│   ├── types.ts                   # TypeScript definitions
│   ├── components/
│   │   ├── variants/OnionLayout.tsx  # Layered ring UI layout
│   │   ├── BaseImageInput.tsx        # Image upload with AI parsing
│   │   ├── SmartBreakdown.tsx        # AI vision parser (text)
│   │   ├── DimensionCard.tsx         # Individual dimension input
│   │   ├── DimensionGrid.tsx         # Grid of dimensions
│   │   ├── FeedbackPanel.tsx         # Generate/feedback controls
│   │   ├── PromptOutput.tsx          # Generated prompts display
│   │   ├── PromptCard.tsx            # Individual prompt card
│   │   ├── PromptDetailModal.tsx     # Full prompt view
│   │   ├── ElementChip.tsx           # Lockable element label
│   │   └── ElementToDimensionButton.tsx
│   ├── hooks/
│   │   └── useSimulator.ts       # State management hook
│   └── lib/
│       ├── promptBuilder.ts      # Prompt generation logic
│       ├── simulatorAI.ts        # API client for LLM calls
│       ├── llmPrompts.ts         # LLM prompt templates
│       ├── defaultDimensions.ts  # Dimension presets & examples
│       └── gameUIPresets.ts      # Game UI genre presets
├── api/ai/
│   ├── simulator/route.ts        # Anthropic Claude API endpoint
│   └── image-describe/route.ts   # Gemini Vision API endpoint
├── lib/
│   ├── gemini.ts                 # Universal Gemini AI provider
│   └── utils.ts                  # General utilities
└── utils/apiErrorHandling.ts     # API utilities
```

## Environment Variables

```env
ANTHROPIC_API_KEY=your_anthropic_key      # For Claude (text breakdown, element conversion)
GOOGLE_AI_API_KEY=your_google_key         # For Gemini Vision (image analysis)
NEXT_PUBLIC_USE_REAL_SIMULATOR_AI=true    # Enable Claude features (optional, defaults to mock)
```

Note: Gemini Vision (image upload analysis) always attempts the real API. If `GOOGLE_AI_API_KEY` is missing or the API fails, an error is shown on the image upload.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **AI**: Anthropic Claude API + Google Gemini Vision (with mock fallbacks)

## Design Philosophy

- **Clean Manuscript Style**: Dark theme, monospace accents, cyan/purple highlights
- **Reference-Based**: Uses cultural references users know, not abstract terms
- **Iterative**: Feedback loop for refining results
- **Content-Swap**: Preserves visual structure, transforms content
