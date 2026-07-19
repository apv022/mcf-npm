# mcf-npm

`mcf-npm` is the reference Node.js/NPM compiler for **MCF 1.0 — Modular Curriculum Format**. It validates a human-readable MCF source package and compiles it into a polished static course that learners can copy, download, and open directly in a browser.

MCF is the source-format standard. This project is one compiler implementation. Its static reader, navigation, grading UI, browser storage, progress, badges, and output layout are implementation features—not requirements added to MCF.

## Install and use

Node.js 20 or newer is required to compile a course. Learners do not need Node.js.

```bash
npm install
npm run build
npm run mcf -- validate examples/minimal
npm run mcf -- compile examples/minimal
npm run mcf -- compile examples/minimal --output ./courses
```

Replace `examples/minimal` with the path to your own MCF package. The `npm run mcf -- ...` form is the recommended repository workflow because it requires no global installation or administrator permissions.

If you want a bare `mcf` command while developing, `npm link` creates a global link. That optional command needs write access to NPM's global prefix and may fail with `EACCES` on system-managed Node.js installations. Prefer the command above, configure a user-owned NPM prefix, or use a Node version manager; do not run project installation commands with `sudo`. Published-package users can also run the CLI with `npx mcf-npm`.

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
- official essay completion criteria: minimum words, minimum sentences, whole-word or normalized-phrase keywords, and minimum keyword count;
- assessment-only `passing_score` plus persisted `randomize` and `question_pool_size` selection;
- rich prompts, options, hints, and explanations;
- identifier uniqueness, answer references, required/type constraints, existing local assets, forward-slash paths, and course-root containment.

Raw source HTML is sanitized. Course-authored scripts are never executed, dangerous URL schemes are removed, and local references cannot escape the package root.

## Progress model

Progress is JSON in `localStorage` under `mcf:<course-id>:<course-version>`. Selected and written responses, question completion and correctness, activity completion, lesson completion, course completion time, and badge state derive from that record.

- Notes complete when the learner selects **Mark notes complete**.
- Practice questions complete only after a correct response; learners may retry and reveal hints.
- Assessments complete after a valid submission. They reveal score/pass state and explanations only after submission.
- A lesson completes when all its activities complete.
- Course progress is completed lessons divided by total lessons.
- At 100%, the reader shows a clearly non-credential completion badge.

Essay completion follows MCF exactly: words are whitespace-delimited; sentences are punctuation-terminated segments plus a final non-empty fragment; single-word keywords use case-insensitive whole-word matching; phrases use normalized consecutive text. Criteria establish completion, never correctness.

Assessment scores include points for selected objective questions. Essays are excluded from earned and possible automatic points. Optional objective questions enter the score only when answered. Completion and passing are stored separately.

**Export progress** downloads validated JSON. **Import progress** accepts only schema version 1 data matching the current course ID and version with the expected object structure. Browsers do not write learner state into compiler-generated `course.json` or `courses.json`.

## Examples

```bash
npm run compile:examples
```

- `examples/minimal` is the smallest useful valid package.
- `examples/showcase` covers every activity and question type, Markdown, math, images, audio/video declarations, a remote embed, feedback, progress, and completion.

The showcase includes original SVG artwork and CC0 audio/video samples from MDN's interactive examples.

## Development

```bash
npm test
npm run build
npm run lint
npm run format:check
npm run compile:examples
npm run test:browser
```

Tests cover package/YAML and lesson parsing, activity boundaries, all question types, essay criteria, answer validation, path traversal and symlink containment, sanitized rendering, offline KaTeX assets, library preservation, and end-to-end compilation. Playwright exercises the compiled reader directly through `file://`, including retry behavior, assessments, persistence, completion, media, and progress transfer. CI installs Chromium, runs both suites, and compiles both examples on Node.js 22.

See [Architecture](docs/architecture.md) for module boundaries and data flow and the [MCF 1.0 conformance checklist](docs/conformance.md) for requirement-level coverage. Contributions should include focused tests, keep dependencies limited, preserve MCF ordering and semantics, and distinguish standard conformance from reader behavior. By contributing, you agree that your changes may be distributed under the MIT license.

## Known limitations

- Firefox may require a local HTTP server for the best local-file experience.
- YouTube is the only provider-style remote video reference rendered as an embed; other HTTPS media remain links or native media URLs.
- Syntax highlighting uses a readable code theme but no language-aware highlighter, keeping generated output small and offline.
- Essay responses are stored but not graded, as required by MCF 1.0 semantics.

## Toward MCF 1.1

Add support only after an official specification exists. Recommended work is to add version-keyed schemas and parser registries, conformance fixtures from the published standard, migrations for any changed runtime data, and feature negotiation for newly standardized activity/block types. Do not introduce vendor fields into MCF 1.0 source.

## License

MIT. Course authors retain rights under the license declared by each course package.
