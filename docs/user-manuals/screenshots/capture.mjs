/**
 * Regenerates the screenshots embedded in docs/user-manuals/{buyer-app,admin-app}.md.
 *
 * Prereqs (see ./README.md): `npx playwright install chromium`. The `admin` /
 * `catalog-manager` / `create-flows` phases need a local backend + admin-app dev
 * server. The `buyer` phase can run against the deployed storefront — pass its URL.
 *
 * Usage:
 *   node docs/user-manuals/screenshots/capture.mjs                  # everything (local)
 *   node docs/user-manuals/screenshots/capture.mjs --phase=admin    # one phase
 *
 *   # buyer screenshots from the live site:
 *   BUYER_URL=https://tech-cart-buyer-app.vercel.app \
 *   BUYER_EMAIL=buyer1@example.com PRODUCT_SLUG=iphone-15 \
 *   node docs/user-manuals/screenshots/capture.mjs --phase=buyer
 *
 * Phases: admin  |  catalog-manager  |  buyer  |  create-flows
 *
 * The script reads existing seeded data for most screens and only *creates* a brand /
 * category / spec schema / variant axis / product for the "How to add…" walkthrough
 * shots (phase `create-flows`), tolerating anything that already exists. It never runs
 * a seed script and never uploads images (R2 presign needs live credentials).
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "assets");

const BUYER_URL = process.env.BUYER_URL ?? "http://localhost:3000";
const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:5173";
const OTP = "123456";

const SUPER_ADMIN = {
  email: process.env.SUPER_ADMIN_EMAIL ?? "admin@techcart.com",
  password: process.env.SUPER_ADMIN_PASSWORD ?? "superAdmin123",
};
const CATALOG_MANAGER = { email: "catalog-manager@example.com", password: "TechCart@Dev123" };
const BUYER_EMAIL = process.env.BUYER_EMAIL ?? "buyer1@example.com";
const PRODUCT_SLUG = process.env.PRODUCT_SLUG ?? "iphone-15";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const only = process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1];
const runPhase = (name) => !only || only === name;

mkdirSync(join(ASSETS, "buyer-app"), { recursive: true });
mkdirSync(join(ASSETS, "admin-app"), { recursive: true });

const log = (...m) => console.log("•", ...m);
const warn = (...m) => console.warn("!", ...m);

function tune(ctx) {
  ctx.setDefaultNavigationTimeout(120000); // slow first-compile on the E: drive
  ctx.setDefaultTimeout(30000);
  return ctx;
}

async function shot(page, app, name) {
  await page.waitForTimeout(500);
  // hide framework dev overlays so they don't appear in the manual
  await page
    .addStyleTag({
      content:
        "nextjs-portal,#__next-build-watcher,[data-nextjs-toast],vite-plugin-checker-error-overlay{display:none!important}",
    })
    .catch(() => {});
  await page.screenshot({ path: join(ASSETS, app, `${name}.png`) });
  log("shot", `${app}/${name}.png`);
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    warn(`skip "${label}": ${String(err).split("\n")[0]}`);
  }
}

// Wait for a product listing to finish loading (the live backend can be slow).
async function waitForListing(page) {
  await page
    .getByText(/Showing .* of .* products/i)
    .first()
    .waitFor({ timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

// --- admin sign-in (password -> OTP) --------------------------------------
async function adminSignIn(browser, creds, { viewport = DESKTOP, capture = false } = {}) {
  const ctx = tune(await browser.newContext({ viewport }));
  const page = await ctx.newPage();
  await page.goto(`${ADMIN_URL}/sign-in`, { waitUntil: "networkidle" });
  if (capture) await shot(page, "admin-app", "01-sign-in-password");

  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForSelector("#otp-code", { timeout: 20000 });
  if (capture) await shot(page, "admin-app", "02-sign-in-otp");

  await page.fill("#otp-code", OTP);
  await page.getByRole("button", { name: /Verify & sign in/i }).click();
  await page.waitForURL(`${ADMIN_URL}/`, { timeout: 20000 });
  log("admin signed in:", creds.email);
  return { ctx, page };
}

// --- buyer sign-in (email OTP) ------------------------------------------
// Set BUYER_STORAGE to a file path to cache the signed-in session (cookies +
// localStorage bearer token) so re-runs don't hit the production sign-in rate
// limit — the file is reused when it exists, written after a fresh sign-in.
const BUYER_STORAGE = process.env.BUYER_STORAGE;

async function buyerSignIn(browser, { viewport = DESKTOP, capture = false } = {}) {
  if (BUYER_STORAGE && existsSync(BUYER_STORAGE)) {
    const ctx = tune(await browser.newContext({ viewport, storageState: BUYER_STORAGE }));
    const page = await ctx.newPage();
    await page.goto(`${BUYER_URL}/`, { waitUntil: "networkidle" });
    log("buyer session reused from", BUYER_STORAGE);
    return { ctx, page };
  }

  const ctx = tune(await browser.newContext({ viewport }));
  const page = await ctx.newPage();
  await page.goto(`${BUYER_URL}/sign-in`, { waitUntil: "networkidle" });
  if (capture) await shot(page, "buyer-app", "01-sign-in");

  await page.fill('input[type="email"]', BUYER_EMAIL);
  await page.getByRole("button", { name: /Send OTP/i }).click();
  await page.getByLabel(/Verification Code/i).waitFor({ timeout: 20000 });
  if (capture) await shot(page, "buyer-app", "02-otp-code-step");

  await page.getByLabel(/Verification Code/i).fill(OTP);
  await page.getByRole("button", { name: /Verify & Sign In/i }).click();
  await page.waitForURL(`${BUYER_URL}/`, { timeout: 20000 });
  log("buyer signed in:", BUYER_EMAIL);
  if (BUYER_STORAGE) await ctx.storageState({ path: BUYER_STORAGE });
  return { ctx, page };
}

// =======================================================================
// phase: admin  (super-admin — every admin screen against seeded data)
// =======================================================================
async function adminPhase(browser) {
  const { ctx, page } = await adminSignIn(browser, SUPER_ADMIN, { capture: true });
  const nav = (p) => page.goto(`${ADMIN_URL}${p}`, { waitUntil: "networkidle" });

  await nav("/");
  await shot(page, "admin-app", "03-console-layout");
  await shot(page, "admin-app", "05-dashboard-sales");

  await nav("/brands");
  await shot(page, "admin-app", "06-brands-list");

  await nav("/categories");
  await shot(page, "admin-app", "08-categories-list");

  await nav("/specifications");
  await safe("spec editor", async () => {
    await page.getByRole("combobox").first().selectOption({ label: "iPhones" });
    await page.waitForTimeout(1200);
    await shot(page, "admin-app", "10-specifications-editor");
    await shot(page, "admin-app", "11-spec-group-fields");
  });

  await nav("/variant-types");
  await safe("variant editor", async () => {
    await page.getByRole("combobox").first().selectOption({ label: "iPhones" });
    await page.waitForTimeout(1200);
    await shot(page, "admin-app", "12-variant-types-editor");
  });

  await nav("/products");
  await shot(page, "admin-app", "13-products-list");

  await safe("product detail + variant form + status", async () => {
    await page.locator("tbody tr td a").first().click();
    await page.waitForURL(/\/products\/[^/]+$/);
    await page.waitForTimeout(1200);
    await shot(page, "admin-app", "16-product-detail");
    await shot(page, "admin-app", "19-product-status");
    await page
      .getByRole("link", { name: /^Edit$/ })
      .first()
      .click();
    await page.waitForURL(/\/edit$/);
    await page.waitForTimeout(1000);
    await page
      .getByRole("button", { name: /Add variant/i })
      .first()
      .click();
    await page.waitForTimeout(800);
    await shot(page, "admin-app", "17-variant-form");
    await shot(page, "admin-app", "18-product-images-editor");
  });

  await nav("/warehouses");
  await shot(page, "admin-app", "20-warehouses");

  await nav("/inventory");
  await shot(page, "admin-app", "21-inventory-list");
  await safe("stock edit", async () => {
    await page.getByRole("button", { name: /^\d+$/ }).first().click();
    await page.waitForTimeout(400);
    await shot(page, "admin-app", "22-inventory-stock-edit");
  });

  await nav("/orders");
  await shot(page, "admin-app", "23-orders-list");
  await safe("order detail + modals", async () => {
    await page.getByRole("link", { name: /000002/ }).click(); // paid, captured payment
    await page.waitForURL(/\/orders\/[^/]+$/);
    await page.waitForTimeout(1000);
    await shot(page, "admin-app", "27-order-detail");
    const orderUrl = page.url();
    await safe("cancel modal", async () => {
      await page.getByRole("button", { name: /^Cancel order$/i }).click();
      await page.waitForTimeout(600);
      await shot(page, "admin-app", "28-order-cancel-modal");
    });
    await page.goto(orderUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await safe("refund modal", async () => {
      await page.getByRole("button", { name: /^Refund$/i }).click();
      await page.waitForTimeout(600);
      await shot(page, "admin-app", "29-order-refund-modal");
    });
    await page.goto(orderUrl, { waitUntil: "networkidle" });
  });

  await nav("/admin-users");
  await shot(page, "admin-app", "24-admin-users-list");
  await safe("admin user form", async () => {
    await page.getByRole("button", { name: /New admin/i }).click();
    await page.waitForTimeout(500);
    await shot(page, "admin-app", "25-admin-user-form");
  });

  await nav("/account");
  await shot(page, "admin-app", "26-account-password");

  // mobile sidebar drawer
  await safe("mobile drawer", async () => {
    const m = tune(
      await browser.newContext({ viewport: MOBILE, storageState: await ctx.storageState() }),
    );
    const mp = await m.newPage();
    await mp.goto(`${ADMIN_URL}/`, { waitUntil: "networkidle" });
    await mp.getByRole("button", { name: /navigation menu/i }).click();
    await mp.waitForTimeout(500);
    await shot(mp, "admin-app", "04-sidebar-mobile-drawer");
    await m.close();
  });

  await ctx.close();
  log("admin phase done");
}

// =======================================================================
// phase: catalog-manager  (the reduced dashboard)
// =======================================================================
async function catalogManagerPhase(browser) {
  await safe("catalog-manager dashboard", async () => {
    const { ctx, page } = await adminSignIn(browser, CATALOG_MANAGER);
    await page.goto(`${ADMIN_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(page, "admin-app", "05b-dashboard-catalog");
    await ctx.close();
  });
}

// =======================================================================
// phase: create-flows  (the "How to add…" walkthrough shots)
// =======================================================================
async function createFlowsPhase(browser) {
  const { ctx, page } = await adminSignIn(browser, SUPER_ADMIN);
  page.on("dialog", (d) => d.accept("Wireless"));

  await safe("brand form (filled)", async () => {
    await page.goto(`${ADMIN_URL}/brands`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /New brand/i }).click();
    await page.fill("#brand-name", "Aurora Audio");
    await page.fill("#brand-description", "Premium headphones and speakers.");
    await shot(page, "admin-app", "07-brand-form");
    await safe("save brand", () => page.getByRole("button", { name: /^Save$/ }).click());
    await page.waitForTimeout(1200);
  });

  await safe("category form (filled)", async () => {
    await page.goto(`${ADMIN_URL}/categories`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /New category/i }).click();
    await page.fill("#category-name", "Headphones");
    await page.fill("#category-sort-order", "1");
    await page.fill("#category-description", "Over-ear and in-ear headphones.");
    await shot(page, "admin-app", "09-category-form");
    await safe("save category", () => page.getByRole("button", { name: /^Save$/ }).click());
    await page.waitForTimeout(1200);
  });

  await safe("product form (filled)", async () => {
    await page.goto(`${ADMIN_URL}/products/new`, { waitUntil: "networkidle" });
    await page.fill("#product-name", "Aurora N1 Wireless Headphones");
    await safe("brand", () => page.selectOption("#product-brand", { index: 1 }));
    await page.fill(
      "#product-description",
      "Rich, balanced sound with deep bass and a comfortable over-ear fit.",
    );
    await page.waitForTimeout(400);
    await shot(page, "admin-app", "14-product-form-basics");
    await safe("category -> specs", async () => {
      const val = await page
        .locator("#product-category option", { hasText: "iPhones" })
        .first()
        .getAttribute("value");
      await page.selectOption("#product-category", val);
      await page.waitForTimeout(1000);
      await shot(page, "admin-app", "15-product-form-specs");
    });
  });

  await ctx.close();
  log("create-flows phase done");
}

// =======================================================================
// phase: buyer  (storefront — seeded catalogue + buyer1's orders)
// =======================================================================
async function buyerPhase(browser) {
  const { ctx, page } = await buyerSignIn(browser, { capture: true });
  const nav = (p) => page.goto(`${BUYER_URL}${p}`, { waitUntil: "networkidle" });

  await nav("/");
  await waitForListing(page);
  await shot(page, "buyer-app", "03-home");
  await shot(page, "buyer-app", "24-header-nav");

  await safe("search suggestions", async () => {
    await page.locator('input[type="search"]').first().fill("iphone");
    await page.waitForTimeout(1600);
    await shot(page, "buyer-app", "05-search-suggestions");
  });
  await nav("/search?q=iphone");
  await waitForListing(page);
  await shot(page, "buyer-app", "06-search-results");

  await safe("category", async () => {
    await nav("/");
    await page.getByRole("button", { name: /All Categories/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("menuitem").first().click();
    await page.waitForURL(/\/category\//);
    await waitForListing(page);
    await shot(page, "buyer-app", "07-category");
    await shot(page, "buyer-app", "08-category-filters");
  });

  await safe("product detail", async () => {
    await nav(`/products/${PRODUCT_SLUG}`);
    await page.waitForTimeout(1500);
    await shot(page, "buyer-app", "10-product-detail");
    await safe("variant selector", async () => {
      // clip to the "Choose a variant" card
      const card = page.locator("section", { hasText: /Choose a variant/i }).first();
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await card.screenshot({
        path: join(ASSETS, "buyer-app", "11-variant-selector.png"),
      });
      log("shot", "buyer-app/11-variant-selector.png");
    });
    await safe("specs accordion", async () => {
      // element screenshot of the whole Specifications section so every group shows
      const specs = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: /^Specifications$/i }) })
        .first();
      await specs.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await specs.screenshot({
        path: join(ASSETS, "buyer-app", "12-specifications-accordion.png"),
      });
      log("shot", "buyer-app/12-specifications-accordion.png");
    });
    // pick an in-stock variant so "Add to Cart" is enabled, then add it
    await safe("add to cart", async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      const addBtn = page.getByRole("button", { name: /^Add to Cart$/i }).first();
      const selector = page.locator("section", { hasText: /Choose a variant/i });
      const values = selector.getByRole("button");
      const n = await values.count();
      for (let i = 0; i < n && !(await addBtn.isEnabled().catch(() => false)); i++) {
        await values
          .nth(i)
          .click()
          .catch(() => {});
        await page.waitForTimeout(600);
      }
      await addBtn.click({ timeout: 8000 });
      await page.waitForTimeout(2500);
    });
  });

  await safe("mini-cart + cart", async () => {
    await nav("/");
    await page.locator("header a[aria-label*='Cart']").first().hover();
    await page.waitForTimeout(900);
    await shot(page, "buyer-app", "15-mini-cart");
    await nav("/cart");
    await page.waitForTimeout(800);
    await shot(page, "buyer-app", "14-cart");
  });

  await safe("checkout", async () => {
    // ensure buyer1 has a saved address
    await nav("/account/addresses");
    await page.waitForTimeout(800);
    const hasAddress = await page.getByRole("button", { name: /^Edit$/ }).count();
    if (!hasAddress) {
      await page
        .getByRole("button", { name: /Add an? (new )?address/i })
        .first()
        .click();
      await page.getByLabel("Full name").fill("Sam Shopper");
      await page.getByLabel("Phone").fill("9876543210");
      await page.getByLabel("Address line 1").fill("42 MG Road");
      await page.getByLabel("City").fill("Bengaluru");
      await page.getByLabel("State").fill("Karnataka");
      await page.getByLabel("PIN code").fill("560001");
      await page.getByRole("button", { name: /^Add address$/i }).click();
      await page.waitForTimeout(1500);
    }
    await nav("/checkout");
    await page.waitForTimeout(1500);
    await shot(page, "buyer-app", "17-checkout-address");
    await safe("add-address form", async () => {
      await page.getByRole("button", { name: /Add a new address/i }).click();
      await page.waitForTimeout(600);
      await shot(page, "buyer-app", "18-checkout-add-address");
      await page
        .getByRole("button", { name: /^Cancel$/i })
        .first()
        .click();
      await page.waitForTimeout(300);
    });
    // PLACE_ORDER=0 keeps an already-good 19-checkout-payment.png and creates no
    // new order (useful for re-runs against the shared live backend).
    if (process.env.PLACE_ORDER !== "0") {
      await safe("payment step", async () => {
        await page.getByRole("button", { name: /Place order/i }).click();
        await page.waitForTimeout(6000); // order create + Razorpay init
        await shot(page, "buyer-app", "19-checkout-payment");
      });
    }
  });

  await safe("profile menu", async () => {
    await nav("/");
    await page.locator("header").getByRole("button").last().click();
    await page.waitForTimeout(400);
    await shot(page, "buyer-app", "25-profile-menu");
  });

  await safe("orders", async () => {
    await nav("/orders");
    await page
      .getByText(/Showing .* of .* orders/i)
      .first()
      .waitFor({ timeout: 45000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "buyer-app", "20-orders");
    // open a still-cancellable order so 26 shows the "Cancel order" button
    const rows = page.locator('a[href^="/orders/"]');
    let target = rows.filter({ hasText: /Pending payment|Paid/i }).first();
    if (!(await target.count())) target = rows.first();
    await target.click();
    await page.waitForURL(/\/orders\/[^/]+$/);
    await page
      .getByText(/^Order #/)
      .first()
      .waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, "buyer-app", "26-order-detail");
  });

  await safe("account", async () => {
    await nav("/account");
    await page
      .getByText(/Lifetime orders/i)
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, "buyer-app", "21-account");
  });
  await safe("addresses", async () => {
    await nav("/account/addresses");
    await page.waitForTimeout(1200);
    await shot(page, "buyer-app", "22-addresses");
    await safe("address form", async () => {
      await page
        .getByRole("button", { name: /Add an? (new )?address/i })
        .first()
        .click();
      await page.waitForTimeout(400);
      await shot(page, "buyer-app", "23-address-form");
    });
  });

  // mobile category filter drawer
  await safe("mobile filters", async () => {
    const m = tune(
      await browser.newContext({ viewport: MOBILE, storageState: await ctx.storageState() }),
    );
    const mp = await m.newPage();
    await mp.goto(`${BUYER_URL}/category/phones`, { waitUntil: "networkidle" });
    await mp.waitForTimeout(1200);
    await mp.getByRole("button", { name: /^Filters$/ }).click();
    await mp.waitForTimeout(500);
    await shot(mp, "buyer-app", "09-category-filter-drawer-mobile");
    await m.close();
  });

  // Clean up ONLY the order this run's checkout step created — matched on all of:
  // current status = pending_payment (via the header badge, not the timeline),
  // the fixed test shipping name, and the PRODUCT_SLUG item. This must never touch
  // a real / seeded order on the shared backend.
  const TEST_SHIPPING_NAME = "Sam Shopper";
  await safe("cleanup: cancel this run's test order", async () => {
    for (let pass = 0; pass < 4; pass++) {
      await nav("/orders");
      await page
        .getByText(/Showing .* of .* orders/i)
        .first()
        .waitFor({ timeout: 30000 })
        .catch(() => {});
      await page.waitForTimeout(1000);
      // list rows whose own badge says "Pending payment"
      const hrefs = await page.locator('a[href^="/orders/"]').evaluateAll((els) => [
        ...new Set(
          els
            .filter((e) => /Pending payment/i.test(e.textContent || ""))
            .map((e) => e.getAttribute("href"))
            .filter(Boolean),
        ),
      ]);
      let cancelledThisPass = false;
      for (const href of hrefs) {
        // hrefs already filtered to list rows whose badge says "Pending payment"
        await page.goto(`${BUYER_URL}${href}`, { waitUntil: "networkidle" });
        await page
          .getByText(/^Order #/)
          .first()
          .waitFor({ timeout: 30000 });
        await page.waitForTimeout(800);
        // extra guards: only this script's own order (fixed test address + item)
        const shipsToTest = await page
          .getByText(TEST_SHIPPING_NAME, { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
        const hasTestItem = await page
          .getByText(new RegExp(PRODUCT_SLUG.replace(/-/g, "[ -]"), "i"))
          .first()
          .isVisible()
          .catch(() => false);
        const cancelBtn = page.getByRole("button", { name: /^Cancel order$/i });
        if (shipsToTest && hasTestItem && (await cancelBtn.count())) {
          await cancelBtn.first().click();
          await page.waitForTimeout(2500);
          log(`cancelled this run's test order (${href})`);
          cancelledThisPass = true;
          break;
        }
      }
      if (!cancelledThisPass) {
        log(pass === 0 ? "no test order to clean up" : "test order cleaned up");
        break;
      }
    }
  });
  await safe("cleanup: empty cart", async () => {
    await nav("/cart");
    await page.waitForTimeout(800);
    for (let i = 0; i < 10; i++) {
      const remove = page.getByRole("button", { name: /^Remove$/i });
      if (!(await remove.count())) break;
      await remove.first().click();
      await page.waitForTimeout(700);
    }
    log("cart emptied");
  });

  await ctx.close();
  log("buyer phase done");
}

// =======================================================================
(async () => {
  const browser = await chromium.launch();
  try {
    if (runPhase("admin")) await adminPhase(browser);
    if (runPhase("catalog-manager")) await catalogManagerPhase(browser);
    if (runPhase("create-flows")) await createFlowsPhase(browser);
    if (runPhase("buyer")) await buyerPhase(browser);
  } finally {
    await browser.close();
  }
  log("done");
})();
