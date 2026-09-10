# TechCart User Manuals

End-user guides for the two TechCart applications. These are **operator/shopper
documentation**, not developer docs — for architecture, APIs, and requirements see
[`docs/architecture.md`](../architecture.md), [`docs/postman/`](../postman/), and
[`docs/srs/SRS.md`](../srs/SRS.md).

| Manual                       | Audience                      | Covers                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [buyer-app.md](buyer-app.md) | Shoppers using the storefront | Accounts & sign-in, browsing, search, category filters, product details, cart, checkout & payment, orders, account, saved addresses                                                                         |
| [admin-app.md](admin-app.md) | Staff using the admin console | Sign-in, console layout, dashboard, and step-by-step guides for brands, categories, specification schemas, variant axes, products & variants, warehouses, inventory, orders & refunds, admin users, account |

The admin manual is organised by the three admin roles — **catalog-manager**,
**order-manager**, and **super-admin** — and its "How to add…" sections double as the
initial data-setup guide for a fresh deployment.

## Screenshots

Screenshots live under [`assets/buyer-app/`](assets/buyer-app/) and
[`assets/admin-app/`](assets/admin-app/). They are regenerated with the Playwright
script in [`screenshots/`](screenshots/) — see
[`screenshots/README.md`](screenshots/README.md) for the environment setup and run
steps.

They were captured against a local instance with the standard development dataset.
Product, brand, and category **images are grey placeholders** in that dataset — the
storefront and console render real uploaded images the same way once a catalogue has
them.
