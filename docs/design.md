# Design

Why the action behaves as it does. `README.md` says what it does.

## Only changed blocks get a comment

A review comment can anchor only to a line that appears in the pull request diff (a hunk's
added or context lines). Restricting comments to blocks the diff touched guarantees at least
one anchorable line, so no fallback comment is needed for "block exists but is not in the
diff". It also matches what a reviewer wants: a link where the diagram changed, not on every
diagram in a file that changed elsewhere.

"Changed" means an added line inside the block, or a deletion whose position is inside the
block (`deletedBefore` in `src/diff.ts`), so a block that only lost lines still counts.

## The comment spans the block

`start_line` and `line` on a review comment must both be in the diff, so a full-block span is
possible only when every block line is in a hunk. That is always true for a new block and
usually true for an edited one. For a long block with one small edit, the hunk shows three
lines of context around the edit and the fences are outside it, so the comment spans the
largest in-hunk run holding the most changed lines and says it is partial.

## Updating on a push

The update endpoint takes only `body`. A comment whose range is unchanged is patched in place;
one whose range moved is deleted and recreated. A block that is gone, or that dropped out of
the diff because a later push reverted it, loses its comment. Comments are matched by an HTML
marker `<!-- mermaid-preview: <path>#<ordinal> -->`. The ordinal survives edits inside the
block and shifts only when a block is inserted above, which costs a delete and recreate rather
than a wrong link. A content hash would be wrong: content is exactly what changes.

## Fork pull requests

`pull_request` from a fork runs with a read-only token, and a `permissions:` block cannot
raise it. The action tries the writes, and on 403 or 404 writes the links to the job summary
and reports `outcome: read-only` without failing. A repository that wants comments on fork
pull requests can run the action on `pull_request_target` with `pr-number` set; the action
never checks out or executes pull request content, so that trigger is safe here.

## No dependency on a rendering service

The link is computed locally: deflate the mermaid.live state object at level 9, base64url,
no padding, the `pako:` scheme mermaid.live's editor uses. Nothing is fetched from mermaid.ink
or anywhere else, and the action has no network call except to the GitHub API.

## Follow-ups not yet built

- A moved or re-indented block reads as changed and gets a comment with a link identical to
  the base's. Comparing the encoded state against the base file's block would skip it.
- Path filtering beyond the Markdown extensions (an `include` glob input).
- `mermaid.ink` image links as an alternative to mermaid.live.
