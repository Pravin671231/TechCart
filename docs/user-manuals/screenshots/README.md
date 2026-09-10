# Regenerating the user-manual screenshots

The screenshots embedded in [`../buyer-app.md`](../buyer-app.md) and
[`../admin-app.md`](../admin-app.md) are produced by [`capture.mjs`](capture.mjs) — a
Playwright script that drives a real Chromium and walks every documented screen.

- The **`buyer`** phase is captured against the **deployed storefront**
  (`https://tech-cart-buyer-app.vercel.app`) so the screenshots show the real
  catalogue and real product images. It needs no local server.
- The **`admin`**, **`catalog-manager`**, and **`create-flows`** phases run against a
  **local** backend + admin-app dev server (no live admin credentials).

Most screens are captured against **existing data**. The admin manual's "How to add a
brand / category / specification / variant / product / warehouse / stock" sections
are backed by the `create-flows` phase, which fills each create form and screenshots
it. The script never runs a `seed:*` script.

## Prerequisites (all phases)

- Node 24 (repo `.nvmrc`)
- `@playwright/test` installed (root `devDependency`) and its browser:
  ```
  npm install
  npx playwright install chromium
  ```

## Buyer phase — from the live site

No local setup. Sign-in OTP codes are fixed to `123456` in every environment
(`backend/src/lib/otp.ts`), so no real inbox is needed.

```
BUYER_URL=https://tech-cart-buyer-app.vercel.app \
BUYER_EMAIL=buyer1@example.com \
PRODUCT_SLUG=iphone-15 \
node docs/user-manuals/screenshots/capture.mjs --phase=buyer
```

`PRODUCT_SLUG` must be a published product with an in-stock active variant. The phase
signs in once, adds one item to the cart and places one order to capture the
cart/checkout/payment/orders screens, then **cancels that order and empties the cart**
in a cleanup step. Production rate-limits sign-in (~5 / 15 min) — aim for a single
clean run; if a re-run 429s, wait it out.

## Admin phases — prerequisites

- A local MongoDB with a populated TechCart database — catalogue, at least a few
  orders, warehouses, and inventory rows. The standard local dev dataset
  (`npm run seed:all --workspace backend`) covers this.
- An admin account you can sign in with (a `super-admin`), and — for the
  catalog-manager dashboard shot — a `catalog-manager` account. `npm run seed:users`
  creates `catalog-manager@example.com` / `order-manager@example.com` with password
  `TechCart@Dev123`; `npm run seed:super-admin` creates the env-driven super-admin.

### 1. Point the frontends at a local backend (temporary)

All `.env*` files are gitignored. Back them up first, then set:

| File                   | Set                                                     |
| ---------------------- | ------------------------------------------------------- |
| `backend/.env`         | `MONGODB_URI` → your local MongoDB                      |
| `backend/.env`         | `RATE_LIMITING_ENABLED=false` (repeated sign-ins)       |
| `admin-app/.env.local` | `VITE_API_URL=http://localhost:4000` (create this file) |

`backend/.env` must still carry valid `R2_*`, `RAZORPAY_*`, `GOOGLE_CLIENT_*`,
`JWT_SECRET`, and `APP_BASE_URL` values — the backend validates them at startup.

### 2. Start the servers

```
npm run dev --workspace backend      # http://localhost:4000
npm run dev --workspace admin-app    # http://localhost:5173
```

### 3. Run the capture

```
node docs/user-manuals/screenshots/capture.mjs --phase=admin
node docs/user-manuals/screenshots/capture.mjs --phase=catalog-manager
node docs/user-manuals/screenshots/capture.mjs --phase=create-flows
```

Set `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in the environment if they differ
from the script defaults (`admin@techcart.com` / `superAdmin123`). Output PNGs land in
`docs/user-manuals/assets/admin-app/`.

The script is tolerant of catalogue data that already exists and of individual steps
failing (each is wrapped so the run continues), so it is safe to re-run.

### 4. Revert

Restore `backend/.env` from your backup; delete `admin-app/.env.local`. Stop the
servers.

## Notes and known gaps

- **Images** — the local dataset the admin-app screenshots use has grey placeholder
  images. The live storefront (buyer-app screenshots) serves real product images.
- **Razorpay** — `19-checkout-payment.png` shows the real Razorpay Checkout overlay
  (Test Mode) when test keys are configured; without them the step lands on its
  "Retry payment" state instead. Either is a valid screenshot for the manual.
- **Test data** — the `buyer` phase places one order and then cancels it + empties
  the cart; a single cancelled order is left in that buyer's history. The
  `create-flows` phase adds an "Aurora …" brand/category/product to the local
  database — drop those rows afterwards if you want a clean dataset.
