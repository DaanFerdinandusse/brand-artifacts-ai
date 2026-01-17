# Brand Artifact Studio Specification

> A conversational AI-powered tool for rapidly creating branded SVG assets through template-based generation.

## Executive Summary

Brand Artifact Studio enables non-technical users to create professional branded assets through natural conversation with an AI agent. Users describe what they want in plain language, and the AI generates JSON configurations that instantly render as customizable SVG templates in the browser.

The core innovation is speed through constraints: rather than free-form generation (which is slow and unpredictable), we use a fixed library of 10-15 high-quality React-based SVG templates that the AI populates via JSON configuration. This allows sub-2-second generation times while maintaining design quality. The architecture separates concerns cleanly to enable parallel development by three engineers: one on templates/JSON schemas, one on API/infrastructure, and one on UI.

The initial release focuses on marketing/brand icons (64-256px) with plans to expand to email templates and PowerPoint templates in future versions.

### Core Features
1. **Conversational Interface** - Chat-based interaction with AI that asks clarifying questions before generating
2. **Instant Template Rendering** - JSON configs render immediately in React components, no server-side image generation
3. **Artifact History** - Generated assets appear as clickable pills in chat, viewable in side panel
4. **SVG Export** - Direct download of vector assets

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation approach | Fixed templates + JSON config | Speed (sub-2s) over flexibility; AI generates config, not raw SVG |
| LLM choice | Claude Haiku via Agent SDK | Fast enough for <2s target, cost-effective, good structured output |
| Streaming strategy | SSE stream, wait for complete JSON | Simpler than partial JSON parsing; typing indicator provides feedback |
| State persistence | Session-only (no database) | Simplifies MVP; no auth needed; can add persistence later |
| Template architecture | Single component with switch | Centralized logic, easier to add new template types |
| Color system | Free hex/RGB input | Users need exact brand colors; curated palettes too limiting |

---

## All Design Decisions

### AI Agent Behavior

**Decision**: AI asks clarifying questions before generating when requests are ambiguous
**Rationale**: Better results than making assumptions; users prefer brief back-and-forth over wrong output. Uses Claude Agent SDK's tool-based clarification pattern.

**Decision**: Each generation creates a new artifact; iterations use previous artifact as base
**Rationale**: Preserves history for comparison; user can always go back. "Adjust this one" references prior config internally.

**Decision**: AI provides brief explanation of design choices with each artifact
**Rationale**: Helps users understand and refine; too minimal feels robotic, too verbose is annoying.

**Decision**: No brand memory across session
**Rationale**: Keeps scope simple for v1; user can specify preferences each time. Brand presets deferred to future.

### Template System

**Decision**: Use-case based template categories (not style-based)
**Rationale**: Users think in terms of what they need (app icon, badge, logo) not abstract styles (minimalist, bold).

**Decision**: 10-15 templates at launch
**Rationale**: Comprehensive enough to be useful; not so many that AI struggles to choose correctly.

**Decision**: Static SVGs only, no animation for v1
**Rationale**: Simpler export, faster development; animations can be added later without schema changes.

**Decision**: Moderately flexible JSON schema
**Rationale**: Style, colors, stroke width, fill patterns, optional elements. Enough control for brand customization without overwhelming complexity.

**Decision**: Templates hardcoded in client bundle
**Rationale**: Faster load times, simpler architecture; adding templates requires deploy but that's acceptable for v1.

**Decision**: Distinct schema per template type (starting with SVG only)
**Rationale**: Cleaner validation, easier AI prompt engineering; unified schema adds unnecessary complexity.

### API & Infrastructure

**Decision**: Next.js API routes (not separate backend)
**Rationale**: Full-stack in one repo; simpler deployment; sufficient for session-based app without persistence.

**Decision**: SSE streaming for AI responses
**Rationale**: Real-time feedback during generation; typing indicator shows progress; client appends to state array with memo optimization.

**Decision**: Artifact JSON embedded in chat response (tool result)
**Rationale**: Single stream, no separate fetches; client parses tool_use/tool_result events for artifacts.

**Decision**: Auto-retry on invalid JSON (not user-facing error)
**Rationale**: Better UX; AI can often fix its own mistakes; only surface error after N retries fail.

