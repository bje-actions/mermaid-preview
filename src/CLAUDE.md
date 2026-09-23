# src

- `main.ts`: entry point, reads inputs, wires the adapter, sets outputs. Excluded from coverage
  with `github.ts` (the Octokit adapter); the smoke job in `ci.yml` exercises both.
- `run.ts`: fetch, plan, apply, and the read-only fallback for fork pull requests (the one
  behavior rule outside the pure modules).
- `plan.ts`: the pure decision: changed files and existing comments in, create, update, remove
  and skipped out. Every other behavior rule lives here or in the three modules below.
- `markdown.ts` (fence finder), `diff.ts` (patch parsing, changed-within, anchor range),
  `encode.ts` (the `pako:` state encoding mermaid.live and mermaid.ink read).
- `../dist/index.js`: the ncc bundle consumers run. Committed; the lefthook `build` step rebuilds
  it on every commit that touches `src/*.ts`, `package.json` or `pnpm-lock.yaml`, and CI fails when
  it does not match `src/`.
