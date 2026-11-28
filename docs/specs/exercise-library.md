# Exercise library with muscle diagrams

Owner decision (Hoan): admins get a personal exercise library (built-in catalog plus their own exercises). Each exercise shows the muscles it works on a front/back body diagram. The training-note form ("Ghi chú tập") picks exercises from the library with search and a muscle filter. No Jira ticket for this one.

## Decisions

1. Built-in catalog: free-exercise-db by yuhonas (Unlicense, public domain), 876 exercises. `scripts/build-exercise-catalog.ts` converts the source JSON into `features/exercise-library/constants/catalog.json` (id, name, primary, secondary, equipment, category, level, instructions, first image path). The file is server-only: only `services/exercise-catalog.ts` (`import "server-only"`) imports it. No database seeding; built-ins are read-only static data.
2. Muscle groups: fixed const of 17 keys (`abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower_back, middle_back, neck, quadriceps, shoulders, traps, triceps`). Used by Zod, the diagram and the filter chips. Labels live in `messages/{vi,en,zh}/exerciseLibrary.json`.
3. DB (additive): table `exercise_library` and nullable column `admin_training_note_items.exercise_ref` ("b:<builtinId>" or "c:<customId>"). Old rows keep null.
4. Diagram: own SVG component `MuscleDiagram`; polygon data is a plain TS file (`constants/muscle-paths.ts`) vendored from react-body-highlighter 2.0.5 (MIT, notice kept in the file), mapped to our 17 keys. Reusable later with react-native-svg.
5. Custom photos are resized in the browser (WebP, long side 800 px, about 150 KB), stored in the DB and served by `GET /api/exercises/[id]/photo` behind `getApiAdmin()` and owner scoping. No Vercel Blob. Built-in images load from raw.githubusercontent.com with a lazy `<img>` (the app sets no CSP for pages, so nothing to adjust).
6. Free text keeps working in notes: a name that is not in the library is saved with `exercise_ref = null`.

## Database

```
exercise_library
  id integer pk autoincrement
  admin_id integer not null -> admins.id
  name text not null
  primary_muscles text not null default '[]'   -- JSON array of muscle keys
  secondary_muscles text not null default '[]'
  equipment text null
  instructions text null                        -- <= 2000 chars
  photo_mime text null, photo_width int null, photo_height int null,
  photo_data blob null, photo_size int null
  created_at, updated_at
  index exercise_library_admin_idx (admin_id)
admin_training_note_items.exercise_ref text null
```

Foreign keys are not enforced in production (D10), so deleting a custom exercise leaves note items untouched; a ref to a missing row reads as "no link" (the item keeps `exercise_name`).

## API (server actions in `features/exercise-library/services/exercise-actions.ts`)

Every action calls `requireAdmin()` first, validates with Zod and goes through `withResultErrorHandling`.

- `searchExercises({ q, muscle?, source?, limit })` -> `{ status: "success", rows }`. Searches built-ins plus the caller's custom rows. Name match is case- and accent-insensitive (`toNameKey`), every query word must appear. Order: custom first, then prefix matches, then substring matches, then name. Default limit 30, max 100. Row: `{ ref, name, primary, secondary, equipment, imageUrl }`.
- `getExercise(ref)` -> detail (adds instructions, category, level) or an error when missing or not owned.
- `createExercise(input)`, `updateExercise(id, input)`, `deleteExercise(id)`: custom only, scoped by `admin_id`; a missing or foreign id answers "not found". Photo: data URL string, `undefined` keeps, `null` removes.
- Note actions accept `exerciseRef` per item (`parseExerciseRef` validates the shape; a custom ref the admin does not own is stored as null).

## UI

- `/admin/exercises` ("Bài tập"): search, muscle chips, tabs "Của tôi" / "Thư viện", rows with name and muscle chips, detail sheet with large front/back diagram, form sheet for custom exercises. Tile on the admin home next to "Ghi chú tập".
- Note form: tapping the exercise name opens `ExercisePickerSheet` (vaul via `BottomSheet`): debounced search (200 ms), muscle chips, recent names when the query is empty, a "Dùng tên '<query>'" row for free text. Picking sets `exerciseName` and `exerciseRef`. Editing the name by hand afterwards clears the ref. `NoteCard` shows a mini diagram for items with a live ref.

