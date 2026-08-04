# The Grimoire Workflow — building an app with Claude

This is the workflow for building Grimoire (and any future app) with Claude, distilled from Anthropic's current best-practice guidance and tailored to this project: a Shadowdark RPG companion, repo `Yetiouz/grimoire`, deployed on Vercel, developed in Cowork sessions and/or Claude Code.

The whole system rests on three ideas. Everything else is detail.

1. **Spec before plan, plan before code.** Attempt one (Delve) drifted because the destination was fuzzy. A written spec is the fix: Claude implements what's on the page, and the page is something you control.
2. **Every task ends with a check Claude can run itself.** A test, a build, a screenshot, a deployed preview. Without one, "looks done" is the only signal and you become the QA department.
3. **Context is the scarce resource.** One feature per session, fresh sessions liberally, and review by a *different* session than the one that wrote the code.

---

## Phase 0 — Foundation (done once, mostly done already)

The repo exists, Vercel is linked, and every `git push` to `main` auto-deploys. That push-to-deploy loop is your verification backbone: every feature ends with a live URL you can open on your phone at the game table.

Two files make every future session smarter:

- **CLAUDE.md** (in the repo root) — the project's standing orders. Claude reads it at the start of every session. Keep it short; prune it when Claude ignores it. It's in this folder now — refine it as the project grows.
- **SPEC.md** — what Grimoire actually is. Built via the interview in Phase 1.

## Phase 1 — Spec via interview (once per major feature area)

Don't write the spec yourself, and don't let Claude guess it. Have Claude interview you. Paste this into a fresh session:

```
I want to build [feature — e.g. the GM's campaign dashboard for Grimoire].
Read SPEC.md and CLAUDE.md first. Then interview me in detail using
questions, one topic at a time. Ask about technical implementation, UI/UX,
edge cases, concerns, and tradeoffs. Don't ask obvious questions — dig into
the hard parts I might not have considered. Keep interviewing until we've
covered everything, then write the result into SPEC.md.
```

The interview surfaces decisions you didn't know you were deferring (What happens when two players edit the same character? Does the GM see player rolls before they resolve?). Those unmade decisions are exactly what sank attempt one.

A good spec names the files and interfaces involved, states what is **out of scope**, and ends with an end-to-end verification step that proves the feature works. Time spent sharpening the spec beats time spent watching the implementation.

**Then start a fresh session to build it.** The interview session's context is full of deliberation; the build session should contain only the spec.

## Phase 2 — Plan, then build, in vertical slices

For anything touching more than one file, make Claude plan before coding (in Claude Code: plan mode, `Shift+Tab`; in Cowork: just say "plan first, don't write code yet"):

```
Read SPEC.md section [X]. Explore the existing code, then write an
implementation plan: files to change, data model, and how we'll verify it
works end to end. Don't write code yet.
```

Read the plan. Edit it. *This is the highest-leverage moment in the whole workflow* — correcting a plan costs one sentence; correcting an implementation costs an afternoon. Then:

```
Implement the plan. Write tests for [the core logic], run them, and fix
failures. When done, show me the test output — evidence, not assertions.
```

Slice vertically: "a player can create a character and see it persist" is one slice; "build the whole data layer" is not. Each slice should be shippable — push it, watch Vercel deploy, open the URL. If a task could be described in one sentence ("fix the typo in the nav"), skip planning and just ask.

## Phase 3 — Verify with fresh eyes

The session that wrote the code is biased toward it. Before calling a feature done, get a review from a clean context — a subagent, or a second session:

```
Review the diff for [feature] against SPEC.md section [X]. Check that every
requirement is implemented, edge cases have tests, and nothing out of scope
changed. Report gaps that affect correctness — not style preferences.
```

For UI work, verification is visual: "take a screenshot of the deployed page and compare it against the design; list differences and fix them." One caution: a reviewer asked to find gaps will always find *something*. Fix what affects correctness; treat the rest as optional, or you'll gold-plate forever.

## Phase 4 — Session hygiene (the habits that prevent attempt three)

**One feature, one session.** When a feature ships, start fresh for the next one. A long session accumulates irrelevant context and Claude's performance degrades as it fills.

**Two failed corrections → restart.** If you've corrected Claude twice on the same thing, the context is polluted with failed approaches. Clear, and write a better first prompt using what you learned. A clean session with a sharp prompt beats a long session with accumulated corrections, every time.

**Commit constantly.** Every green slice gets a commit. Git is your rewind button, and pushes double as deploys.

**Feed CLAUDE.md.** When Claude makes the same mistake twice across sessions, the fix belongs in CLAUDE.md — one line, phrased as a rule. When a rule stops being needed, delete it. A bloated CLAUDE.md gets ignored.

**Point at sources, not descriptions.** "Look at how the character sheet component handles state — follow that pattern" beats three paragraphs describing the pattern.

## The loop, on one line

**Interview → spec → fresh session → plan → edit the plan → implement with a check → push (auto-deploy) → fresh-eyes review → commit → clear → next slice.**

## Grimoire-specific notes

The current `index.html` is the landing page — treat it as the marketing front door, and build the app itself as a separate concern (e.g. `/app`) so landing-page tweaks never risk app state. When the app needs a backend (multiplayer sync, campaigns, auth), you already have Supabase available from attempt one — the archived attempt-1 schema dumps are a design reference, not a starting point: read them for lessons, rebuild from the spec. And since Shadowdark is published under a third-party license, keep a note in SPEC.md about which game content you can reproduce verbatim versus reference.
