# Contributing

`README.md` is the Marketplace listing page and holds only what a consumer needs. Everything
else about working on the action is here; `docs/design.md` records why each behavior rule is
the way it is.

## Development

```bash
pnpm install     # also installs the lefthook pre-commit hooks
pnpm test        # vitest with coverage, 100% thresholds
pnpm typecheck
pnpm lint
pnpm build       # writes dist/, which is committed; CI refuses a stale dist
```

`test/fixtures/sample.md` carries a mermaid block so a pull request that edits it exercises
the action on itself through the smoke job in CI.

Commits and pull request titles follow Conventional Commits; the title becomes the squash
commit and decides the release version (see Releases). Never commit with `--no-verify`.

## Releases

Releases are cut by [`brianespinosa/release-action`](https://github.com/brianespinosa/release-action)
on every push to `main`: the next semver comes from the conventional-commit squash titles since
the last tag (`feat` minor, `feat(scope)!:` major, `fix`, `docs`, `refactor` and `perf` patch;
`chore`, `ci`, `test`, `style` and `build` do not release), and the `v1` and `v1.N` alias tags
move with each release. Squash merge is the only merge method enabled on this repository, which
that workflow requires.

## Marketplace

The first release was published to the listing by hand once (the release edit form, "Publish
this Action to the GitHub Marketplace"). Every release the workflow creates since then has
reached the listing on its own, including with the default `GITHUB_TOKEN`; a release created
before the first listing existed (`v1.0.1`) never appears on it. Consumers on the `v1` alias tag
get every release either way.

The Marketplace validates `action.yml` at the release's commit: the description must be under
125 characters, and `branding` takes a Feather icon name and one of nine named colors.
