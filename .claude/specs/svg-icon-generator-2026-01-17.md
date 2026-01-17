# SVG Icon Generator Specification

> A chat-based web application for generating, iterating, and exporting AI-created SVG icons with a fluid, centered-to-chat UX flow.

## Executive Summary

We're building an interactive SVG icon generation tool where users describe the icon they want in natural language, and an AI (Z.ai GLM 4.7 on Cerebras) generates 4 distinct variants. Users can then select a variant to iterate on with feedback, download as SVG, or regenerate entirely with critique of what didn't work.

The core UX innovation is a **centered prompt box** that animates upward after the first submission, transitioning from a focused "describe your icon" experience to a chat-based iteration flow. The 4 SVG variants always appear directly above the prompt input, with chat history scrolling above that.

The application supports two generation modes: **Parallel** (4 separate API calls with prompt diversification for maximum variety) and **Single** (1 API call that outputs 4 SVGs in JSON format for speed).

### Core Features
1. **SVG Generation** - Natural language to 4 distinct SVG icon variants using Cerebras GLM 4.7
2. **Iteration Flow** - Select a variant, provide feedback, generate 4 new refined variants
3. **Regenerate with Critique** - Discard all variants with AI-summarized feedback on what didn't work
4. **Dual Generation Modes** - User-toggleable Parallel vs Single mode for variety/speed tradeoff
5. **Chat History** - Scrollable history showing all generations with all 4 variants visible
6. **SVG Export** - Download any variant as .svg file

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Model | Z.ai GLM 4.7 on Cerebras | 1000+ tokens/sec, strong code generation, user requirement |
| Generation Modes | Parallel (4 calls) + Single (1 call) | User-facing toggle; parallel for diversity, single for speed |
| SVG Constraints | Minimal (allow gradients, styles, etc.) | More creative freedom; sanitization handles security |
| Prompt Variants | Hidden from user | Cleaner UX; users see results not implementation details |
| Error Handling | Auto-retry up to 3x with stricter prompt | Robust SVG output; reduces user friction |
| Iteration Output | Always 4 variants | Consistent exploration even when refining |
| SVG Security | Strict sanitization | Remove scripts, event handlers, external refs |
| Session Persistence | None (MVP) | Simpler implementation; clean slate per session |

---

## All Design Decisions

### UX Flow

**Decision**: Centered prompt box animates to top after first submission
**Rationale**: Creates a focused, unintimidating initial experience. Animation signals transition to "conversation mode."

**Decision**: 4 skeleton placeholders during loading
**Rationale**: Shows where content will appear, maintains layout stability, provides clear loading feedback.

**Decision**: Chat history above variants, variants above input
**Rationale**: Classic chat layout (newest at bottom); variants are always visible without scrolling.

**Decision**: Hover enlarges + adds border; Click selects for iteration
**Rationale**: Clear affordance without cluttering UI; single click is most common action.

**Decision**: Inline selection (highlight + focus prompt box)
**Rationale**: Keeps user in flow; no modal interruption for the common iteration action.

**Decision**: Full display of all 4 variants in chat history
**Rationale**: Users can reference and compare past generations; supports learning what worked.

### Generation Strategy

**Decision**: Two modes - Parallel and Single - with user-facing toggle
**Rationale**: User explicitly requested this. Parallel offers diversity; Single offers speed.

**Decision**: In Parallel mode, use GLM 4.7 for both prompt variants and SVG generation
**Rationale**: User preference for consistency over cost/speed optimization.

**Decision**: In Single mode, model outputs JSON array with 4 SVG strings
**Rationale**: Structured format is reliably parseable; avoids regex extraction from markdown.

**Decision**: Prompt diversification happens server-side, results only shown to user
**Rationale**: Cleaner UX; internal implementation detail doesn't need to be exposed.

### SVG Handling

**Decision**: Minimal SVG constraints (allow gradients, patterns, styles)
**Rationale**: More creative output; lets the model express icons in various styles.

**Decision**: Default viewBox 24x24 (icon standard)
**Rationale**: Industry standard for icon libraries; scales well at any size.

