# 🛒 TechCart — Full Stack E-Commerce Platform

TechCart is a production e-commerce platform: a Next.js buyer storefront and a React/Vite admin console, sharing one Node/Express API and one MongoDB database. India-first (Razorpay), built feature-by-feature against a versioned SRS, deployed on managed infrastructure (Vercel, Render, MongoDB Atlas, Upstash Redis).

---

## ✨ Features

- 🔍 **Product Discovery** — buyer-facing search, category browsing, and price/brand/category/variant/specification filtering with sorting
- 🗂️ **Catalog Management** — admin CRUD for brands, hierarchical categories, category-governed specifications & variant types, and products with embedded sellable variants
- 🖼️ **Image Uploads** — direct-to-storage presigned uploads to Cloudflare R2, plus a backend-proxied fallback path
- 🔎 **Admin Search & Status Control** — search across all three admin list views, dedicated status-update endpoints for products/categories/brands
- 🧪 **Tested** — Vitest + React Testing Library + MSW on both frontends, Vitest + Supertest on the backend
- 🐳 **Containerized** — a `Dockerfile` per app plus a root `docker-compose.yml` for one-command local startup
- ⚙️ **CI/CD** — GitHub Actions runs lint + tests on every PR; `backend` auto-deploys to Render, `buyer-app`/`admin-app` auto-deploy to Vercel, on every merge to `main`

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| **Buyer Storefront** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Admin Console** | Vite 7, React 19, TypeScript, Tailwind CSS 4, React Router 7 |
| **Backend API** | Node.js 24, Express 5, TypeScript, Zod |
| **Database** | MongoDB (Mongoose, MongoDB Atlas) |
| **File Storage** | Cloudflare R2 |
| **Testing** | Vitest, React Testing Library, MSW, Supertest |
| **DevOps** | Docker, GitHub Actions, Render, Vercel |

---

## 🚀 Getting Started

### Prerequisites

- Node.js **24** (pinned in `.nvmrc`/`.node-version` — `nvm use` if you have nvm installed)
- npm
- A MongoDB connection string (local `mongod`, or a MongoDB Atlas cluster)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pravin671231/TechCart.git
   cd TechCart
   ```

2. **Install dependencies** (single install covers all three npm workspaces):
   ```bash
   npm install
   ```

3. **Set up backend environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Fill in `MONGODB_URI`, `ADMIN_API_KEY`, and the five `R2_*` (Cloudflare R2) variables. `buyer-app` and `admin-app` need no environment setup — neither currently declares any env vars.

4. **Run each app in dev mode** (three separate terminals):
   ```bash
   npm run dev --workspace backend    # http://localhost:4000
   npm run dev --workspace buyer-app  # http://localhost:3000
   npm run dev --workspace admin-app  # http://localhost:5173
   ```

   **Or, with Docker** — bring all three up together in one command:
   ```bash
   docker compose up --build
   ```
   Same three ports. See `docker-compose.yml` and `docker/` for the per-app Dockerfiles.

---

## 📜 Available Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds all three workspaces |
| `npm run lint` | Lints the whole repo |
| `npm test` | Runs all three workspaces' test suites |
| `npm run test:backend` | Runs just `backend`'s tests |
| `npm run test:buyer-app` | Runs just `buyer-app`'s tests |
| `npm run test:admin-app` | Runs just `admin-app`'s tests |

---

## 📚 Documentation

- **[docs/srs/SRS.md](docs/srs/SRS.md)** — the versioned Software Requirements Specification: scope, feature index, per-feature detail docs.
- **[docs/architecture.md](docs/architecture.md)** — system diagram, per-app architecture, data model, environments, and conventions. **§10 is the current source of truth for what's implemented so far.**
- Each workspace also has its own `CLAUDE.md` (`backend/CLAUDE.md`, `buyer-app/CLAUDE.md`, `admin-app/CLAUDE.md`) with implementation detail specific to that app.

---

## ☁️ Deployment

`backend` deploys to [Render](https://render.com) as a Docker service, built from `docker/Dockerfile.backend` via the repo-root `render.yaml` Blueprint. `buyer-app` and `admin-app` both deploy natively to [Vercel](https://vercel.com) as separate projects from this same repo. See [docs/architecture.md §7](docs/architecture.md) for the full environment breakdown.

---

## 🧭 Development Process

This project is built feature-by-feature against a version-tracked Software Requirements Specification:

```
Feature → Update SRS → Add to Milestone → Add to Issue → Implement Code
```

- **SRS:** [docs/srs/SRS.md](docs/srs/SRS.md) — scope, feature index, per-feature template, and workflow.
- **Tech stack & architecture:** see the "E-Commerce Platform — Technology Blueprint" referenced in the SRS.
