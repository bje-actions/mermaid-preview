# Rulesets

`enterprise-mermaid-preview.json` is the enterprise ruleset that requires
`.github/workflows/pr-mermaid-preview.yml` from this repository on every pull request in every
organization of the `bje` enterprise, the same way `bje-actions/conflict-label` is deployed. An
organization ruleset takes the same shape without the `organization_name` condition.

This repository is excluded: its own CI already runs the action against each pull request
(the smoke job), and two runs on one pull request would race to create the same comment.

Created by hand with the API and recorded here; it is not managed in terraform:

```bash
gh api -X POST enterprises/bje/rulesets --input rulesets/enterprise-mermaid-preview.json
```

A ruleset workflow ignores the file's own event filters, so the workflow runs on every pull
request, not only those touching Markdown; the action plans nothing for a pull request with
no Markdown and exits 0 in a few seconds on `ubuntu-slim`.
