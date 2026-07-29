# Issue Drafts

**Project:** TechCart
**Status:** M0 (Foundation), M1 (CI Pipeline), and M2 (Product Catalog, backend only) are all opened as real GitHub Issues — #1–#10, and #25–#36 under [Milestone #3](https://github.com/Pravin671231/TechCart/milestone/3) respectively — so all three milestones' draft text has been removed from this file; see `docs/milestone.md` and `docs/srs/SRS.md` §6 for their roadmap-level and traceability records. The **Backlog** below is currently empty, ready for the next milestone once its SRS doc is written.

This is where issues get drafted — full context, a build-order task checklist, and test criteria — before they're opened as real GitHub Issues. It sits between [docs/milestone.md](milestone.md) (which milestone/goal) and GitHub itself (which is the actual tracker once an issue is opened): draft it here, then `gh issue create` it, then work it via the branch/PR flow in [docs/srs/SRS.md](srs/SRS.md) §5. Once a milestone's issues are opened on GitHub, its draft section is removed from here — this happened for M2 as of Issues #25–#36.

**Scope of this file right now:** empty. M3 (Authentication onward) needs its functional requirements from that feature's SRS doc (`docs/srs/features/<version>-<feature>.md`) before its issues can be drafted with real content — that doesn't exist yet. This file gains a new Backlog subsection one milestone at a time, as each feature's SRS doc is written, and loses it again once that milestone's issues are opened for real.

**Numbering:** within a drafted-but-unopened milestone, `M<x>.1`, `M<x>.2`, etc. are draft sequence numbers, not GitHub issue numbers. When an issue is actually opened (`gh issue create`), use the real assigned number for its branch: `feature/<real-issue-number>-<scope>`.

---

## Template

Every milestone in the Backlog is a `###` section; every issue inside it follows this shape, one heading level deeper:

```
#### <Milestone>.<N> — <Title>
**Milestone:** M<x> – <Milestone name>
**Suggested branch:** feature/<issue-number>-<scope>
**Labels:** <labels>

**Context**
<Why this issue exists, what it depends on, what it unblocks.>

**Tasks**
- [ ] <ordered implementation step>

**Test Criteria**
- <verifiable, unambiguous condition>
```

---

## Backlog

Milestones in this section are fully drafted — issues with real Context/Tasks/Test Criteria — but not yet opened as real GitHub Issues or a GitHub Milestone. A milestone moves out of this section once its issues are actually opened via `gh issue create` (most recently M2, now Issues #25–#36).

### M2 — Product Catalog (addendum)

#### M2.13 — Mock UI verification & traceability for Product Catalog

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/41-mock-ui-verification
**Labels:** documentation, catalog

**Context**
`mock-ui/` already contains a structural wireframe for every screen SRS v0.2 §6 calls for — 4 `buyer-app` screens and 7 `admin-app` screens, each annotated with its `FR-CAT-*` IDs, cross-linked into a click-through prototype. It was added via direct commits (`0b0f0e8`, `d2d95b3`) outside the normal Issue → Implement flow this repo otherwise enforces, and SRS v0.2 §10 still lists "screen-level UI design" as an open question even though `mock-ui/README.md` already answers it in practice. This issue brings that already-done design work under M2 tracking and closes the loop: verify it, document the SRS-to-mock-ui traceability, and formally resolve the open question — not add new wireframes.

**Tasks**

- [ ] Cross-check every §6 screen/state against its `mock-ui/*.html` file; note any gap
- [ ] Fix any discrepancy found
- [ ] Add a scan-able §6-requirement → `FR-CAT-*` → mock-ui file table to `mock-ui/README.md`
- [ ] Move "screen-level UI design" from Open Question 1 to "Resolved during drafting" in `docs/srs/features/0.2-product-catalog.md` §10, referencing `mock-ui/`
- [ ] Add a one-line pointer to `mock-ui/` from `buyer-app/CLAUDE.md` and `admin-app/CLAUDE.md`

**Test Criteria**

- Every §6 screen/state has a correctly annotated `mock-ui/*.html` counterpart
- SRS v0.2 §10 no longer lists screen-level design as unresolved
- `buyer-app/CLAUDE.md` and `admin-app/CLAUDE.md` each reference `mock-ui/`
- No `mock-ui/*.html` file is orphaned from `mock-ui/index.html`; no internal link 404s
