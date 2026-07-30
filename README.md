# TechCart

Production e-commerce platform: a Buyer storefront (Next.js) and an Admin console (React), sharing one Node/Express API and MongoDB. India-first (Razorpay), deployed on managed infrastructure (Vercel, Render/Railway, MongoDB Atlas, Upstash Redis).

## Development process

This project is built feature-by-feature against a version-tracked Software Requirements Specification:

```
Feature → Update SRS → Add to Milestone → Add to Issue → Implement Code
```

- **SRS:** [docs/srs/SRS.md](docs/srs/SRS.md) — scope, feature index, per-feature template, and workflow.
- **Tech stack & architecture:** see the "E-Commerce Platform — Technology Blueprint" referenced in the SRS.

## Status

**Foundation phase (M0) is complete.** SRS v0.1 (initial scope and feature listing) is complete. Root workspace tooling is scaffolded (Issue #1 / M0.1, merged) — npm workspaces, shared TypeScript/ESLint/Prettier config, Node 24 pinning. `backend/` is scaffolded (Issue #2 / M0.2, merged) — Express 5 + TypeScript, module-based structure, a working `health` endpoint, Vitest+Supertest tests. Coverage reporting is wired (Issue #3 / M0.3, merged). `buyer-app/` is scaffolded (Issue #4 / M0.4, merged) — Next.js 16 App Router, Tailwind CSS 4, feature-based structure, a placeholder home route, with a Vitest + React Testing Library + MSW test suite wired (Issue #5 / M0.5, merged). `admin-app/` is scaffolded (Issue #6 / M0.6, merged) — Vite + React 19 + TypeScript, React Router, Tailwind CSS 4, a placeholder landing route, with a Vitest + React Testing Library + MSW test suite wired (Issue #7 / M0.7, merged). Root fan-out scripts (`npm run build`, `npm run lint`, `npm test`) are wired and verified against a genuinely clean clone (Issue #8 / M0.8, merged). M1 (CI Pipeline) is complete: `.github/workflows/ci.yml` runs lint + a per-workspace test matrix on every PR into `main` (Issue #9 / M1.1, merged); branch protection on `main` is configured (Issue #10 / M1.2, merged) — PR + passing CI required, squash-merge only. SRS v0.2 (Product Catalog) is spec-drafted (`docs/srs/features/0.2-product-catalog.md`, `FR-CAT-001`–`096`, since amended to `FR-CAT-100`, PR #23 merged), with its backend implementation broken into 12 issues, opened as GitHub Issues #25–#36 (PR #37). M2 implementation is underway: Issue #25 / M2.1 (core plumbing — live Mongo connection, response envelope, temporary admin guard, merged), Issue #26 / M2.2 (Cloudflare R2 image uploads — presigned and backend-proxied upload paths, merged), Issue #27 / M2.3 (brand management — admin CRUD, guarded delete, public brand list, merged), Issue #28 / M2.4 (category management — two-level hierarchy, combined delete guard, public list with SEO fallback, merged), and Issue #29 / M2.5 (category-governed specifications — nested schema, field-level guarded delete, merged) are all done; see `backend/CLAUDE.md`/`backend/AGENTS.md` for detail.
