# Issue Drafts

**Project:** TechCart
**Status:** Draft — M0 (Foundation) and M1 (CI Pipeline) only; nothing scaffolded yet

This is where issues get drafted — full context, a build-order task checklist, and test criteria — before they're opened as real GitHub Issues. It sits between [docs/milestone.md](milestone.md) (which milestone/goal) and GitHub itself (which is the actual tracker once an issue is opened): draft it here, then `gh issue create` it, then work it via the branch/PR flow in [docs/srs/SRS.md](srs/SRS.md) §5.

**Scope of this file right now:** only M0 and M1. Every later milestone (M2 Product Catalog onward) needs its functional requirements from that feature's SRS doc (`docs/srs/features/<version>-<feature>.md`) before its issues can be drafted with real content — none of those exist yet. This file gets more sections appended, one milestone at a time, as each feature's SRS doc is written — same incremental approach as the rest of this project's docs.

**Numbering:** `M0.1`, `M0.2`, etc. are draft sequence numbers, not GitHub issue numbers. When an issue is actually opened (`gh issue create`), use the real assigned number for its branch: `feature/<real-issue-number>-<scope>`.

---

## Template

Every issue below follows this shape:

```
### <Milestone>.<N> — <Title>
**Milestone:** M<x> – <Milestone name>
**Suggested branch:** feature/<issue-number>-<scope>
**Labels:** <labels>

**Context**
<Why this issue exists, what it depends on, what it unblocks.>

**Tasks**
- [ ] <ordered implementation step>

**Test Criteria**
- <verifiable, unambiguous condition>
```

---

## M0 — Foundation

### M0.1 — Root workspace & tooling setup

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-root-workspace-setup`
**Labels:** infra

**Context**
Every other M0 issue (backend/buyer-app/admin-app skeletons) needs a working npm workspaces root to live inside. Nothing here is a new decision — it's applying what's already locked in `docs/architecture.md` §2/§8 (workspace names, npm workspaces, Node 24, shared lint/format config).

**Tasks**

- [ ] Root `package.json` with `"workspaces": ["backend", "buyer-app", "admin-app"]` and `"engines": { "node": ">=24" }`
- [ ] `tsconfig.base.json` (ES2023+, strict mode)
- [ ] `eslint.config.ts` (flat config) at root
- [ ] `.prettierrc`
- [ ] `.nvmrc` and `.node-version`, both `"24"`

**Test Criteria**

- `npm install` succeeds at the repo root with zero workspace directories created yet
- `node -e "console.log(require('./package.json').workspaces)"` lists all three workspace names

---

### M0.2 — Backend skeleton

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-backend-skeleton`
**Labels:** infra, backend

**Context**
`backend` is the single source of business logic (`docs/architecture.md` §1/§4.3) — every feature milestone builds on its layered folder structure and its error-response contract, so both need to exist before any real endpoint is written, not be retrofitted later.

**Tasks**

- [ ] Initialize `backend/` as a workspace package: `package.json`, `express@5`, `typescript`, `tsx` (dev), `dotenv`
- [ ] Create layered folders: `src/{config,routes,controllers,services,repositories,models,middleware,utils}`
- [ ] Implement `GET /health` returning `{ "success": true, "code": "OK", "message": "healthy" }`
- [ ] Implement error-handling middleware enforcing the `{ "success": false, "code", "message" }` shape on every error response
- [ ] Stub Mongoose connection in `src/config/db.ts` (mocked/no-op is fine — a real connection lands with M2 Product Catalog)
- [ ] `build` (tsc) and `dev` (tsx watch) scripts in `backend/package.json`

**Test Criteria**

- `GET /health` returns 200 with the exact success-contract shape
- A route that deliberately throws returns the error-contract shape — no raw stack trace leaks to the response
- `npm run build --workspace backend` produces no TypeScript errors

---

### M0.3 — Backend test suite

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-backend-test-suite`
**Labels:** infra, backend, testing

**Context**
Matches the testing convention in `docs/architecture.md` §8 (Vitest + Supertest, `__tests__/` folders). This issue only has to prove the tooling works end-to-end — coverage thresholds are enforced starting with real features, not here.

**Tasks**

- [ ] Add `vitest`, `@vitest/coverage-v8`, `supertest` as `backend` devDependencies
- [ ] `backend/vitest.config.ts` (node environment, v8 coverage provider)
- [ ] `backend/__tests__/health.test.ts` — Supertest against `GET /health`, asserts 200 + success-contract shape
- [ ] Workspace-scoped test script wired (`npm run test --workspace backend`)

**Test Criteria**

- `npm run test --workspace backend` passes: 1 test, 0 failures
- `npm run test:coverage --workspace backend` produces a coverage report

---

### M0.4 — buyer-app skeleton

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-buyer-app-skeleton`
**Labels:** infra, buyer-app

**Context**
`buyer-app` is the SSR/ISR storefront (`docs/architecture.md` §4.1). This issue only needs a running Next.js 16 App Router shell with Tailwind wired — no catalog/cart code yet.

**Tasks**

- [ ] Scaffold `buyer-app/` as Next.js 16 (App Router, TypeScript)
- [ ] Wire Tailwind CSS 4
- [ ] Placeholder home route (`app/page.tsx`) rendering a static landing placeholder
- [ ] Confirm `dev`/`build` scripts in `buyer-app/package.json`

