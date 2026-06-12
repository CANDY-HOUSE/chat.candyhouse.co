# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

candyhouseAI is a multi-AI chat application built with React and TypeScript. It provides a unified interface for interacting with multiple AI model providers (OpenAI, Anthropic, Google, Deepseek, xAI) through a backend AI service.

## Development Commands

### Environment Setup
```bash
npm i                    # Install dependencies
```

### Development
```bash
npm run start            # Start dev server with .env.development config
npm run prod             # Start dev server with .env.production config
```

### Build
```bash
npm run prebuild         # Generate version info (runs before build)
npm run build            # Build production bundle
```

**Production Build Features:**
- Source maps can be disabled via `GENERATE_SOURCEMAP=false` in environment variables
- Standard React production optimizations applied

### Code Quality
```bash
npm run lint             # Run ESLint on src/
npm run lint:fix         # Auto-fix ESLint issues
```

### Testing
```bash
npm run test             # Run tests (react-scripts test)
```

### Cleanup
```bash
npm run clean:all        # Remove node_modules, package-lock.json, and clear npm cache
```

## Architecture

### State Management (Jotai)

The application uses Jotai for global state management with a centralized store pattern:

- **Store location**: `src/store/index.ts` exports the global `store` instance
- **State modules**: Organized by domain in `src/store/`:
  - `control.ts` - UI state (sidebar visibility, settings)
  - `model.ts` - AI model configuration and selection
  - `theme.ts` - Theme and appearance settings
  - `feedBack.ts` - Toast, modal, and anchor UI components
- **Reset pattern**: `resetAllAtoms()` clears all state (called on logout)
- **Usage**: Import atoms from `@/store` and use `store.set()` for imperative updates outside React

### Model Configuration

The application supports **user-defined JSON configuration** for customizing AI model behavior per conversation:

#### Configuration Storage
- Stored in `modelInfo.jsonConfig` within each conversation's state
- Configuration is conversation-specific (different conversations can have different settings for the same model)
- Persisted across sessions

#### Configuration Flow
1. **User input** - User provides JSON config via UI (model settings panel)
2. **Validation** - JSON is parsed and validated
3. **Storage** - Saved to `modelInfo.jsonConfig` in conversation state
4. **Runtime merge** - `buildProviderParams()` merges user config with system runtime parameters
5. **API call** - Final parameters sent to backend via `apiStreamChat()`