**Decision**: Strict sanitization (no scripts, onclick, external URLs)
**Rationale**: Security requirement when rendering user-influenced content.

**Decision**: Auto-retry up to 3x on malformed SVG with stricter prompt
**Rationale**: Models occasionally produce invalid output; retry with feedback usually succeeds.

**Decision**: SVG-only export (no PNG)
**Rationale**: User preference for MVP; SVG is the proper format for icons.

### Iteration & Regeneration

**Decision**: Selected SVG + new feedback passed to iteration
**Rationale**: Focused context; model knows exactly what to refine.

**Decision**: Regenerate sends summary of why variants were rejected
**Rationale**: Improves next batch by learning from failures; user requested this.

**Decision**: Iteration always produces 4 new variants
**Rationale**: Consistent experience; keeps exploration open even when refining.

### UI/Styling

**Decision**: Minimal light theme
**Rationale**: User preference; clean and professional appearance.

**Decision**: Simple textarea only (no suggestions/presets)
**Rationale**: MVP simplicity; users describe what they want in their own words.

**Decision**: Toggle labeled "Parallel / Single"
**Rationale**: User preference for technical labels; clear for users who understand the tradeoff.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App (Frontend)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React Components (Chat, Variants, History, Controls)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  State Management (React useState/useReducer)            │   │
│  │  - messages[], currentVariants[], mode, isLoading        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POST /api/generate                                      │   │
│  │  - Receives: prompt, mode, selectedSvg?, feedback?       │   │
│  │  - Returns: SSE stream of generation progress            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POST /api/regenerate                                    │   │
│  │  - Receives: originalPrompt, rejectedSvgs[]              │   │
│  │  - Returns: SSE stream with critique-informed generation │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cerebras API (External)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Model: zai-glm-4.7                                      │   │
│  │  Endpoint: https://api.cerebras.ai/v1/chat/completions   │   │
│  │  ~1000 tokens/sec, 131K context (paid), 64K (free)       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### UI Components

#### Initial State (Centered Prompt)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                    ┌───────────────────────┐                    │
│                    │   SVG Icon Generator  │                    │
│                    └───────────────────────┘                    │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐     │
│     │                                                     │     │
│     │   Describe the icon you want to create...          │     │
│     │                                                     │     │
│     └─────────────────────────────────────────────────────┘     │
│              [Parallel ○ Single]           [Generate →]         │
│                                                                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Loading State (After First Submit)

```
┌─────────────────────────────────────────────────────────────────┐
│     ┌─────────────────────────────────────────────────────┐     │
│     │   Describe the icon you want to create...          │     │
│     └─────────────────────────────────────────────────────┘     │
│              [Parallel ● Single]           [Generate →]         │
│                                                                 │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│   │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│      │
│   │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│      │
│   │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│      │
│   │░ skeleton ░│ │░ skeleton ░│ │░ skeleton ░│ │░ skeleton ░│      │
│   │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│      │
│   └───────────┘ └───────────┘ └───────────┘ └───────────┘      │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐     │
│     │   Type feedback or new prompt...                   │     │
│     └─────────────────────────────────────────────────────┘     │
│              [Parallel ● Single]           [Generate →]         │
└─────────────────────────────────────────────────────────────────┘
```

