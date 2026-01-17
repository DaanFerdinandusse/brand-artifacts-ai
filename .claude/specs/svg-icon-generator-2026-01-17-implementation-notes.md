# SVG Icon Generator - Implementation Notes

## Phase 1: Core Infrastructure - COMPLETE

### Overview

Phase 1 has been fully implemented. The application provides basic working SVG generation using single mode with the Cerebras GLM 4.7 model.

### What Was Implemented

#### 1. Cerebras Client Wrapper (`lib/cerebras/client.ts`)

- Initializes the Cerebras SDK with API key from environment
- Uses model ID `zai-glm-4.7` as specified
- Provides `generateCompletion()` function that:
  - Accepts messages array with role/content
  - Configurable temperature (default 0.7) and max tokens (default 4000)
  - Returns the content string from the response
  - Includes type guard for ChatCompletionResponse

#### 2. SVG Sanitizer (`lib/svg/sanitizer.ts`)

**Security sanitization** implemented per spec:
- Removes dangerous elements: `script`, `iframe`, `object`, `embed`, `foreignObject`, `image`
- Strips dangerous attributes: all `on*` event handlers
- Blocks dangerous patterns: `javascript:`, `data:`, `vbscript:` URIs
- Removes external URL references in `href`/`xlink:href`

**Utilities**:
- `sanitizeSvg(string)` - Extracts SVG from markdown, sanitizes, validates structure
- `extractSvgsFromJson(string)` - Parses JSON response with `{svgs: [...]}` format, with fallback to direct SVG extraction

#### 3. Prompts (`lib/cerebras/prompts.ts`)

Implemented as specified:
- `SVG_SYSTEM_PROMPT` - Base instructions for icon design with allowed/forbidden elements
- `getSingleModePrompt(userPrompt)` - Generates JSON request for 4 SVG variants
- `getIterationPrompt(selectedSvg, feedback)` - Refinement prompt with selected SVG context
- `STRICTER_PROMPTS` - Array of 3 increasingly strict prompts for retry logic

#### 4. Generation Logic (`lib/generation/single.ts`)

- `generateSingle(prompt, selectedSvg?, onProgress?)` function:
  - Uses iteration prompt when selectedSvg is provided
  - Implements retry logic (up to 3 retries with stricter prompts)
  - Extracts SVGs from JSON response
  - Pads to 4 variants if fewer returned
  - Reports progress via callback for SSE streaming

#### 5. API Route (`app/api/generate/route.ts`)

- POST endpoint accepting `{ prompt, mode, selectedSvg }`
- Returns SSE stream with events:
  - `started` - Generation begun
  - `variant_complete` - Individual SVG ready
  - `complete` - All 4 variants done
  - `error` - Error occurred
- Proper headers for SSE streaming

#### 6. React Components

**PromptInput** (`components/generation/PromptInput.tsx`):
- Textarea with placeholder that changes based on selection state
- Submit button that shows "Generating..." during loading
- Enter key submission (Shift+Enter for newline)
- Input validation (trims, requires non-empty)

**SvgRenderer** (`components/svg/SvgRenderer.tsx`):
- Simple component using `dangerouslySetInnerHTML`
- Sanitization happens server-side before delivery
- CSS class `svg-renderer` for styling hooks

**VariantCard** (`components/generation/VariantCard.tsx`):
- Displays single SVG variant
- Hover effect (scale + shadow)
- Selected state (blue border + checkmark badge)
- Download button (appears on hover)
- Downloads as `icon-variant-{n}.svg`

**SkeletonCard** (`components/generation/SkeletonCard.tsx`):
- Animated placeholder during loading
- Matches VariantCard dimensions

**VariantGrid** (`components/generation/VariantGrid.tsx`):
- Responsive grid: 2 columns on mobile, 4 on md+
- Shows 4 skeleton cards when loading with no variants
- Displays variants with remaining skeletons during progressive load

#### 7. State Management (`hooks/useGeneration.ts`)

