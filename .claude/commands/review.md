Review the current branch's diff against origin/main for merge-readiness.

Steps:
1. Run `git fetch origin main`
2. Show the full diff: `git diff origin/main...HEAD`
3. Analyze and report:
   - **High-conflict-risk files**: files that are frequently edited by multiple people (check git log for recent editors)
   - **Large diffs**: any single file with 100+ changed lines that should be split into separate PRs
   - **Missing tests**: any new functions or endpoints that lack test coverage
   - **Potential bugs**: obvious issues like unused imports, undefined variables, hardcoded secrets
4. Give a go/no-go recommendation with specific action items if no-go