#### Active State (With Results + History)

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ CHAT HISTORY (scrollable)                                 │  │
│  │                                                           │  │
│  │ You: "Create a settings gear icon"                        │  │
│  │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                   │  │
│  │ │ ⚙️    │ │ ⚙️    │ │ ⚙️    │ │ ⚙️    │  ← selected      │  │
│  │ └───────┘ └───────┘ └───────┘ └───────┘                   │  │
│  │                                                           │  │
│  │ You: "Make it more minimal, thinner lines" (selected #4)  │  │
│  │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                   │  │
│  │ │ ⚙️    │ │ ⚙️    │ │ ⚙️    │ │ ⚙️    │                   │  │
│  │ └───────┘ └───────┘ └───────┘ └───────┘                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  CURRENT VARIANTS                          [↻ Regenerate All]   │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │           │ │           │ │  SELECTED │ │           │       │
│  │   ⚙️      │ │   ⚙️      │ │   ⚙️  ✓   │ │   ⚙️      │       │
│  │   [↓]     │ │   [↓]     │ │   [↓]     │ │   [↓]     │       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   Refining variant #3: Add more feedback...            │    │
│  └─────────────────────────────────────────────────────────┘    │
│           [Parallel ● Single]              [Generate →]         │
└─────────────────────────────────────────────────────────────────┘
```

**Interactions**:
- Prompt input → Submits generation request, shows skeleton loaders
- Mode toggle → Switches between Parallel/Single generation
- Hover variant → Enlarges with border highlight
- Click variant → Selects for iteration, highlights, focuses prompt input
- Download button [↓] → Downloads SVG file
- Regenerate All → Sends rejected variants for critique, generates new batch
- Scroll history → View and reference past generations

**States**:
- Initial: Centered prompt, no history
- Loading: Skeleton placeholders, input disabled or showing "Generating..."
- Results: 4 variants displayed, ready for interaction
- Selected: One variant highlighted, prompt shows "Refining variant #N"
- Error: Error message with retry button

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│ User Input  │────▶│ React State  │────▶│ API Route Handler   │
│ (prompt,    │     │ (messages,   │     │ (validates, routes  │
│  selection, │     │  variants,   │     │  to generation      │
│  mode)      │     │  loading)    │     │  strategy)          │
└─────────────┘     └──────────────┘     └─────────────────────┘
                                                   │
                    ┌──────────────────────────────┴──────────────┐
                    ▼                                             ▼
         ┌─────────────────────┐                    ┌─────────────────────┐
         │ PARALLEL MODE       │                    │ SINGLE MODE         │
         │                     │                    │                     │
         │ 1. Generate 4       │                    │ 1. Single API call  │
         │    prompt variants  │                    │    requesting JSON  │
         │ 2. 4 parallel SVG   │                    │    array of 4 SVGs  │
         │    generation calls │                    │ 2. Parse JSON       │
         │ 3. Collect results  │                    │    response         │
         └─────────────────────┘                    └─────────────────────┘
                    │                                             │
                    └──────────────────┬──────────────────────────┘
                                       ▼
                         ┌─────────────────────────┐
                         │ SVG Validation &        │
                         │ Sanitization            │
                         │ - Parse XML             │
                         │ - Remove scripts        │
                         │ - Strip event handlers  │
                         │ - Remove external refs  │
                         │ - Retry on failure (3x) │
                         └─────────────────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │ SSE Stream to Client    │
                         │ - Progress events       │
                         │ - SVG results           │
                         │ - Error handling        │
                         └─────────────────────────┘
```

### Component Architecture

```
components/
├── layout/
│   └── AppShell.tsx              # Root layout with animation states
├── chat/
│   ├── ChatContainer.tsx         # Scrollable history container
│   ├── MessageGroup.tsx          # User prompt + 4 variants group
│   ├── UserMessage.tsx           # User's prompt text display
│   └── VariantGrid.tsx           # 2x2 or 1x4 grid of SVG variants
├── generation/
│   ├── PromptInput.tsx           # Textarea with submit button
│   ├── ModeToggle.tsx            # Parallel/Single toggle switch
│   ├── VariantCard.tsx           # Individual SVG variant container
│   ├── SkeletonCard.tsx          # Loading placeholder
│   └── RegenerateButton.tsx      # "Regenerate All" with critique
├── svg/
│   ├── SvgRenderer.tsx           # Sanitized SVG display component
│   ├── SvgSanitizer.ts           # Security sanitization logic
│   └── SvgDownloader.tsx         # Download button functionality
├── error/
│   └── ErrorState.tsx            # Error display with retry button
└── hooks/
    ├── useGeneration.ts          # Generation API integration
    ├── useSseStream.ts           # SSE stream handling
    └── useAnimatedLayout.ts      # Prompt position animation

app/
├── page.tsx                      # Main page component
├── layout.tsx                    # Root layout with metadata
├── globals.css                   # Tailwind + custom styles
└── api/
    ├── generate/
    │   └── route.ts              # Generation endpoint (SSE)
    └── regenerate/
        └── route.ts              # Regenerate with critique (SSE)

lib/
├── cerebras/
│   ├── client.ts                 # Cerebras SDK wrapper
│   ├── prompts.ts                # System prompts for SVG generation
│   └── types.ts                  # API response types
├── svg/
│   ├── parser.ts                 # SVG parsing and validation
│   ├── sanitizer.ts              # Security sanitization
│   └── types.ts                  # SVG-related types
└── generation/
    ├── parallel.ts               # Parallel mode implementation
    ├── single.ts                 # Single mode implementation
    └── retry.ts                  # Retry logic with stricter prompts
```

---

## External Dependencies

### @cerebras/cerebras_cloud_sdk (latest)

**Purpose**: Official Cerebras API client for accessing GLM 4.7 model

**Installation**:
```bash
npm install @cerebras/cerebras_cloud_sdk
```

**Key APIs**:
```typescript
import Cerebras from "@cerebras/cerebras_cloud_sdk";

// Initialize client
const client = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

// Chat completion (non-streaming)
const response = await client.chat.completions.create({
  model: "zai-glm-4.7",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ],
  temperature: 0.7,
  max_tokens: 4000,
});

// Streaming
const stream = await client.chat.completions.create({
  model: "zai-glm-4.7",
  messages: [...],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  // Process chunk
}
```

**Model Details**:
- Model ID: `zai-glm-4.7`
- Context: 64K tokens (free tier), 131K tokens (paid)
- Max output: 40K tokens
- Speed: ~1000 tokens/sec
- Pricing: $2.25/M input, $2.75/M output

**Important Patterns**:
- Reasoning is enabled by default; may need to disable for faster SVG generation
- API is OpenAI-compatible; error handling follows similar patterns
- Rate limits: 10 req/min (free), 250 req/min (developer tier)

### framer-motion (latest)

**Purpose**: Smooth animations for layout transitions

**Key Usage**:
```typescript
import { motion, AnimatePresence } from "framer-motion";

// Animate prompt box position
<motion.div
  initial={{ y: "40vh" }}
  animate={{ y: isFirstSubmit ? 0 : "40vh" }}
  transition={{ type: "spring", damping: 25 }}
>
  <PromptInput />
</motion.div>
```

---

## API Design

### POST /api/generate

Handles both initial generation and iteration requests.

```typescript
// Request body
interface GenerateRequest {
  prompt: string;
  mode: "parallel" | "single";
  // For iteration (optional)
  selectedSvg?: string;        // SVG code of selected variant
  selectedIndex?: number;      // Which variant was selected (0-3)
}

// SSE Events
type GenerateEvent =
  | { type: "started"; mode: "parallel" | "single" }
  | { type: "variant_complete"; index: number; svg: string }
  | { type: "variant_error"; index: number; error: string; retrying: boolean }
  | { type: "complete"; variants: string[] }
  | { type: "error"; message: string };
```

**Implementation**:
```typescript
// app/api/generate/route.ts
export async function POST(req: Request) {
  const { prompt, mode, selectedSvg, selectedIndex } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        send({ type: "started", mode });

        if (mode === "parallel") {
          const variants = await generateParallel(prompt, selectedSvg, send);
          send({ type: "complete", variants });
        } else {
          const variants = await generateSingle(prompt, selectedSvg, send);
          send({ type: "complete", variants });
        }
      } catch (error) {
        send({ type: "error", message: error.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### POST /api/regenerate

Regenerates with critique of rejected variants.

```typescript
// Request body
interface RegenerateRequest {
  originalPrompt: string;
  rejectedSvgs: string[];      // All 4 SVGs that were rejected
  mode: "parallel" | "single";
}

// Same SSE events as /api/generate
```

**Implementation Flow**:
1. Call GLM 4.7 to summarize why the rejected SVGs didn't work
2. Include that critique in the generation prompt
3. Generate new batch avoiding the identified issues

---

## Prompt Engineering

### System Prompt (SVG Generation)

```typescript
const SVG_SYSTEM_PROMPT = `You are an expert SVG icon designer. Generate clean, scalable SVG icons.

OUTPUT REQUIREMENTS:
- Output ONLY valid SVG code, no explanations or markdown
- Use viewBox="0 0 24 24" for standard icon sizing
- SVG must be self-contained (no external references)
- Optimize for clarity at small sizes

ALLOWED ELEMENTS:
- Basic shapes: path, circle, rect, line, polyline, polygon, ellipse
- Grouping: g, defs, use
- Styling: fill, stroke, stroke-width, stroke-linecap, stroke-linejoin
- Gradients: linearGradient, radialGradient, stop
- Transforms: transform attribute

FORBIDDEN:
- <script> tags
- Event handlers (onclick, onload, etc.)
- External references (xlink:href to URLs)
- <image> or <foreignObject> elements
- Embedded data: URIs

The user will describe what icon they want. Create exactly what they describe.`;
```

### Parallel Mode: Prompt Variant Generation

```typescript
const VARIANT_PROMPT = `Given this user request for an SVG icon: "${userPrompt}"

Generate 4 DISTINCT prompt variations that will produce different but valid interpretations:
1. A literal interpretation
2. A more stylized/artistic interpretation
3. A minimal/simplified interpretation
4. A creative/unique interpretation

Output as JSON array of 4 strings, each being a refined prompt:
["prompt1", "prompt2", "prompt3", "prompt4"]`;
```

### Single Mode: Multi-SVG Generation

```typescript
const SINGLE_MODE_PROMPT = `${SVG_SYSTEM_PROMPT}

Generate 4 DISTINCT SVG icon variations for this request. Each should be a different valid interpretation.

User request: "${userPrompt}"

Output as a JSON object with this exact structure:
{
  "svgs": [
    "<svg viewBox=\"0 0 24 24\"...>...</svg>",
    "<svg viewBox=\"0 0 24 24\"...>...</svg>",
    "<svg viewBox=\"0 0 24 24\"...>...</svg>",
    "<svg viewBox=\"0 0 24 24\"...>...</svg>"
  ]
}`;
```

### Iteration Prompt

```typescript
const ITERATION_PROMPT = `${SVG_SYSTEM_PROMPT}

The user selected this SVG variant and wants changes:

SELECTED SVG:
${selectedSvg}

USER FEEDBACK:
${feedback}

Generate 4 new variations that incorporate the feedback while maintaining the essence of the selected design.`;
```

### Regeneration Critique Prompt

```typescript
const CRITIQUE_PROMPT = `The user rejected these 4 SVG icons for their request "${originalPrompt}":

${rejectedSvgs.map((svg, i) => `Variant ${i + 1}:\n${svg}`).join('\n\n')}

Briefly summarize what was likely wrong with these (be concise, 1-2 sentences):`;

const REGENERATE_WITH_CRITIQUE_PROMPT = `${SVG_SYSTEM_PROMPT}

Previous attempt critique: ${critique}

Create 4 NEW SVG variations for: "${originalPrompt}"
Avoid the issues identified in the critique.`;
```

---

## SVG Sanitization

### Sanitization Rules

```typescript
// lib/svg/sanitizer.ts
const DANGEROUS_ELEMENTS = [
  'script',
  'iframe',
  'object',
  'embed',
  'foreignObject',
  'image', // Can reference external URLs
];

const DANGEROUS_ATTRIBUTES = [
  'onclick', 'onload', 'onerror', 'onmouseover', // Event handlers
  'href', 'xlink:href', // When pointing to external URLs
];

const DANGEROUS_PATTERNS = [
  /javascript:/i,
  /data:/i,       // data: URIs can contain scripts
  /vbscript:/i,
];

export function sanitizeSvg(svgString: string): string | null {
  // 1. Parse as XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  // 2. Check for parse errors
  if (doc.querySelector('parsererror')) {
    return null;
  }

  // 3. Remove dangerous elements
  DANGEROUS_ELEMENTS.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // 4. Remove dangerous attributes
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    DANGEROUS_ATTRIBUTES.forEach(attr => {
      el.removeAttribute(attr);
    });

    // Check all attributes for dangerous patterns
    Array.from(el.attributes).forEach(attr => {
      if (DANGEROUS_PATTERNS.some(p => p.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // 5. Serialize back to string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
}
```

### Retry Logic

```typescript
// lib/generation/retry.ts
const STRICTER_PROMPTS = [
  // Level 1: Remind about format
  `Remember: Output ONLY the SVG code, no markdown or explanations.`,
  // Level 2: Be more explicit
  `Your response must start with <svg and end with </svg>. No other text.`,
  // Level 3: Simplify request
  `Create a simple, minimal SVG icon. Use only basic shapes (path, circle, rect). Output just the SVG.`,
];

export async function generateWithRetry(
  prompt: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const stricterPrompt = attempt > 0
      ? `${prompt}\n\n${STRICTER_PROMPTS[attempt - 1]}`
      : prompt;

    try {
      const response = await callCerebras(stricterPrompt);
      const svg = extractSvg(response);
      const sanitized = sanitizeSvg(svg);

      if (sanitized) {
        return sanitized;
      }

      throw new Error('Invalid SVG structure');
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt + 1} failed:`, error.message);
    }
  }

  throw lastError;
}
```

---

## State Management

### Application State

```typescript
// Types
interface Message {
  id: string;
  type: 'user' | 'generation';
  content?: string;           // User message text
  variants?: string[];        // Generated SVG variants
  selectedIndex?: number;     // Which variant was selected (if any)
  timestamp: Date;
}

interface AppState {
  messages: Message[];
  currentVariants: string[];  // Currently displayed variants
  selectedIndex: number | null;
  mode: 'parallel' | 'single';
  isLoading: boolean;
  isFirstGeneration: boolean; // For animation state
  error: string | null;
}

// Actions
type AppAction =
  | { type: 'START_GENERATION' }
  | { type: 'VARIANT_COMPLETE'; index: number; svg: string }
  | { type: 'GENERATION_COMPLETE'; variants: string[] }
  | { type: 'GENERATION_ERROR'; message: string }
  | { type: 'SELECT_VARIANT'; index: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_MODE'; mode: 'parallel' | 'single' }
  | { type: 'ADD_TO_HISTORY'; message: Message };
```

### React Hook

```typescript
// hooks/useGeneration.ts
export function useGeneration() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const generate = async (prompt: string, selectedSvg?: string) => {
    dispatch({ type: 'START_GENERATION' });

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        mode: state.mode,
        selectedSvg,
        selectedIndex: state.selectedIndex,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const events = parseSSE(text);

      for (const event of events) {
        switch (event.type) {
          case 'variant_complete':
            dispatch({
              type: 'VARIANT_COMPLETE',
              index: event.index,
              svg: event.svg
            });
            break;
          case 'complete':
            dispatch({
              type: 'GENERATION_COMPLETE',
              variants: event.variants
            });
            break;
          case 'error':
            dispatch({
              type: 'GENERATION_ERROR',
              message: event.message
            });
            break;
        }
      }
    }
  };

  return { state, generate, dispatch };
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

**Goal**: Basic working SVG generation with single mode

**Components**:
1. Set up Cerebras client wrapper (`lib/cerebras/client.ts`)
2. Create SVG sanitizer (`lib/svg/sanitizer.ts`)
3. Build basic prompt input component
4. Create `/api/generate` endpoint (single mode only)
5. Build SVG renderer component
6. Basic variant grid display

**Verification**:
- [ ] Can input a prompt and receive 4 SVG variants
- [ ] SVGs render correctly in the browser
- [ ] Invalid SVGs are caught and handled
- [ ] API errors show user-friendly message

---

### Phase 2: Parallel Mode & Retry Logic

**Goal**: Full generation modes with robust error handling

**Components**:
1. Implement parallel mode (prompt variants → 4 parallel calls)
2. Add retry logic with stricter prompts
3. Create mode toggle component
4. Add SSE streaming for progress feedback
5. Show skeleton loaders during generation

**Verification**:
- [ ] Mode toggle switches between Parallel and Single
- [ ] Parallel mode generates more diverse variants
- [ ] Failed generations retry automatically up to 3x
- [ ] Skeleton loaders appear during loading
- [ ] Progress events stream to client

---

### Phase 3: Animation & Layout Transitions

**Goal**: Polished UX with smooth animations

**Components**:
1. Install and configure Framer Motion
2. Implement centered → top animation on first submit
3. Build scrollable chat history container
4. Create history message groups with variant grids
5. Implement hover/selection states for variants

**Verification**:
- [ ] Initial prompt is vertically centered
- [ ] Smooth animation to top on first submit
- [ ] Chat history scrolls independently
- [ ] Variants enlarge on hover
- [ ] Selected variant shows highlight

---

### Phase 4: Iteration & Regeneration

**Goal**: Full iteration workflow

**Components**:
1. Implement variant selection flow
2. Build iteration prompt with selected SVG context
3. Create regenerate button with critique flow
4. Add `/api/regenerate` endpoint
5. Show selected variant indicator in history

**Verification**:
- [ ] Clicking variant selects it for iteration
- [ ] Submitting with selection includes SVG context
- [ ] Regenerate button generates new batch with critique
- [ ] History shows which variant was selected

---

### Phase 5: Export & Polish

**Goal**: Complete, polished application

**Components**:
1. Implement SVG download functionality
2. Add download button to each variant
3. Handle edge cases (empty input, rapid submissions)
4. Accessibility improvements (keyboard nav, focus states)
5. Error states and retry buttons
6. Mobile responsive layout

**Verification**:
- [ ] Download button saves valid .svg file
- [ ] Keyboard navigation works for variant selection
- [ ] Error states display with retry options
- [ ] Works on mobile viewport
- [ ] No console errors in production build

---

## Testing Strategy

### Unit Tests

**SVG Sanitizer**:
- [ ] Removes `<script>` tags
- [ ] Removes event handler attributes
- [ ] Removes external references
- [ ] Preserves valid SVG structure
- [ ] Returns null for invalid SVG

**Prompt Generation**:
- [ ] Parallel mode generates 4 distinct prompts
- [ ] Iteration prompt includes selected SVG
- [ ] Regenerate prompt includes critique

### Integration Tests

**API Endpoints**:
- [ ] `/api/generate` returns SSE stream
- [ ] Single mode returns JSON with 4 SVGs
- [ ] Parallel mode makes 4+ API calls
- [ ] Retry logic triggers on invalid response
- [ ] Error handling returns proper status codes

### E2E Tests

**User Flows**:
- [ ] Initial generation → 4 variants appear
- [ ] Select variant → iteration generates 4 new
- [ ] Regenerate → new batch with different results
- [ ] Download → valid SVG file saved
- [ ] Mode toggle → changes generation behavior

### Manual Testing

- [ ] Animation smoothness on various devices
- [ ] SVG rendering in Chrome, Firefox, Safari
- [ ] Mobile touch interactions
- [ ] Accessibility with screen reader
- [ ] Rate limit handling (free tier)

---

## Security Considerations

- **API Key**: `CEREBRAS_API_KEY` stored in environment variables, never exposed to client
- **SVG Sanitization**: Strict removal of scripts, event handlers, external references before rendering
- **Input Validation**: Prompt length limits, sanitize user input before sending to API
- **Rate Limiting**: Consider implementing client-side rate limiting to avoid hitting API limits
- **CORS**: API routes are same-origin only by default in Next.js
- **No Persistence**: Session-only state means no data storage concerns

---

## Environment Variables

```bash
# .env.local
CEREBRAS_API_KEY=your_cerebras_api_key_here
```

---

## Future Considerations

*Items explicitly deferred from MVP:*

- **PNG Export**: User requested SVG-only for MVP; PNG can be added later via canvas rendering
- **Session Persistence**: LocalStorage saving deferred; can add for recovering work on refresh
- **Color Picker / Style Presets**: Deferred to keep prompt input simple
- **Prompt Suggestions**: Example prompts could help new users but deferred for MVP

---

## Unresolved Questions

*None at this time - all requirements have been clarified through the interview process.*
