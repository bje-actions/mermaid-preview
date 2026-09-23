---
paths:
  - ".github/workflows/**"
---

# CI

The job names `Build and test` and `Smoke test on this pull request` are required checks on the
repo ruleset Require CI (23861154, created by hand with `gh api`, not managed elsewhere). The
header comment in `ci.yml` says what renaming or adding one entails; follow it.

`pr-mermaid-preview.yml` is not CI for this repository: it is the workflow an org or enterprise
ruleset requires on every pull request elsewhere (`rulesets/README.md`). Its job name is not a
required check here.
