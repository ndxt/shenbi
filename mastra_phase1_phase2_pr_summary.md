# Mastra Phase 1 + Phase 2 PR Summary

## Summary

This PR introduces Mastra as a new backend orchestration runtime for Shenbi AI flows, while preserving the existing HTTP APIs, `AgentEvent` protocol, SSE behavior, and frontend event consumers.

Phase 1 focuses on single-page flows:

- Keep `/api/ai/run` and `/api/ai/run/stream` unchanged.
- Route `schema.create` and `schema.modify` through the Mastra runtime.
- Keep `finalize` and non-page intents on the legacy path.
- Share reusable domain logic through `@shenbi/ai-agents`.

Phase 2 extends runtime-driven routing:

- Route `/api/ai/classify-route` through the runtime interface.
- Migrate `/api/ai/chat` in Mastra mode to shared `deps.llm` instead of falling back to legacy runtime chat handlers.

## Key Changes

### 1. Added Mastra runtime with runtime switch

- Added `@shenbi/mastra-runtime`.
- Added `AI_RUNTIME=legacy|mastra`.
- Kept existing Hono route wiring and SSE protocol unchanged.
- In `mastra` mode, only `schema.create` and `schema.modify` are handled by Mastra workflows; unsupported intents still fall back to legacy runtime where required.

### 2. Preserved existing frontend/backend protocol

- No changes to `/api/ai/run`, `/api/ai/run/stream`, `/api/ai/chat`, `/api/ai/classify-route` public contracts.
- No changes to `AgentEvent` event names or streaming semantics consumed by the frontend.
- Mastra workflow output is adapted back into the existing event stream shape.

### 3. Moved reusable AI domain logic into `@shenbi/ai-agents`

Shared capabilities now live in `packages/ai-agents` and are reused by both legacy and Mastra runtimes:

- page planner prompt helpers
- page block prompt helpers
- modify planner prompt helpers
- insert-node prompt helpers
- page schema assembly helpers
- modify planning helpers
- block quality checks
- component knowledge / contract catalog access
- schema normalization / repair helpers

This reduces `apps/ai-api`-specific coupling and gives Mastra a stable domain layer to call into.

### 4. Added Phase 1 regression harness

- Added offline regression coverage for representative page types:
  - list
  - form
  - dashboard
  - detail
- Added a root regression command:

```bash
pnpm test:mastra-phase1
```

### 5. Completed Phase 2 runtime routing for classify and chat

- `/api/ai/classify-route` now goes through the runtime interface instead of route-local classification logic.
- Mastra runtime `chat` and `chatStream` now use shared `deps.llm`.
- `createLegacyRuntimeDeps().llm` now supports both:
  - prompt-style requests used by orchestrators
  - message-style `ChatRequest` used by `/api/ai/chat`

## Main Files

- `packages/mastra-runtime/src/runtime/create-mastra-agent-runtime.ts`
- `packages/mastra-runtime/src/runtime/workflows.ts`
- `apps/ai-api/src/runtime/runtime-switch.ts`
- `apps/ai-api/src/runtime/agent-runtime.ts`
- `apps/ai-api/src/runtime/component-catalog.ts`
- `apps/ai-api/src/runtime/normalize-schema.ts`
- `apps/ai-api/src/routes/classify-route.ts`
- `packages/ai-agents/src`

## Validation

Verified with targeted type-checks and tests across the touched packages:

- `pnpm --filter @shenbi/ai-agents type-check`
- `pnpm --filter @shenbi/mastra-runtime type-check`
- `pnpm --filter @shenbi/ai-api type-check`
- targeted Vitest coverage for:
  - Mastra runtime event adaptation
  - runtime switching
  - app routing
  - Mastra smoke coverage
  - shared helper modules
- end-to-end Phase 1 regression entrypoint:

```bash
pnpm test:mastra-phase1
```

## Non-Goals

This PR does not:

- introduce RAG
- migrate Gateway generation
- replace the frontend event protocol
- adopt Mastra HTTP adapters in production routes
- fully migrate all intents to Mastra

## Follow-Ups

Recommended next steps after merge:

1. Run real end-to-end smoke validation against live provider credentials in `AI_RUNTIME=mastra` mode.
2. Decide whether `finalize` should remain legacy or move behind the runtime interface with a Mastra-backed path.
3. Evaluate whether multi-page planning / broader chat orchestration should move into dedicated Mastra workflows in Phase 3.
