Fetch the latest main branch from origin, then rebase the current branch onto it.

Steps:
1. Run `git fetch origin main`
2. Run `git rebase origin/main`
3. If there are conflicts, list every conflicted file and suggest how to resolve each one
4. Do NOT auto-resolve conflicts -- show them to me so I can decide
5. Report the final status: how many commits ahead/behind main we are
