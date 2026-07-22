# TechCart context

This is the `admin-app` workspace of a monorepo. Root-level decisions (monorepo layout, shared tooling, error contract, auth) live in root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those. Implementation detail for this workspace specifically is in [`docs/architecture.md`](docs/architecture.md).

## Feature-based structure

- `src/app/` is routing only — thin files that set up `react-router` and render from `src/features/<feature>/`. Unlike `buyer-app`'s Next.js file-system router, routes here are declared explicitly in `src/app/App.tsx`.
- `src/features/<feature>/` holds the actual UI/logic for that feature. `src/features/landing/LandingPlaceholder.tsx` is the current worked example, rendered at `/` by `src/app/App.tsx`.
- This mirrors `backend/src/modules/<feature>/` and `buyer-app/src/features/<feature>/`'s feature-based organization (see `backend/AGENTS.md`, `buyer-app/AGENTS.md`), adapted for React Router instead of a file-system router.
