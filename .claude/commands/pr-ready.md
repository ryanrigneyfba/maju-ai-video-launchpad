Prepare the current branch for a pull request.

Steps:
1. Run `git fetch origin main`
2. Rebase onto origin/main -- if conflicts exist, stop and report them
3. Run any available tests or linting (check package.json for scripts)
4. If tests fail, stop and report the failures
5. Show a summary of all changes vs main: files changed, lines added/removed
6. Generate a PR title (under 70 chars) and description with:
   - Summary section (1-3 bullet points of what changed)
   - Test plan section (what to verify)
7. Push the branch to origin
8. Create the PR using `gh pr create`
