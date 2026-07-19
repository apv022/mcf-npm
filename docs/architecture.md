# Architecture

```text
MCF source directory
  → package discovery and YAML/frontmatter parsing
  → typed model and semantic/reference validation
  → Markdown, media, and compile-time KaTeX rendering
  → sanitized, structurally formatted HTML
  → atomic course-directory replacement
  → updated static course library
  → browser reader and local progress state
```

The layers deliberately keep the MCF source format separate from this compiler's reader behavior. The parser and model describe accepted MCF 1.0 input; navigation, scoring presentation, storage, badges, and visual design are implementation choices.

## Repository layout

- `src/` contains compiler, parser, renderer, CLI, and browser-reader source.
- `src/reader/` contains browser-only TypeScript. It is bundled into classic scripts because compiled courses must work through `file://` without module loading or a server.
- `src/reader/styles/` contains design tokens, base rules, course/library layout, activity controls, media rules, and responsive breakpoints. CSS files are concatenated in sorted filename order.
- `scripts/` contains build support. `clean.mjs` removes stale `dist/` output; `build-reader.mjs` bundles browser entry points and copies source CSS.
- `test/` contains Node.js unit, parser, validation, renderer, and compiler tests.
- `browser/` contains Playwright tests against compiled static output.
- `examples/` contains three valid courses plus deliberately invalid fixtures used by validation tests. Large example trees are source content, not runtime package files.
- `docs/` contains architecture, authoring, and conformance documentation.
- `.github/workflows/ci.yml` defines the Node.js 22 CI release checks.
- `dist/`, `courses/`, `.browser-courses/`, `test-results/`, and `playwright-report/` are generated and ignored.

Important root configuration files are:

- `package.json`: npm metadata, CLI/API entry points, publish whitelist, dependencies, and scripts.
- `package-lock.json`: reproducible dependency graph for `npm ci`.
- `tsconfig.json`: strict NodeNext TypeScript compilation into `dist/`; tests are compiled there for Node's test runner.
- `eslint.config.js`: TypeScript-aware static analysis for source, tests, browser tests, and scripts.
- `.prettierrc`: source formatting policy. Generated HTML does not invoke Prettier at runtime.
- `playwright.config.ts`: browser test location, timeout, and headless defaults.
- `.gitignore`: excludes dependencies, builds, compiled courses, test reports, logs, and package tarballs.

## Compiler modules

- `src/model.ts` defines the typed course, chapter, lesson, activity, question, option, and validation-diagnostic structures.
- `src/parser.ts` discovers packages; parses YAML, lesson frontmatter, activity containers, and question fences; preserves declared order; and validates field types, identifiers, answer references, uniqueness, path portability, real-path containment, and asset existence.
- `src/render.ts` converts rich content to HTML. It protects math before Markdown parsing, renders KaTeX, resolves local/remote media, generates controls for each question type, and sanitizes the result.
- `src/compiler.ts` creates course data, pages, copied assets, reader runtime, CSS, and local KaTeX files. It also maintains the root library catalog.
- `src/cli.ts` exposes `validate` and `compile`, maps `ValidationError` instances to readable diagnostics, returns nonzero status on failure, and reads its version from `package.json`.

## Compilation pipeline

1. `parseCourse(input)` resolves the course root and reads `manifest.yaml`.
2. Chapter and lesson paths are followed in declared order. YAML and `.mcf` source become the typed model.
3. Validation accumulates actionable issues rather than failing at the first malformed field. Compilation stops if any issue exists.
4. `src/render.ts` turns each activity into sanitized HTML. Question fences become interactive controls, and KaTeX output is produced at compile time.
5. `src/compiler.ts` writes into a process-specific staging directory under the output root. It creates readable multiline HTML and pretty-prints embedded course data without a runtime formatter.
6. Local assets, referenced files, bundled reader JavaScript, concatenated CSS, and KaTeX CSS/fonts are copied into the staging course.
7. The previous directory for the same course ID is removed and the staging directory is renamed into place. Other course directories are preserved.
8. `courses.json`, root `library.js`, `styles.css`, and `index.html` are updated. Library entries are sorted by title.