- `useGeneration()` hook with state:
  - `variants` - Array of 4 SVG strings
  - `selectedIndex` - Currently selected variant (null if none)
  - `isLoading` - Generation in progress
  - `error` - Error message if any
  - `hasGenerated` - True after first successful generation

- Actions:
  - `generate(prompt)` - Triggers generation with SSE handling
  - `selectVariant(index | null)` - Toggle selection
  - `clearError()` - Dismiss error message

#### 8. Main Page (`app/page.tsx`)

- Centered layout that transitions upward after first generation
- Title visible only before first generation
- Error display with dismiss button
- Variant grid with selection hints
- Selection indicator with clear button

### Key Decisions Made

1. **Server-side sanitization only**: SVGs are sanitized in the API route before sending to client, so `dangerouslySetInnerHTML` is safe.

2. **Regex-based sanitization**: Chose regex over DOM parsing for server-side compatibility (no DOMParser in Node.js without additional dependencies).

3. **JSON fallback extraction**: If the model outputs invalid JSON, we fall back to extracting `<svg>` tags directly with regex.

4. **Padding to 4 variants**: If fewer than 4 SVGs are extracted, we duplicate the last one to maintain consistent grid layout.

5. **CSS transitions over Framer Motion**: Phase 1 uses simple CSS transitions for the layout shift. Framer Motion will be added in Phase 3 for smoother animations.

### Files Created/Modified

```
lib/
├── cerebras/
│   ├── client.ts      # Cerebras SDK wrapper
│   ├── prompts.ts     # System prompts and generators
│   └── types.ts       # TypeScript interfaces
├── svg/
│   ├── sanitizer.ts   # SVG sanitization utilities
│   └── types.ts       # SVG-related types
└── generation/
    └── single.ts      # Single mode generation logic

components/
├── generation/
│   ├── PromptInput.tsx
│   ├── VariantCard.tsx
│   ├── SkeletonCard.tsx
│   └── VariantGrid.tsx
└── svg/
    └── SvgRenderer.tsx

hooks/
└── useGeneration.ts

app/
├── page.tsx           # Main page with centered-to-top animation
├── layout.tsx         # Updated title/description
├── globals.css        # Updated with light theme, removed dark mode
└── api/generate/
    └── route.ts       # SSE endpoint for generation
```

### Verification Checklist Status

- [x] Can input a prompt and receive 4 SVG variants
- [x] SVGs render correctly in the browser
- [x] Invalid SVGs are caught and handled (sanitization + retry logic)
- [x] API errors show user-friendly message
- [x] Build passes without TypeScript errors
- [x] Dev server starts correctly

---

## Phase 2: Parallel Mode & Retry Logic - COMPLETE

### Overview

Phase 2 adds the parallel generation mode and a user-facing toggle to switch between modes. Parallel mode generates more diverse results by first creating 4 distinct prompt variants, then generating SVGs for each in parallel.

### What Was Implemented

#### 1. Prompt Variant Generation (`lib/cerebras/prompts.ts`)

New prompts added for parallel mode:
- `VARIANT_SYSTEM_PROMPT` - System context for the prompt diversification step
- `getVariantGenerationPrompt(userPrompt)` - Generates request for 4 distinct interpretations:
  1. Literal interpretation
  2. Stylized/artistic interpretation
  3. Minimal/simplified interpretation
  4. Creative/unique interpretation
- `getSingleSvgPrompt(refinedPrompt)` - Generates single SVG from a refined prompt
- `getIterationSingleSvgPrompt(selectedSvg, feedback, refinedPrompt)` - For iterating on selected variant with style preserved

#### 2. Parallel Mode Generation (`lib/generation/parallel.ts`)

New generation logic that:
1. **First generates 4 prompt variants** from the user's original prompt using GLM 4.7
   - Parses JSON array response, with fallback to manual variants if parsing fails
   - Uses higher temperature (0.8) for more creative diversity
