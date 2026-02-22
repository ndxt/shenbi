# Main Worktree Boundary Checklist (Phase 1.5 Functional Track)

Branch: `main`  
Owner: Phase 1.5 feature implementation

## Allowed Paths

- `packages/engine/src/compiler/**`
- `packages/engine/src/runtime/**`
- `packages/engine/src/renderer/node-renderer.tsx`
- `packages/engine/src/renderer/shenbi-page.tsx`
- `packages/engine/src/resolver/index.ts`
- `packages/engine/src/**/*.test.ts*`
- `apps/preview/src/mock/**`
- `apps/preview/src/features/crud/**`
- `apps/preview/src/schemas/user-management.ts`
- `apps/preview/src/features/crud/**/*.test.ts*`
- `docs/shenbi-phase-1.5-design-doc.md`

## Blocked Paths

- `apps/preview/src/ui/**`
- `apps/preview/src/layout/**`
- `apps/preview/src/panels/**`
- `apps/preview/src/theme/**`
- `apps/preview/src/styles/**`
- `apps/preview/src/App.tsx`
- `apps/preview/src/main.tsx`

## Integration Contract

- UI track reads only: `apps/preview/src/features/crud/public-api.ts`
- Functional track is the only owner of this contract file.
