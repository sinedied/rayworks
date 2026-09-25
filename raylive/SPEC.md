# Ray|Live — Specification

Live audience interaction for presentations: **Q&A**, **live polls**, and **interactive quizzes**.
A focused, self-hostable Slido alternative built on Rayfin.

Status: Q&A is built and deployed. Polls and quizzes are specified here and not yet implemented.

---

## 1. Goals

- A presenter prepares interactions **in advance**, or creates them **live** mid-talk.
- The audience joins with a short code or QR — **no sign-in, no app install**.
- Results update **live** and can be projected or **embedded in a slide deck**.
- Only presenters authenticate.

### Non-goals

Team/multi-presenter accounts, analytics export, approval-workflow moderation queues,
translations, per-attendee accounts, video/webinar integration.

---

## 2. Personas and surfaces

| Surface | Route | Auth | Purpose |
| --- | --- | --- | --- |
| Dashboard | `/` | Presenter | Create and manage rooms |
| Room console | `/manage/:code` | Presenter | Build activities, run them live, moderate Q&A |
| Audience | `/r/:code` | **Public** | Ask, vote, answer the active activity |
| Live view | `/present/:code` | **Public** | Projected/embedded results, plus owner-only controls |
| Remote | `/control/:code` | Presenter | Phone remote for driving the room |

---

## 3. Core model: rooms and activities

A **Room** is one talk. It contains an always-available **Q&A** feed plus an ordered list of
**Activities**. An activity is one poll or one quiz question.

### Activity lifecycle

```text
draft ──(go live)──> live ──(end)──> ended
  ▲                                   │
  └──────────(reopen, optional)───────┘
```

- **draft** — being prepared. Hidden from the audience.
- **live** — accepting responses. **At most one activity is live per room.** Starting one ends
  the previously live activity.
- **ended** — closed to responses; results remain visible if `showResults` is on.

The live view renders the live activity; when none is live it falls back to the Q&A feed.
The presenter controls the room from the console, so the projected screen follows automatically.

### Editing and response reset

The owner can edit an activity's prompt, options, correctness, and builder settings while it is
Draft or Ended and has no stored answers, including hidden or superseded submissions. Its kind,
ID, position, and lifecycle are preserved. Live activities and prepared quiz lobbies must be
ended before editing. Eligibility is checked again against fresh data on save.

The management console's **Reset all responses** action requires confirmation and deletes all
answers, Q&A questions, and votes for the room. Every activity returns to Draft; preparation,
quiz start times, and public answer reveals are cleared. Room configuration and links, activity
configuration and order, and private correctness are retained. Leaderboards empty naturally.

Optional `Activity.answerResetId` scopes browser-local answer locks to the current run.
Optional `Room.isResetting` and `Room.resetResumeQuestions` retain reset/recovery state across
reloads. Participation and shared presenter controls are paused until a successful reset restores
the original question setting. Failed multi-write operations are explicit and retryable, not
transactional; client-side checks cannot exclude all concurrent API writes.

---

## 4. Activity types

All types share: `prompt`, `position`, `state`, `showResults` (whether the audience sees results
on their own device — the projected view always shows them).

### 4.1 Multiple choice

- Presenter defines 2+ options; `allowMultiple` permits selecting several.
- Audience picks option(s).
- Results: horizontal bar chart with counts and percentages.

### 4.2 Word cloud

- Audience submits a short free-text answer (`max 80`), optionally several.
- Repeated answers grow larger. Matching is case-insensitive and trimmed.
- Results: frequency-scaled text cloud (CSS-based, no charting dependency).

### 4.3 Rating

- Presenter sets a scale (`maxRating`, default 5).
- Audience picks a value 1..N (stars).
- Results: average score, response count, and distribution per value.

### 4.4 Open text

- Audience submits longer free text (`max 500`).
- Results: a live list of responses, newest first, with optional author name.
- Presenter can hide individual responses (moderation), same mechanism as Q&A.

### 4.5 Ranking

