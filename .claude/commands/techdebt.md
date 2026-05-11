End-of-session codebase cleanup. Find and kill duplicated and dead code.

Steps:

1. Scan the codebase for:
   - Duplicated code blocks (3+ similar lines appearing in multiple places)
   - Dead/unused exports, functions, and variables
2. Present findings grouped by file, with line numbers
3. Ask which items to fix now
4. Fix approved items one at a time, running tests after each fix to verify nothing breaks
5. Commit the cleanup when done