2. **Then generates 4 SVGs in parallel** - one for each variant prompt
   - Uses `Promise.all` for true parallel execution
   - Each SVG generation has its own retry logic (up to 3 retries with stricter prompts)
   - Temperature decreases on retry attempts for more reliable output
3. **Progress callbacks** for real-time UI updates:
   - `onVariantComplete(index, svg)` - When individual SVG is ready
   - `onVariantError(index, error, retrying)` - When a variant fails (with fallback placeholder)

#### 3. ModeToggle Component (`components/generation/ModeToggle.tsx`)

New UI component:
- Segmented button design (Parallel | Single)
- Active state highlighted in blue
- Disabled state during loading
- Compact design that fits below the prompt input

#### 4. Updated API Route (`app/api/generate/route.ts`)

Now handles both modes:
- Routes to `generateParallel()` or `generateSingle()` based on request mode
- Streams `variant_error` events in addition to existing events
- Parallel mode produces SSE events as each SVG completes

#### 5. Updated useGeneration Hook (`hooks/useGeneration.ts`)

Added mode state and control:
- `mode` state ("parallel" | "single") - defaults to "parallel"
- `setMode(mode)` action to switch modes
- Generation request now includes current mode

#### 6. Updated Main Page (`app/page.tsx`)

Integrated mode toggle:
- Mode toggle positioned below prompt input
- Helper text showing mode benefit ("More diverse results" vs "Faster generation")
- Mode disabled during loading to prevent mid-generation changes

### How It Works

**Single Mode (1 API call)**:
```
User prompt → GLM 4.7 (request 4 SVGs as JSON) → Parse JSON → 4 SVGs
```

**Parallel Mode (5 API calls)**:
```
User prompt → GLM 4.7 (generate 4 prompt variants) → 4 diverse prompts
                                                           ↓
                                        ┌──────────┬──────────┬──────────┐
                                        ↓          ↓          ↓          ↓
                                     GLM 4.7   GLM 4.7   GLM 4.7   GLM 4.7
                                        ↓          ↓          ↓          ↓
                                      SVG 1     SVG 2     SVG 3     SVG 4
```

### Key Decisions Made

1. **Default to parallel mode**: The spec emphasizes diversity, so parallel is the default. Users can switch to single for faster results.

2. **Retry logic per-variant in parallel mode**: Each SVG generation has its own retry attempts, so one slow/failing variant doesn't block others.

3. **Fallback prompt variants**: If the model fails to produce valid JSON for prompt variants, we fall back to simple suffix-based variations to ensure generation continues.

4. **Placeholder SVG on failure**: Rather than failing entirely, a failing variant gets a placeholder SVG so the user sees 4 results (can regenerate to fix).

5. **Temperature reduction on retry**: Retries use progressively lower temperature (0.7 → 0.6 → 0.5 → 0.4) to increase reliability.

### Files Created/Modified

```
lib/
├── cerebras/
│   └── prompts.ts     # Added variant generation prompts
└── generation/
    └── parallel.ts    # NEW: Parallel mode generation logic

components/
└── generation/
    └── ModeToggle.tsx # NEW: Mode toggle UI component

hooks/
└── useGeneration.ts   # Added mode state and setMode

app/
├── page.tsx           # Integrated ModeToggle
└── api/generate/
    └── route.ts       # Routes to parallel/single based on mode
```

### Verification Checklist Status

- [x] Mode toggle switches between Parallel and Single
- [x] Parallel mode generates more diverse variants (uses prompt diversification)
- [x] Failed generations retry automatically up to 3x
- [x] Skeleton loaders appear during loading
- [x] Progress events stream to client
- [x] Build passes without TypeScript errors

### Notes for Next Phase

Phase 3 will add:
- Framer Motion for smoother layout animations
- Centered → top animation on first submit
- Scrollable chat history container
- Enhanced hover/selection states

The current CSS transitions provide basic animation but Framer Motion will enable more sophisticated spring-based animations.

---

## Phase 3: Animation & Layout Transitions - COMPLETE

