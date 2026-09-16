# AGENTS.md

This project ships Rayfin agent context.
Load `.agents/skills/rayfin/SKILL.md` and the `rayfin` MCP server in `.mcp.json` before writing Rayfin code.

Rayfin docs are version-locked to the packages installed in this project.
Prefer the MCP tools `search_docs`, `get_doc`, `list_docs`, and `discover_packages` for examples, API details, and troubleshooting.
If MCP is unavailable, run `rayfin docs ...` from the project root so the CLI reads this project's `node_modules`.
If `rayfin` is not on `PATH`, use `npx -y @microsoft/rayfin-cli docs ...` from the project root.

Use `discover_packages` or `rayfin docs discover <topic>` when installed docs do not cover the task.

## Project

Ray|Live is a React + TypeScript (Vite) live audience interaction app ("Slido replacement") backed by **Rayfin**,
styled with Tailwind CSS v4. Presenters create rooms, run polls and quizzes, and moderate Q&A;
the audience answers from a share link; live results are projected or embedded in a slide deck.
Auth is presenter-only: local dev uses a mock email/password flow, production uses Fabric Entra SSO.

**Anonymous data access is enabled** via the unsupported `anonymous-data-access` CLI feature flag,
so the audience participates without signing in. All `rayfin up` / `db apply` runs must set
`RAYFIN_FEATURE_FLAGS=anonymous-data-access` (the `dev`, `rayfin:up`, and `rayfin:db` npm scripts do
this) or the command fails with `AnonymousAccessBlockedError`. `@anonymous()` is imported from
`@microsoft/rayfin-core/experimental`. See "Security model" in `README.md` before changing permissions.

## Repo map

- `rayfin/data/` – Entities (`Room`, `Question`, `Vote`, `Activity`, `ActivityOption`, `Answer`),
  exported from `schema.ts`
- `src/pages/` – HomePage (dashboard), ManagePage (console), AudiencePage, PresentPage
- `src/hooks/useLiveRoom.ts` – Polling hook backing every live surface
- `src/lib/aggregate.ts` – Pure tallying and quiz scoring (unit-tested, no Rayfin imports)
- `src/services/` – Data access, voter/participant identity, client bootstrap
- `src/components/` – Activity builder, answer forms, result visuals, leaderboard, QR, auth

## Presenter controls

`src/lib/runOrder.ts` resolves the run order (`nextActivity`, `previousActivity`,
`activationMode`, `canStartPrepared`) and `useRoomControls` turns it into actions. The control bar,
the keyboard shortcuts, and the remote all go through that one hook — add actions there, not in a
page, so the surfaces cannot drift apart. Quizzes are *prepared* before they start.

Gate any presenter affordance on `currentUserIdOrNull() === room.owner_id`, never on
`isSignedIn()` alone. Keyboard shortcuts go through `useShortcuts`, which ignores modifiers and
anything typed into a field.

## Theming

Rooms store three colours (`themeBackground`, `themeText`, `themeAccent`) plus `themePreset`.
`src/lib/theme.ts` resolves them with fallbacks and emits `--ia-bg` / `--ia-text` / `--ia-accent`;
`main.css` mixes the rest (`--ia-surface`, `--ia-muted`, `--ia-border`, `--ia-accent-soft`) with
`color-mix()`. Themed surfaces carry `data-ia-theme`; `:root` holds light defaults so the
unthemed console still renders. Style audience/present components with those variables, never
hardcoded `gray-*`/`blue-*`.

New columns added to existing tables must be `optional` (old rows have no value) — read them
defensively, e.g. `room.qnaEnabled !== false` and `room.showJoinInfo !== false`.
`room.brandTitle` falls back to the Ray|Live wordmark.

Keep the audience and projected views responsive: no horizontal overflow at 390 / 768 / 1280 px,
44 px minimum tap targets, and `clamp()` for stage typography so it reads on a laptop and a
projector.

## Activities

A room contains a Q&A feed plus ordered activities: `multipleChoice`, `wordCloud`, `rating`,
`openText`, `ranking`, `quiz`. Each moves through `draft → live → ended` and **at most one is
live per room** — `goLive()` ends the previous one, which is what lets the projected view
follow the presenter with no extra coordination state. See `SPEC.md`.

## Routing

