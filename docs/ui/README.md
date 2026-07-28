# UI Documentation

**Project:** TechCart
**Scope:** Index for every UI document in this directory — the document chain, precedence, feature status, and the conventions all four documents follow
**Status:** Draft — normative target for implementation; `mock-ui/` is built to match

This directory owns **how the two apps look and behave** — design language, layout, components, screens, states. It does not own _what_ the UI must let a user do: that is the job of each feature's SRS document ([docs/srs/features/](../srs/features/) §6). When a screen here appears to add a capability, the SRS is short a requirement and should be amended there first; these documents are not a way to smuggle in scope.

---

## Document types

Two kinds of document, two canonical names. Use these terms and no others.

| Term            | Is                       | Owns                                                                                                                                                                                                                                 |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **main doc**    | `<app>/<app>-main-ui.md` | Everything true across the whole app: project information, purpose, objectives, target users, layout structure, design guidelines, UI components, accessibility, the UI feature index, interaction conventions, implementation notes |
| **feature doc** | `<app>/<feature>.md`     | One feature: its pages, UI design details, page-by-page wireframes, behavior and interactions, and requirements traceability                                                                                                         |

---

## The document chain

Each link owns a different question. Stated once here so the main docs don't each repeat it:

| Artifact                                      | Owns                                                             |
| --------------------------------------------- | ---------------------------------------------------------------- |
| [docs/architecture.md](../architecture.md) §4 | Rendering strategy, SPA shape, role gating, which libraries      |
| [docs/srs/SRS.md](../srs/SRS.md) §3           | Which features exist at all — the admin sidebar is built from it |
| `docs/srs/features/<version>-<feature>.md` §6 | **What** the UI must let a user do — requirements, `FR-` IDs     |
| A main doc                                    | **How** the app looks — design guidelines, layout, components    |
| A feature doc                                 | **How** one feature's screens look and behave                    |
| [mock-ui/](../../mock-ui/)                    | A throwaway visual reference for these documents                 |
| `<app>/src/features/`                         | The implementation                                               |

---

## Precedence

**This is the only copy of these rules.** The main docs point here rather than restating them.

- Root [docs/architecture.md](../architecture.md) wins on architecture. Nothing in this directory restates or overrides a root-level decision — these documents only say what the pixels do.
- The feature's SRS wins on requirements. If a screen appears to add a capability, the SRS is short a requirement and should be amended there first.
- **These documents win over `mock-ui/`.** The prototype is a static HTML/vanilla-JS sketch with deliberate simplifications (see [mock-ui/README.md](../../mock-ui/README.md)). Where the two differ, the prototype is wrong.

---

## Navigation

| App         | Main doc                                         | Feature docs                                         | Prototype                              |
| ----------- | ------------------------------------------------ | ---------------------------------------------------- | -------------------------------------- |
| `admin-app` | [admin/admin-main-ui.md](admin/admin-main-ui.md) | [admin/product-catalog.md](admin/product-catalog.md) | [mock-ui/admin/](../../mock-ui/admin/) |
| `buyer-app` | [buyer/buyer-main-ui.md](buyer/buyer-main-ui.md) | [buyer/product-catalog.md](buyer/product-catalog.md) | [mock-ui/buyer/](../../mock-ui/buyer/) |

---

## Feature status

