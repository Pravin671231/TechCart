# buyer-app — architecture

Implementation-level detail for `buyer-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.1 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` is routing only (Next's file-system router requires this). Actual UI/logic lives in `src/features/<feature>/`. `src/store/` (Issue #71 / M2.14) is a third, cross-cutting top-level `src/` directory — not a "feature" itself, but the Redux Toolkit + RTK Query plumbing every feature's data-fetching sits on top of:

```
src/
├── app/
│   ├── layout.tsx           # root layout, page metadata, mounts StoreProvider
│   ├── page.tsx               # thin route file — imports and renders HomePlaceholder
│   └── globals.css             # @import "tailwindcss";
├── features/
│   └── home/
│       └── HomePlaceholder.tsx  # first feature — static placeholder content
└── store/
    ├── env.ts                    # validates NEXT_PUBLIC_API_URL at import time, throws if missing
    ├── api.ts                    # RTK Query api slice — envelope unwrap/error normalization, tagTypes, no endpoints
    ├── store.ts                  # configureStore factory (makeStore) + AppStore/RootState/AppDispatch types
    ├── StoreProvider.tsx          # "use client" boundary wrapping <Provider>, mounted in layout.tsx
    └── hooks.ts                    # typed useAppDispatch/useAppSelector/useAppStore
```

See `AGENTS.md` for the full app/ vs features/ vs store/ convention.

## State management / data fetching

- **Redux Toolkit + RTK Query**, not TanStack Query — a deliberate choice (Issue #71 / M2.14), since `createApi`'s cache tags give the later filtered/paginated listing screens (M2.16/M2.17) automatic refetch-on-arg-change with no manual `useEffect` wiring. Root `docs/architecture.md` §4.1 is updated to match.
- `src/store/api.ts` defines **zero endpoints** — `endpoints: () => ({})`, RTK Query's own documented empty-API-slice pattern. Later feature issues add endpoints via `api.injectEndpoints({...})` inside their own `src/features/<feature>/api.ts`, never by editing `src/store/api.ts` directly. `tagTypes: ["Product", "Category"]` is declared here so those endpoints can `providesTags`/`invalidatesTags` against a shared, pre-agreed list.
- A single custom `baseQuery` (`src/store/api.ts`, wrapping `fetchBaseQuery`) does two things for every endpoint automatically: unwraps `backend`'s `{success:true,data}` envelope down to `data`, and normalizes both of `backend`'s distinct error shapes (`{success:false,code,message}` and, for `ZodError`s specifically, `{success:false,code,errors}` with no `message` key) into one consistent `{code,message}` shape — synthesizing `message` from `errors` when the latter is what the backend sent. Every `useXQuery()` hook's `error` is therefore always `NormalizedApiError`, never the raw backend shape.
- List responses' `pagination` key is currently dropped by the blanket unwrap (there are no list endpoints yet to need it) — flagged with a `TODO(M2.16/M2.17)` in `api.ts` to thread it through via RTK Query's per-endpoint `meta` once a real list endpoint exists.
- The Redux store is created **per-`StoreProvider`-instance** (`useState(() => makeStore())`, not a module-level singleton), per Redux Toolkit's own Next.js App Router guidance — avoids cross-request state bleed if a route later becomes dynamically SSR'd. `layout.tsx` stays a Server Component (still exports `metadata`); `StoreProvider.tsx` is the `"use client"` boundary that mounts `<Provider>` around `children`.
- `NEXT_PUBLIC_API_URL` fails loudly, not silently: `src/store/env.ts` validates it with `zod` at module-evaluation time and throws immediately if unset. Because `StoreProvider` is reachable from every route including the statically-prerendered `/`, `next build`'s static-generation pass pulls in `env.ts` and the build fails outright with a clear message if the var is missing; under `next dev` the same throw surfaces via the dev error overlay on first request. Never add a hardcoded fallback default in code — the `http://localhost:4000` local-dev default is documentation-only, living in `.env.example`'s comment.

## Current file tree

```
buyer-app/
├── package.json          # name "buyer-app"; scripts: dev, build, start, lint, test
├── tsconfig.json           # Next-generated — NOT extending ../tsconfig.base.json (see Config below)
├── next.config.ts
├── postcss.config.mjs        # @tailwindcss/postcss plugin
├── eslint.config.mjs           # eslint-config-next (core-web-vitals + typescript) — separate from root eslint.config.ts
├── vitest.config.ts             # jsdom environment, @vitejs/plugin-react, vite-tsconfig-paths
├── vitest.setup.ts                # jest-dom matchers, MSW server lifecycle, RTL cleanup
├── AGENTS.md                    # Next.js version-guard warning (auto-generated) + TechCart addendum
├── CLAUDE.md                     # @AGENTS.md (Claude Code import syntax)
├── docs/architecture.md            # this file
├── .env.example                   # NEXT_PUBLIC_API_URL (blank; default documented in a comment)
├── __tests__/
│   ├── home.test.tsx               # renders app/page.tsx, asserts placeholder content
│   ├── store/api.test.ts             # api slice: envelope unwrap, error normalization, fail-loud env check
│   └── mocks/{handlers.ts,server.ts}  # shared MSW server, extended by later feature tests
└── src/
    ├── app/{layout.tsx,page.tsx,globals.css}
    ├── features/home/HomePlaceholder.tsx
    └── store/{env.ts,api.ts,store.ts,StoreProvider.tsx,hooks.ts}
```

## Config

- **TypeScript**: `tsconfig.json` is Next's own generated config (`module: "esnext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, the `next` TS plugin, `@/*` → `./src/*`). It deliberately does **not** `extends: "../tsconfig.base.json"` — that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Next requires. Sharing strictness flags across all three workspaces is a possible future follow-up, not done here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via `postcss.config.mjs` (`@tailwindcss/postcss` plugin) and a single `@import "tailwindcss";` in `src/app/globals.css`.
- **ESLint**: `eslint.config.mjs` uses `eslint-config-next` (React hooks rules, Next-specific rules, core-web-vitals) — resolved when `eslint` runs from within `buyer-app/` (e.g. `npm run lint --workspace buyer-app`). The root `eslint.config.ts` still covers `buyer-app/**` with baseline TS rules when run repo-wide (`npx eslint .` from root) — the two aren't in conflict, just different scopes.

## Testing

- Vitest (`environment: "jsdom"`) + React Testing Library + MSW, per root `docs/architecture.md` §8. `vitest.config.ts` uses the `vite-tsconfig-paths` plugin for `@/*` resolution plus `@vitejs/plugin-react` for JSX transform — neither is needed by `backend`'s Node-only config. Note: `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` is **not** a real Vite/Vitest option (verified by reproducing its `@/app` resolution failure); `backend/CLAUDE.md`'s claim that this works natively is inaccurate and worth a follow-up fix there.
- Test files live in workspace-root `__tests__/`, not colocated in `src/` — `__tests__/home.test.tsx` is the current worked example, rendering `src/app/page.tsx` directly. `__tests__/store/api.test.ts` (Issue #71 / M2.14) is the second, exercising the RTK Query `baseQuery` end-to-end via a throwaway `api.injectEndpoints({...})` test endpoint dispatched through a real `makeStore()`.
- `__tests__/mocks/server.ts` + `handlers.ts` hold one shared MSW server, started/stopped once in `vitest.setup.ts`; later feature tests extend `handlers.ts` or call `server.use(...)` per-test rather than re-wiring MSW from scratch.
- Because `src/store/env.ts` throws at import time, `api.test.ts` uses `vi.stubEnv` + `vi.resetModules()` + dynamic `import()` per test to get an isolated module graph with a controlled env value each time — the same technique any future test needing a different `NEXT_PUBLIC_API_URL` state should reuse.
- Components using RTK Query hooks (`useXQuery`, etc.) need a manual `<Provider store={makeStore()}>` wrapper in any test that renders them directly with RTL — `vitest.setup.ts`/`layout.tsx`'s `StoreProvider` isn't in the tree for a component rendered in isolation.
- No coverage threshold yet (matches `backend`'s "reporting only" stance — a gate lands once there are real features to measure).

## Dev workflow

- Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_API_URL` (local dev default `http://localhost:4000`, matching `backend`'s default `PORT`) before running `dev` or `build` — both fail immediately with a clear error if it's missing (`src/store/env.ts`).
- `npm run dev --workspace buyer-app` — `next dev`, serves on `http://localhost:3000`
- `npm run build --workspace buyer-app` — `next build`, must succeed
- `npm run lint --workspace buyer-app` — `eslint` (uses this workspace's own `eslint-config-next` rules)
- `npm run test --workspace buyer-app` — `vitest run`
