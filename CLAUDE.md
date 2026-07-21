# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TechCart is a production e-commerce platform: a Next.js buyer storefront and a React/Vite admin console sharing one Node/Express API and one MongoDB database. Target market is India-first (Razorpay), initial scale is small-to-medium, hosting is managed platforms only (Vercel, Render/Railway, MongoDB Atlas, Upstash Redis). Full stack rationale and version pins live in the "E-Commerce Platform — Technology Blueprint," referenced from `docs/srs/SRS.md` §1.5.

## Current status

Root workspace tooling is scaffolded (Issue #1 / M0.1, merged): root `package.json` (npm workspaces — `backend`, `buyer-app`, `admin-app`; `engines.node >=24`), `tsconfig.base.json`, `eslint.config.ts` (flat config), `.prettierrc`, `.nvmrc`/`.node-version`. `npm install`, `npx eslint .`, and `npx prettier --check .` all work at the repo root. `backend/` is scaffolded (Issue #2 / M0.2, merged): Express 5 + TypeScript, module-based structure (`src/modules/<feature>/`), `health` module, error contract, TS path aliases (`@/*`), Vitest+Supertest wired, plus coverage reporting (Issue #3 / M0.3, merged) — see `backend/CLAUDE.md` for detail. `npm run build|dev|test|test:coverage --workspace backend` all work. There is still no `buyer-app/` or `admin-app/` directory and no frontend code — those scaffold in M0.4/M0.6. Do not assume they exist, and do not invent commands for them — check what's actually present before running anything. Keep updating this section as each subsequent M0 issue lands.

## Development process — read before starting any feature

This repo is built strictly feature-by-feature against a versioned SRS, not from a single upfront spec:

```
Feature → Update SRS → Add to Milestone → Add to Issue → Implement Code
```

- The SRS lives at `docs/srs/SRS.md` (version history, scope, feature index, per-feature template) with detail docs per feature at `docs/srs/features/<version>-<feature>.md` as they're written.
- Before implementing any feature, its SRS doc must exist and follow the template in `docs/srs/SRS.md` §4 — functional requirements numbered `FR-<CODE>-<NNN>`, plus a feature-scoped Baseline NFR checklist. Full system-wide NFRs are deliberately deferred to SRS v0.8/v0.9, but that section exists so each feature still gets a lightweight security/data/error-handling pass rather than none at all.
- Feature order follows `docs/srs/SRS.md` §3's Feature Index unless explicitly reprioritized.
- Each issue gets a branch `feature/<issue-number>-<scope>`, cut from `main` and squash-merged back into `main` (no `develop` branch). See `docs/architecture.md` §8 for commit format and release tagging.
- Before marking an issue complete: push the branch and open a PR into `main` (squash-merge, per the convention above); once merged, sync the status sections of `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/architecture.md` §10 to reflect the new state in a direct follow-up commit on `main`, then close the GitHub issue referencing the merge.
- Whenever changes are made within a scaffolded workspace (`backend/`, and later `buyer-app/`/`admin-app/` once they exist), update that workspace's own `CLAUDE.md`/`AGENTS.md` (see the workspace-docs mapping in Architecture below) to reflect them.

## Architecture

`docs/architecture.md` has the full system diagram, layered backend structure, per-route rendering strategy for `buyer-app`, and the data/collection map. This is a plain **npm workspaces** monorepo — three workspaces flat at repo root (`backend/`, `buyer-app/`, `admin-app/`), no `apps/` nesting and no shared `packages/` directory. Points worth internalizing before touching code:

- **One backend, two frontends** — all business logic lives in `backend/`; neither `buyer-app/` nor `admin-app/` duplicates it. This is why the backend is a plain Express service rather than Next.js API routes (`admin-app` isn't a Next.js app and would need the logic duplicated).
- **No shared validation package** — `backend/` owns its Zod schemas internally; `buyer-app`/`admin-app` do their own separate client-side validation. This is a deliberate simplification (matches the sibling `LeafFlow` project), not an oversight — treat `backend`'s validation as the one that actually enforces correctness.
- **Backend layering** — implementation detail owned by `backend/` itself; not yet locked in as a root-level architectural decision. See the workspace-docs mapping below (`backend/CLAUDE.md`, `backend/AGENTS.md`, `backend/docs/architecture.md`) for the current structure.
- **Auth/RBAC** — Better Auth issues sessions for both apps; Admin routes check role claims (`catalog-manager`, `order-manager`, `super-admin`) server-side on every request — never rely on a client-side route guard alone.
- **Error contract** — every backend error responds `{ "success": false, "code": "string", "message": "string" }`.
- **Workspace-level docs** — once a workspace is scaffolded, it may have its own `CLAUDE.md`/`AGENTS.md`/`docs/architecture.md` for implementation-level detail. Those never override the root-level decisions in this file or `docs/architecture.md`.

  | Workspace    | Own docs                                                                 |
  | ------------ | ------------------------------------------------------------------------ |
  | `backend/`   | `backend/CLAUDE.md`, `backend/AGENTS.md`, `backend/docs/architecture.md` |
  | `buyer-app/` | not yet scaffolded                                                       |
  | `admin-app/` | not yet scaffolded                                                       |

## Git conventions

- Do not add a `Co-Authored-By: Claude` trailer to commit messages in this repository.
- Conventional Commits: `type(scope): message (Issue #N)` — types `feat, fix, test, chore, docs, refactor`; scopes `backend, buyer-app, admin-app, ci, infra`.