- `/auth` – Public sign-in page (presenters only)
- `/` – Presenter dashboard (guarded)
- `/manage/:code` – Console: activities, Q&A moderation, leaderboard, sharing (guarded)
- `/r/:code` – **Public** audience view, no auth guard; falls back to Q&A only when
  `Room.qnaEnabled` is not `false`
- `/present/:code` – **Public** live results; `?embed=1` for iframes, `?hideAnswered=1` to
  filter answered questions, `?leaderboard=1` to project quiz standings. Shows the presenter
  control bar and keyboard shortcuts **only** when the signed-in owner is viewing and not embedded
- `/control/:code` – Phone remote (guarded, owner-only)

## Conventions and version-locked gotchas

- Always set `max` on `@text()` — unbounded `NVARCHAR(MAX)` breaks GraphQL schema generation on MSSQL.
- Policies cannot traverse relationships, so `owner_id` and `room_id` are denormalized onto every child.
- The policy DSL exposes only the `sub`, `email`, and `role` claims, with `eq`/`neq`/`and`/`or`.
  The method is `.neq()` even though it serialises to `ne`.
- `@role()` takes `policy: (claims, item) => ...`. The guide's `check` is the inner `PolicyOptions`
  shape, not the decorator option.
- The fluent client has no `count()`. All tallies live in `src/lib/aggregate.ts`;
  never denormalize a counter that anonymous callers could forge.
- There are no realtime subscriptions. Live views poll (`useLiveRoom`), pausing while the tab is hidden.
- **Never write a field the caller cannot read back.** `create`/`update` build their GraphQL
  selection set from the *input keys* (`getDefaultFields`), so writing a field that is `exclude`d
  from the caller's read permission fails with `AUTH_NOT_AUTHORIZED`. This is why
  `Answer.participantKey` and `Vote.voterKey` are readable by anonymous callers.
- Anonymous callers cannot read back rows they just wrote when they have *no* read permission at
  all. Ids are generated client-side and writes go through `createTolerantly` in
  `src/services/rayfinWrite.ts`.
- Anonymous callers cannot update or delete. Upvotes are final, and changing an answer means
  writing a **new submission**: rows share a `submissionId`, and `latestSubmissions()` keeps only
  each participant's newest one. Never try to update or delete an answer as the audience.
- Always tally through `tallyAnswers(activity, answers)` rather than raw rows, so changed answers
  are superseded — except word clouds and open text with `allowMultiple`, which intentionally
  accept several entries per person (that helper already handles it).
- Only the presenter can delete answers (`clearAnswers`), which is the reset-after-rehearsal path.
- **Field-level `exclude` is static.** It cannot depend on row state, which is why revealing quiz
  answers copies `isCorrect` into the public `revealedCorrect` rather than relaxing a policy.
- Never select a field an anonymous caller cannot read — currently only
  `ActivityOption.isCorrect`. Even filtering on it fails with "Access forbidden to a field
  referenced in the filter".
- Quiz scoring and leaderboards run on the presenter's screen, because only the owner can read
  the answer key.
- **Never render from `isCorrect`.** The projected `/present` view runs in the presenter's
  signed-in session, so `isCorrect` is fetched there — using it to highlight an option printed the
  answer key on the wall. Results show correctness only via `revealedCorrect`
  (`showsCorrectness` in `src/lib/quiz.ts`).
- Quiz timing rules live in `src/lib/quiz.ts`: `isPreparing`/`isRunning` (a prepared quiz is
  `state === 'live'` with `isPrepared`, collecting nicknames without showing the prompt),
  `remainingMs`, `isExpired`, `canAnswer`, and `showsDistribution` (a running quiz hides its
  distribution). The deadline is enforced in `submitAll` as well as the UI — it is a fairness aid,
  not a security boundary, since no policy can express it.
- Ranking uses `@dnd-kit` because the HTML5 drag-and-drop API never fires on touch. Keep the
  ↑/↓ buttons and the `touch-none` drag handle; the pure reorder lives in `src/lib/reorder.ts`.
- Lists that re-sort (ranking, leaderboard, stage Q&A) animate with `useFlipList`; a CSS
  transition cannot animate a DOM order change. Call the hook unconditionally — extract a
  component rather than placing it after an early return.
- Delete children before parents: votes → questions → room, and answers → options → activity.
- Data services always use the real backend; do not reintroduce the template's in-memory fallback,
  which would break multi-device sync (the whole point of the app).
- Schema changes need `npm run rayfin:up` to reach the deployed app.