### Overview

Phase 3 adds polished UX with smooth Framer Motion animations, a scrollable chat history showing all past generations, and enhanced hover/selection states on variant cards.

### What Was Implemented

#### 1. Framer Motion Installation & Configuration

Installed `framer-motion` package for sophisticated React animations.

#### 2. Layout Animation (Centered → Top)

**Main Page (`app/page.tsx`)**:
- Uses `motion.div` with spring physics for the centered-to-top transition
- `paddingTop` animates from `40vh` (centered) to `2rem` (top) on first generation
- Spring config: `stiffness: 200, damping: 30` for a natural, bouncy feel
- `AnimatePresence` wraps elements that should animate in/out (title, errors, hints)
- Title fades out with `y: -20` exit animation

#### 3. Chat History System

**New Types (`lib/cerebras/types.ts`)**:
```typescript
interface Message {
  id: string;
  prompt: string;
  variants: string[];
  selectedIndex?: number;
  timestamp: Date;
}
```

**Updated State (`hooks/useGeneration.ts`)**:
- Added `messages` array to track all generations
- Added `currentPrompt` to track the in-progress prompt
- Each completed generation creates a new `Message` and adds it to history
- Maintains `variants` alias for backwards compatibility
- Selection is cleared after new generation starts

**ChatContainer (`components/chat/ChatContainer.tsx`)**:
- Wraps chat history in a scrollable container
- Auto-scrolls to bottom when new messages arrive
- Shows all messages except the last (which is displayed as "current variants")
- Max height of `40vh` with overflow scrolling
- Styled with subtle background and border

**MessageGroup (`components/chat/MessageGroup.tsx`)**:
- Displays a single generation: user prompt + 4 variants grid
- Smaller variant display for history (no hover effects, read-only)
- Shows which variant was selected (if any) with a checkmark badge
- Animates in with `opacity: 0, y: 20` → `opacity: 1, y: 0`

#### 4. Enhanced Hover/Selection States

**VariantCard (`components/generation/VariantCard.tsx`)**:
- Now uses Framer Motion for all animations
- `whileHover`: scales to 1.05 and lifts up by 4px
- `whileTap`: scales to 0.98 for press feedback
- Spring transition with `stiffness: 400, damping: 25`
- Selection checkmark badge animates in with `scale: 0` → `scale: 1`
- Added variant number badge (top-left) showing `#1`, `#2`, etc.
- Download button fades in on hover with scale animation

**SkeletonCard (`components/generation/SkeletonCard.tsx`)**:
- Uses Framer Motion for entrance animation
- Staggered appearance based on index (50ms delay between cards)
- Animated shimmer effect using `motion.div` with x-axis translation
- Smoother loading experience than CSS-only solution

**VariantGrid (`components/generation/VariantGrid.tsx`)**:
- Wraps grid in `motion.div` with layout animation
- Uses `AnimatePresence` with `mode="popLayout"` for smooth transitions
- Properly passes index to SkeletonCard for staggered animation

### How It Works

**Animation Flow**:
1. Initial state: Prompt centered vertically at `40vh` from top
2. User submits first prompt → title fades out (0.3s), container springs to top
3. Skeleton cards appear with staggered fade-in + shimmer effect
4. Variants fade in as they complete, replacing skeletons
5. User selects variant → checkmark badge springs in, card gets blue highlight
6. User submits iteration → current variants move to history, new generation starts
7. History container expands, auto-scrolls to show new message

**Data Flow for History**:
```
User submits → variants = [], currentPrompt = prompt, isLoading = true
  ↓
SSE events update variants progressively
  ↓
Generation complete → new Message added to messages[], variants displayed
  ↓
User submits again → current variants become history entry, cycle repeats
```

### Key Decisions Made

1. **History excludes current generation**: The chat history shows all messages except the most recent, which is displayed as the "current variants" below the history. This prevents duplication.

