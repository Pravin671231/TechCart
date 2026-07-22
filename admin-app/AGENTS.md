# TechCart context

This is the `admin-app` workspace of a monorepo. Root-level decisions (monorepo layout, shared tooling, error contract, auth) live in root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those. Implementation detail for this workspace specifically is in [`docs/architecture.md`](docs/architecture.md).

## Feature-based structure

- `src/app/` is routing only — thin files that set up `react-router` and render from `src/features/<feature>/`. Unlike `buyer-app`'s Next.js file-system router, routes here are declared explicitly in `src/app/App.tsx`.
- `src/features/<feature>/` holds the actual UI/logic for that feature. `src/features/landing/LandingPlaceholder.tsx` is the current worked example, rendered at `/` by `src/app/App.tsx`.
- This mirrors `backend/src/modules/<feature>/` and `buyer-app/src/features/<feature>/`'s feature-based organization (see `backend/AGENTS.md`, `buyer-app/AGENTS.md`), adapted for React Router instead of a file-system router.

## Testing

- Stack: Vitest (`environment: "jsdom"`) + React Testing Library + MSW, wired via `vitest.config.ts` + `vitest.setup.ts` — same shape as `buyer-app` (see `buyer-app/AGENTS.md`). Reuses the `@vitejs/plugin-react` and `vite-tsconfig-paths` devDependencies already present for the app's own `vite.config.ts`.
- Test files live in `__tests__/` at the workspace root, e.g. `__tests__/app.test.tsx`, which renders `App` directly since `src/app/App.tsx` _is_ the router here (unlike `buyer-app`, which has Next's routing external to the page component).
- The shared MSW server lives at `__tests__/mocks/server.ts` (built from `__tests__/mocks/handlers.ts`) and is started/stopped once for the whole run via `vitest.setup.ts`. New feature tests that need to mock a request add handlers to `handlers.ts`, or call `server.use(...)` inside the test itself for a one-off override.
- `npm run test --workspace admin-app` runs the suite once (`vitest run`, not watch mode).
