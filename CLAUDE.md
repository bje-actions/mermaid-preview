# CLAUDE.md

See `README.md` for what the action does and `docs/design.md` for why each rule is the way it is.

## Layout

- `src/main.ts`: entry point, reads inputs, wires the adapter, sets outputs. Excluded from
  coverage with `src/github.ts` (the Octokit adapter); the smoke job in `ci.yml` exercises both.
- `src/run.ts`: fetch, plan, apply, and the read-only fallback for fork pull requests.
- `src/plan.ts`: the pure decision: changed files and existing comments in, create, update,
  remove and skipped out. Every behaviour rule lives here or in the three modules below.
- `src/markdown.ts` (fence finder), `src/diff.ts` (patch parsing, changed-within, anchor range),
  `src/encode.ts` (the `pako:` state encoding mermaid.live reads).
- `dist/index.js`: the ncc bundle consumers run. Committed; the lefthook `build` step rebuilds
  it on every commit that touches `src/`, and CI fails when it does not match `src/`.

## Rules

- Conventional Commits; PR title is the squash commit and drives the release version
  (`feat` minor, `fix` patch, `feat(scope)!:` major; `chore`, `ci`, `test`, `docs` do not release).
- Never `--no-verify`. Never lower a coverage threshold; exclusion by file name with a stated
  reason is the only relief.
- `action.yml` inputs and outputs are a published contract. Adding is a `feat`; removing or
  renaming is a breaking change.
- No em-dashes in any written output.
