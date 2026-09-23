---
paths:
  - "action.yml"
  - "README.md"
---

# action.yml contract

Inputs and outputs are a published contract. Adding one is a `feat`; removing or renaming one is
a breaking change. The README inputs and outputs tables mirror `action.yml` and change with it.
The Marketplace validates `action.yml` at the release's commit: the description stays under 125
characters, and `branding` takes a Feather icon name and one of nine named colors.