**Decision**: No authentication for v1
**Rationale**: Anonymous usage reduces friction; no persistence means no account needed; can add OAuth later.

### User Interface

**Decision**: Centered layout initially, 50/50 split when artifact exists
**Rationale**: Focus on conversation when no artifact; balanced view for editing/refinement flow.

**Decision**: Prompt box animates from center to bottom after first message
**Rationale**: Familiar chat UX pattern; smooth transition with Framer Motion.

**Decision**: Artifacts appear as clickable pills in chat history
**Rationale**: Maintains conversation context; easy to see which message generated which artifact.

**Decision**: Single artifact view in panel (not gallery)
**Rationale**: Cleaner focus; pills in chat serve as the gallery/history.

**Decision**: Panel hidden until first artifact, then toggleable
**Rationale**: Don't show empty UI; sidebar toggle icon appears after first generation.

**Decision**: Animated transitions between artifacts
**Rationale**: Smooth, polished feel; Framer Motion makes this easy.

**Decision**: Typing indicator during generation
**Rationale**: Feels conversational; simple to implement; matches chat app conventions.

**Decision**: Subtle example prompts below input on initial screen
**Rationale**: Helps users get started without cluttering UI; not as aggressive as clickable chips.

**Decision**: No favorites system for v1
**Rationale**: Keeps UI simple; all artifacts accessible via chat scroll; can add later if needed.

### Export

**Decision**: SVG-only export for v1
**Rationale**: Maintains vector quality; PNG conversion adds complexity; users can convert externally if needed.

**Decision**: Download button in artifact panel header
**Rationale**: Prominent, always visible when viewing artifact; doesn't clutter the artifact itself.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Next.js Frontend                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │   │
│  │  │ Chat UI      │  │ Artifact     │  │ Template Components    │ │   │
│  │  │ Components   │  │ Panel        │  │ (SVG Renderers)        │ │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────┘ │   │
│  │         │                 │                        │              │   │
│  │         └────────┬────────┴────────────────────────┘              │   │
│  │                  │                                                 │   │
│  │         ┌────────▼────────┐                                       │   │
│  │         │  State Manager  │  (React state + useMemo)              │   │
│  │         │  - messages[]   │                                       │   │
│  │         │  - artifacts[]  │                                       │   │
│  │         │  - activeArtifact                                       │   │
│  │         └────────┬────────┘                                       │   │
│  └──────────────────│────────────────────────────────────────────────┘   │
│                     │ SSE                                                │
└─────────────────────│────────────────────────────────────────────────────┘
                      │
┌─────────────────────│────────────────────────────────────────────────────┐
│                     │         Next.js API Routes                         │
│         ┌───────────▼───────────┐                                        │
│         │   /api/chat           │                                        │
│         │   - SSE endpoint      │                                        │
│         │   - Session state     │                                        │
│         └───────────┬───────────┘                                        │
│                     │                                                    │
│         ┌───────────▼───────────┐                                        │
│         │  Claude Agent SDK     │                                        │
│         │  (TypeScript)         │                                        │
│         │  - generate_artifact  │                                        │
│         │  - ask_clarification  │                                        │
│         │  - list_templates     │                                        │
│         └───────────┬───────────┘                                        │
│                     │                                                    │
└─────────────────────│────────────────────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  Claude API   │
              │  (Haiku)      │
              └───────────────┘
