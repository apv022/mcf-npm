# Architecture

```text
MCF package → discovery and YAML → typed parser → semantic validator
                                                 ↓
course library ← atomic output writer ← safe HTML renderer
                                      ↓
                          static browser reader + local progress
```

The layers deliberately keep the MCF source standard separate from this compiler and its generated reader.

## Modules

- `src/model.ts` defines the typed intermediate representation and validation diagnostics.
- `src/parser.ts` discovers packages; parses YAML, frontmatter, activities, and question fences; preserves declared order; and performs structural, semantic, reference, uniqueness, and path validation.
- `src/render.ts` transforms rich content into sanitized HTML. Markdown and KaTeX render at compile time, so compiled lessons require no CDN. Media URLs are resolved from their containing lesson and constrained to copied assets.
- `src/compiler.ts` copies local assets, produces course data/pages/runtime/style files through a staging directory, replaces only the matching course ID, and maintains the root catalog.
- `src/reader/` contains maintainable browser TypeScript for storage, objective questions, essays, practice, assessment submission, progress, import/export, and the course library. `scripts/build-reader.mjs` bundles it into classic scripts with no runtime imports, fetches, or Node.js dependency.
- `src/reader/styles/` contains readable design tokens, base rules, layout, activities, questions, media, and responsive behavior. The compiler concatenates these local files.
- `src/cli.ts` maps validation failures to readable diagnostics and nonzero exit status.

## Security boundary

Course packages are untrusted. Resolution rejects backslashes and paths outside the course root. Local references must exist. Raw HTML is sanitized and scripts/events are not allowed. URL schemes are allowlisted. The runtime never evaluates source data or injects course-authored JavaScript.

KaTeX runs at compile time. Every course receives a local stylesheet and the complete KaTeX font set, allowing inline and display formulas to render through `file://` with no CDN.

## Extending a future standard

Add official types to the model and parser dispatch only when their normative schema exists, then add conformance fixtures before renderer behavior. Runtime behavior may be extended independently, but it must remain documented as implementation behavior.
