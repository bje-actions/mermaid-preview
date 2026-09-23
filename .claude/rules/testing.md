---
paths:
  - "src/**/*.ts"
  - "test/**/*.ts"
---

# Tests

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
