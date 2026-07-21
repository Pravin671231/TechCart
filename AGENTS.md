# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

TechCart is a production e-commerce platform: a Next.js buyer storefront and a React/Vite admin console sharing one Node/Express API and one MongoDB database. Target market is India-first (Razorpay), initial scale is small-to-medium, hosting is managed platforms only (Vercel, Render/Railway, MongoDB Atlas, Upstash Redis). Full stack rationale and version pins live in the "E-Commerce Platform — Technology Blueprint," referenced from `docs/srs/SRS.md` §1.5.

## Current status

No application code exists yet — only planning documents (`docs/srs/SRS.md`, `docs/architecture.md`, `README.md`). There is no `package.json`, no build/lint/test tooling, and no `backend/`/`buyer-app/`/`admin-app/` scaffolding. Do not assume any of it exists, and do not invent commands for it — check what's actually present before running anything. The monorepo layout described in `docs/architecture.md` is the target for the Foundation phase, not current reality.

## Development process — read before starting any feature

This repo is built strictly feature-by-feature against a versioned SRS, not from a single upfront spec:

```
Feature → Update SRS → Add to Milestone → Add to Issue → Implement Code
```

- The SRS lives at `docs/srs/SRS.md` (version history, scope, feature index, per-feature template) with detail docs per feature at `docs/srs/features/<version>-<feature>.md` as they're written.
- Before implementing any feature, its SRS doc must exist and follow the template in `docs/srs/SRS.md` §4 — functional requirements numbered `FR-<CODE>-<NNN>`, plus a feature-scoped Baseline NFR checklist. Full system-wide NFRs are deliberately deferred to SRS v0.8/v0.9, but that section exists so each feature still gets a lightweight security/data/error-handling pass rather than none at all.
- Feature order follows `docs/srs/SRS.md` §3's Feature Index unless explicitly reprioritized.
- Each issue gets a branch `feature/<issue-number>-<scope>`, cut from `main` and squash-merged back into `main` (no `develop` branch). See `docs/architecture.md` §8 for commit format and release tagging.

## Architecture

`docs/architecture.md` has the full system diagram, layered backend structure, per-route rendering strategy for `buyer-app`, and the data/collection map. This is a plain **npm workspaces** monorepo — three workspaces flat at repo root (`backend/`, `buyer-app/`, `admin-app/`), no `apps/` nesting and no shared `packages/` directory. Points worth internalizing before touching code:

- **One backend, two frontends** — all business logic lives in `backend/`; neither `buyer-app/` nor `admin-app/` duplicates it. This is why the backend is a plain Express service rather than Next.js API routes (`admin-app` isn't a Next.js app and would need the logic duplicated).
- **No shared validation package** — `backend/` owns its Zod schemas internally; `buyer-app`/`admin-app` do their own separate client-side validation. This is a deliberate simplification (matches the sibling `LeafFlow` project), not an oversight — treat `backend`'s validation as the one that actually enforces correctness.
- **Backend layering** — `routes/ → controllers/ → services/ → repositories/ → models/`. Business logic belongs in `services/`; `repositories/` only issues Mongoose queries.
- **Auth/RBAC** — Better Auth issues sessions for both apps; Admin routes check role claims (`catalog-manager`, `order-manager`, `super-admin`) server-side on every request — never rely on a client-side route guard alone.
- **Error contract** — every backend error responds `{ "success": false, "code": "string", "message": "string" }`.
- **Workspace-level docs** — once a workspace is scaffolded, it may have its own `CLAUDE.md`/`AGENTS.md`/`docs/architecture.md` for implementation-level detail. Those never override the root-level decisions in this file or `docs/architecture.md`.

## Git conventions

- Do not add a `Co-Authored-By: Claude` (or any other agent) trailer to commit messages in this repository.
- Conventional Commits: `type(scope): message (Issue #N)` — types `feat, fix, test, chore, docs, refactor`; scopes `backend, buyer-app, admin-app, ci, infra`.