```

### UI Components

#### Initial State (No Messages)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                                                         │
│                                                                         │
│                                                                         │
│                     ┌───────────────────────────────┐                   │
│                     │                               │                   │
│                     │    Create a branded asset...  │                   │
│                     │                               │                   │
│                     └───────────────────────────────┘                   │
│                     Try: "Blue rocket icon for my startup"              │
│                                                                         │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Chat State (No Artifact)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     ┌───────────────────────────────┐                   │
│                     │ User: Create a rocket icon    │                   │
│                     └───────────────────────────────┘                   │
│                     ┌───────────────────────────────┐                   │
│                     │ AI: What style are you        │                   │
│                     │ looking for? Minimalist,      │                   │
│                     │ detailed, or playful?         │                   │
│                     └───────────────────────────────┘                   │
│                     ┌───────────────────────────────┐                   │
│                     │ User: Minimalist, blue tones  │                   │
│                     └───────────────────────────────┘                   │
│                     ┌───────────────────────────────┐                   │
│                     │ AI is typing...               │                   │
│                     └───────────────────────────────┘                   │
│                                                                         │
│                     ┌───────────────────────────────┐                   │
│                     │    Type your message...       │                   │
│                     └───────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Chat + Artifact State (50/50 Split)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                    [<]  │
├────────────────────────────────────┬────────────────────────────────────┤
│                                    │  [x]                    [↓ Export] │
│  ┌────────────────────────────┐    │                                    │
│  │ User: Minimalist rocket    │    │         ┌──────────────┐          │
│  └────────────────────────────┘    │         │              │          │
│  ┌────────────────────────────┐    │         │    🚀        │          │
│  │ AI: Here's your icon with  │    │         │   (SVG)      │          │
│  │ a clean blue gradient.     │    │         │              │          │
│  │ ┌────────────────────────┐ │    │         └──────────────┘          │
│  │ │ 📎 Rocket Icon         │ │    │                                    │
│  │ └────────────────────────┘ │    │                                    │
│  └────────────────────────────┘    │                                    │
│                                    │                                    │
│  ┌────────────────────────────┐    │                                    │
│  │    Type your message...    │    │                                    │
│  └────────────────────────────┘    │                                    │
└────────────────────────────────────┴────────────────────────────────────┘
```

**Interactions**:
- Prompt box in center → animates to bottom on first message
- Chat stays centered until artifact generated → slides left to 50%
- Click artifact pill in chat → opens that artifact in right panel
- `[x]` button → collapses artifact panel, chat re-centers
- `[<]` sidebar icon (when panel closed) → re-opens last viewed artifact
- `[↓ Export]` → downloads SVG file

**States**:
- Initial: Large centered prompt box with subtle example suggestions
- Chatting: Messages centered, prompt at bottom, typing indicator when AI responding
- With Artifact: 50/50 split, artifact panel on right
- Panel Collapsed: Chat re-centered, sidebar toggle icon visible
- Error: Inline error message in chat with retry suggestion
- Loading: Typing indicator ("AI is thinking...")

### Data Flow

```
User Input
    │
    ▼
┌─────────────────┐     SSE POST     ┌─────────────────┐
│  React State    │ ───────────────► │  /api/chat      │
│  - messages     │                  │                 │
│  - artifacts    │                  │  Maintains      │
└─────────────────┘                  │  conversation   │
    ▲                                │  context        │
    │                                └────────┬────────┘
    │                                         │
    │ SSE Events:                             ▼
    │ - text_delta                   ┌─────────────────┐
    │ - tool_use_start               │  Claude Agent   │
    │ - tool_result                  │  SDK            │
    │                                │                 │
    └────────────────────────────────┤  Tools:         │
                                     │  - generate_artifact
                                     │  - ask_clarification
                                     │  - list_templates
                                     └────────┬────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │  Claude Haiku   │
                                     │  API            │
                                     └─────────────────┘

When tool_result contains artifact:
┌─────────────────┐
│  Artifact JSON  │
│  {              │
│   template: "..." │
│   config: {...}  │
│  }              │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     props     ┌─────────────────┐
│  artifacts[]    │ ────────────► │  TemplateRenderer│
│  state update   │               │  <IconTemplate   │
│                 │               │    config={...}  │
└─────────────────┘               │  />             │
                                  └─────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  SVG Output     │
                                  │  (in browser)   │
                                  └─────────────────┘
```

### Component Architecture

