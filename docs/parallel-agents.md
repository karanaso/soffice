# Parallel editor agents

Five OpenCode agents are defined in `.opencode/agents/`:

| Agent | Owns | Use for |
| --- | --- | --- |
| `word-dev` | `app/features/word/**`, `lib/features/word/**`, `e2e/word/**`, `public/word/**` | Rich-text editing, Word content model, Word tests |
| `excel-dev` | `app/features/excel/**`, `lib/features/excel/**`, `e2e/excel/**`, `public/excel/**` | Grid, cells, formulas, Excel tests |
| `powerpoint-dev` | `app/features/powerpoint/**`, `lib/features/powerpoint/**`, `e2e/powerpoint/**`, `public/powerpoint/**` | Slides, canvas, layouts, PowerPoint tests |
| `drawing-dev` | `app/features/drawing/**`, `lib/features/drawing/**`, `e2e/drawing/**`, `public/drawing/**` | Canvas, tools, strokes, Drawing tests |
| `shared-dev` | Shell, routing, storage, API, migrations, dependencies, design system, Docker, shared tests | Cross-cutting work and feature integration |

All five use `mode: all`, so they can be selected as a primary agent or launched as subagents. Each has edit permissions scoped to its ownership area; the boundary is also enforced by its system prompt.

## Feature registration boundary

The boundary exists in this change:

- Each feature exports one editor component from `app/features/<type>` (`WordEditor`, `ExcelEditor`, `PowerPointEditor`, `DrawingEditor`) with the shared `EditorProps`.
- Each feature exports a pure content codec from `lib/features/<type>/content.ts` (`wordCodec`, `excelCodec`, `powerpointCodec`, `drawingCodec`).
- `shared-dev` owns the host in `app/components/EditorSurface.tsx`, the codec registry in `lib/content/registry.ts`, the content API, migrations, and save orchestration in `app/lib/use-document-content.ts`.
- `docs/editor-contract.md` is the frozen interface: props, codec rules, and the paths each agent may edit.

Feature agents still must not edit shared files or migrations. A feature that needs a new prop, schema, dependency, or API reports it to `shared-dev` instead of editing the host.

## Shared integration sequence

1. `shared-dev` lands the content contract, migration, repository/service/API, hook, and shell save status.
2. The four feature agents build their codec, editor, tests, and e2e spec in parallel worktrees.
3. `shared-dev` merges the branches, wires the codecs into `lib/content/registry.ts` and the editors into `EditorSurface.tsx`, then runs the full suite.

The content API is `GET/PUT /api/documents/<id>/content`. Payloads are validated by the document type's codec, capped at 1 MiB, and saved with a revision check that returns `409 content_conflict` instead of overwriting a newer revision.

## Worktree workflow

Use one worktree and one branch per agent task. From the parent session:

```text
Use the office worktree tools to create a worktree for each independent task, then launch word-dev, excel-dev, powerpoint-dev, and drawing-dev in parallel. Ask shared-dev to prepare the shared migration and registration changes after their interfaces are known. Do not merge anything; report branches and commits.
```

For a single agent:

```text
Launch word-dev in its own worktree on the Word editor implementation. It should work only in that worktree, run its scoped tests, and report the branch and commit.
```

The agents follow this protocol when the parent asks for parallel or worktree work:

1. Create an OpenCode worktree (`tools.opencode.worktree_create`) and move the session into it (`tools.opencode.session_move`), or use `git worktree add` under `/tmp/opencode/`.
2. Use a branch named `agent/<type>-<slug>`.
3. Edit and test only inside that worktree.
4. Commit; do not merge or push unless asked.
5. Report path, branch, commit, tests, and shared changes needed.

## Shared-change handoff

Feature agents must not edit shared files or migrations. When one needs a shared change, it reports:

- the exported component/props interface it expects;
- any schema it needs, including SQLite and PostgreSQL implications;
- any dependency it needs;
- the shared integration point and test that should be added.

`shared-dev` owns the migration, dependency, registry, and integration work, then the parent can merge feature branches in any order after the shared interface lands.

## OpenSpec

Each agent checks for an active OpenSpec change before writing feature code. If none exists, it proposes one and stops. During implementation it uses the apply workflow and keeps task checkboxes accurate. Main specs are changed only through OpenSpec sync/archive, never by hand.