2. **Spring physics for layout**: Used spring transitions (not duration-based) for more natural-feeling animations that respond well to interruption.

3. **Staggered skeleton animation**: Each skeleton card appears 50ms after the previous, creating a pleasant cascading effect during loading.

4. **Selection clears on new generation**: When a user submits a new prompt/feedback, the selection is automatically cleared since we're moving to new variants.

5. **Compact history variants**: History shows smaller, non-interactive variant grids to distinguish from the current interactive variants.

### Files Created/Modified

```
components/
├── chat/
│   ├── ChatContainer.tsx  # NEW: Scrollable history wrapper
│   └── MessageGroup.tsx   # NEW: Single generation display
└── generation/
    ├── VariantCard.tsx    # UPDATED: Framer Motion animations
    ├── SkeletonCard.tsx   # UPDATED: Shimmer animation
    └── VariantGrid.tsx    # UPDATED: AnimatePresence

hooks/
└── useGeneration.ts       # UPDATED: messages state, history tracking

lib/cerebras/
└── types.ts               # UPDATED: Added Message interface

app/
└── page.tsx               # UPDATED: Full Framer Motion integration
```

### Verification Checklist Status

- [x] Initial prompt is vertically centered
- [x] Smooth spring animation to top on first submit
- [x] Chat history scrolls independently (max 40vh)
- [x] Variants enlarge on hover (scale 1.05, lift 4px)
- [x] Selected variant shows highlight (blue border, checkmark badge)
- [x] History shows all past generations with variant grids
- [x] Build passes without TypeScript errors
- [x] Dev server starts correctly

### Notes for Next Phase

Phase 4 will add:
- Iteration flow (selecting variant → feedback → new generation based on it)
- Regenerate button with critique (sends rejected SVGs for analysis)
- `/api/regenerate` endpoint for critique-informed generation
- Selected variant indicator in prompt placeholder

---

## Phase 4: Iteration & Regeneration - COMPLETE

### Overview

Phase 4 adds the full iteration workflow where users can select a variant to refine with feedback, or regenerate all variants with AI-powered critique of why the current batch didn't work.

### What Was Implemented

#### 1. Regenerate Prompts (`lib/cerebras/prompts.ts`)

New prompts for critique-informed regeneration:
- `getCritiquePrompt(originalPrompt, rejectedSvgs)` - Asks the model to analyze why the rejected SVGs might not have worked
- `getRegenerateWithCritiquePrompt(originalPrompt, critique)` - Uses the critique to generate new SVGs that avoid the identified issues

#### 2. Regenerate Logic (`lib/generation/regenerate.ts`)

New generation function that:
1. First calls GLM 4.7 to critique the rejected SVGs (lower temperature 0.5 for focused analysis)
2. Uses that critique as context when generating 4 new SVG variants
3. Implements same retry logic as other generators (up to 3 retries with stricter prompts)
4. Provides callbacks for streaming progress (`onCritique`, `onVariantComplete`)

#### 3. API Route (`app/api/regenerate/route.ts`)

New SSE streaming endpoint:
- Accepts `{ originalPrompt, rejectedSvgs, mode }`
- Returns SSE events including new `critique` event type
- Uses same event structure as `/api/generate` for consistency

#### 4. Types (`lib/cerebras/types.ts`)

New types added:
- `RegenerateRequest` interface for the regenerate API body
- New `critique` event type in `GenerateEvent` union

#### 5. RegenerateButton Component (`components/generation/RegenerateButton.tsx`)

New UI component:
- Refresh icon with "Regenerate All" label
- Spinning animation during loading
- Disabled state styling
- Framer Motion hover/tap effects

#### 6. Updated useGeneration Hook (`hooks/useGeneration.ts`)

New state and functionality:
- `isRegenerating` state to distinguish regeneration from initial generation
- `lastCritique` state to display the AI's analysis during regeneration
- `regenerate()` function that calls `/api/regenerate` with current prompt and variants
- Handles the new `critique` SSE event type
- Adds regenerated results to history with "(Regenerated)" prefix

