# CLAUDE.md

See `README.md` for what the action does and `docs/design.md` for why each rule is the way it is.

## Layout

- `src/main.ts`: entry point, reads inputs, wires the adapter, sets outputs. Excluded from
  coverage with `src/github.ts` (the Octokit adapter); the smoke job in `ci.yml` exercises both.
- `src/run.ts`: fetch, plan, apply, and the read-only fallback for fork pull requests (the one
  behavior rule outside the pure modules).
- `src/plan.ts`: the pure decision: changed files and existing comments in, create, update,
  remove and skipped out. Every other behavior rule lives here or in the three modules below.
- `src/markdown.ts` (fence finder), `src/diff.ts` (patch parsing, changed-within, anchor range),
  `src/encode.ts` (the `pako:` state encoding mermaid.live reads).
- `dist/index.js`: the ncc bundle consumers run. Committed; the lefthook `build` step rebuilds
  it on every commit that touches `src/`, `package.json` or `pnpm-lock.yaml`, and CI fails when
  it does not match `src/`.

## Tests

The baseline is mattpocock's `engineering/tdd` skill (its `mocking.md` and `tests.md`).

- Seams under test: `findMermaidBlocks`; `parsePatch`, `changedWithin`, `anchorRange`;
  `encodeState`, `previewLinks`; `plan`; and `run` through a fake `PullRequestClient`. A new seam
  is agreed before its first test.
- The GitHub API is the only boundary and the only thing faked. `test/helpers.ts` holds the fake,
  which keeps the comments in memory so a test asserts what is on the pull request afterwards.
  Nothing in `src/` is mocked, and no test asserts call order or counts.
- Expected values are literals: the `pako:` fragments in `test/helpers.ts` were each rendered by
  mermaid.ink, and comment bodies are spelled out by `body()` there, never built with `buildBody`
  or `encodeState`.
- Red before green, one slice at a time; refactoring is review work, not part of the loop.

## Rules

- Conventional Commits; PR title is the squash commit and drives the release version:
  `feat` minor, `feat(scope)!:` major, `fix`, `docs`, `refactor` and `perf` patch; `chore`, `ci`,
  `test`, `style` and `build` do not release.
- Never `--no-verify`. Never lower a coverage threshold; exclusion by file name with a stated
  reason is the only relief.
- The CI job names `Build and test` and `Smoke test on this pull request` are required checks on
  the repo ruleset Require CI (23861154, created by hand with `gh api`, not managed elsewhere).
  Renaming one silently blocks every pull request; see the header comment in `ci.yml`.
- `action.yml` inputs and outputs are a published contract. Adding is a `feat`; removing or
  renaming is a breaking change.
- No em-dashes in any written output.
