# Mastra `run/runStream` Fallback Inventory

## Conclusion

As of this phase, the normal `RunRequest.intent` surface no longer has any active legacy fallback intent in the Mastra runtime.

Current `AgentIntent` union:

- `schema.create`
- `schema.modify`
- `chat`

Current Mastra handling in [`create-mastra-agent-runtime.ts`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\packages\mastra-runtime\src\runtime\create-mastra-agent-runtime.ts):

- `schema.create` -> Mastra page-create workflow
- `schema.modify` -> Mastra page-modify workflow
- `chat` -> Mastra native `message:start/message:delta/done` stream

The only remaining `fallback_legacy` branch is now a defensive branch for unsupported future intents, not a currently reachable production intent under the existing `AgentIntent` type.

## Previous Fallback Intent

Previously, `run/runStream` used an explicit legacy whitelist fallback for:

- `chat`

That fallback has been removed by commit `94eecdb` (`feat: migrate run stream chat intent to mastra`).

## Current Fallback Matrix

| Intent | Current Runtime Path | Legacy Fallback |
|---|---|---|
| `schema.create` | Mastra workflow | No |
| `schema.modify` | Mastra workflow | No |
| `chat` | Mastra chat event stream | No |
| Unknown / future unsupported intent | Defensive fallback branch | Yes |

## Real Callers Of `/api/ai/run/stream`

### 1. Single-page editor generation / modification

Primary frontend path:

- [`useAgentRun.ts`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\packages\editor-plugins\ai-chat\src\hooks\useAgentRun.ts)
- [`page-execution.ts`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\packages\editor-plugins\ai-chat\src\ai\page-execution.ts)
- [`sse-client.ts`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\packages\editor-plugins\ai-chat\src\ai\sse-client.ts)

Behavior:

- Builds a `RunRequest`
- Calls `aiClient.runStream(...)`
- Hits `POST /api/ai/run/stream`
- Uses `intent = schema.create` or `intent = schema.modify`

This path is fully on Mastra now.

### 2. Multi-page project sub-page execution

Primary frontend path:

- [`useAgentLoop.ts`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\packages\editor-plugins\ai-chat\src\hooks\useAgentLoop.ts)

Behavior:

- Multi-page orchestration now uses `POST /api/ai/project/stream`
- When the backend project workflow emits `project:page:event`, the frontend reuses page execution helpers
- Those sub-page tasks consume embedded page events through a queued client abstraction
- Effective page intents are still `schema.create` and `schema.modify`

This path is fully on Mastra now.

## AI Routes That Do Not Depend On `run/runStream` Fallback

These routes already bypass the old fallback question entirely:

- [`/api/ai/chat`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\apps\ai-api\src\routes\chat.ts)
- [`/api/ai/classify-route`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\apps\ai-api\src\routes\classify-route.ts)
- [`/api/ai/run/finalize`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\apps\ai-api\src\routes\finalize.ts)
- [`/api/ai/project/*`](C:\Users\zhang\Code\LowCode\shenbi-codes\shenbi-mastra-ai-intro\apps\ai-api\src\routes\project.ts)

They already run through Mastra Host / Mastra runtime directly.

## Frontend Paths And Which AI Route They Hit

| Frontend path | Backend route | Intent / protocol | Current runtime |
|---|---|---|---|
| Single-page create / modify from AI panel | `/api/ai/run/stream` | `schema.create` / `schema.modify` | Mastra |
| Direct chat API usage | `/api/ai/chat` | chat request/response or stream | Mastra |
| Route classification before loop branching | `/api/ai/classify-route` | classify | Mastra |
| Multi-page project generation | `/api/ai/project/stream` | `ProjectAgentEvent` | Mastra |
| Multi-page confirm / revise / cancel | `/api/ai/project/confirm|revise|cancel` | session mutation | Mastra |
| Modify finalize | `/api/ai/run/finalize` | finalize | Mastra |

Notably:

- The current frontend does **not** use `/api/ai/run/stream` for chat UI messages.
- Chat UI messages go through `/api/ai/chat`.
- `/api/ai/run/stream` is now effectively a page-task execution channel.

## De-Legacy Validation Result

Validation command:

```bash
pnpm test:mastra-phase4
```

Validated successfully after removing `chat` fallback:

- `@shenbi/ai-agents`: 89 tests passed
- `@shenbi/mastra-runtime`: 12 tests passed
- `@shenbi/editor-plugin-ai-chat`: 52 tests passed
- `@shenbi/ai-api`: 107 tests passed

## Practical Outcome

`legacy runtime` is no longer carrying any normal `run/runStream` main-path intent under the current API contract.

Its remaining value is now:

- rollback safety
- defensive fallback for unsupported future intent expansion
- compatibility during future incremental migrations