```
brand-artifact-studio/
├── app/
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Main chat + artifact page
│   ├── api/
│   │   └── chat/
│   │       └── route.ts           # SSE endpoint for chat
│   └── globals.css                # Tailwind base styles
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx      # Main chat wrapper, handles layout transitions
│   │   ├── MessageList.tsx        # Scrollable message history
│   │   ├── Message.tsx            # Single message (user or AI)
│   │   ├── ArtifactPill.tsx       # Clickable artifact reference in chat
│   │   ├── PromptInput.tsx        # Text input with submit
│   │   └── TypingIndicator.tsx    # "AI is thinking..." animation
│   │
│   ├── artifact/
│   │   ├── ArtifactPanel.tsx      # Right-side panel container
│   │   ├── ArtifactHeader.tsx     # Close button, export button
│   │   ├── ArtifactViewer.tsx     # Renders current artifact
│   │   └── SidebarToggle.tsx      # Icon to re-open collapsed panel
│   │
│   └── templates/
│       ├── TemplateRenderer.tsx   # Switch component that selects template
│       ├── icons/
│       │   ├── IconTemplate.tsx   # Main icon template with variant logic
│       │   └── variants/          # Style-specific SVG generators
│       │       ├── AppIcon.tsx
│       │       ├── Badge.tsx
│       │       ├── Logo.tsx
│       │       ├── SocialIcon.tsx
│       │       ├── Avatar.tsx
│       │       └── ... (10-15 total)
│       └── schemas/
│           └── icon.schema.ts     # TypeScript types + Zod validation
│
├── lib/
│   ├── agent/
│   │   ├── index.ts               # Agent setup and configuration
│   │   ├── tools.ts               # Tool definitions
│   │   └── prompts.ts             # System prompts for the agent
│   │
│   ├── sse/
│   │   ├── client.ts              # SSE client hook for React
│   │   └── parser.ts              # Parse SSE events into typed messages
│   │
│   └── export/
│       └── svg.ts                 # SVG download utility
│
├── hooks/
│   ├── useChat.ts                 # Chat state management
│   ├── useArtifacts.ts            # Artifact state + selection
│   └── useSSE.ts                  # SSE connection management
│
├── types/
│   ├── chat.ts                    # Message, Conversation types
│   ├── artifact.ts                # Artifact, ArtifactConfig types
│   └── sse.ts                     # SSE event types
│
└── config/
    └── templates.ts               # Template registry (names, schemas, defaults)
```

---

## API Design

### SSE Chat Endpoint

```typescript
// app/api/chat/route.ts

import { Agent } from '@anthropic-ai/agent-sdk';

export async function POST(request: Request): Promise<Response> {
  const { messages, conversationId } = await request.json();

  // TODO: Implement
  // 1. Initialize/retrieve agent with conversation context
  // 2. Configure tools (generate_artifact, ask_clarification, list_templates)
  // 3. Stream response via SSE
  // 4. Parse tool calls, validate artifact JSON against schema
  // 5. On invalid JSON, auto-retry up to 3 times
  // 6. Return SSE stream with text_delta, tool_use, tool_result events
}
```

**Request Body**:
```typescript
interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    artifacts?: ArtifactReference[];  // Previous artifacts for context
  }>;
  conversationId?: string;  // For session continuity
}
```

**SSE Event Types**:
```typescript
// Text streaming
interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

// Tool invocation start
interface ToolUseStartEvent {
  type: 'tool_use_start';
  tool: 'generate_artifact' | 'ask_clarification' | 'list_templates';
  id: string;
}

// Tool result (contains artifact for generate_artifact)
interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  result: ArtifactConfig | ClarificationQuestion | TemplateList;
}

// Stream complete
interface DoneEvent {
  type: 'done';
  messageId: string;
}

// Error (after retries exhausted)
interface ErrorEvent {
  type: 'error';
  message: string;
  retryable: boolean;
}
```

### Agent Tools

```typescript
// lib/agent/tools.ts

import { z } from 'zod';

// Tool: generate_artifact
// Creates a new artifact with the specified template and configuration
export const generateArtifactTool = {
  name: 'generate_artifact',
  description: 'Generate a branded SVG artifact using a template',
  parameters: z.object({
    template: z.enum([
      'app-icon',
      'badge',
      'logo',
      'social-icon',
      'avatar',
      'decorative-element',
      'icon-set',
      'banner-icon',
      'notification-badge',
      'status-indicator',
      // ... more template types
    ]),
    config: z.object({
      // Common fields
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      backgroundColor: z.string().optional(),
      size: z.number().min(24).max(512).default(128),

      // Template-specific fields validated per template
      // See icon.schema.ts for full definitions
    }),
    explanation: z.string().describe('Brief explanation of design choices'),
  }),
};

// Tool: ask_clarification
// Ask the user for more details before generating
export const askClarificationTool = {
  name: 'ask_clarification',
  description: 'Ask the user a clarifying question when the request is ambiguous',
  parameters: z.object({
    question: z.string(),
    options: z.array(z.string()).optional().describe('Suggested options if applicable'),
  }),
};

// Tool: list_templates
// Show available templates to the user
export const listTemplatesTool = {
  name: 'list_templates',
  description: 'List available template types and their capabilities',
  parameters: z.object({
    category: z.enum(['all', 'icons', 'badges', 'logos']).optional(),
  }),
};
```

