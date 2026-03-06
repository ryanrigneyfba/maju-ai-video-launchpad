# Git Conventions

- Always pull latest from `main` before creating a feature branch
- Branch naming: `feature/<description>`, `fix/<description>`
- Rebase onto main before opening PRs (not merge)
- Keep PRs small and focused -- one feature/fix per PR
- Run `node server/server.js` to verify the server starts before committing
- Commit messages: `type: short description` (feat, fix, refactor, docs)

# Project Structure

- `index.html` -- Main frontend UI
- `js/app.js` -- Core frontend application logic (video generation pipeline)
- `css/` -- Styles
- `server/` -- Express backend (proxy for Higgsfield/Kling APIs)
- `sops/` -- Standard operating procedures

# PR Guidelines

- PR titles under 70 characters
- Include a summary of what changed and why
- Tag relevant reviewers via CODEOWNERS
- Resolve all merge conflicts via rebase, not merge commits
