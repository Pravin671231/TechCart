# Milestones

**Project:** TechCart
**Status:** Planned — nothing scaffolded yet (see `docs/architecture.md` §10)

This is the milestone-level roadmap for the product development flow: what gets built, in what order, and how "done" is judged at each stage. It sits above [docs/srs/SRS.md](srs/SRS.md), which holds the detailed functional/non-functional requirements per feature, and is tracked day-to-day via GitHub Milestones/Issues and the SRS's [Traceability Matrix](srs/SRS.md#6-traceability-matrix) — this document doesn't duplicate either, it's the plan they execute against.

Two infrastructure milestones come first, then one milestone per SRS feature version:

| # | Title | Goal | Key deliverables | Exit criteria | Maps to | Status |
|---|---|---|---|---|---|---|
| M0 | Foundation — Base App Setup & Test Suite | Scaffold all three workspaces with a runnable skeleton and working test tooling, so every later milestone has something to build on and test against. | Root `package.json` (npm workspaces) + `tsconfig.base.json` + `eslint.config.ts` + `.prettierrc` + `.nvmrc`/`.node-version`; `backend/` Express skeleton (`GET /health`); `buyer-app/` Next.js skeleton; `admin-app/` Vite+React skeleton; Vitest+Supertest (backend) and Vitest+RTL+MSW (frontends) wired with one passing placeholder test per workspace, in `__tests__/`. | `npm test --workspaces` and `npm run build --workspaces` both succeed from a clean clone. | Infra only — groundwork for SRS v0.1, no version of its own. | Not started |
| M1 | CI Pipeline | Automated lint + test on every PR into `main`, so no feature work merges without passing checks. | `.github/workflows/ci.yml` (single workflow, lint + test matrix across the three workspaces); branch protection on `main` requiring that check. | Opening a PR triggers the workflow; a failing run blocks merge. | Infra only. | Not started |
| M2 | Product Catalog | Ship browsing/search/filtering + admin CRUD. | Per SRS v0.2 feature doc. | SRS v0.2 acceptance criteria pass. | SRS v0.2 | Not started |
| M3 | Authentication | Buyer + admin auth, RBAC, sessions. | Per SRS v0.3 feature doc. | SRS v0.3 acceptance criteria pass. | SRS v0.3 | Not started |
| M4 | Shopping Cart | Guest + logged-in cart, persistence, sync. | Per SRS v0.4 feature doc. | SRS v0.4 acceptance criteria pass. | SRS v0.4 | Not started |
| M5 | Orders | Checkout capture, order lifecycle, history. | Per SRS v0.5 feature doc. | SRS v0.5 acceptance criteria pass. | SRS v0.5 | Not started |
| M6 | Payments | Razorpay integration, verification, refunds. | Per SRS v0.6 feature doc. | SRS v0.6 acceptance criteria pass. | SRS v0.6 | Not started |
| M7 | Dashboard | Admin analytics + buyer account dashboard. | Per SRS v0.7 feature doc. | SRS v0.7 acceptance criteria pass. | SRS v0.7 | Not started |
| M8 | Backend NFRs | Performance, scalability, security, DB, API, logging, error handling — system-wide. | Per SRS v0.8 feature doc. | SRS v0.8 acceptance criteria pass. | SRS v0.8 | Not started |
| M9 | Frontend NFRs | UI performance, responsiveness, browser support, accessibility, UX, frontend security — system-wide. | Per SRS v0.9 feature doc. | SRS v0.9 acceptance criteria pass. | SRS v0.9 | Not started |
| M10 | Launch Readiness | Final consolidated SRS + go-live checklist (security, India/Razorpay compliance pages, load test, monitoring wired up). | Per SRS v1.0. | SRS v1.0 complete; launch checklist items closed. | SRS v1.0 | Not started |

## Working through M2–M10: step by step, rebase before PR

Each feature milestone is worked through the existing 5-step SRS workflow (`docs/srs/SRS.md` §5) one functional requirement at a time — implement, test, commit — rather than one giant commit per feature. Before opening or updating a PR, rebase the feature branch onto the latest `main` (not merge-from-main), keeping history linear, consistent with the linear-history branch protection in `docs/architecture.md` §8.

## Relationship to GitHub Milestones

Each row above becomes a GitHub Milestone with the same title when work on it starts (`docs/srs/SRS.md` §5 step 3); issues under that milestone track the individual functional requirements. This file doesn't need to be re-synced line-by-line with GitHub — update the Status column here when a milestone opens/closes, and let the Traceability Matrix carry the fine-grained issue-level detail.
