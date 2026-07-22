# buyer-app — architecture

Implementation-level detail for `buyer-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.1 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` is routing only (Next's file-system router requires this). Actual UI/logic lives in `src/features/<feature>/`:

```
src/
├── app/
│   ├── layout.tsx           # root layout, page metadata
│   ├── page.tsx               # thin route file — imports and renders HomePlaceholder
│   └── globals.css             # @import "tailwindcss";
└── features/
    └── home/
        └── HomePlaceholder.tsx  # first feature — static placeholder content
```

See `AGENTS.md` for the full app/ vs features/ convention.

## Current file tree

```
buyer-app/
├── package.json          # name "buyer-app"; scripts: dev, build, start, lint
├── tsconfig.json           # Next-generated — NOT extending ../tsconfig.base.json (see Config below)
├── next.config.ts
├── postcss.config.mjs        # @tailwindcss/postcss plugin
├── eslint.config.mjs           # eslint-config-next (core-web-vitals + typescript) — separate from root eslint.config.ts
├── AGENTS.md                    # Next.js version-guard warning (auto-generated) + TechCart addendum
├── CLAUDE.md                     # @AGENTS.md (Claude Code import syntax)
├── docs/architecture.md            # this file
└── src/
    ├── app/{layout.tsx,page.tsx,globals.css}
    └── features/home/HomePlaceholder.tsx
```

## Config

- **TypeScript**: `tsconfig.json` is Next's own generated config (`module: "esnext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, the `next` TS plugin, `@/*` → `./src/*`). It deliberately does **not** `extends: "../tsconfig.base.json"` — that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Next requires. Sharing strictness flags across all three workspaces is a possible future follow-up, not done here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via `postcss.config.mjs` (`@tailwindcss/postcss` plugin) and a single `@import "tailwindcss";` in `src/app/globals.css`.
- **ESLint**: `eslint.config.mjs` uses `eslint-config-next` (React hooks rules, Next-specific rules, core-web-vitals) — resolved when `eslint` runs from within `buyer-app/` (e.g. `npm run lint --workspace buyer-app`). The root `eslint.config.ts` still covers `buyer-app/**` with baseline TS rules when run repo-wide (`npx eslint .` from root) — the two aren't in conflict, just different scopes.

## Dev workflow

- `npm run dev --workspace buyer-app` — `next dev`, serves on `http://localhost:3000`
- `npm run build --workspace buyer-app` — `next build`, must succeed
- `npm run lint --workspace buyer-app` — `eslint` (uses this workspace's own `eslint-config-next` rules)