**Test Criteria**

- `npm run build --workspace buyer-app` succeeds
- `npm run dev --workspace buyer-app` serves the placeholder home page locally

---

### M0.5 — buyer-app test suite

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-buyer-app-test-suite`
**Labels:** infra, buyer-app, testing

**Context**
Matches `docs/architecture.md` §8 (Vitest + RTL + MSW for frontends). The MSW mock server is initialized once here so every later feature's tests extend it instead of re-wiring it from scratch.

**Tasks**

- [ ] Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `msw` as `buyer-app` devDependencies
- [ ] `vitest.config.ts` (jsdom environment) + `vitest.setup.ts` initializing the MSW server
- [ ] `buyer-app/__tests__/home.test.tsx` — renders the placeholder home page, asserts expected content

**Test Criteria**

- `npm run test --workspace buyer-app` passes: 1 test, 0 failures

---

### M0.6 — admin-app skeleton

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-admin-app-skeleton`
**Labels:** infra, admin-app

**Context**
`admin-app` is the RBAC-gated SPA console (`docs/architecture.md` §4.2). This issue only needs a running Vite + React shell with routing wired — no dashboard/catalog-management code yet.

**Tasks**

- [ ] Scaffold `admin-app/` as Vite + React 19 + TypeScript
- [ ] Wire React Router and Tailwind CSS 4
- [ ] Placeholder route rendering a static landing placeholder
- [ ] Confirm `dev`/`build` scripts in `admin-app/package.json`

**Test Criteria**

- `npm run build --workspace admin-app` succeeds
- `npm run dev --workspace admin-app` serves the placeholder page locally

---

### M0.7 — admin-app test suite

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-admin-app-test-suite`
**Labels:** infra, admin-app, testing

**Context**
Mirrors M0.5 for `admin-app`.

**Tasks**

- [ ] Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `msw` as `admin-app` devDependencies
- [ ] `vitest.config.ts` (jsdom) + setup file initializing MSW
- [ ] `admin-app/__tests__/app.test.tsx` — renders the placeholder route, asserts expected content

**Test Criteria**

- `npm run test --workspace admin-app` passes: 1 test, 0 failures

---

### M0.8 — Root scripts & clean-clone verification

**Milestone:** M0 – Foundation
**Suggested branch:** `feature/<issue-number>-root-scripts-verification`
**Labels:** infra

**Context**
This is M0's exit-criteria issue from `docs/milestone.md` — no new code, just wiring the root-level fan-out scripts and proving the whole workspace builds and tests cleanly from a fresh clone. It's what unblocks M1 (CI) and every feature milestone after it.

**Tasks**

- [ ] Root `package.json` scripts: `build` (`--workspaces`), `lint` (root eslint), `test` (`--workspaces`), plus per-workspace variants (`test:backend`, `test:buyer-app`, `test:admin-app`)
- [ ] Fresh clone into a scratch directory; run `npm install`, `npm run build`, `npm test` from clean
- [ ] Fix any cross-workspace issues surfaced (hoisting, duplicate deps, path issues)

**Test Criteria**

- From a clean clone: `npm install && npm run build && npm test` all succeed with no manual intervention — matches `docs/milestone.md`'s M0 exit criteria exactly

---

## M1 — CI Pipeline

### M1.1 — CI workflow (ci.yml)

**Milestone:** M1 – CI Pipeline
**Suggested branch:** `feature/<issue-number>-ci-workflow`
**Labels:** infra, ci

**Context**
Implements the single-workflow decision in `docs/architecture.md` §8/§9 (one `.github/workflows/ci.yml`, not three separate files as in LeafFlow) — automates what M0.8 already proved works locally, on every PR into `main`.

**Tasks**

- [ ] `.github/workflows/ci.yml`: trigger on `pull_request` targeting `main`
- [ ] Job `lint`: checkout, `setup-node` (`node-version-file: .nvmrc`), `npm ci`, `npm run lint`
- [ ] Job `test`: matrix over `[backend, buyer-app, admin-app]`, `npm ci`, `npm run test --workspace <matrix-value>`
- [ ] Concurrency group to cancel superseded runs on the same PR/ref

**Test Criteria**

- Opening a PR against `main` triggers both jobs
- A deliberately broken test in one workspace fails only that matrix leg, not the others
- A deliberate lint error fails the `lint` job

---

### M1.2 — Branch protection on main

**Milestone:** M1 – CI Pipeline
**Suggested branch:** `feature/<issue-number>-branch-protection`
**Labels:** infra, ci

**Context**
Without this, M1.1's CI check is advisory only. This issue makes it load-bearing and locks in the linear-history/squash-merge convention already stated in `docs/architecture.md` §8.

**Tasks**

- [ ] Configure branch protection on `main`: require the `ci.yml` status check(s) to pass before merging
- [ ] Require linear history (no merge commits)
- [ ] Restrict merge method to squash-merge only
- [ ] Decide (and note in the PR) whether to also require a review, given this is currently a solo-maintained repo

**Test Criteria**

- A direct push to `main` is rejected
- A PR with a failing CI check cannot be merged
- A PR with a passing check can only be squash-merged, not merge-commit or rebase-merged
