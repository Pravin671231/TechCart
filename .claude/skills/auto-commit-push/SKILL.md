---
name: auto-commit-push
description: Single-pass, no-gate workflow that stages, commits, and pushes changes already present in the working tree, then reports status. Auto Mode only — no confirmation gates. Use when the user says "/auto-commit-push", or asks to commit and push without stopping to confirm each step.
---

# Auto Commit & Push

Mode: **Auto Mode** — run all three steps back-to-back with no confirmation gate between them. Don't ask "should I commit?" or "should I push?" mid-flow. Only stop if a step fails outright (nothing to commit, push rejected, hook failure) or the situation is genuinely ambiguous (e.g. detached HEAD, no upstream and no clear target remote).

This skill assumes changes already exist in the working tree — it does not implement anything itself.

## Step 1 — Commit the required changes

- Run `git status`, `git diff` (staged + unstaged), and `git log --oneline -5` to see what changed and match this repo's commit style.
- If there's nothing to commit, stop and tell the user — do not proceed to Step 2/3.
- Stage the relevant files by name (avoid `git add -A`/`.` if it would sweep in unrelated or sensitive files — check `git status` first).
- Write a concise commit message describing why the change was made, following the repo's existing convention if one is evident from recent history.
- Commit. Standard git safety rules apply: never `--force`, never skip hooks (`--no-verify`), never amend an existing commit — always a new commit. If a pre-commit hook fails, fix the issue, re-stage, and commit again as a new commit.

## Step 2 — Push to the current branch

- Determine the current branch: `git branch --show-current`.
- Push: `git push`, or `git push -u origin <branch>` if it has no upstream yet.
- Never force-push. If the push is rejected (e.g. remote has diverged), stop and report — do not force or rebase over the user's history without asking first.

## Step 3 — Confirm

- Run `git status` and `git log -1 --oneline` to confirm the push landed and local/remote are in sync.
- Report: commit SHA + message, branch name, and confirmation that the push succeeded.

"Auto Mode" here means behavioral continuity — proceeding through all three steps without pausing for approval — not a literal mode-switch tool call.
