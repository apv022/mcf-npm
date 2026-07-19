# Authoring MCF 1.0 courses

An MCF course is a portable directory of YAML metadata, `.mcf` lesson files, and optional local assets. The compiler uses the order declared in YAML; directory and filename sorting never determines course order.

## Package layout

```text
my-course/
├── manifest.yaml
├── assets/
│   └── images/
│       └── cover.svg
└── chapters/
    └── getting-started/
        ├── chapter.yaml
        └── lessons/
            └── 01-welcome.mcf
```

`assets/` is optional. Chapter directories must be under `chapters/`, and lesson files must use the `.mcf` extension. All source paths use forward slashes and must remain inside the course root, including after symbolic links are resolved.

Identifiers for courses, chapters, lessons, activities, questions, and options must match `[a-z][a-z0-9._-]*`. Chapter IDs are unique within a course; distinct lesson files use unique lesson IDs; activity and question IDs are unique within a lesson; option IDs are unique within a question.

## Course manifest

`manifest.yaml` declares course metadata and chapter order:

```yaml
mcf: '1.0'
id: my-course
title: My Course
language: en
description: A short course description.
authors:
  - Course Author
license: CC-BY-4.0
version: '1.0.0'
cover: assets/images/cover.svg
chapters:
  - source: chapters/getting-started
```

Required fields are `mcf`, `id`, `title`, `language`, and a non-empty `chapters` list. This compiler accepts exactly `mcf: '1.0'`. `description`, `authors`, `license`, `version`, and `cover` are optional. A cover may be a validated local path or an HTTP(S) URL.

The course `version` participates in the browser-storage key. Change it when a release should use a fresh progress record instead of reopening state from an older course build.

## Chapter metadata

Each chapter directory contains `chapter.yaml`:

```yaml
id: getting-started
title: Getting Started
description: Orientation and first steps
lessons:
  - lessons/01-welcome.mcf
```

`id`, `title`, and a non-empty ordered `lessons` list are required. `description` is optional. Lesson paths are relative to the chapter directory.

## Lesson files

A lesson starts with YAML frontmatter and contains one or more activity containers:

```markdown
---
id: welcome
title: Welcome
description: Introduces the course.
authors:
  - Course Author
license: CC-BY-4.0
---

:::mcf-activity
type: notes
id: welcome-notes
title: Learn
:::

# Welcome

Lesson content uses Markdown.

:::mcf-end
```

Lesson `id` and `title` are required. `description`, `authors`, and `license` are optional. Apart from comments and whitespace, all lesson-body content must be inside a correctly closed activity container.

### Activities

Supported activity types are `notes`, `practice`, and `assessment`.

```markdown
:::mcf-activity
type: assessment
id: final-check
title: Final check
passing_score: 0.8
randomize: true
question_pool_size: 5
:::

Assessment introduction and questions go here.

:::mcf-end
```

Every activity requires `type` and `id`; `title` is optional. `passing_score` is an optional number from `0` through `1` and is valid only for assessments. `randomize` and positive-integer `question_pool_size` are valid only for practice and assessment activities. A pool cannot be larger than the activity's question count. The selected question order is persisted for each learner.

Notes are completed explicitly with the reader's **Mark notes complete** action. Required practice questions must be answered correctly. Assessments require responses for all selected required questions and complete when submitted; passing and completion remain separate states.

## Questions

Questions are YAML inside a fenced `mcf-question` block within an activity:

````markdown
```mcf-question
id: slope
type: multiple_choice
prompt: What is the slope of $y=3x+2$?
options:
  - id: one
    text: '1'
  - id: three
    text: '3'
answer: three
points: 1
required: true
hint: Look at the coefficient of $x$.
explanation: The coefficient of $x$ is the slope.
```
````

All questions require `id`, `type`, and `prompt`. `points` defaults to `1` and must be non-negative. `required` defaults to `true`. `hint` and `explanation` are optional rich content.

| Type              | Required answer shape                 | Additional fields                              |
| ----------------- | ------------------------------------- | ---------------------------------------------- |
| `multiple_choice` | One option ID                         | Non-empty `options`                            |
| `multiple_select` | Non-empty list of distinct option IDs | Non-empty `options`                            |
| `true_false`      | YAML boolean `true` or `false`        | None                                           |
| `numeric`         | Finite number                         | Optional non-negative absolute `tolerance`     |
| `short_answer`    | String                                | Compared after trimming and case normalization |
| `essay`           | No objective `answer`                 | Optional completion criteria                   |

Essay completion fields are positive integers `minimum_words`, `minimum_sentences`, and `minimum_keywords`, plus a non-empty distinct `keywords` list. `minimum_keywords` requires `keywords` and cannot exceed the list length. If keywords are supplied without `minimum_keywords`, all listed keywords are required. Essays are completion-checked but never automatically scored as correct.

## Rich content, math, and media

Activity content, prompts, options, hints, and explanations support CommonMark, GFM tables, fenced code, links, images, inline math with `$...$`, and display math with `$$...$$`. KaTeX renders math at compile time, and the compiler copies its stylesheet and fonts into every course.

Local Markdown references resolve relative to the lesson file:

```markdown
![Graph](../../../assets/images/graph.svg)
[Reference notes](../../../assets/notes/reference.pdf)
```

Audio and video use the MCF media directive:

```markdown
@[audio](../../../assets/audio/example.mp3 'Audio description')
@[video](../../../assets/video/example.mp4 'Video description')
@[video](youtube:VIDEO_ID 'External video')
@[video](https://www.youtube.com/watch?v=VIDEO_ID 'External video')
```

Normal YouTube watch, share, embed, shorts, and live URLs are recognized. Remote media requires internet access. Under direct `file://` use, YouTube is presented as a thumbnail link; serve the compiled directory over HTTP for inline playback.

Raw HTML is sanitized. Scripts, event handlers, unsafe URL schemes, and paths outside the course package are rejected or removed. Course-authored JavaScript is never executed.

## Validate and compile

From this repository:

```bash
npm run mcf -- validate ./my-course
npm run mcf -- compile ./my-course --output ./courses
```

From the published package:

```bash
npx mcf-npm validate ./my-course
npx mcf-npm compile ./my-course --output ./courses
```

Compilation atomically replaces the directory matching the course ID and preserves other courses in the output library. Open `courses/index.html` directly or serve `courses/` with a static HTTP server.

For compact patterns, start with `examples/minimal`. Use `examples/showcase` for feature coverage and `examples/calculus-i` for a larger multi-chapter reference course.
