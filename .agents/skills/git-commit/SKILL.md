---
name: "git-commit"
description: "Commit, push, and open a PR"
---

Follow these steps in order:

1. Run `git status` to see what files have changed
2. Run `git diff` to review the changes
3. If no files are staged, run `git add -A .` to stage all changes; otherwise skip
4. Run `git diff --staged` to review staged changes and generate a commit message following conventional commits format. Show the message and ask for explicit confirmation with choices: `Confirm commit` / `Cancel`. Only proceed if confirmed
5. If the command arguments contain `-b`, or the current branch is `main`, `master`, `dev`, or matches `feat/<version>` (e.g. `feat/2.1`): infer a branch name from the staged diff content in `<type>/<scope>-<summary>` format and run `git checkout -b <branch>`; otherwise stay on the current branch
6. Run `git commit -m "<message>"`

If there are any issues at any step, stop and report them.
