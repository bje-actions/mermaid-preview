---
paths:
  - ".github/workflows/**"
---

# CI

The job names `Build and test` and `Smoke test on this pull request` are required checks on the
repo ruleset Require CI (23861154, created by hand with `gh api`, not managed elsewhere).
Renaming one silently blocks every pull request; see the header comment in `ci.yml`. Add a new
required name to the ruleset only after it has reported on `main` once; remove it from the
ruleset before the pull request that drops the job merges.