## Test matrix

| Area | Test |
| --- | --- |
| Search ranking and normalization | `utils/__tests__/exercise-search.test.ts`: accents, case, multi-word, custom first, prefix before substring, limit, muscle filter |
| Muscle keys | `utils/__tests__/muscles.test.ts`: catalog names map to keys, unknown dropped, every key has a path |
| Ref | `utils/__tests__/exercise-ref.test.ts`: parse/format, rejects junk |
| Zod | `services/__tests__/exercise-schemas.test.ts`: limits, muscle enum, dedupe, search input |
| Owner scoping | `services/__tests__/exercise-actions.test.ts` with the in-memory DB: create/update/delete/get scoped to admin, missing rows, photo checks, search merges custom and built-in |
| Notes | `training-note-actions.test.ts`: ref saved and loaded, foreign custom ref dropped; `note-schema.test.ts`: ref parsing |
| Catalog | `services/__tests__/exercise-catalog.test.ts`: 876 entries, every muscle valid |

## Targets

The same feature on each platform. The shared contract is the row/detail shape above, the 17 muscle keys and the `b:`/`c:` ref.

### (a) Web production: this Next.js app

Server actions plus the photo route handler, as built here. Deploy needs only the additive `drizzle-kit push` (new table, new nullable column). The catalog ships inside the server bundle; images come from the public GitHub raw host.

### (b) Monorepo web app

`features/exercise-library` moves to a shared package: `muscles.ts`, `muscle-paths.ts`, `exercise-search.ts`, `exercise-ref.ts`, Zod schemas and the `MuscleDiagram` component are framework-free. The web app calls the REST API below through a thin client instead of server actions; the picker and library views keep their props (`rows`, `onPick`).

### (c) Expo mobile app on NestJS + TypeORM + PostgreSQL

REST (all behind the admin/PT JWT guard, owner-scoped by `adminId` taken from the token):

| Endpoint | Purpose |
| --- | --- |
| `GET /exercises?q&muscle&source&limit` | Same search as `searchExercises`; built-ins come from the bundled catalog (loaded once into memory at boot), custom rows from Postgres. |
| `GET /exercises/:ref` | `b:<id>` from the catalog, `c:<id>` from Postgres; 404 when missing or not owned. |
| `POST /exercises` | Create a custom exercise (multipart or base64 photo). |
| `PATCH /exercises/:id` | Update; `photo: null` removes. |
| `DELETE /exercises/:id` | Delete a custom exercise; note items keep their name. |
| `GET /exercises/:id/photo` | Photo bytes. In production prefer object storage (S3-compatible) with a signed URL instead of a bytea column. |

TypeORM entity `ExerciseLibrary`: `id serial`, `adminId int` (indexed, `ManyToOne(() => Admin)`), `name varchar(80)`, `primaryMuscles text[]` and `secondaryMuscles text[]` (native arrays instead of JSON text), `equipment varchar nullable`, `instructions text nullable`, photo metadata plus key/bytea, `createdAt`, `updatedAt`. The training note item entity gets `exerciseRef varchar nullable`. A `GET /exercises` response page of 30 rows keeps the picker fast on mobile data. Search uses `unaccent` + `ILIKE` (or `pg_trgm`) in Postgres, with the same ranking applied in SQL (`ORDER BY custom DESC, prefix DESC, name`).

Mobile: `muscle-paths.ts` plus `react-native-svg` (`Svg`, `Polygon`) render the same diagram, with fills from the app theme. The picker is a full-screen route (`/notes/pick-exercise`) with a search bar, muscle chips in a horizontal `FlatList`, recent names on top, a "use name" row, and `router.back()` with the chosen `{ name, ref }`. Offline: the catalog is bundled, so built-in search works without network; custom rows sync through the API.
