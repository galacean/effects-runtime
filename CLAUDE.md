# CLAUDE.md - Project Instructions for Claude Code

This file provides project-specific guidance for Claude Code. Update this file whenever Claude does something incorrectly so it learns not to repeat mistakes.

## Project Overview

It can load and render cool animation effects, The APIs provided by effects-core allow your engine to quickly access animation data such as layer and particle animation.

## Development Workflow

Give Claude verification loops for 2-3x quality improvement:

1. Make changes
2. Run typecheck
3. Run tests
4. Lint before committing
5. Before creating PR: run full lint and test suite

## Code Style & Conventions

<!-- Customize these for your project's conventions -->

- Prefer `type` over `interface`; As much as possible avoid use `enum` (use string literal unions instead)
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

---

_Update this file continuously. Every mistake Claude makes is a learning opportunity._
