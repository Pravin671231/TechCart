# Issue Drafts

**Project:** TechCart
**Status:** M0 (Foundation), M1 (CI Pipeline), and M2 (Product Catalog, backend only) are all opened as real GitHub Issues — #1–#10, and #25–#36 under [Milestone #3](https://github.com/Pravin671231/TechCart/milestone/3) respectively — so all three milestones' draft text has been removed from this file; see `docs/milestone.md` and `docs/srs/SRS.md` §6 for their roadmap-level and traceability records. The **Backlog** below is currently empty, ready for the next milestone once its SRS doc is written.

This is where issues get drafted — full context, a build-order task checklist, and test criteria — before they're opened as real GitHub Issues. It sits between [docs/milestone.md](milestone.md) (which milestone/goal) and GitHub itself (which is the actual tracker once an issue is opened): draft it here, then `gh issue create` it, then work it via the branch/PR flow in [docs/srs/SRS.md](srs/SRS.md) §5. Once a milestone's issues are opened on GitHub, its draft section is removed from here — this happened for M2 as of Issues #25–#36.

**Scope of this file right now:** empty. M3 (Authentication onward) needs its functional requirements from that feature's SRS doc (`docs/srs/features/<version>-<feature>.md`) before its issues can be drafted with real content — that doesn't exist yet. This file gains a new Backlog subsection one milestone at a time, as each feature's SRS doc is written, and loses it again once that milestone's issues are opened for real.

**Numbering:** within a drafted-but-unopened milestone, `M<x>.1`, `M<x>.2`, etc. are draft sequence numbers, not GitHub issue numbers. When an issue is actually opened (`gh issue create`), use the real assigned number for its branch: `feature/<real-issue-number>-<scope>`.

---

## Template

`.github/ISSUE_TEMPLATE/feature-issue.md` mirrors the shape below for `gh issue create`/the GitHub web UI — keep the two in sync if this shape changes.

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

_Empty — nothing drafted yet for M3 onward._