- Presenter defines options; audience orders them by dragging (touch, mouse, or keyboard) or with
  ↑/↓ buttons. Results animate as the order changes.
- Aggregation: **Borda count** — an option ranked `r` of `n` scores `n - r` points.
- Results: options sorted by total score, showing average rank.

### 4.6 Quiz

Multiple choice with correctness, a timer, and a leaderboard.

- Presenter marks one or more options correct and optionally sets `timeLimitSeconds`
  (default 20, 0 = no limit).
- **Prepare** opens a lobby: attendees set a nickname, the prompt stays hidden, and the projector
  shows a "get ready" screen. **Start question** stamps `startedAt` and opens answering.
- The deadline is **enforced**: once it passes the form closes and submissions are refused.
- The distribution stays hidden while the question is open, and correctness is shown only after
  **Reveal answers** — never from `isCorrect`, which the projected screen can read.
- `startedAt` is stamped when the activity goes live; the audience device shows a countdown.
- **Scoring:** correct answers score `base + speed bonus`, where the bonus decays linearly
  with elapsed time over the limit. Multi-correct questions require exactly the correct set.
- **Leaderboard:** top participants by cumulative score across the room's quiz activities.
- Participants supply a **nickname** to appear on the leaderboard.

---

## 5. Q&A

Audience asks questions and upvotes; the presenter marks answered, hides, or deletes.
Sorted by votes, ties broken by recency.

Q&A is **optional per room** (`Room.qnaEnabled`): when off, the tab disappears from the audience
view and the console, and the live view no longer falls back to the question feed.

## 5c. Presenter controls

The projected view carries a control bar and keyboard shortcuts, rendered only when the
signed-in **owner** views it and never in embed mode: next/previous, start, end, reveal, join-info
and leaderboard toggles. `/control/:code` offers the same actions as a phone remote, reachable via
a QR in the console; it is owner-only, since the underlying writes require the owner anyway.

Run order resolution is pure (`src/lib/runOrder.ts`) and shared through `useRoomControls`, so all
three surfaces behave identically. Quizzes are prepared before they start.

## 5d. Room branding and join info

`Room.brandTitle` replaces the Ray|Live wordmark on the audience and projected views.
`Room.showJoinInfo` hides the join link, QR, and code live — stored on the room so the projector,
console, and remote agree.

## 5b. Theming

Each room stores `themeBackground`, `themeText`, and `themeAccent` (plus the selected
`themePreset`). Presets: Midnight, Daylight, Ocean, Sunset, Forest, High contrast — or custom.
Everything else is derived with `color-mix()`, and the console shows a WCAG contrast rating so a
theme cannot quietly become unreadable on a projector.

---

## 6. Data model

Existing: `Room`, `Question`, `Vote`. New entities below.

### `Activity`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `kind` | set | `multipleChoice`, `wordCloud`, `rating`, `openText`, `ranking`, `quiz` |
| `prompt` | text(500) | The question |
| `state` | set | `draft`, `live`, `ended` |
| `position` | int | Order in the room |
| `showResults` | boolean | Audience sees results on their device |
| `allowMultiple` | boolean | Multi-select / multiple word-cloud entries |
| `maxRating` | int? | Rating scale, default 5 |
| `timeLimitSeconds` | int? | Quiz countdown |
| `startedAt` | date? | Stamped when going live; anchors quiz timing |
| `createdAt` | date | |
| `room_id` / `room` | uuid / `@one` | |
| `owner_id` | text(200) | Denormalized presenter id |

### `ActivityOption`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `label` | text(200) | |
| `position` | int | |
| `isCorrect` | boolean | **Hidden from anonymous reads** — quiz answer key |
| `revealedCorrect` | boolean | Public copy, flipped when the presenter reveals |
| `activity_id` / `activity` | uuid / `@one` | |
| `room_id` | uuid | Denormalized for single-query fetches |
| `owner_id` | text(200) | |

### `Answer`

