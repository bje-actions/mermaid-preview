# Design

Why the action behaves as it does. `README.md` says what it does.

## Only changed blocks get a comment

A review comment can anchor only to a line that appears in the pull request diff (a hunk's
added or context lines). Restricting comments to blocks the diff touched guarantees at least
one anchorable line, so no fallback comment is needed for "block exists but is not in the
diff". It also matches what a reviewer wants: a link where the diagram changed, not on every
diagram in a file that changed elsewhere.

"Changed" means an added line inside the block, or a deletion whose position is inside the
block (`deletedBefore` in `src/diff.ts`), so a block that only lost lines still counts. A
deletion recorded at the opening fence sits above the block (text removed just before it) and
does not count.

## The comment spans the block

`start_line` and `line` on a review comment must both be in the diff, so a full-block span is
possible only when every block line is in a hunk. That is always true for a new block and
usually true for an edited one. For a long block with one small edit, the hunk shows three
lines of context around the edit and the fences are outside it, so the comment spans the
in-hunk run holding the most changed lines (the earliest on a tie). The body does not say the
span is partial: the highlighted range shows it.

## Updating on a push

The update endpoint takes only `body`. A comment whose range is unchanged is patched in place;
one whose range moved is deleted and recreated. A block that is gone, or that dropped out of
the diff because a later push reverted it, loses its comment. Comments are matched by an HTML
marker `<!-- mermaid-preview: <path>#<ordinal> -->`. The ordinal survives edits inside the
block and shifts only when a block above it is inserted or removed, which costs a delete and
recreate rather than a wrong link. A content hash would be wrong: content is exactly what changes.

## Fork pull requests

`pull_request` from a fork runs with a read-only token, and a `permissions:` block cannot
raise it. The action decides from the event whether the head is a fork; only then does a 403 on
a write fall back to the job summary with `outcome: read-only`. On a same-repository pull
request every write failure fails the run, naming the block and asking whether the job grants
`pull-requests: write`, so a misconfigured job is never silently green. A 404 on a delete means
the comment is already gone and is not an error. A repository that wants comments on fork pull
requests can run the action on `pull_request_target`; the action never checks out or executes
pull request content, so that trigger is safe here. `pr-number` is only needed on a trigger
without a pull request payload.

## No dependency on a rendering service

The link is computed locally: deflate the mermaid.live state object at level 9, base64url,
no padding, the `pako:` scheme mermaid.live's editor uses. Nothing is fetched from mermaid.ink
or anywhere else, and the action has no network call except to the GitHub API. With
`type: image` the comment embeds `https://mermaid.ink/img/pako:<state>`, the same encoded
state, and the viewer's browser fetches the render; the action still does not.

A single image cannot follow the reader's light or dark mode, so the image is a `<picture>`
with a `prefers-color-scheme: dark` source rendered on Mermaid's `dark` theme and an `<img>`
rendered on the `theme` input. Each carries GitHub's own page background for that appearance
(`ffffff` and `0d1117`) as mermaid.ink's `bgColor`, so the render sits flush on the comment;
these are not inputs, because the values are GitHub's, not the consumer's. GitHub keeps this
markup in comments (probed on PR #10) and serves both renders through its image proxy.

## Follow-ups not yet built

- A moved or re-indented block reads as changed and gets a comment with a link identical to
  the base's. Comparing the encoded state against the base file's block would skip it.
- Path filtering beyond the Markdown extensions (an `include` glob input).

## Links open where GitHub decides

GitHub's comment sanitizer strips `target` and `rel` from every link, HTML or Markdown
(verified with a probe comment on PR #10), so a comment cannot make its links open in a new
tab. Whether they do is the reader's browser setting, not something this action can set.

## One visible link, and a hidden view URL

The comment shows one link, to mermaid.live's edit route, worded "View in mermaid.live": the
edit route is the useful one (the reader can tweak the diagram), and a link labelled "edit"
reads as if the pull request were editable from there. The view route still goes into every
body as `<!-- mermaid-preview-view: <url> -->`, beside the identity marker, for tooling that
reads the raw body. GitHub keeps HTML comments in the raw body but strips them from the
rendered HTML and the page DOM (verified on PR #10), so such tooling reads the body through
the REST API or the comment's edit form, not the page.
