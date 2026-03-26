# Mastra Migration PR Summary

## Summary

This PR migrates Shenbi AI APIs onto Mastra as the primary backend orchestration layer, while preserving the existing HTTP APIs, `AgentEvent` protocol, SSE behavior, and frontend event consumers where compatibility matters.

The migration now covers:

- Keep `/api/ai/run` and `/api/ai/run/stream` unchanged.
- Route `schema.create`, `schema.modify`, `chat`, `classify-route`, and `finalize` through Mastra-backed runtime paths.
- Route multi-page project generation through backend Mastra project workflows.
- Keep shared AI domain logic in `@shenbi/ai-agents`.
- Retire the legacy runtime assembly from the application startup path.

## Key Changes

### 1. Added Mastra runtime and Mastra-only runtime assembly

- Added `@shenbi/mastra-runtime`.
- Kept existing Hono route wiring and SSE protocol unchanged.
- `apps/ai-api` now boots through Mastra runtime assembly only.
- Legacy runtime assembly has been retired from the startup path.

### 2. Preserved existing frontend/backend protocol

- No breaking changes to `/api/ai/run`, `/api/ai/run/stream`, `/api/ai/chat`, `/api/ai/classify-route`, `/api/ai/run/finalize` public contracts.
- No changes to `AgentEvent` event names or streaming semantics consumed by the frontend.
- Mastra workflow output is adapted back into the existing event stream shape for single-page flows.

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

### 4. Added project workflow APIs and migrated frontend multi-page orchestration

- Added backend project workflow routes:
  - `/api/ai/project/stream`
  - `/api/ai/project/confirm`
  - `/api/ai/project/revise`
  - `/api/ai/project/cancel`
- Added `ProjectAgentEvent` contract for multi-page orchestration.
- Migrated frontend multi-page `useAgentLoop` from local ReAct orchestration to backend `project/stream`.

### 5. Migrated remaining runtime-backed AI APIs to Mastra

- `/api/ai/classify-route` now goes through the runtime interface instead of route-local classification logic.
- Mastra runtime `chat` and `chatStream` use shared `deps.llm`.
- `run/runStream` chat intents no longer fall back to legacy runtime.
- `finalize` now runs through Mastra-backed memory finalization.
- `models` and `debug` are now provided through the unified AI service boundary.

### 6. Retired legacy main-path runtime usage

- Normal main-path intents no longer rely on legacy runtime execution.
- Unsupported future intents now fail explicitly instead of silently delegating to legacy runtime.
- Legacy runtime assembly has been removed from `apps/ai-api` startup wiring.

### 7. Added regression and verification coverage

- Added offline regression coverage for representative page types:
  - list
  - form
  - dashboard
  - detail
- Added project workflow route coverage and frontend project stream coverage.
- Added root regression commands:

```bash
pnpm test:mastra-phase1
pnpm test:mastra-phase4
```

## Main Files

- `packages/mastra-runtime/src/runtime/create-mastra-agent-runtime.ts`
- `packages/mastra-runtime/src/runtime/workflows.ts`
- `packages/mastra-runtime/src/runtime/project-service.ts`
- `apps/ai-api/src/runtime/runtime-switch.ts`
- `apps/ai-api/src/runtime/agent-runtime.ts`
- `apps/ai-api/src/routes/project.ts`
- `packages/editor-plugins/ai-chat/src/hooks/useAgentLoop.ts`
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
  - project workflow routes
  - frontend project stream consumption
  - shared helper modules
- end-to-end regression entrypoints:

```bash
pnpm test:mastra-phase1
pnpm test:mastra-phase4
```

## Non-Goals

This PR does not:

- introduce RAG
- migrate Gateway generation
- adopt Mastra HTTP adapters in production routes
- introduce UniversalMessage
- remove every provider/deps helper reused by Mastra runtime internals

## Follow-Ups

Recommended next steps after merge:

1. Run real end-to-end smoke validation against live provider credentials in `AI_RUNTIME=mastra` mode.
2. Remove or archive legacy-only documentation and stale naming that still refers to Phase 1/2 split-brain runtime ownership.
3. Decide whether the remaining provider/deps construction code in `apps/ai-api/src/runtime/agent-runtime.ts` should be extracted into a smaller Mastra-specific factory module.