One row per participant **per selected option / per submission**. Multi-select and ranking
produce several rows.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `participantKey` | text(64) | Browser-local id, **hidden from anonymous reads** |
| `participantName` | text(80)? | Nickname, shown on leaderboards |
| `option_id` | uuid? | Choice / quiz / ranking |
| `textValue` | text(500)? | Word cloud / open text |
| `ratingValue` | int? | Rating |
| `rankPosition` | int? | Ranking |
| `elapsedMs` | int? | Quiz speed, from `Activity.startedAt` |
| `isHidden` | boolean | Moderation for open text |
| `createdAt` | date | |
| `activity_id` / `activity` | uuid / `@one` | |
| `room_id` | uuid | |
| `owner_id` | text(200) | |

### Permissions

| Entity | anonymous | authenticated |
| --- | --- | --- |
| `Activity` | `read` where `state neq 'draft'` | Owner CRUD |
| `ActivityOption` | `read` excluding `isCorrect` | Owner CRUD |
| `Answer` | `create`; `read` where `isHidden eq false` | Owner read/update/delete |

Drafts stay invisible, so upcoming quiz questions do not leak through the app.
The answer key never reaches an anonymous caller — only `revealedCorrect`, after the reveal.

---

## 7. Platform constraints that shape the design

These come from the installed Rayfin version and are **not** style preferences.

1. **Anonymous callers can only `create`.** No update, no delete. Therefore:
   - upvotes are final, and changing an answer means writing a **new submission** that supersedes
     the previous one (rows share a `submissionId`; tallies keep the newest per participant);
   - de-duplication is best-effort via a browser-local `participantKey` + localStorage;
   - only the presenter can delete answers, via *Clear responses*.
2. **A write selects back every field it writes.** `create` builds its GraphQL selection set from
   the input keys, so a field excluded from the caller's read permission makes the write fail with
   `AUTH_NOT_AUTHORIZED`. Only `ActivityOption.isCorrect` is excluded, and only the presenter
   writes it. Where the caller has no read permission at all, `createTolerantly` absorbs the
   read-back denial and ids are client-generated.
3. **No `count()` on the client** — all tallies are aggregated in the browser from raw rows.
4. **Policies cannot traverse relationships** — `owner_id` and `room_id` are denormalized onto
   every child entity.
5. **Field-level `exclude` is the only per-field guard**, and it is static: it cannot depend on
   activity state. Hence the separate `revealedCorrect` field.
6. **No realtime subscriptions** — live views poll every 3s, paused when the tab is hidden.
7. **Quiz scoring runs on the presenter's screen**, because only an authenticated owner can read
   `isCorrect`. The leaderboard is computed in the room console / live view.
8. **Anonymous data access requires the `anonymous-data-access` CLI feature flag** (see README
   "Security model"). It is unsupported and set by the npm scripts.

### Accepted weaknesses (sample-grade)

Client-supplied timestamps make `elapsedMs` forgeable; there is no rate limiting or captcha;
the room code is not an access boundary. Documented, not fixed.

---

## 8. UX flows

### Presenter

1. Create a room → gets a code, join link, QR, and embed snippet.
2. In the console, add activities from a type picker; fill in prompt and options; reorder.
3. During the talk: **Go live** on an activity → the projected view switches to it automatically.
4. **End** it to freeze results; for quizzes, **Reveal answers** then show the leaderboard.
5. Q&A stays available in its own tab throughout.

### Audience

1. Open `/r/:code` (link or QR).
2. See the live activity, if any: answer it, then see confirmation and — if `showResults` —
   the live results.
3. If no activity is live, land on the Q&A feed: ask and upvote.
4. Quizzes prompt for a nickname once, stored locally, reused for the rest of the room.

---

## 9. Success criteria

- A presenter can prepare a mixed set of activities before a talk and run them in order.
- An attendee on a phone can answer every activity type without signing in.
- The projected view switches automatically as the presenter drives the room and never shows
  draft content.
- Quiz correctness is never exposed to the audience before the reveal.
- Everything works embedded in an iframe inside a slide deck.