### Icon Schema Definition

```typescript
// components/templates/schemas/icon.schema.ts

import { z } from 'zod';

// Base configuration shared by all icon templates
const baseIconConfig = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  size: z.number().min(24).max(512).default(128),
  strokeWidth: z.number().min(0).max(8).default(2),
  cornerRadius: z.number().min(0).max(50).default(0),
});

// App Icon template
export const appIconSchema = baseIconConfig.extend({
  template: z.literal('app-icon'),
  shape: z.enum(['circle', 'rounded-square', 'squircle']),
  iconType: z.string(), // The actual icon content descriptor
  gradient: z.object({
    enabled: z.boolean().default(false),
    direction: z.enum(['top-bottom', 'left-right', 'diagonal']).optional(),
    endColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).optional(),
  shadow: z.boolean().default(false),
});

// Badge template
export const badgeSchema = baseIconConfig.extend({
  template: z.literal('badge'),
  text: z.string().max(20).optional(),
  shape: z.enum(['circle', 'shield', 'ribbon', 'star']),
  border: z.boolean().default(true),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Logo template
export const logoSchema = baseIconConfig.extend({
  template: z.literal('logo'),
  text: z.string().max(10).optional(),
  iconPosition: z.enum(['left', 'top', 'center', 'none']),
  fontWeight: z.enum(['light', 'regular', 'bold']).default('bold'),
  letterSpacing: z.number().min(-2).max(10).default(0),
});

// ... additional template schemas

// Union type for all templates
export const iconConfigSchema = z.discriminatedUnion('template', [
  appIconSchema,
  badgeSchema,
  logoSchema,
  // ... other schemas
]);

export type IconConfig = z.infer<typeof iconConfigSchema>;
export type AppIconConfig = z.infer<typeof appIconSchema>;
export type BadgeConfig = z.infer<typeof badgeSchema>;
export type LogoConfig = z.infer<typeof logoSchema>;
```

### Artifact Type Definitions

```typescript
// types/artifact.ts

import { IconConfig } from '@/components/templates/schemas/icon.schema';

export interface Artifact {
  id: string;
  createdAt: Date;
  template: string;
  config: IconConfig;
  explanation: string;
  messageId: string;  // Links to the message that created it
}

export interface ArtifactReference {
  id: string;
  template: string;
  preview?: string;  // Base64 thumbnail for history
}
```

### Chat Type Definitions

```typescript
// types/chat.ts

import { ArtifactReference } from './artifact';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  artifacts?: ArtifactReference[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  messages: Message[];
  artifacts: Artifact[];
}
```

---

## Implementation Phases

### Phase 1: Foundation & Single Template

**Goal**: End-to-end flow working with one template type

**Components**:
1. Next.js project setup with TypeScript, Tailwind, Framer Motion
2. Basic chat UI (centered layout, no artifact panel yet)
3. Single SSE API endpoint with Claude Agent SDK
4. One template: App Icon with basic config (shape, colors, size)
5. Template renders in response, appears in chat as text initially

**Verification**:
- [ ] User can type message and receive streamed AI response
- [ ] AI can generate valid app-icon JSON config
- [ ] Config renders as SVG in chat message area
- [ ] Invalid JSON triggers auto-retry (visible in server logs)

**Engineer Ownership**:
- Infrastructure: API route, SSE streaming, Agent SDK setup
- Templates: AppIcon component, schema, validation
- UI: Chat components, message rendering, prompt input

---

### Phase 2: Artifact Panel & Interactions

**Goal**: Full 50/50 layout with artifact viewing and export

**Components**:
1. Artifact panel (right side) with Framer Motion transitions
2. Artifact pills in chat messages (clickable)
3. Layout transition: centered → 50/50 when artifact generated
4. Panel collapse/expand with sidebar toggle
5. SVG export/download functionality
6. Typing indicator during generation

**Verification**:
- [ ] Chat slides left when first artifact generated
- [ ] Clicking artifact pill opens it in panel
- [ ] Panel smoothly collapses/expands
- [ ] Download button exports valid SVG file
- [ ] Typing indicator shows during AI generation