The generated `course.json` and `courses.json` files are inspectable metadata. For direct-file compatibility, equivalent data is embedded into ordinary scripts; the browser reader does not fetch those JSON files.

## Generated reader

`scripts/build-reader.mjs` uses esbuild to bundle `src/reader/player.ts` and `src/reader/library.ts` as non-minified IIFEs targeting ES2020. The generated course therefore has no npm, Node.js, bundler, module-loader, or network dependency for local content.

- `library.ts` reads embedded catalog data, restores per-course completion percentages, and creates fixed-layout course cards.
- `player.ts` selects/persists randomized question pools, wires controls, restores responses, submits assessments, and coordinates progress updates.
- `storage.ts` defines and validates schema-versioned `localStorage` state under `mcf:<course-id>:<course-version>`.
- `questions.ts` evaluates objective responses and delegates essay completion.
- `essays.ts` implements deterministic word, sentence, and keyword requirements.
- `progress.ts` derives lesson/course completion and completion timestamps.
- `import-export.ts` exports readable JSON and accepts only valid state matching the current course ID and version.

Navigation and course data are compiled into each page. The sidebar is generated from declared chapter/lesson order; previous/next links use the flattened unique lesson order. Responsive CSS changes the sidebar into horizontal navigation on smaller screens and reflows the course library cards.

## Rendering and media

Markdown is parsed with Marked, tables use GFM behavior, and HTML is sanitized with an allowlist. Math placeholders prevent Markdown from escaping derivative primes or TeX commands before KaTeX renders them. KaTeX CSS and fonts are local to every compiled course.

Local links, images, audio, and video resolve relative to their lesson source and are checked against the course root. Course covers fill the library thumbnail while lesson diagrams use proportional `object-fit: contain` sizing. YouTube references become privacy-enhanced embeds over HTTP; direct-file pages hide the iframe and show a thumbnail link instead.

## Security boundary

Course packages are untrusted. Resolution rejects backslashes and paths outside the course root, including symlink escapes. Local references must exist. Raw HTML is sanitized; scripts, event handlers, unsafe protocols, and course-authored JavaScript are not allowed. Embedded JSON replaces `<` with its Unicode escape before insertion into a script element.

The browser validates imported progress structurally and checks course identity/version before replacing local state. Reader code uses text content or escaped/sanitized values for authored data.

## Build and package flow

`npm run build` first removes `dist/`, preventing stale modules from entering later builds. TypeScript then emits Node.js modules and test JavaScript; esbuild creates browser bundles and copies reader CSS. `npm test` runs the compiled Node tests. `npm run test:browser` builds a disposable showcase library and runs Playwright through `file://`.

The published npm package exposes:

- the `mcf` binary at `dist/src/cli.js`;
- `compile` from the package root;
- typed `model`, `parser`, and `render` subpath exports;
- `dist/reader/`, required by the compiler when producing courses.

The `files` whitelist excludes tests, source examples, documentation beyond the root README, build scripts, internal reader TypeScript output, and local generated artifacts. `prepack` performs a clean build. Use `npm pack --dry-run` to inspect the exact publication manifest.

## Extension points and maintenance

- Add source-format features in `model.ts` and `parser.ts` first, with validation fixtures and conformance documentation before renderer/reader behavior.
- Add reader-only behavior under `src/reader/` without presenting it as an MCF requirement.
- Keep progress-state changes schema-versioned and provide migration or explicit invalidation when stored structures change.
- Preserve atomic replacement and path-containment checks when changing asset handling.
- Keep compile-time rendering deterministic; avoid CDNs or runtime dependencies that break offline output.
- Add official future MCF versions through version-keyed parsing rather than silently extending MCF 1.0 with vendor fields.
