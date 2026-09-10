# Regenerating the user-manual screenshots

The screenshots embedded in [`../buyer-app.md`](../buyer-app.md) and
[`../admin-app.md`](../admin-app.md) are produced by [`capture.mjs`](capture.mjs) — a
Playwright script that drives a real Chromium against locally-running instances of all
three services and walks every documented screen.

Most screens are captured against **existing data**. The admin manual's "How to add a
brand / category / specification / variant / product / warehouse / stock" sections
are backed by the `create-flows` phase, which fills each create form and screenshots
it. The script never runs a `seed:*` script.

## Prerequisites

- Node 24 (repo `.nvmrc`)
- A local MongoDB with a populated TechCart database — catalogue, at least a few
  orders, warehouses, and inventory rows. The standard local dev dataset
  (`npm run seed:all --workspace backend`) covers this.
- An admin account you can sign in with (a `super-admin`), and — for the
  catalog-manager dashboard shot — a `catalog-manager` account. `npm run seed:users`
  creates `catalog-manager@example.com` / `order-manager@example.com` with password
  `TechCart@Dev123`; `npm run seed:super-admin` creates the env-driven super-admin.
- `@playwright/test` installed (root `devDependency`) and its browser:
  ```
  npm install
  npx playwright install chromium
  ```

## 1. Point the frontends at a local backend (temporary)

All `.env*` files are gitignored. Back them up first, then set:

| File                   | Set                                                     |
| ---------------------- | ------------------------------------------------------- |
| `backend/.env`         | `MONGODB_URI` → your local MongoDB                      |
| `backend/.env`         | `RATE_LIMITING_ENABLED=false` (repeated sign-ins)       |
| `buyer-app/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:4000`             |
| `admin-app/.env.local` | `VITE_API_URL=http://localhost:4000` (create this file) |

`backend/.env` must still carry valid `R2_*`, `RAZORPAY_*`, `GOOGLE_CLIENT_*`,
`JWT_SECRET`, and `APP_BASE_URL` values — the backend validates them at startup. Sign-in
OTP codes are fixed to `123456` in every environment (`backend/src/lib/otp.ts`), so no
real inbox is needed.

## 2. Start the three servers

```
npm run dev --workspace backend      # http://localhost:4000
npm run dev --workspace buyer-app    # http://localhost:3000
npm run dev --workspace admin-app    # http://localhost:5173
```

## 3. Run the capture

```
node docs/user-manuals/screenshots/capture.mjs
# or one phase:  --phase=admin | catalog-manager | create-flows | buyer
```

Set `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / `BUYER_EMAIL` in the environment if
they differ from the script defaults (`admin@techcart.com` / `superAdmin123` /
`buyer1@example.com`). Output PNGs land in
`docs/user-manuals/assets/{buyer-app,admin-app}/`.

The script is tolerant of catalogue data that already exists and of individual steps
failing (each is wrapped so the run continues), so it is safe to re-run.

## 4. Revert

Restore `backend/.env` and `buyer-app/.env.local` from your backups; delete
`admin-app/.env.local`. Stop the servers.

## Notes and known gaps

- **Images** — the standard dev dataset uses grey placeholder images. Real uploaded
  images render the same way; only the picture content differs.
- **Buyer product specifications** — the dev dataset's products carry no specification
  values, so the storefront's PDP "Specifications" accordion is not visible and has no
  screenshot. It is described in prose in `buyer-app.md` §6.
- **Razorpay** — `19-checkout-payment.png` shows the real Razorpay Checkout overlay
  when test keys are configured; without them the step lands on its "Retry payment"
  state instead. Either is a valid screenshot for the manual.
- The `create-flows` phase adds a brand/category/product named "Aurora …" to the
  database. Drop those rows afterwards if you want a clean dataset.
