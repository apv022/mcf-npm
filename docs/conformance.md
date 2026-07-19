# MCF 1.0 conformance checklist

This checklist maps the implemented MCF 1.0 source-format requirements to code and verification. Reader UI behavior is intentionally listed separately from source-format conformance.

| Requirement                                                                   | Implementation                                         | Validation and tests                                                | Example                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| Course package, one `manifest.yaml`, `chapters/`, chapter and lesson packages | `src/parser.ts` package discovery                      | `test/validation.test.ts`, `test/parser.test.ts`                    | all valid examples                   |
| Manifest metadata and ordered chapter sources                                 | `Course` model and `parseCourse`                       | required/type/order tests                                           | showcase manifest uses every field   |
| Chapter metadata and ordered lesson paths                                     | `Chapter` model and `parseCourse`                      | package/order/missing-path tests                                    | showcase chapter uses every field    |
| Lesson frontmatter and activity-only body                                     | `parseLessonSource`                                    | frontmatter, boundary, malformed-container tests                    | minimal, showcase, calculus-i        |
| `notes`, `practice`, `assessment`; all activity fields                        | activity parser and `src/reader/player.ts`             | parser and Playwright behavior tests                                | showcase                             |
| CommonMark, tables, code, images, links, audio/video, YouTube                 | `src/render.ts`                                        | `test/rich-content.test.ts`, browser media checks                   | rich-content lesson                  |
| Inline/display LaTeX and fallback                                             | compile-time KaTeX renderer; compiler copies CSS/fonts | rendering and output-structure tests                                | rich-content lesson                  |
| `mcf-question` and six question types                                         | parser, model, renderer, reader question evaluator     | parser/question/browser tests                                       | questions lesson                     |
| Common fields, options, answers, tolerance, points, required                  | parser semantic checks and reader scoring              | parser, validation, question, browser tests                         | questions lesson                     |
| Essay structural completion                                                   | `src/reader/essays.ts`                                 | deterministic word/sentence/keyword unit tests and browser feedback | assessment essay                     |
| Identifier syntax and scoped uniqueness                                       | parser validators                                      | parser and validation tests                                         | valid and generated invalid fixtures |
| Forward-slash paths, resolution, real containment, existence                  | parser lexical and real-path checks                    | traversal/missing-file/missing-asset tests                          | invalid fixtures                     |
| Exact version and declared ordering                                           | parser                                                 | unsupported-version and order tests                                 | all valid examples                   |
| Actionable diagnostics/nonzero CLI failure                                    | `ValidationError`, `src/cli.ts`                        | validation suite and CLI verification                               | invalid fixtures                     |

## Reader implementation behavior

The generated reader uses correctness-gated practice, delayed assessment submission/scoring, explicit notes completion, completed-lessons progress, a non-credential badge, and schema-validated JSON progress transfer. `randomize` and `question_pool_size` select and persist a learner-specific question order. Assessment essays must meet completion criteria but contribute neither earned nor possible automatic points. Optional objective questions enter the score only when answered. Assessment completion means a valid submission and remains distinct from pass/fail.
