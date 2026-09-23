# Mermaid preview

GitHub Action that comments a [mermaid.live](https://mermaid.live) preview link on every
changed `mermaid` code block in a pull request's Markdown files, as a review comment spanning
the block, and keeps the comment current as the block changes.

GitHub renders mermaid blocks in the rendered file view, but not in the diff. This action puts
a link to the rendered diagram exactly where the reviewer is reading the source.

## Usage

```yaml
name: Mermaid preview

on:
  pull_request:
    paths: ['**/*.md', '**/*.markdown', '**/*.mdx']

permissions:
  contents: read
  pull-requests: write

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: bje-actions/mermaid-preview@v1
```

No checkout is needed: the action reads the changed files through the API. The default
`GITHUB_TOKEN` is enough for pull requests from the same repository.

### Inputs

| Input       | Default               | Description                                                                 |
| ----------- | --------------------- | --------------------------------------------------------------------------- |
| `token`     | `${{ github.token }}` | Token for the pull request API calls. Needs `pull-requests: write`.          |
| `pr-number` | the triggering PR     | Pull request number, for runs not triggered by `pull_request`.               |
| `theme`     | `default`             | Mermaid theme encoded into the link (`default`, `dark`, `forest`, `neutral`). |

### Outputs

| Output     | Description                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `outcome`  | `completed`, `read-only` (the token could not write review comments and the links went to the job summary instead), or `failed`. |
| `comments` | Number of review comments created or updated.                                                                                     |

## Behaviour

- Only `mermaid` blocks whose lines the pull request changed get a comment. A file that
  changed elsewhere leaves its untouched diagrams alone.
- The comment spans the whole block, opening fence to closing fence, when every line of the
  block is in the diff. When only part of a long block is in a hunk, the comment spans that
  part and says so.
- On a new push the comment is updated in place when its range is unchanged, or replaced when
  the block moved (the API cannot move a comment's range). A block that is removed, or reverted
  to its base content, loses its comment.
- Comments are identified by an HTML marker carrying the file path and the block's ordinal in
  that file, so the action never touches a human's comment.
- On a fork pull request the default token is read-only; the links are written to the job
  summary and the run stays green with `outcome: read-only`.

`docs/design.md` records the reasoning behind each rule.

## Publishing

Releases are cut by [`brianespinosa/release-action`](https://github.com/brianespinosa/release-action)
on every push to `main`: the next semver comes from the conventional-commit squash titles since
the last tag, and the `v1` and `v1.N` alias tags move with each release. Squash merge is the
only merge method enabled on this repository, which that workflow requires.

The first Marketplace listing must be made by hand once: open the release in the GitHub UI and
tick "Publish this Action to the GitHub Marketplace".

## Development

```bash
pnpm install     # also installs the lefthook pre-commit hooks
pnpm test        # vitest, 100% coverage thresholds
pnpm typecheck
pnpm lint
pnpm build       # writes dist/, which is committed; CI refuses a stale dist
```

`test/fixtures/sample.md` carries a mermaid block so a pull request that edits it exercises
the action on itself through the smoke job in CI.

## License

MIT
