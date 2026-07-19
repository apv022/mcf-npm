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
- `src/runtime.ts` contains dependency-free browser code for responses, feedback, completion, local storage, and progress transfer.
- `src/cli.ts` maps validation failures to readable diagnostics and nonzero exit status.

## Security boundary

Course packages are untrusted. Resolution rejects backslashes and paths outside the course root. Local references must exist. Raw HTML is sanitized and scripts/events are not allowed. URL schemes are allowlisted. The runtime never evaluates source data or injects course-authored JavaScript.

## Extending a future standard

Add official types to the model and parser dispatch only when their normative schema exists, then add conformance fixtures before renderer behavior. Runtime behavior may be extended independently, but it must remain documented as implementation behavior.