**Engineer Ownership**:
- Infrastructure: None (phase 1 complete)
- Templates: SVG export utility, ensuring templates are export-compatible
- UI: All panel components, animations, layout transitions

---

### Phase 3: Additional Templates & Polish

**Goal**: Full template library and production-ready polish

**Components**:
1. Remaining 9-14 icon templates (badge, logo, social-icon, etc.)
2. Complete JSON schemas for all templates
3. Agent prompt refinement for template selection
4. Error handling UI (inline error messages)
5. Initial screen with example prompt suggestions
6. Animation polish and loading states

**Verification**:
- [ ] All 10-15 templates render correctly
- [ ] AI correctly selects appropriate template for requests
- [ ] Clarification questions work (ask_clarification tool)
- [ ] Error states display correctly with retry option
- [ ] Example prompts on initial screen work when clicked

**Engineer Ownership**:
- Infrastructure: Error handling, retry logic refinement
- Templates: All remaining template components and schemas
- UI: Error states, initial screen, final polish

---

### Phase 4: Iteration & Refinement Flow

**Goal**: Smooth iterative editing experience

**Components**:
1. "Adjust this artifact" detection and handling
2. Previous artifact config passed to AI for iterations
3. Artifact versioning within conversation
4. list_templates tool implementation
5. Performance optimization (memo, virtualization if needed)

**Verification**:
- [ ] "Make it bluer" correctly references and modifies previous artifact
- [ ] AI shows available templates when asked
- [ ] No unnecessary re-renders during streaming
- [ ] Smooth scrolling with many messages

**Engineer Ownership**:
- Infrastructure: Context passing for iterations, list_templates tool
- Templates: Ensure all configs are iteration-compatible
- UI: Performance optimization, scroll handling

---

## Testing Strategy

### API Layer

**Automated**:
- [ ] Unit tests for JSON schema validation (valid configs pass, invalid rejected)
- [ ] Unit tests for SSE event parsing
- [ ] Integration test: send message → receive valid SSE stream
- [ ] Auto-retry logic: verify retries on invalid JSON, max 3 attempts

**Manual**:
- [ ] Test with various ambiguous prompts to verify clarification flow
- [ ] Test API under slow network conditions
- [ ] Verify error messages are user-friendly

### Template System

**Automated**:
- [ ] Snapshot tests for each template with sample configs
- [ ] Schema validation tests: all valid configs render, invalid throw
- [ ] SVG export tests: output is valid SVG, correct dimensions

**Manual**:
- [ ] Visual review of all templates across size range (24px - 512px)
- [ ] Color contrast verification for accessibility
- [ ] Export to design tools (Figma, Sketch) to verify compatibility

### UI Components

**Automated**:
- [ ] Component rendering tests with React Testing Library
- [ ] Animation completion tests (Framer Motion)
- [ ] State transitions: centered → split → collapsed

**Manual**:
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness check
- [ ] Animation smoothness on lower-end devices
- [ ] Accessibility: keyboard navigation, screen reader

---

## Security Considerations

- **No user data persistence**: Session-only storage eliminates data breach risk
- **Input sanitization**: All user input passed to LLM should be treated as untrusted; no direct execution
- **SVG safety**: Generated SVGs must not include script tags or external references; validate before rendering
- **Rate limiting**: While not surfaced to users, implement backend rate limiting to prevent abuse
- **API key protection**: Anthropic API key must be server-side only, never exposed to client
- **CORS**: API routes should only accept requests from same origin

---

## Future Considerations

- **Email templates**: Add HTML email template type with similar JSON config approach
- **PowerPoint templates**: Would require server-side generation (pptx library) or separate service
- **Brand presets**: Allow users to save color/style preferences for session
- **User accounts & persistence**: Add auth (OAuth) and database for saving work
- **Sharing**: Generate shareable links to artifacts
- **Animation support**: Add CSS/SVG animations to icon templates
- **Template composition**: Nested templates (icon inside badge)
- **Figma/Adobe plugin**: Export directly to design tools
- **Rate limiting UI**: Show generation count or implement soft limits

---

## Unresolved Questions

*None - all requirements have been clarified during the interview.*
