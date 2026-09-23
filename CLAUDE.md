# CLAUDE.md

See `README.md` for what the action does, `CONTRIBUTING.md` for the development setup and
releases, and `docs/design.md` for why each rule is the way it is. `src/CLAUDE.md` maps the
modules; `.claude/rules/` holds the rules that apply to one part of the tree.

- Conventional Commits; the PR title is the squash commit and drives the release version:
  `feat` minor, `feat(scope)!:` major, `fix`, `docs`, `refactor` and `perf` patch; `chore`, `ci`,
  `test`, `style` and `build` do not release. Every merge to `main` that releases moves the `v1`
  tag, so one issue's changes ship as one PR.
- Never `--no-verify`.
- No em-dashes in any written output.
