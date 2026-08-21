---
name: auto-pr-merge
description: Single-pass, no-gate workflow that opens a PR from the current branch, waits for CI to pass, squash-merges into main, deletes the branch, syncs local main to the latest, and — if the repo documents its own post-merge status-doc convention — syncs those docs via a follow-up PR too. Auto Mode only — no confirmation gates. Use when the user says "/auto-pr-merge", or asks to create a PR and merge it, merge to main and clean up, or ship the current branch.
---

# Auto PR & Merge

Mode: **Auto Mode** — run all steps back-to-back with no confirmation gate between them. Don't ask "should I open the PR?" or "should I merge?" mid-flow. Only stop if a step fails outright (nothing to PR, CI fails, merge rejected, local sync blocked) or the situation is genuinely ambiguous (e.g. already on `main`, detached HEAD, uncommitted changes present).

Every action this skill takes — pushing, opening the PR, merging, deleting the branch, checking out and pulling the base branch, and (when Step 6 applies) the follow-up doc-sync PR — is pre-approved simply by the user invoking this skill. Treat any point that would normally prompt "confirm?" as already answered yes; do not pause mid-flow to ask again for any of these specific actions.

This skill assumes the current branch's work is already committed and pushed (or push-able) — it does not implement or commit anything itself. If there's uncommitted work, stop and tell the user (chaining after a commit/push skill first is their call, not this skill's).

## Step 1 — Pre-flight

- `git status` — if there are uncommitted changes, stop and report; do not proceed.
- `git branch --show-current` — if this is `main`/`master` or detached HEAD, stop: nothing to PR.
- `git log origin/<base>..HEAD --oneline` (base is `main` unless the repo's docs say otherwise) — if empty, stop: nothing ahead of base to merge.
- Push the branch if it isn't already up to date with its remote (`git push`, or `git push -u origin <branch>` with no upstream yet) — same push safety rules as `auto-commit-push`: never force.

## Step 2 — Open the PR (or reuse an existing one)

- Check for an existing PR first: `gh pr list --head <branch> --state open`. Reuse it if found — don't open a duplicate.
- Otherwise create one: `gh pr create --base <base> --head <branch> --title ... --body ...`. Derive the title/summary from the branch's own commit history (`git log <base>..HEAD`); reference an issue with `Closes #N` if the branch name or commits name one. Match the repo's own PR-body conventions if a template or prior-PR pattern is evident.

## Step 3 — Wait for CI and ensure it passes

- `gh pr checks <number> --watch` until every check reaches a final state.
- If any required check fails, **stop** — report which check failed and its link. Do not merge a red PR under any circumstances, regardless of Auto Mode.

## Step 4 — Merge

- Merge using the repo's documented convention if discoverable (e.g. a `CLAUDE.md`/`AGENTS.md`/`CONTRIBUTING.md` stating squash-merge only, linear history) — default to `gh pr merge <number> --squash --delete-branch` when no convention is documented.
- Never force-merge past a failing/blocking check. If the merge is rejected (branch protection, conflicts with base since the PR opened), stop and report — do not bypass with admin overrides.

## Step 5 — Delete the branch and sync local base branch

- Confirm the remote branch is gone (`--delete-branch` already requested this; verify via `git fetch --prune` + `git branch -a`).
- `git status` again before switching (standing safety rule — never discard uncommitted work silently).
- `git checkout <base>` (e.g. `main`), then `git pull` to fast-forward to the just-merged commit.
- Delete the local feature branch with `git branch -d <branch>` (lowercase `-d`, not `-D` — refuses if not actually merged, a safety net that should never trigger here since it just was).

## Step 6 — Root docs sync (only if the repo's own process calls for it)

- Check whether the repo documents a post-merge status-sync convention of its own (e.g. a root `CLAUDE.md` that says something like "once merged, sync the status sections of `AGENTS.md`/`CLAUDE.md`/`docs/architecture.md` in a small follow-up PR"). If no such convention is documented anywhere in the repo, skip this step entirely — most repos won't have one.
- If it is documented: update those root status sections to reflect the just-merged change, following the existing style/wording pattern from prior status-sync commits (`git log --oneline --grep=sync`, or similar, to find precedent). Then repeat Steps 1–5 for this doc-only change on its own small branch — commit, push, open a PR, wait for CI, merge, delete the branch, sync local `<base>` again — same Auto Mode continuity, no gate. Never push doc-only changes directly to a protected base branch if the repo rejects direct pushes.

## Step 7 — Confirm

- Report: PR number + URL, merge commit SHA, confirmation CI passed (which checks), confirmation the branch is deleted both remotely and locally, confirmation local `<base>` is now up to date with `origin/<base>`, and — if Step 6 ran — the same for the follow-up doc-sync PR.

"Auto Mode" here means behavioral continuity — proceeding through all steps without pausing for approval — not a literal mode-switch tool call.
