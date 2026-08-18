# CLAUDE.md - Project Instructions for Claude Code

This file provides project-specific guidance for Claude Code. Update this file whenever Claude does something incorrectly so it learns not to repeat mistakes.

## Project Overview

It can load and render cool animation effects, The APIs provided by effects-core allow your engine to quickly access animation data such as layer and particle animation.

## Development Workflow

Give Claude verification loops for 2-3x quality improvement:

1. Make changes
2. Run typecheck
3. Run `npx eslint --fix` on all modified `.ts` files
4. Run tests
5. Lint before committing
6. Before creating PR: run full lint and test suite

## Code Style & Conventions

<!-- Customize these for your project's conventions -->

- Use descriptive variable names
- Keep functions small and focused
- Write tests for new functionality
- Handle errors explicitly, don't swallow them

## Commands Reference

```sh
# Verification loop commands (customize for your project)
pnpm check:ts        # Type checking
pnpm test            # Run tests, temporarily requires opening browser for manual confirmation
pnpm lint            # Lint all files

# Git workflow
git status              # Check current state
git diff                # Review changes before commit
```

## Self-Improvement

After every correction or mistake, update this CLAUDE.md with a rule to prevent repeating it. Claude is good at writing rules for itself.

End corrections with: "Now update CLAUDE.md so you don't make that mistake again."

Keep iterating until the mistake rate measurably drops.

## Working with Plan Mode

- Start every complex task in plan mode (shift+tab to cycle)
- Pour energy into the plan so Claude can 1-shot the implementation
- When something goes sideways, switch back to plan mode and re-plan. Don't keep pushing.
- Use plan mode for verification steps too, not just for the build

## Parallel Work

- For tasks that need more compute, use subagents to work in parallel
- Offload individual tasks to subagents to keep the main context window clean and focused
- When working in parallel, only one agent should edit a given file at a time
- For fully parallel workstreams, use git worktrees:
  `git worktree add .claude/worktrees/<name> origin/main`

## Things Claude Should NOT Do

<!-- Add mistakes Claude makes so it learns -->

- Don't use `any` type in TypeScript without explicit approval
- Don't skip error handling
- Don't commit without running tests first
- Don't make breaking API changes without discussion

## Project-Specific Patterns

<!-- Add patterns as they emerge from your codebase -->

- Respond in Simplified-Chinese by default; only switch to another language when explicitly requested in the prompt
- In text architecture, keep RichText parser `SourceRange` separate from AE/Lottie Text Animator `Range Selector`: the parser defines static text segments, while the animator selector only computes per-unit animation weights. Never use `t.a[]` as the rich-text segmentation or fancy-stack binding model.
- RichText Runtime input contains one complete markup string; Runtime performs segmentation internally. Never describe the caller as passing segmented text. Per-range fancy data, when needed, is style-only metadata associated after parsing, preferably nested under the extra fancy configuration.
- When rich-text markup and per-range fancy metadata are serialized together, bind them positionally by the deterministic parser output order. Do not invent an explicit `rangeIndex`, `rangeId`, or offsets unless the product requires non-positional updates; the override entry itself contains style only.
- For the final RichText fancy contract, preserve one public `FancyConfig` for ordinary/rich text compatibility. Use ordered inline range overrides in the V1 snapshot, but split the shared template into explicit Range/Object semantics only inside the scope-aware normalizer and `TextRenderPlan`; object effects remain unique and range overrides may only contain range-capable effects.
- For the V1 Runtime JSON, reuse is allowed through an ordered `rangeStacks[]` table and positive 1-based ordinals in `rangeOverrides[]`; do not introduce global/named stack IDs. Null inherits the default range template and `{mode: "disable"}` preserves only the basic RichText fill.
- Existing FancyConfig storage has `presetName`/registry-name keys but no stable preset identity. Keep any external preset asset identity in a wrapper, never use a display name as an ID; V1 Runtime JSON uses only local ordered stack ordinals, and `sourceRangeId` remains runtime-internal.
- Object Glow is object-scope: its shared mask source in `CanvasRichTextFancyBackend.drawSolidFill(maskOnly)` must be a constant full-alpha white silhouette (`'rgb(255,255,255)'`). Never let range fill RGB OR range fill alpha (`fillColor[3]`/fillOpacity) through — both pulse/recolor the whole glow when one segment's fill changes. Glow strength comes only from its own color/blur/intensity. (3931e764 fixed RGB; 69577a4c fixed the remaining alpha leak.)
- When testing glow/shadow halo isolation, first render a no-glow (or no-effect) reference to capture the text+stroke silhouette, then compare candidate renders only over pixels OUTSIDE that silhouette where the effect render still has alpha>0. A naive "both renders transparent here" check only touches pure background corner pixels and trivially passes without ever sampling the halo — it will not catch a real glow leak.

---

_Update this file continuously. Every mistake Claude makes is a learning opportunity._
