---
name: discuss-plan-build
description: Implementation workflow — discuss requirements, confirm them, enter Plan Mode and write a step-by-step plan (implementation + testing + verification), confirm the plan, list the tasks and confirm Auto Mode (continuous) or Manual Mode (pause per task) before executing, tracking a live task checklist throughout, ending in a short summary. Use when the user says "/discuss-plan-build", or asks to discuss and confirm requirements before planning, or to plan and confirm before implementing.
---

# Discuss → Plan → Build

A generic, project-agnostic workflow for any implementation task. It runs through three confirmation gates — requirements, plan, and execution mode — before execution begins, and never skips one.

## Rule

- **Plan Mode:** after the plan is confirmed, list the implementation steps in detail.
- **Auto Mode:** execute the confirmed step-by-step plan continuously, with no per-task stops.
- **Manual Mode:** execute the confirmed plan one task at a time, pausing after each for explicit user go-ahead before starting the next.
- Which of the two runs is confirmed with the user right after the plan is approved (Step 4.5) — never assumed.

## Step 1 — Ask / Discuss

Discuss the feature or task with the user before touching anything:
- Clarify scope, expected behavior, constraints, edge cases, and dependencies.
- Read code only as needed to ask informed questions — don't do a full codebase survey yet, that belongs in Step 3.
- Do **not** start implementation, and do not write a plan file yet.

## Step 2 — Requirement Confirmation

- Summarize the agreed requirements back to the user as a short, concrete list.
- Ask for explicit confirmation.
- Do not proceed to Plan Mode until confirmed. If the user's answer is "yes, but also X," fold X in and summarize again — a partial or ambiguous yes is not confirmation.

## Step 3 — Plan Mode

Once requirements are confirmed:
1. Enter Plan Mode (call `EnterPlanMode`).
2. Review the relevant project files and project instructions — the repo's own `CLAUDE.md`/`AGENTS.md` if present, and existing patterns in the codebase. For anything non-trivial or with uncertain scope, use the Explore agent to survey rather than guessing.
3. Write a complete, step-by-step implementation plan to the plan file, with implementation, testing, and verification covered explicitly (as their own sections or clearly distinguishable within the steps) — not just "write the code."

If the project itself has its own spec/issue/branch process (an SRS, an issue tracker workflow, a documented branching convention), fold that into the plan rather than skipping it — this skill doesn't override a project's own process, it wraps around it.

## Step 4 — Plan Confirmation

- Call `ExitPlanMode` to present the plan.
- Wait for explicit approval.
- If the user requests changes, revise the plan and call `ExitPlanMode` again. Never implement before approval — a rejection means revise-and-re-present, not proceeding anyway.

## Step 4.5 — Task List & Execution Mode Confirmation

Once the plan is approved (Step 4):
1. List the implementation tasks as an ordered checklist, all `⬜ Pending`, each with a specific, descriptive name naming its concrete deliverable (not a generic phase label) — the same format the Task Progress Rule below defines; this step produces its first rendering.
2. Ask the user (via `AskUserQuestion`) which mode to execute in:
   - **Auto Mode** — execute every task directly and continuously, no per-task stops (Step 5's default behavior).
   - **Manual Mode** — execute one task, mark it Completed, then stop and wait for the user's explicit go-ahead before starting the next task. The checklist is still shown/updated the same way; only the pacing differs.
3. Do not begin execution until a mode is chosen. This is a one-time choice for the whole task list, not asked again per task.
4. **If the mode-choice question is rejected/declined/left unanswered**, that counts as the mode being resolved, not skipped: default to **Auto Mode** and continue immediately — do not stay blocked waiting for a re-ask, and do not treat the rejection as a request to stop the whole workflow. A rejection here means "skip choosing, just proceed," not "cancel."

## Task Progress Rule

After the plan is approved, display the implementation tasks as an ordered checklist and update their status continuously as execution progresses. Each task's name must be specific and descriptive — naming the concrete deliverable or action (e.g., a function, file, or behavior) — not a generic phase label like "Implementation"/"Testing"/"Verification" on its own.

Example:

```
☑️ Create toTitleCase function — Completed
🔄 Add assertion checks — In Progress
⬜ Run and verify output — Pending
⬜ Update docs — Pending
```

When "Add assertion checks" is completed:

```
☑️ Create toTitleCase function — Completed
☑️ Add assertion checks — Completed
🔄 Run and verify output — In Progress
⬜ Update docs — Pending
```

Continue this process until all tasks are completed.

Rules:
- Tasks must always be executed in the defined order.
- A task must be marked Completed only after it has actually been finished and verified.
- When moving to the next task, mark it In Progress.
- Completed tasks must remain marked as completed unless actual rework is required.
- In Auto Mode, do not ask for user approval between individual tasks — continue continuously through the entire list. In Manual Mode (chosen in Step 4.5), pause after each task's completion and wait for the user's go-ahead before starting the next; this is the one deliberate exception to that rule. Auto Mode is also the fallback default whenever Step 4.5's mode question goes unanswered/rejected — see Step 4.5, point 4.
- After all tasks are completed, provide the final Completion summary (Step 6) — changes made, tests/verification performed, and any remaining items.

## Step 5 — Execution

This is the **Auto Mode** path (chosen in Step 4.5): implement the confirmed plan continuously, in one pass:
- Work through every task without pausing to re-confirm each individual one — that back-and-forth is what Steps 2, 4, and 4.5 already cleared.
- Display and update the task checklist continuously per the Task Progress Rule above.
- Run the planned tests/verification as part of this same pass, not as a separate follow-up the user has to ask for.
- Pause only for something the plan couldn't have anticipated: an unexpected destructive/irreversible action not already covered by the plan, a genuinely blocking ambiguity, or information only the user can supply.

"Auto Mode" here means behavioral continuity — working straight through without stopping to ask permission at each step — not a literal mode-switch tool call. Actual tool permissions are still governed by whatever permission mode the session is running under; this skill doesn't and can't override that.

If **Manual Mode** was chosen instead: execute one task, update the checklist, then stop and explicitly ask the user to proceed before starting the next task. Everything else above (checklist display, running that task's own tests/verification, pausing for genuine blockers) still applies per task.

## Step 6 — Completion

Give a short final summary covering:
- What was changed.
- What was tested/verified.
- Any remaining work or known issues.

## Final Flow

`Ask/Discuss → Requirement Confirmation → Plan Mode → Create Plan → Plan Confirmation → Task List & Mode Confirmation → Auto/Manual Execute → Test/Verify → Done`
