# Software Requirements Specification

**Project:** E-Commerce Platform (Admin App + Buyer App)
**Current Version:** 0.1
**Status:** Draft — Initial Setup and Feature Listing
**Last Updated:** 2026-07-21

---

## Version History

| Version | Date       | Scope                          | Status  |
|---------|------------|---------------------------------|---------|
| 0.1     | 2026-07-21 | Initial scope, structure, feature listing | Complete |
| 0.2     | —          | Product Catalog                 | Planned |
| 0.3     | —          | Authentication                  | Planned |
| 0.4     | —          | Shopping Cart                   | Planned |
| 0.5     | —          | Orders                          | Planned |
| 0.6     | —          | Payments                        | Planned |
| 0.7     | —          | Dashboard                       | Planned |
| 0.8     | —          | Backend Non-Functional Requirements  | Planned |
| 0.9     | —          | Frontend Non-Functional Requirements | Planned |
| 1.0     | —          | Final Consolidated System SRS   | Planned |

Each row above becomes "Complete" only once its feature has been specified, designed, implemented, and validated — see [Development Workflow](#5-development-workflow).

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for a production-ready e-commerce platform consisting of a Buyer-facing storefront and an Admin management console, sharing a single backend API. It is written incrementally: this version (0.1) fixes the scope and the document's own structure; each subsequent version adds one feature's full specification.

### 1.2 Scope
The system enables:
- Buyers to browse a product catalog, manage a cart, place orders, and pay online.
- Admins to manage catalog, orders, and view operational dashboards.
- Secure authentication and role-based access for both buyer and admin users.

Out of scope for v1.0: multi-vendor marketplace features, multi-currency/multi-region checkout, subscription/recurring billing.

### 1.3 Intended Audience
Solo/small-team developer(s) building and maintaining the system; this document also serves as the reference the AI-assisted development workflow is driven from.

### 1.4 Definitions & Acronyms
| Term | Meaning |
|---|---|
| SRS | Software Requirements Specification |
| FR  | Functional Requirement |
| NFR | Non-Functional Requirement |
| Buyer App | Next.js storefront used by customers |
| Admin App | React console used by store staff |
| API | Shared Node/Express backend consumed by both apps |

### 1.5 References
- Technology Blueprint (stack, versions, architecture decisions): published artifact, "E-Commerce Platform — Technology Blueprint" (2026-07-21).

---

## 2. Overall Description

### 2.1 Product Perspective
Two client applications, one API, one database — no per-frontend backend logic duplication:

```
Buyer App (Next.js)  ──┐
                        ├──> API (Node/Express) ──> MongoDB
Admin App (React)    ──┘                        └─> Redis, Razorpay, Cloudinary, Resend
```

### 2.2 Product Functions (high-level)
1. **Product Catalog** — browse, search, filter products; admin CRUD on products/categories.
2. **Authentication** — buyer sign-up/sign-in, admin sign-in, role-based access control.
3. **Shopping Cart** — add/update/remove items, persist across sessions.
4. **Orders** — checkout capture, order lifecycle, buyer order history, admin order management.
5. **Payments** — online payment via Razorpay, payment verification, refunds.
6. **Dashboard** — admin operational overview (sales, orders, inventory); buyer account/order dashboard.

Each function above receives its own detailed FR/NFR specification in v0.2–v0.7.

### 2.3 User Classes and Characteristics
| User Class | Description |
|---|---|
| Guest | Unauthenticated visitor; can browse catalog, hold a cart, must authenticate to check out. |
| Registered Buyer | Authenticated customer; places orders, views order history, manages profile. |
| Catalog Manager | Admin role; manages products, categories, inventory. |
| Order Manager | Admin role; manages order lifecycle, refunds, shipping status. |
| Super Admin | Admin role; full access, including user/role management. |

### 2.4 Operating Environment
See the Technology Blueprint (§1.5). Summary: Next.js 16 (Buyer), React 19 + Vite (Admin), Node 24 + Express 5 (API), MongoDB Atlas, Redis (Upstash), deployed on managed platforms (Vercel / Render or Railway).

### 2.5 Design and Implementation Constraints
- Market: India-first — Razorpay as the payment gateway; GST and Razorpay KYC policy-page requirements apply.
- Hosting: managed platforms only (no self-managed Kubernetes/servers) for this phase.
- Scale target: small-to-medium catalog store — architecture intentionally avoids premature microservices/queue/search infrastructure.
- Stack is fixed per the Technology Blueprint unless explicitly revisited.

### 2.6 Assumptions and Dependencies
- Razorpay merchant account can be activated (business PAN, bank account, published policy pages).
- MongoDB Atlas, Upstash Redis, Cloudinary, and Resend accounts are available/provisionable.
- A GitHub repository will exist before the Development Workflow's milestone/issue steps become actionable (not yet created as of this version).

---

## 3. Feature Index

| # | Feature | One-line description | Target SRS Version | Status |
|---|---|---|---|---|
| 1 | Product Catalog | Product/category browsing, search, filtering, admin CRUD | v0.2 | Not started |
| 2 | Authentication | Buyer + admin auth, RBAC, session management | v0.3 | Not started |
| 3 | Shopping Cart | Guest + logged-in cart, persistence, sync | v0.4 | Not started |
| 4 | Orders | Checkout capture, order lifecycle, history | v0.5 | Not started |
| 5 | Payments | Razorpay integration, verification, refunds | v0.6 | Not started |
| 6 | Dashboard | Admin analytics + buyer account dashboard | v0.7 | Not started |
| 7 | Backend NFRs | Performance, scalability, security, DB, API, logging, error handling | v0.8 | Not started |
| 8 | Frontend NFRs | UI performance, responsiveness, browser support, accessibility, UX, frontend security | v0.9 | Not started |
| 9 | Final Consolidated SRS | Full system document | v1.0 | Not started |

Detailed per-feature SRS documents will live alongside this file as they're written:

```
docs/srs/
├── SRS.md                    ← this file: master index + structure (updated at every version)
└── features/
    ├── 0.2-product-catalog.md
    ├── 0.3-authentication.md
    ├── 0.4-shopping-cart.md
    ├── 0.5-orders.md
    ├── 0.6-payments.md
    ├── 0.7-dashboard.md
    ├── 0.8-backend-nfr.md
    └── 0.9-frontend-nfr.md
```

---

## 4. Feature SRS Template

Every feature document under `docs/srs/features/` follows this structure, so v0.2–v0.9 stay consistent and diffable:

1. **Feature Overview** — what it does and why, in a few sentences.
2. **Functional Requirements** — numbered `FR-<CODE>-<NNN>`, one testable statement each (e.g. `FR-CAT-001: Admin can create a product with name, SKU, price, category, and images.`).
3. **Baseline Non-Functional Requirements** — a short checklist scoped to *this* feature only (auth/session security touchpoints, data validation, relevant DB indexes, error-handling contract). This is deliberately lightweight; the exhaustive system-wide NFRs are specified once in v0.8/v0.9 and this section just prevents obvious gaps (e.g. unindexed queries, unvalidated input) from shipping before then.
4. **User Stories / Use Cases** — short "as a \<role\>, I want \<goal\>, so that \<benefit\>" list.
5. **Data Model / API Contract** — collections/fields touched, endpoints added or changed, request/response shape.
6. **UI/UX Requirements** — key screens/states (empty, loading, error), reference to Admin vs Buyer app.
7. **Out of Scope** — explicitly excluded from this version, to prevent scope creep mid-feature.
8. **Acceptance Criteria** — the conditions that make "Test and validate the completed feature" concrete and checkable.
9. **Dependencies** — other features or external services this one relies on.
10. **Open Questions** — unresolved decisions, if any, at time of writing.

Feature codes used in requirement IDs: `CAT`, `AUTH`, `CART`, `ORD`, `PAY`, `DASH`, `NFR-BE`, `NFR-FE`.

---

## 5. Development Workflow

Each feature moves through the same five steps, in order:

```
Feature → Update SRS → Add to Milestone → Add to Issue → Implement Code
```

1. **Feature** — the next feature is selected from the Feature Index (§3), in listed order unless reprioritized.
2. **Update SRS** — write `docs/srs/features/<version>-<feature>.md` using the template in §4; update this file's Version History and Feature Index status to "Spec drafted."
3. **Add to Milestone** — create (or reuse) a GitHub milestone named after the SRS version, e.g. `v0.2 – Product Catalog`.
4. **Add to Issue** — break the feature's functional requirements into one or more GitHub issues linked to that milestone, referencing the relevant `FR-<CODE>-<NNN>` IDs.
5. **Implement Code** — implement against the issues; on completion, run the feature's acceptance criteria, mark the issues/milestone closed, and update this file's status to "Complete."

Steps 3–4 require a GitHub repository, which does not exist yet for this project (§2.6). They become actionable once one is created.

---

## 6. Traceability Matrix

Filled in as features progress; empty until the first feature reaches step 3 of the workflow above.

| Feature | SRS Version | Milestone | Issue(s) | Status |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 7. Approval

Informal solo/small-team project — no formal sign-off gate. Each version is considered approved when its Feature Index status is marked "Complete" in this document.
