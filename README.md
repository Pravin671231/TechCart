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

Foundation phase (M0) in progress. SRS v0.1 (initial scope and feature listing) is complete. Root workspace tooling is scaffolded (Issue #1 / M0.1, merged) — npm workspaces, shared TypeScript/ESLint/Prettier config, Node 24 pinning. `backend/` is scaffolded (Issue #2 / M0.2, merged) — Express 5 + TypeScript, module-based structure, a working `health` endpoint, Vitest+Supertest tests. Coverage reporting is wired (Issue #3 / M0.3, merged). `buyer-app/` is scaffolded (Issue #4 / M0.4, merged) — Next.js 16 App Router, Tailwind CSS 4, feature-based structure, a placeholder home route, with a Vitest + React Testing Library + MSW test suite wired (Issue #5 / M0.5, merged). `admin-app/` is scaffolded (Issue #6 / M0.6, merged) — Vite + React 19 + TypeScript, React Router, Tailwind CSS 4, a placeholder landing route; no test suite yet.
