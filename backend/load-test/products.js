// FR-NFR-BE-005 — load test for the three highest-traffic buyer endpoints:
// product listing, product detail, and keyword search.
//
// Prerequisites (see ./README.md):
//   1. k6 installed        (winget install k6.k6  /  choco install k6  /  brew install k6)
//   2. a bulk-seeded DB    (npm run seed:load-test --workspace backend -- --products=5000 --orders=10000)
//   3. the backend running  (npm run dev --workspace backend) against that same DB
//
// Run:   k6 run backend/load-test/products.js
//        k6 run -e BASE_URL=http://localhost:4000 backend/load-test/products.js
//
// The run FAILS (non-zero exit) if p95 latency for any of the three groups
// exceeds 300ms — that is the FR-NFR-BE-001 target.

/* global __ENV */
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const KEYWORDS = ["ultra", "pro", "max", "lite", "air", "plus", "mini", "edge"];

export const options = {
  scenarios: {
    buyer_traffic: {
      executor: "constant-vus",
      vus: 50,
      duration: "1m",
    },
  },
  thresholds: {
    "http_req_failed": ["rate<0.01"],
    "http_req_duration{group:::listing}": ["p(95)<300"],
    "http_req_duration{group:::detail}": ["p(95)<300"],
    "http_req_duration{group:::search}": ["p(95)<300"],
  },
};

// setup() runs once — discover real product slugs so the detail scenario
// hits live URLs without a checked-in slug list.
export function setup() {
  const res = http.get(`${BASE_URL}/api/products?limit=100`);
  const body = res.json();
  const slugs = (body && body.data ? body.data : []).map((p) => p.slug).filter(Boolean);
  if (slugs.length === 0) {
    throw new Error(
      `No products returned from ${BASE_URL}/api/products — did you run seed:load-test and start the server against the same DB?`,
    );
  }
  return { slugs };
}

export default function (data) {
  const roll = Math.random();

  if (roll < 0.55) {
    // 55% — product listing (paginated, the default "recommended" home sort)
    group("listing", () => {
      const page = 1 + Math.floor(Math.random() * 20);
      const res = http.get(`${BASE_URL}/api/products?page=${page}&sort=recommended`);
      check(res, { "listing 200": (r) => r.status === 200 });
    });
  } else if (roll < 0.8) {
    // 25% — product detail
    group("detail", () => {
      const slug = data.slugs[Math.floor(Math.random() * data.slugs.length)];
      const res = http.get(`${BASE_URL}/api/products/${slug}`);
      check(res, { "detail 200": (r) => r.status === 200 });
    });
  } else {
    // 20% — keyword search
    group("search", () => {
      const q = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
      const res = http.get(`${BASE_URL}/api/products?q=${q}`);
      check(res, { "search 200": (r) => r.status === 200 });
    });
  }

  sleep(Math.random() * 0.5);
}
