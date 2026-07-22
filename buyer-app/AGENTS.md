<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## TechCart context

This is the `buyer-app` workspace of a monorepo. Root-level decisions (monorepo layout, shared tooling, error contract, auth) live in root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those. Implementation detail for this workspace specifically is in [`docs/architecture.md`](docs/architecture.md).

## Feature-based structure

- `src/app/` is routing only — thin files that import and render from `src/features/<feature>/`. Next's file-system router requires `app/` for routes; that's the only thing that belongs there.
- `src/features/<feature>/` holds the actual UI/logic for that feature. `src/features/home/HomePlaceholder.tsx` is the current worked example, rendered by `src/app/page.tsx`.
- This mirrors `backend/src/modules/<feature>/`'s feature-based organization (see `backend/AGENTS.md`), adapted for Next's routing constraints — named `features` here rather than `modules`, since this is a different framework with its own conventions.

## Testing

- Stack: Vitest (`environment: "jsdom"`) + React Testing Library + MSW, wired via `vitest.config.ts` + `vitest.setup.ts`. Path aliases (`@/*`) resolve via the `vite-tsconfig-paths` plugin — `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` is not a real Vite/Vitest option (confirmed by reproducing the failure there), so it isn't mirrored here.
- Test files live in `__tests__/` at the workspace root (not colocated inside `src/`), e.g. `__tests__/home.test.tsx`.
- The shared MSW server lives at `__tests__/mocks/server.ts` (built from `__tests__/mocks/handlers.ts`) and is started/stopped once for the whole run via `vitest.setup.ts`. New feature tests that need to mock a request add handlers to `handlers.ts`, or call `server.use(...)` inside the test itself for a one-off override.
- `npm run test --workspace buyer-app` runs the suite once (`vitest run`, not watch mode).
