# interask

A live audience interaction app — a Slido-style replacement built on [Rayfin](http://aka.ms/rayfin/docs).

Run **Q&A**, **live polls** (multiple choice, word cloud, rating, open text, ranking), and
**interactive quizzes** with a leaderboard. The audience opens a short link — or scans a QR
code — and answers from their phone. The presenter drives everything from a console and
projects the live results, full-screen or embedded straight into a slide deck as an iframe.

**No sign-in for the audience.** Only presenters authenticate.

See [`SPEC.md`](./SPEC.md) for the full feature specification.

## Getting started

```bash
# Start the local backend and dev server
npm run dev

# As needed, apply database migrations (one time, when running locally)
npm run rayfin:db
```

Open [http://localhost:5173](http://localhost:5173), sign in, and create a room.

## How it works

| Route | Auth | Purpose |
| --- | --- | --- |
| `/` | Presenter | Dashboard: create rooms, get share links, delete rooms |
| `/manage/:code` | Presenter | Console: build and run activities, moderate Q&A, see the leaderboard |
| `/control/:code` | Presenter | Phone remote: drive the room from your pocket |
| `/r/:code` | **Public** | Audience view: answer the live activity, ask questions, upvote |
| `/present/:code` | **Public** | Live results for projection or embedding |

### Activities

A room holds an ordered list of **activities**, plus an optional Q&A feed you can switch on or
off per room. Prepare activities before the talk or add them live.

| Type | Audience does | Results show |
| --- | --- | --- |
| Multiple choice | Picks one or several options | Bars with counts and percentages |
| Word cloud | Sends a short answer | Repeated answers grow larger |
| Rating | Picks 1–N stars | Average plus distribution |
| Open text | Writes a longer answer | Live list, moderatable |
| Ranking | Drags options into order (or uses ↑/↓) | Borda count standings, animated |
| Quiz | Answers against an enforced timer | Distribution after the question closes, then the answer on reveal, plus a leaderboard |

Quizzes add a **Prepare** step: attendees join and pick a nickname while the projector shows a
"get ready" screen, and the question itself stays hidden until you hit **Start question**. Once
the timer runs out the form closes, and the correct answer only appears when you choose
**Reveal answers** — it is never shown on the projector before that.

Each activity moves through `draft → live → ended`. **At most one is live at a time**, and the
projected view follows it automatically — so running a talk is just "Go live" on the next one.
Drafts are invisible to the audience, so upcoming quiz questions never leak.

### Running a session

The projected view doubles as the presenter's cockpit: when the **owner** is signed in, a control
bar appears (never on a projected or embedded copy) with keyboard shortcuts.

| Key | Action |
| --- | --- |
| `→` `space` `n` | Next activity |
| `←` `p` | Previous activity |
| `Enter` | Start a prepared question, or open the next one |
| `e` | End the current activity |
| `r` | Reveal quiz answers |
| `j` | Show or hide the join info and QR |
| `l` | Toggle the leaderboard |
| `?` | Shortcut help |

"Next" prepares quizzes first so attendees can pick a nickname, then `Enter` starts the clock.

The console also offers a QR for `/control/:code`, a thumb-sized remote for your phone. It is
**owner-only**: sign-in on a phone goes through the Fabric Portal handoff tab, which is fiddlier
than in the portal itself — if it gives you trouble, use the on-screen control bar instead.

### Branding

Each room can carry its own **title** in place of the interask wordmark, alongside its colours —
both live in the console under "Branding & theme". The join link, QR, and code can be hidden live
(`j`) once everyone is in the room.

### Embedding in a slide deck

The manage page gives you a ready-made snippet:

```html
<iframe src="https://<your-app>/present/<code>?embed=1" width="100%" height="600"></iframe>
```

- `?embed=1` drops the outer chrome so the view fits inside a slide.
- `?hideAnswered=1` removes questions you have already covered.
- `?leaderboard=1` projects the quiz leaderboard instead of the live activity.

Works in any deck that accepts an HTML embed (reveal.js, Slidev, PowerPoint web objects, …).

### "Live" means polling

This Rayfin version has no realtime subscriptions, so the live views poll every 3 seconds.
Polling pauses while the tab is hidden and catches up immediately when it becomes visible
again — see `src/hooks/useLiveRoom.ts`.

## ⚠️ Security model — read this first

> **Audience members do NOT sign in.** Anyone with the room code can ask and upvote.
> Authentication is required only for presenters who create and moderate rooms.

This depends on an **unsupported CLI feature flag**, exactly like the `forms` sample.

### Anonymous access requires a feature flag

By default the Rayfin CLI **refuses** to apply any configuration granting the `anonymous`
role: `rayfin up db apply` throws `AnonymousAccessBlockedError`. The `@anonymous()` decorator
ships only from `@microsoft/rayfin-core/experimental`, and the stable `role()` export accepts
`'authenticated'` only.

The block is skipped when the `anonymous-data-access` flag is set:

```bash
RAYFIN_FEATURE_FLAGS=anonymous-data-access npx rayfin up
```

The `npm run dev`, `npm run rayfin:up`, and `npm run rayfin:db` scripts set it for you.
**Commands without it will fail** while the anonymous decorators are present.

That flag's own source describes it as a **contributor-only escape hatch for internal test
infrastructure**. Consequences you are accepting:

- It is unsupported and may change or disappear in any Rayfin upgrade.
- It disables the guard for the whole configuration, not per entity.

To drop the trade-off, remove the `@anonymous(...)` decorators from `rayfin/data/*.ts` and the
flag from the npm scripts. Every attendee then has to sign in.

### Permissions

| Entity | anonymous | authenticated |
| --- | --- | --- |
| `Room` | `read` while the room is open | Owner CRUD; `create` binds `owner_id` to the caller |
| `Question` | `create`, and `read` while not hidden | Owner moderates (update/delete); owner also reads hidden ones |
| `Vote` | `create`, `read` | Owner read and delete |
| `Activity` | `read` only once it leaves `draft` | Owner CRUD |
| `ActivityOption` | `read` **excluding `isCorrect`** | Owner CRUD |
| `Answer` | `create`, `read` of non-hidden rows | Owner read/update/delete |

`participantKey` and `voterKey` are deliberately readable: a `create` mutation selects back every
field it writes, so excluding a field you also write makes the write fail. They are random
pseudonymous ids, not credentials.

Ending a room removes it — and therefore its questions — from anonymous reads entirely.
Hiding a question drops it from anonymous reads server-side, so moderation is enforced by
policy rather than by the UI.

**The quiz answer key never reaches an attendee.** `isCorrect` is excluded from anonymous
reads, so scoring and the leaderboard are computed on the presenter's screen. Revealing
answers copies the key into a separate public `revealedCorrect` field — field visibility is
static and cannot depend on activity state, which is exactly why the reveal needs its own
field.

### What the room code does *not* protect

**The code is not an access boundary.** Permissions are per-entity, not per-row-secret, so
anyone can query the GraphQL endpoint directly to list every **open** room and its questions,
or post to any open room they can name. There is no captcha or rate limiting, so spam and
ballot-stuffing are possible.

Vote de-duplication uses a browser-local `participantKey` (`src/services/identity.ts`). It stops
accidental double-voting, not a determined participant clearing storage. Quiz timings
(`elapsedMs`) are client-supplied and therefore forgeable — fine for a friendly quiz, not for
anything that matters.

## Data model

Six entities in `rayfin/data/`:

- **`Room`** — one talk. `code` is the short slug in share links. `isOpen` ends the room;
  `qnaEnabled` turns the Q&A feed on or off entirely; `isAcceptingQuestions` pauses new questions
  while keeping results on screen; `theme*` holds the room's colours.
- **`Question`** / **`Vote`** — the Q&A feed. Vote totals are aggregated **client-side**:
  the fluent client has no `count()`, and a denormalized counter would be forgeable.
- **`Activity`** — one poll or quiz question, with its `kind`, `state`, and per-kind settings
  (`maxRating`, `timeLimitSeconds`, `allowMultiple`, `showResults`).
- **`ActivityOption`** — a selectable choice. `isCorrect` is the quiz answer key, hidden from
  the audience; `revealedCorrect` is its public counterpart.
- **`Answer`** — one row per participant per selected option or submission, so multi-select and
  ranking simply write several rows. Rows of one submission share a `submissionId` so a changed
  answer supersedes the previous one.

`owner_id` and `room_id` are denormalized onto every child entity because policies cannot
traverse relationships.

### One answer per person

Attendees are identified by a browser-local `participantKey` (`src/services/identity.ts`).
Anonymous callers can only **create**, never update or delete, so changing an answer writes a
**new submission** instead: every row of one submission shares a `submissionId`, and tallies keep
only each participant's newest submission.

Turn on **"Let people change their answer"** on an activity to expose a *Change my answer* button;
leave it off and the form locks once answered. Word clouds and open text set to allow multiple
entries are exempt — there, several submissions from one person all count.

Upvotes remain final: there is no un-voting.

## Theming

Every room carries its own colours so the projected view can match your slide deck. The console
offers presets — Midnight, Daylight, Ocean, Sunset, Forest, High contrast — plus custom pickers
for background, text, and accent, with a live preview and a **WCAG contrast warning** so the
result stays readable on a projector.

Only those three colours are stored; surfaces, borders, and muted text are derived with
`color-mix()` in `src/main.css`, so light and dark themes work from a single triple.

## Project structure

```text
├── rayfin/
│   ├── rayfin.yml           # Fabric service configuration
│   └── data/
│       ├── Room.ts          # Room entity: share code, open/paused state, owner policies
│       ├── Question.ts      # Q&A questions with moderation flags
│       ├── Vote.ts          # Q&A upvotes (tallied client-side)
│       ├── Activity.ts      # Polls and quiz questions, draft/live/ended
│       ├── ActivityOption.ts# Choices; isCorrect hidden from the audience
│       ├── Answer.ts        # Submitted answers, one row per selection
│       └── schema.ts        # Schema export consumed by the typed client
├── src/
│   ├── App.tsx              # Routes: presenter routes guarded, audience routes public
│   ├── components/
│   │   ├── ActivityAnswerForm.tsx  # Audience input for every activity kind
│   │   ├── ActivityBuilder.tsx     # Presenter's activity editor
│   │   ├── ActivityResults.tsx     # Result visuals, themed for console or stage
│   │   ├── Leaderboard.tsx         # Quiz standings
│   │   ├── QuizTimer.tsx           # Countdown for timed questions
│   │   └── AuthPage, QrCode, CopyButton
│   ├── hooks/
│   │   ├── AuthContext.tsx  # React context wrapping the auth helpers
│   │   └── useLiveRoom.ts   # Polling hook powering every live surface
│   ├── lib/
│   │   ├── aggregate.ts     # Pure tallying and quiz scoring, fully unit-tested
│   │   └── theme.ts         # Presets, CSS variables, WCAG contrast
│   ├── pages/
│   │   ├── HomePage.tsx     # Presenter dashboard
│   │   ├── ManagePage.tsx   # Console: activities, Q&A, leaderboard, sharing
│   │   ├── AudiencePage.tsx # Public answer & ask view
│   │   └── PresentPage.tsx  # Public live results (embeddable)
│   └── services/
│       ├── rooms.ts         # Room CRUD and share-code lookup
│       ├── activities.ts    # Activity CRUD and lifecycle (go live, end, reveal)
│       ├── answers.ts       # Answer submission and retrieval
│       ├── questions.ts     # Q&A questions, votes, and tally
│       ├── identity.ts      # Browser-local participant key, nickname, and memory
│       ├── rayfinWrite.ts   # Tolerates the anonymous write-then-read denial
│       ├── rayfinClient.ts  # Typed Rayfin client singleton
│       └── bootstrap.ts     # Reads env, picks the right auth service
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the local backend and dev server |
| `npm run build` | Production build |
| `npm run build:fabric` | Build for Fabric deployment |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run unit tests with Vitest |
| `npm run rayfin:up` | Deploy to Fabric (sets the anonymous-access flag) |
| `npm run rayfin:db` | Apply database migrations (sets the anonymous-access flag) |