#### Configuration Schema
Each provider accepts different configuration fields (see [Provider-Specific Parameters](#provider-specific-parameters)):
- **OpenAI/xAI**: `instructions`, `reasoning`, `tools`, `text`
- **Anthropic**: `tools`, `thinking`
- **Google**: `tools`, `thinkingConfig`, `imageConfig`, `config` (for video)
- **Deepseek**: Standard chat completion parameters

#### Runtime-Managed Fields (no longer in `providerParams`)

Fields that used to be injected into `providerParams.<provider>` as "runtime params" have been moved to the backend or to message-level metadata. **The frontend `jsonConfig` no longer needs to special-case them**:

- `previousResponseId` (OpenAI / xAI Response API session pointer) — now travels on the wire via `UnifiedInput.metadata.previousResponseId` per assistant message. `toAiRequest` ([src/hooks/useMessage.ts](src/hooks/useMessage.ts)) attaches it; backend Lambda extracts and injects into `providerParams.<provider>.previousResponseId` before calling the SDK Adapter.
- `image` / `image_urls` (video/image reference images) — backend extracts these from `messages[lastUser].content[].image_url` automatically. Frontend just sends the user's full message content as usual.

Users putting these fields in `jsonConfig` will simply have them ignored (no longer special-cased / overwritten).

### AI Service Architecture

The AI service has been **migrated to the backend** for security and maintainability. The frontend communicates with the backend through a unified API interface.

#### Architecture Overview

```
Frontend (React)
    ↓
  apiStreamChat() - Unified API client
    ↓
  AWS Lambda Function URL (with IAM auth)
    ↓
  Backend AI Service (handles all provider integrations)
    ↓
  AI Providers (OpenAI, Anthropic, Google, Deepseek, xAI)
```

#### Frontend Components

**1. API Client** ([src/api/index.ts](src/api/index.ts))
- `apiStreamChat(model, options, abortController, onChunk)` - Main API for all AI operations
- Uses AWS IAM Signature V4 for authentication
- Supports streaming responses via Server-Sent Events (SSE)
- Handles abort signals for request cancellation

**2. Type Definitions** ([src/types/ai.ts](src/types/ai.ts))
- `ModelProvider` - Provider enumeration (OpenAI, Anthropic, Google, Deepseek, xAI)
- `UnifiedInput` - Standardized message format sent to backend (`{role, content, name?, cacheControl?, metadata?}`)
- `UnifiedResponse<V>` - Streaming response format with usage metrics
- `StreamValue` - Union type for chat, image, and video responses

**3. AI Utilities** ([src/utils/ai.ts](src/utils/ai.ts))
- `getModelProvider(modelName)` - Determine provider from model name
- `supportsVideoGeneration(modelName)` - Check video generation capability (UI hint only)
- `supportsImageGeneration(modelName)` - Check image generation capability (UI hint only)
- `supportsResponseAPI(modelName)` - Check Response API support (UI hint only)

> Capability checks are **UI hints** (e.g. show image-upload button) — they no longer drive send-path routing. Routing is the backend's job.

**4. Main Hook** ([src/hooks/useAi.ts](src/hooks/useAi.ts))
- **Single send path** — `handleChatCompletion` for all modalities. The old per-modality strategies (video / image / Response API) have been collapsed; the frontend sends a uniform chat-shape wire and the backend Lambda rewrites it to the modality-specific dispatch shape.
- **User configuration** - Supports custom JSON config per model via `modelInfo.jsonConfig`
- **Parameter building** - `buildProviderParams()` flattens user JSON config into `providerParams.<modelProvider>`. Runtime-managed fields (`previousResponseId`, video reference image) are no longer injected here — see the [Runtime-Managed Fields](#runtime-managed-fields-no-longer-in-providerparams) section.
- Manages message state, abort controllers, and streaming updates
- Handles error cases and usage tracking

#### Request Flow

1. **User sends message** → `useAi.sendMessage()` → `handleSendMessage()` → `toAiRequest()` builds `UnifiedInput[]` from conversation history (attaches `metadata.previousResponseId` per assistant message that has one) → `handleChatCompletion()`
2. **Options construction** → `buildProviderParams(modelProvider, jsonConfig)` packages the user's JSON config under `providerParams.<modelProvider>`; chat-shape request: `{messages, maxTokens, providerParams, email}`
3. **API call** → `apiStreamChat()` with AWS IAM authentication
4. **Backend processing** → Lambda `selectModalityStrategy()` routes by capability, rewrites chat-shape options into video/image/Response-API specific shapes as needed, dispatches to the provider
5. **Streaming response** → SSE chunks parsed and processed
6. **UI update** → `handlePushMessage()` updates conversation state; `data.responseId` (when present) is stored on the assistant `IMessage.previousResponseId` for the next turn's metadata attachment

#### Provider-Specific Parameters

The `options` object passed to `apiStreamChat()` is always chat-shaped: `{messages, maxTokens, providerParams, email}`. No `prompt` field, no per-modality shape variations — all modalities are normalized to this shape and the backend rewrites them as needed.

##### Parameter Construction

`buildProviderParams(modelProvider, jsonConfig)` flattens the user's JSON config under `providerParams.<modelProvider>`:

```typescript
const providerParams = buildProviderParams(
  modelProvider,   // 'OpenAI' | 'Anthropic' | 'Google' | 'Deepseek' | 'xAI'
  jsonConfig,      // User's custom JSON config from UI
)
// → { [modelProvider]: { ...jsonConfig } }
```

The function still accepts an optional 3rd `runtimeParams` argument, but **no longer has any in-frontend caller passing it** — runtime injection now happens on the backend (see [Runtime-Managed Fields](#runtime-managed-fields-no-longer-in-providerparams)).

##### Provider Configuration Examples

`providerParams.<provider>` ends up being **just `jsonConfig` re-keyed by provider name** — no runtime fields mixed in.

**OpenAI** (Response API):
```typescript
// User configures via jsonConfig:
{
  "instructions": "You are a helpful assistant",
  "reasoning": { "effort": "high", "summary": "detailed" },
  "tools": [...],
  "text": { "format": {...} }
}
// Wire: providerParams.OpenAI = { ...same... }
// Backend Lambda extracts previousResponseId from messages[*].metadata and injects
// providerParams.OpenAI.previousResponseId before calling the SDK adapter.
```

**Anthropic** (Chat Completion):
```typescript
{
  "tools": [...],
  "thinking": { "type": "enabled", "budget_tokens": 10000 }
}
// Wire: providerParams.Anthropic = { ...same... }
```

**Google** (Chat / Image / Video):
```typescript
// Chat / image models
{
  "tools": [{ "googleSearch": {} }],
  "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true },
  "imageConfig": { "aspectRatio": "16:9" }
}

// Video (Veo) — note: no `image` field; reference images flow through messages[lastUser].content[].image_url
{
  "config": {
    "durationSeconds": 5,
    "resolution": "720p",
    "aspectRatio": "16:9"
  }
}
// Wire: providerParams.Google = { ...same... }
// Backend extracts the reference image from the last user message and builds the canonical
// UnifiedVideoPrompt = { image, text } before calling the SDK adapter.
```

**Deepseek** (Chat):
```typescript
{ "temperature": 0.7, "top_p": 0.9 }
// Wire: providerParams.Deepseek = { ...same... }
```

**xAI** (Response API):
```typescript
{
  "instructions": "...",
  "reasoning": { "effort": "medium" },
  "tools": [...]
}
// Wire: providerParams.xAI = { ...same... }
// Backend injects providerParams.xAI.previousResponseId from messages metadata
// (same mechanism as OpenAI).
```

#### Backend Responsibilities

The backend Lambda function handles:
- **API key management** - Stores and manages provider API keys securely
- **Request routing** - Routes to appropriate provider based on model name
- **Format conversion** - Transforms between unified format and provider-specific APIs
- **Error handling** - Standardizes errors across providers
- **Response streaming** - Converts provider streams to unified SSE format
- **Usage tracking** - Aggregates token usage across providers

#### Security Features

- **No API keys in frontend** - All keys managed in backend
- **IAM authentication** - AWS Signature V4 for API requests
- **Encrypted storage** - API keys encrypted at rest with AES-256
- **Cognito CUSTOM_AUTH** - Passwordless OTP login via email; the `password` field in `Auth.signUp()` satisfies Cognito's API requirement but is never used for actual authentication (password policy disabled)
- **IAM credential chain** - Cognito JWT → Identity Pool Authenticated role → temporary AWS credentials → Lambda Sig V4 signing

#### Adding a New AI Provider

Backend changes (Lambda function):
1. Add provider SDK to Lambda dependencies
2. Create provider-specific adapter class
3. Implement request/response transformation logic
4. Register provider in routing table
5. Update model configuration with provider mappings

Frontend changes:
1. Add provider to `ModelProvider` type in [src/types/ai.ts](src/types/ai.ts)
2. Update `getModelProvider()` in [src/utils/ai.ts](src/utils/ai.ts)
3. Add capability detection (`supportsX`) only if UI needs to gate something visually on the new capability
4. Update `llmConfig` in `src/config/ai.ts` with token limits
5. Document user-configurable JSON fields for the provider in AGENTS.md

> Note: there is **no longer a frontend strategy/handler to extend per provider**. The single `handleChatCompletion` path serves all modalities. Provider-specific runtime fields (reference images, response-id session pointers, etc.) belong on the backend — extend `rewriteChatToModalityOptions` / `rewriteChatToResponseAPIOptions` in [ai-chat-stream/src/index.ts](../lambda/ai-chat-stream/src/index.ts), or add a new rewrite helper for a brand-new modality.

### Routing

The app has a minimal routing structure:
- `/login` - LoginPage
- `/home` - HomePage (main chat interface)

Routes are defined in `src/router/RoutesComponent.tsx`. The router handles:
- State reset on login page
- User authentication token refresh on home page
- Global UI components (toast, modal, anchor, image preview)

### Path Aliases

Configured in both `tsconfig.json` and `craco.config.js`:
- `@/*` → `src/*`
- `@utils` → `src/utils/index`
- `@config` → `src/config/index`
- `@constants` → `src/constants/index`
- `@api` → `src/api/index`
- `@assets` → `src/assets`

### Environment Configuration

Two environments:
- `.env.development` - Used by `npm run start`
- `.env.production` - Used by `npm run prod` and `npm run build`

Environment variables follow `REACT_APP_*` naming convention and include:
- AWS S3 bucket configuration
- AWS Cognito authentication (Auth region, user pool, identity pool)
- API endpoint configuration
- `GENERATE_SOURCEMAP=false` - Disables source map generation in production builds

### Key Hooks

Custom hooks in `src/hooks/`:
- `useAi` - Main hook for AI operations (initialization, model selection, API keys)
- `useMessage` - Message management within conversations
- `useConversation` - Conversation/topic management
- `useTopic` - Topic-specific operations

### AWS Amplify Integration

Configured in `App.tsx` with:
- S3 storage for file uploads
- Cognito authentication
- API Gateway endpoints

The app initializes Amplify on mount with environment-specific configuration.

#### Authentication Flow (CUSTOM_AUTH)

The app uses **passwordless OTP-based authentication** via Cognito CUSTOM_CHALLENGE:

1. `apiLogin(email)` → `Auth.signIn(email)` triggers CUSTOM_CHALLENGE, Cognito sends OTP to email
2. If user doesn't exist (`NotAuthorizedException`): `Auth.signUp()` creates the account first, then retries `signIn`
3. `apiAuth(user, code)` → `Auth.sendCustomChallengeAnswer(user, code)` verifies the OTP
4. On success: Cognito returns JWT tokens → exchanged for temporary IAM credentials via Identity Pool (Authenticated role)

Auth functions: `apiLogin()`, `apiAuth()` in [src/api/index.ts](src/api/index.ts)

**`mandatorySignIn` setting** in `App.tsx` controls whether unauthenticated visitors can obtain Guest Identity Pool credentials via `Auth.currentCredentials()`. Set to `true` to prevent unauthenticated visitors from obtaining any Identity Pool credentials.

## Code Style & Linting

- ESLint config in `eslint.config.js` using flat config format
- TypeScript strict mode enabled in `tsconfig.json`
- React 18+ with functional components only
- No React imports needed in JSX files (automatic runtime)
- Unused parameters should be prefixed with `_`
- Avoid deep imports from `@mui` (e.g., `@mui/*/*/*` is restricted)
- Console statements trigger warnings (but allowed in test files)

## TypeScript Configuration

- Target: ES2022
- Strict mode with `noUncheckedIndexedAccess`
- Module resolution: bundler
- Type roots include `src/@types` for custom type definitions

## Build System

Uses CRACO (Create React App Configuration Override) for webpack customization:
- Custom path aliases configured in `craco.config.js`
- Pre-build step generates version info via `generate-version.js`
- Production builds support Electron packaging (see `build` section in `package.json`)

**Build Configuration Location:** `craco.config.js` contains webpack path alias configurations.

## Dependencies

### Core
- React 18.3 with React Router 6
- Material-UI (MUI) v7 for components
- Jotai for state management
- i18next for internationalization

### Utilities
- AWS Amplify for auth and storage
- axios for HTTP requests
- quill for rich text editing
- react-markdown for markdown rendering
- crypto-js for encryption
- lodash-es for utilities

### Build
- `@craco/craco` - Webpack configuration override without ejecting
