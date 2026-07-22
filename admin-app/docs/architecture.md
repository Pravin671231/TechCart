# admin-app — architecture

Implementation-level detail for `admin-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.2 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` is routing only (explicit `react-router` route declarations, since there's no file-system router here). Actual UI/logic lives in `src/features/<feature>/`:

```
src/
├── app/
│   └── App.tsx              # BrowserRouter + Routes — imports and renders LandingPlaceholder at "/"
├── features/
│   └── landing/
│       └── LandingPlaceholder.tsx  # first feature — static placeholder content
├── main.tsx                    # Vite entry — mounts <App /> into #root
└── index.css                     # @import "tailwindcss";
```

See `AGENTS.md` for the full `app/` vs `features/` convention.

## Current file tree

```
admin-app/
├── package.json          # name "admin-app"; scripts: dev, build, lint, preview
├── tsconfig.json           # solution file — references tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json          # app code: bundler resolution, DOM lib, @/* → ./src/*
├── tsconfig.node.json           # covers vite.config.ts
├── vite.config.ts                 # @vitejs/plugin-react, @tailwindcss/vite, vite-tsconfig-paths
├── eslint.config.mjs                # typescript-eslint + react-hooks + react-refresh — separate from root eslint.config.ts
├── index.html                        # Vite entry HTML, mounts #root
├── AGENTS.md
├── CLAUDE.md                           # @AGENTS.md (Claude Code import syntax)
├── docs/architecture.md                  # this file
└── src/
    ├── main.tsx
    ├── index.css
    ├── app/App.tsx
    └── features/landing/LandingPlaceholder.tsx
```

## Config

- **TypeScript**: split into `tsconfig.app.json` (app code — `moduleResolution: "bundler"`, DOM lib, `jsx: "react-jsx"`, `@/*` → `./src/*`) and `tsconfig.node.json` (covers `vite.config.ts`), referenced from the root `tsconfig.json` solution file — the standard Vite project-reference shape. Deliberately does **not** `extends: "../tsconfig.base.json"`, same reasoning as `buyer-app` (see `buyer-app/docs/architecture.md`): that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Vite/React need.
- **Path aliases**: `@/*` → `./src/*` is resolved by the `vite-tsconfig-paths` plugin in `vite.config.ts`, for both dev and build. This is a deliberate difference from `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` — that option is **not real** (Vite silently ignores it; confirmed while fixing `buyer-app`'s Vitest config in Issue #5), so it's never used here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via the `@tailwindcss/vite` plugin in `vite.config.ts` and a single `@import "tailwindcss";` in `src/index.css` — the Vite-native equivalent of `buyer-app`'s PostCSS-based `@tailwindcss/postcss` wiring.
- **ESLint**: `eslint.config.mjs` uses `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (the standard Vite React-TS template set) — resolved when `eslint` runs from within `admin-app/` (e.g. `npm run lint --workspace admin-app`). The root `eslint.config.ts` still covers `admin-app/**` with baseline TS rules when run repo-wide (`npx eslint .` from root) — same non-conflicting layering as `buyer-app`.

## Testing

Not wired yet — Vitest + React Testing Library + MSW land in a later issue (mirrors `buyer-app`'s Issue #5), matching root `docs/architecture.md` §8.

## Dev workflow

- `npm run dev --workspace admin-app` — `vite`, serves on `http://localhost:5173`
- `npm run build --workspace admin-app` — `tsc -b && vite build`, must succeed
- `npm run lint --workspace admin-app` — `eslint .` (uses this workspace's own flat config)
- `npm run preview --workspace admin-app` — `vite preview`, serves the production build locally