**This is the only copy of this mapping.** Keyed to [docs/srs/SRS.md](../srs/SRS.md) §3. A feature gets UI documents only once its SRS version is written and reviewed — see [Adding a feature's UI doc](#adding-a-features-ui-doc).

| Feature         | SRS version | SRS doc                                                          | Admin UI doc                                         | Buyer UI doc                                         |
| --------------- | ----------- | ---------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Product Catalog | v0.2        | [0.2-product-catalog.md](../srs/features/0.2-product-catalog.md) | [admin/product-catalog.md](admin/product-catalog.md) | [buyer/product-catalog.md](buyer/product-catalog.md) |
| Authentication  | v0.3        | —                                                                | Not specified                                        | Not specified                                        |
| Shopping Cart   | v0.4        | —                                                                | Not specified                                        | Not specified                                        |
| Orders          | v0.5        | —                                                                | Not specified                                        | Not specified                                        |
| Payments        | v0.6        | —                                                                | Not specified                                        | Not specified                                        |
| Dashboard       | v0.7        | —                                                                | Not specified                                        | Not specified                                        |

### State wording

Two words that look interchangeable and are not:

| Word              | Means                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not specified** | No UI doc exists for this feature yet, because its SRS version has not been written and reviewed. A **document** state.                      |
| **Disabled**      | An admin-console nav entry that renders at reduced emphasis and is not interactive. A **UI** state, specified in full in the admin main doc. |

The admin sidebar lists all six features, with the five unspecified ones rendered as disabled entries so the shape of the finished console is visible. A disabled entry is not a design — see [admin/admin-main-ui.md §9.1](admin/admin-main-ui.md#91-the-disabled-entries). The storefront renders nothing at all for its unspecified areas.

---

## Adding a feature's UI doc

In this order, no steps skipped — it mirrors root `CLAUDE.md`'s `Feature → SRS → Milestone → Issue → Code`:

1. The feature's SRS document exists at `docs/srs/features/<version>-<feature>.md` and has been reviewed. Its §6 owns _what_ the UI must do.
2. Add a row to [Feature status](#feature-status) above.
3. Add a row to the app's UI feature index (§9 of its main doc), switching the feature from unspecified to specified.
4. Write `docs/ui/<app>/<feature>.md` using the template below.
5. Update `mock-ui/` to match.
6. Implement.

Turning a disabled nav entry into a working link without steps 1–4 is exactly the shortcut this repo's process exists to prevent.

### Main doc outline

Both main docs carry these sections, in this order. Sections marked ¹ are admin-only — the storefront has no sidebar, no theme toggle and no locked scroll shell.

| §   | Section                   | §    | Section                     |
| --- | ------------------------- | ---- | --------------------------- |
| 1   | Project Information       | 7    | UI Components               |
| 2   | Purpose                   | 7.1  | Forms                       |
| 3   | Objectives                | 7.2  | Buttons                     |
| 4   | Target Users              | 7.3  | Validation Rules            |
| 5   | Layout Structure          | 7.4  | Error Messages              |
| 5.1 | Header                    | 7.5  | Component inventory         |
| 5.2 | Sidebar¹                  | 8    | Accessibility               |
| 5.3 | Main region               | 9    | UI Feature Index            |
| 5.4 | Persistence               | 9.1  | The disabled entries¹       |
| 5.5 | Scroll model¹             | 10   | Interaction Conventions     |
| 6   | Design Guidelines         | 11   | Implementation Notes        |
| 6.1 | Color Guidelines          | 11.1 | Where `mock-ui` falls short |
| 6.2 | Typography                | 12   | Version History             |
| 6.3 | Spacing, radii, elevation |      |                             |
| 6.4 | Responsive Design         |      |                             |
| 6.5 | Browser Support           |      |                             |
| 6.6 | Icons                     |      |                             |
| 6.7 | Why this differs          |      |                             |

### Feature doc outline

| §   | Section                      | Contents                                                                                          |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Pages                        | Route → page → purpose → `FR-` IDs → link to its wireframe                                        |
| 2   | UI Design Details            | The surfaces this feature brings (cards, tables, forms, wizards) and the components it introduces |
| 3   | Page-by-page Wireframes      | One subsection per page: ASCII wireframe, then regions, columns, states, requirements             |
| 4   | UI Behavior and Interactions | Interaction rules specific to this feature                                                        |
| 5   | Requirements Traceability    | `FR-` ID → page, so SRS §6 coverage is checkable at a glance                                      |

The overview and the links (SRS doc, main doc, `mock-ui/`) live in the front-matter, so there is no separate overview section.

---

## Conventions

### Wireframes

Wireframes are **ASCII box art in a fenced block, one per page**. They show regions and reading order, not pixel-accurate widths — the Tailwind classes in the prose are the real specification. Boxes are labelled with the component names used in the main doc's §7.5 or the feature doc's §2, so a reader can move from a box to its spec.

**Every line in a wireframe block has the same character count.** A frame that does not close is worse than no frame. Verify before committing:

````bash
node -e 'for(const f of process.argv.slice(1)){let b=[],i=0,s=0;
for(const l of require("fs").readFileSync(f,"utf8").split("\n")){i++;
if(l.trim()==="```"){if(!s){s=i;b=[]}else{const w=new Set(b.map(x=>[...x].length));
if(w.size>1)console.log(`${f}:${s} RAGGED ${[...w]}`);s=0}}else if(s)b.push(l)}}' docs/ui/*/*.md
````

Annotations sit **inside** the frame. Responsive variants are not drawn per breakpoint; each main doc's §6.4 stays the source of truth for what happens at `sm`, `md` and `lg`.

### Section references

Every `§N` reference is a link, so it can be followed rather than scrolled to. Anchors follow GitHub slug rules — lowercase, spaces to hyphens, everything else dropped:

Written from inside a main doc, the two forms look like this:

```markdown
Colour tokens are in [§6.1](#61-color-guidelines). <- same document
Sorting is specified in [§10.1](#101-sorting). <- same document
See [§7.5](../admin/admin-main-ui.md#75-component-inventory) <- another document
```

### Keeping this in sync

When a screen changes, update its feature doc in the same PR as the code. When the design language or shell changes, update the app's main doc and bump its §12 Version History. When the SRS data model changes, the order is: SRS → the documents here → `mock-ui/` → implementation.
