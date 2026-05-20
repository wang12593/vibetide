# Parallel Subagent Development with Git Worktrees

**Extracted:** 2026-03-27
**Context:** Large feature implementation (26 tasks, 5 phases, 46 files) using isolated workspace + parallel agent dispatch

## Problem
Implementing a large feature (e.g., full page rewrite with 9 feature modules) takes too long with sequential execution. Agents working on the same branch can create conflicts. Need a way to safely parallelize independent tasks.

## Solution
Combine git worktrees for isolation with parallel subagent dispatch for speed:

1. **Worktree setup:** Create isolated workspace on a feature branch
   ```bash
   git worktree add .worktrees/<feature> -b feature/<name>
   cd .worktrees/<feature> && npm install
   ```

2. **Task dependency analysis:** Before dispatch, identify which tasks touch different directories/files. Tasks modifying different `features/` subdirectories can run in parallel.

3. **Parallel dispatch pattern:**
   ```
   # These touch different feature dirs → parallel
   Agent A: features/ai-chat/ (background)
   Agent B: features/ai-analysis/ (background)

   # This depends on both → sequential after A+B
   Agent C: article-detail-client.tsx (integration)
   ```

4. **Sequential for shared files:** Tasks modifying the same file (e.g., article-detail-client.tsx) must run sequentially to avoid merge conflicts.

5. **Merge back:** After all tasks complete:
   ```bash
   git stash push -m "stash before merge"
   git merge feature/<name> --no-ff
   git stash pop
   # Resolve any conflicts
   git worktree remove .worktrees/<feature>
   git branch -d feature/<name>
   ```

## Key Insights

- **Feature-Sliced architecture enables parallelism:** When components are organized by feature domain (not by layer), each feature directory is independent → perfect for parallel agents.
- **Background agents (`run_in_background: true`)** let you dispatch 2 agents simultaneously, halving wall-clock time for independent tasks.
- **Type checking as gate:** Run `npx tsc --noEmit | grep "target/dir"` after each task to catch errors early without being blocked by pre-existing errors elsewhere.
- **Stash before merge:** The main branch likely has uncommitted local changes that conflict with the feature branch. Always stash first.

## Performance Results

- 26 tasks completed in ~12 parallel rounds (vs 26 sequential)
- ~60% wall-clock time reduction from parallelization
- Zero merge conflicts between parallel agents (due to feature isolation)

## When to Use

- Feature requires 10+ files across multiple independent modules
- Project uses Feature-Sliced or similar domain-based architecture
- Tasks can be grouped into independent pairs/triples
- Each task touches different directories
