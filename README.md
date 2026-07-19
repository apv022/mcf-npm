# mcf-npm

`mcf-npm` is the reference Node.js/NPM compiler for **MCF 1.0 — Modular Curriculum Format**. It validates a human-readable MCF source package and compiles it into a polished static course that learners can copy, download, and open directly in a browser.

MCF is the source-format standard. This project is one compiler implementation. Its static reader, navigation, grading UI, browser storage, progress, badges, and output layout are implementation features—not requirements added to MCF.

## Install and use

Node.js 20 or newer is required to compile a course. Learners do not need Node.js.

```bash
npm install
npm run build
npm link
mcf validate ./my-course
mcf compile ./my-course
mcf compile ./my-course --output ./courses
```

Without linking, use `node dist/src/cli.js` in place of `mcf`.

Compilation creates a library and a self-contained directory for each course:

```text
courses/
├── index.html
├── styles.css
├── library.js
├── courses.json
└── my-course-id/
    ├── index.html
    ├── styles.css
    ├── player.js
    ├── course.json
    ├── lessons/
    └── assets/
```

Course order always comes from `manifest.yaml` and `chapter.yaml`, never filenames. Recompiling the same course ID atomically replaces only that course directory and updates its library record; other compiled courses remain intact.

## Browser support

The output is designed for direct `file://` use in current Chromium-based browsers and Safari. All runtime data is embedded in ordinary scripts so the reader does not rely on `fetch()` for local JSON. Firefox applies stricter local-file rules and is not a primary direct-file target; serve the library when needed:

```bash
python -m http.server --directory courses
# or: npx serve courses
```

Remote media still needs a network connection. The core UI, CSS, JavaScript, lessons, and local assets do not.

## MCF 1.0 coverage

The compiler supports:

- root manifests, declared chapter order, chapter packages, and declared lesson order;
- lesson frontmatter and correctly nested `notes`, `practice`, and `assessment` activities;
- CommonMark, tables, fenced code, safe links and images, server-rendered LaTeX, audio, video, and YouTube references;
- `multiple_choice`, `multiple_select`, `true_false`, `numeric` with absolute tolerance, case-insensitive trimmed `short_answer`, and saved but never objectively graded `essay` responses;
- rich prompts, options, hints, and explanations;
- identifier uniqueness, answer references, required/type constraints, existing local assets, forward-slash paths, and course-root containment.

Raw source HTML is sanitized. Course-authored scripts are never executed, dangerous URL schemes are removed, and local references cannot escape the package root.

## Progress model

Progress is JSON in `localStorage` under `mcf:<course-id>:<course-version>`. Selected and written responses, question completion and correctness, activity completion, lesson completion, course completion time, and badge state derive from that record.

- Notes complete when the learner selects **Mark notes complete**.
- Practice and assessment activities complete when every required question has a response.
- A lesson completes when all its activities complete.
- Course progress is completed lessons divided by total lessons.
- At 100%, the reader shows a clearly non-credential completion badge.

**Export progress** downloads validated JSON. **Import progress** accepts only schema version 1 data matching the current course ID and version. Browsers do not write learner state into compiler-generated `course.json` or `courses.json`.

## Examples

```bash
npm run compile:examples
```

- `examples/minimal` is the smallest useful valid package.
- `examples/showcase` covers every activity and question type, Markdown, math, images, audio/video declarations, a remote embed, feedback, progress, and completion.

The tiny audio/video files are intentionally non-copyrighted textual fixture placeholders; replace them with encoded local media for playback demonstrations. The SVG artwork is original and local.

## Development

```bash
npm test
npm run build
npm run lint
npm run format:check
npm run compile:examples
```

Tests cover package/YAML and lesson parsing, activity boundaries, all question types, answer validation, path traversal, sanitized structural rendering, deterministic progress math, library preservation, and end-to-end compilation. CI runs tests and compiles both examples on Node.js 22.

See [Architecture](docs/architecture.md) for module boundaries and data flow. Contributions should include focused tests, keep dependencies limited, preserve MCF ordering and semantics, and distinguish standard conformance from reader behavior. By contributing, you agree that your changes may be distributed under the MIT license.

## Known limitations

- Firefox may require a local HTTP server for the best local-file experience.
- YouTube is the only provider-style remote video reference rendered as an embed; other HTTPS media remain links or native media URLs.
- Syntax highlighting uses a readable code theme but no language-aware highlighter, keeping generated output small and offline.
- Question-pool metadata is validated and preserved; deterministic pool selection/randomization is not yet applied by the reader.
- Essay responses are stored but not graded, as required by MCF 1.0 semantics.

## Toward MCF 1.1

Add support only after an official specification exists. Recommended work is to add version-keyed schemas and parser registries, conformance fixtures from the published standard, migrations for any changed runtime data, and feature negotiation for newly standardized activity/block types. Do not introduce vendor fields into MCF 1.0 source.

## License

MIT. Course authors retain rights under the license declared by each course package.