#### 7. Updated Main Page (`app/page.tsx`)

New UI elements:
- "Generated Variants" / "Current Variants" label above variant grid
- RegenerateButton positioned to the right of the label
- Critique display panel (amber/yellow) during regeneration showing AI analysis
- Proper loading states for regeneration vs initial generation

### How It Works

**Iteration Flow (was already working from Phase 3)**:
```
User clicks variant → selectedIndex set → placeholder shows "Refining variant #N"
User enters feedback → generate() called with selectedSvg from currentVariants[selectedIndex]
API receives selectedSvg → uses getIterationPrompt() → 4 new refined variants
History shows original with selection indicator
```

**Regeneration Flow (new in Phase 4)**:
```
User clicks "Regenerate All" → regenerate() called
API receives originalPrompt + all 4 rejectedSvgs
  ↓
Step 1: GLM 4.7 critiques why variants failed
  → SSE: { type: "critique", critique: "..." }
  → UI shows amber panel with critique
  ↓
Step 2: GLM 4.7 generates 4 new SVGs using critique context
  → SSE: { type: "variant_complete", index, svg } (x4)
  → UI updates grid progressively
  ↓
Step 3: Complete
  → SSE: { type: "complete", variants: [...] }
  → History updated with "(Regenerated)" prefix
```

### Key Decisions Made

1. **Critique before regeneration**: The spec requires sending rejected SVGs for analysis. This helps the model understand what went wrong and produce better results on the next attempt.

2. **Critique visible during regeneration**: The amber panel shows users what the AI thinks was wrong, giving transparency into the regeneration process.

3. **History prefix for regenerated**: Using "(Regenerated)" prefix in history helps users understand which generations came from clicking "Regenerate All" vs entering new prompts.

4. **Same mode for regeneration**: Regeneration uses the current mode setting (parallel/single) for consistency, though it currently only uses single-mode style generation internally.

5. **No parallel regeneration**: Since regeneration is already an uncommon action and critique + generation is a sequential operation, we didn't implement parallel-style regeneration with prompt variants.

### Files Created/Modified

```
lib/
├── cerebras/
│   ├── prompts.ts     # UPDATED: Added regeneration prompts
│   └── types.ts       # UPDATED: Added RegenerateRequest, critique event
└── generation/
    └── regenerate.ts  # NEW: Critique + regeneration logic

components/
└── generation/
    └── RegenerateButton.tsx  # NEW: Regenerate button component

hooks/
└── useGeneration.ts   # UPDATED: Added regenerate function, isRegenerating state

app/
├── page.tsx           # UPDATED: Integrated RegenerateButton, critique display
└── api/regenerate/
    └── route.ts       # NEW: SSE endpoint for regeneration
```

### Verification Checklist Status

- [x] Clicking variant selects it for iteration (placeholder updates)
- [x] Submitting with selection includes SVG context (selectedSvg passed to API)
- [x] Regenerate button generates new batch with critique
- [x] History shows which variant was selected (checkmark + "(selected #N)")
- [x] Critique is displayed during regeneration (amber panel)
- [x] Build passes without TypeScript errors
- [x] Dev server starts correctly

---

## Phase 5: Export & Polish - COMPLETE

### Overview

Phase 5 completes the application with SVG export functionality, keyboard navigation, accessibility improvements, mobile responsive layout polish, and edge case handling.

### What Was Implemented

#### 1. Keyboard Navigation (`components/generation/VariantCard.tsx`, `VariantGrid.tsx`)

**VariantCard** now supports:
- `Enter` or `Space` to select/deselect variant
- `D` key to download the SVG
- Arrow keys (left/right/up/down) to navigate between cards
- Full keyboard focus with visible focus ring

**VariantGrid** manages:
- Arrow key navigation logic based on viewport (2 cols mobile, 4 cols desktop)
- Proper focus management between cards
- ARIA group role with descriptive label

#### 2. Enhanced Error States (`app/page.tsx`)

