# UI Worktree Boundary Checklist (Phase 1.5 UI Track)

Branch: `feat/preview-ui-phase15`  
Owner: preview UI/UX optimization

## Allowed Paths

- `apps/preview/src/ui/**`
- `apps/preview/src/layout/**`
- `apps/preview/src/panels/**`
- `apps/preview/src/theme/**`
- `apps/preview/src/styles/**`
- `apps/preview/src/App.tsx`
- `apps/preview/src/main.tsx`
- `apps/preview/src/ui/**/*.test.ts*`

## Blocked Paths

- `packages/engine/src/**`
- `apps/preview/src/mock/**`
- `apps/preview/src/features/crud/**`
- `apps/preview/src/schemas/user-management.ts`
- `docs/shenbi-phase-1.5-design-doc.md`

## Integration Contract

- UI track can only consume `apps/preview/src/features/crud/public-api.ts`.
- UI track must not change this contract file.
