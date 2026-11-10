# kb — the support knowledge base

**kb** = knowledge base. What the support desk knows about how our products break, written
down where the code can keep it honest.

One desk takes reports for every product we run: `sched-prod` (calendar invites for about
300k people) and the rest. When something
goes wrong, the reports reach the desk first. This kb is how the desk triages them, what each
incident turned out to be, and why we decided what we decided.

## What's here

```
src/routes/kb/      the pages (.svx: Markdown with components)
  triage/           how the desk handles incoming reports
  incidents/        one page per big ticket
  decisions/        numbered decision records
src/lib/kb/         components and the logic they run
src/lib/layouts/    the frame every page shares
src/lib/data/       exports from the ticket system
```

## Conventions

- Words in the page, logic in `src/lib` (imported as `#lib/…`). A number that can be computed belongs in a component.
- Every page starts with frontmatter: `title`, `owner`, `status`, `reviewed`.
- A decision is never edited after it is accepted. A new record replaces it.
- A page you add is signed: its frontmatter carries your `signature` and it ends with `<RenderStamp {signature} />`, so the desk knows who wrote it.

## Owners

Support desk. Decision records: whoever signed them.

---

Exported 2026-10-04 from the `support` repo, `apps/kb/` → `src/`.

## Reproduce the S01E03 page

Use Node.js 24 or newer (Node.js 26 was used for this build) and npm.

```sh
npm ci
npm test
npm run build
npm exec playwright install chromium
npm run capture
```

On a minimal Linux machine, Chromium also needs its platform libraries; consult
`npm exec playwright install-deps -- --help` before installing system packages.
If Chromium is already installed, set `KB_BROWSER_EXECUTABLE` to its full executable path
instead of downloading another browser. Libraries installed in a private directory may
require `LD_LIBRARY_PATH` when running the capture.

`npm run capture` starts the built site on `127.0.0.1:4173`, checks the computed report
counts, issue links, browser errors, and the signature stamp, and writes:

- [`rendered/4471-causes.html`](rendered/4471-causes.html): the actual page with styles
  inlined, readable locally without a server or JavaScript;
- [`rendered/4471-causes.png`](rendered/4471-causes.png): the full-page Chromium screenshot.

The source is [`src/routes/kb/incidents/4471-causes/+page.svx`](src/routes/kb/incidents/4471-causes/+page.svx).
Open the downloaded HTML in a browser, or use `npm run preview -- --host 127.0.0.1` to
inspect the complete KB at `/kb/`. The build uses the supplied components and classifier;
it does not replace their output with a manually written table. The original export and
accepted decision 0001 remain unchanged.

### Dependency audit

The initial dependency audit reports a low-severity `deepmerge` advisory in the
Svelte build-tool dependency tree (including its dependent packages). No patched
`deepmerge` release was available when this lockfile was generated. This project
only builds the checked-in configuration locally and publishes a static page;
do not expose its development server to untrusted users or use untrusted config.