Improved error display with:
- Error icon for visual prominence
- "Try again" button that clears error and focuses prompt input
- "Dismiss" button for manual dismissal
- Close button (X) in corner
- ARIA `role="alert"` and `aria-live="polite"` for screen readers

#### 3. Mobile Responsive Layout

**Global changes**:
- Reduced padding on mobile (`px-3 sm:px-4`)
- Smaller initial padding-top (`30vh` instead of `40vh`)
- Adjusted title size (`text-xl sm:text-2xl`)

**PromptInput**:
- Shorter button text on mobile ("Go" instead of "Generate")
- Reduced padding in input field
- Better button positioning

**ModeToggle**:
- Compact labels on mobile ("4x"/"1x" instead of "Parallel"/"Single")
- Reduced button padding

**RegenerateButton**:
- Shorter text on mobile ("Redo" instead of "Regenerate All")
- Reduced padding and gaps

**VariantGrid**:
- Smaller gaps on mobile (`gap-3 sm:gap-4`)
- Added horizontal padding on mobile (`px-2 sm:px-0`)

#### 4. Accessibility Improvements

All interactive elements now have:
- `aria-label` for screen readers
- `role` attributes where appropriate
- `tabIndex` for keyboard focus
- Visible focus rings with `focus:ring-2 focus:ring-blue-500`
- `aria-pressed` for toggle states
- `aria-hidden` for decorative icons
- Screen reader-only labels (`sr-only` class)

**Specific components**:
- VariantCard: `role="button"`, descriptive `aria-label`
- ModeToggle: `role="radiogroup"` with `role="radio"` buttons
- PromptInput: `label`, `aria-describedby` for hint text
- Error state: `role="alert"`, `aria-live="polite"`

#### 5. Edge Case Handling (`hooks/useGeneration.ts`)

**Debouncing**:
- 500ms minimum between submissions to prevent rapid clicking
- Uses `lastSubmitTimeRef` to track timing

**Request Cancellation**:
- AbortController cancels previous request when new one starts
- Gracefully handles abort errors without showing error message

**Input Validation**:
- Trims whitespace from prompts
- Shows error message for empty input
- Validates before submission

### Key Decisions Made

1. **Mobile-first abbreviations**: Used shorter text on mobile (Go, 4x/1x, Redo) to save space while keeping full text on larger screens for clarity.

2. **Focus ring offset**: Added `focus:ring-offset-2` to ensure focus rings don't overlap with element borders.

3. **Debounce over throttle**: Used debounce timing (500ms minimum between submissions) rather than throttle to ensure the last submission always goes through.

4. **Abort previous requests**: When a new request starts, we abort any in-flight request to prevent race conditions and stale data.

5. **Download via D key**: Added keyboard shortcut for download that matches common UI patterns (D for Download).

### Files Modified

```
components/
├── generation/
│   ├── VariantCard.tsx      # UPDATED: Keyboard nav, ARIA, focus styles
│   ├── VariantGrid.tsx      # UPDATED: Arrow key navigation, ARIA group
│   ├── PromptInput.tsx      # UPDATED: Mobile layout, accessibility
│   ├── ModeToggle.tsx       # UPDATED: Mobile labels, ARIA radiogroup
│   └── RegenerateButton.tsx # UPDATED: Mobile layout, ARIA

hooks/
└── useGeneration.ts         # UPDATED: Debounce, abort controller, validation

app/
└── page.tsx                 # UPDATED: Error UI, mobile padding
```

### Verification Checklist Status

- [x] Download button saves valid .svg file
- [x] Keyboard navigation works for variant selection (Enter/Space/Arrows/D)
- [x] Error states display with retry options
- [x] Works on mobile viewport (responsive layout)
- [x] No console errors in production build
- [x] Focus states visible on all interactive elements
- [x] ARIA labels on all interactive elements
- [x] Rapid submission prevention (500ms debounce)
- [x] Build passes without TypeScript errors
