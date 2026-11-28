# Plan: exercise-library

## Source

- Intent: none (owner request in the project timeline: choose an exercise and search it while writing a training note)
- Spec: `docs/specs/exercise-library.md`
- KAN key: none (no Jira ticket for this one)

## Files that change

- `db/schema.ts`: table `exercise_library`, column `admin_training_note_items.exercise_ref` (additive).
- `scripts/build-exercise-catalog.ts`, `features/exercise-library/constants/catalog.json`: built-in catalog from free-exercise-db (Unlicense).
- `features/exercise-library/{constants,types,utils,services,hooks,components}`: muscle keys and paths, search and ref utils, schemas, queries, actions, `MuscleDiagram`, library view, detail and form sheets, picker sheet.
- `app/admin/(protected)/exercises/*`, `app/api/exercises/[id]/photo/route.ts`: page and photo route.
- `app/admin/(protected)/(home)/page.tsx`, `constants/routes.ts`: tile and route.
- `features/training-notes/*`: `exerciseRef` through schema, draft, actions, queries, `NoteItemFields`, `NoteFormSheet`, `NoteCard`.
- `messages/{vi,en,zh}/exerciseLibrary.json`, `errors.json`, `adminPages.json`, `trainingNotes.json`, `i18n/*`: copy.

## Order of work

1. Spec and plan (this commit).
2. Schema, catalog script and data, muscle keys and paths, pure utils with tests.
3. Schemas, queries, actions, photo route, with tests.
4. Library page, diagram, sheets, tile, messages.
5. Note integration: ref in schema/actions/queries, picker sheet, note card diagram.
6. `pnpm verify`, screenshots, push.

## Risks

- Large catalog: stays server-side; the client only gets 30-100 compact rows per search.
- Production DB: only an additive table and a nullable column.
- Ref to a deleted custom exercise: treated as no link, items keep their name.
- Built-in images depend on raw.githubusercontent.com; an `onError` fallback hides a broken image.

## Proof

- Vitest files listed in the spec's test matrix; `pnpm verify`.
- Browser: screenshots of the library, the detail sheet and the picker at 390x844.

## Deviations

None yet.
