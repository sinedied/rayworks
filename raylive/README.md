<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/logos/raylive-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../docs/logos/raylive.svg">
  <img src="../docs/logos/raylive.svg" alt="Ray|Live" height="72">
</picture>

**Run live Q&A, polls, and quizzes from one presenter console.**

[![Built with Copilot](https://img.shields.io/badge/Built%20with-Copilot-8957E5?style=flat-square&logo=githubcopilot&logoColor=white)](https://github.com/features/copilot)
[![Microsoft Fabric Apps](https://img.shields.io/badge/Microsoft-Fabric%20Apps-7FBA00?style=flat-square&logo=microsoft&logoColor=white)](https://learn.microsoft.com/en-us/fabric/apps/overview)
[![Rayfin SDK](https://img.shields.io/badge/Rayfin-SDK-00C2AB?style=flat-square)](https://aka.ms/rayfin/docs)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[&larr; Ray|Works](../README.md) &middot;
[Features](#features) &middot;
[Getting started](#getting-started) &middot;
[Security](#security-model) &middot;
[Reference](#reference)

</div>

## Overview

Ray|Live is a live audience interaction app built with
[Microsoft Fabric Apps](https://learn.microsoft.com/en-us/fabric/apps/overview) and
[Project Rayfin](https://aka.ms/rayfin/docs). Presenters authenticate to prepare and run a room;
the audience joins from a short link or QR code without signing in.

## Features

- **Live Q&A** - collect, moderate, and upvote audience questions.
- **Six activity types** - multiple choice, word cloud, rating, open text, ranking, and quiz.
- **Presenter workflow** - prepare questions, go live, reveal answers, and show a leaderboard.
- **Audience projection** - full-screen results, embeddable views, and room-specific branding.
- **Phone remote** - owner-only controls for advancing a session away from the main screen.
- **Accessible theming** - presets, custom colors, live preview, and WCAG contrast warnings.

## Getting started

### Prerequisites

- Node.js 20.19+, 22.12+, or 24.x
- A Microsoft Fabric workspace with Fabric Apps enabled

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), sign in as a presenter, and create a room.
Apply local schema changes when needed:

```bash
npm run rayfin:db
```

The development and deployment scripts set the required anonymous-access feature flag.

## How it works

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Presenter | Create and manage rooms |
| `/manage/:code` | Owner | Build activities, moderate Q&A, and run the session |
| `/control/:code` | Owner | Phone-friendly remote control |
| `/r/:code` | **Public** | Join, answer, ask, and upvote |
| `/present/:code` | **Public** | Project or embed live results |

| Activity | Audience action | Result |
| --- | --- | --- |
| Multiple choice | Select one or more options | Counts and percentages |
| Word cloud | Submit a short answer | Repeated answers grow |
| Rating | Choose `1-N` stars | Average and distribution |
| Open text | Submit a longer response | Moderatable live list |
| Ranking | Reorder options | Borda-count standings |
| Quiz | Answer against a timer | Reveal, scoring, and leaderboard |

Activities move through `draft -> live -> ended`, and only one can be live at a time. Quizzes add
a prepare step so attendees can choose a nickname before the prompt and timer appear.

> [!NOTE]
> Rayfin has no realtime subscriptions in this version. Audience and stage views poll every three
> seconds, pause while hidden, and refresh immediately when visible again.

## Security model

> [!WARNING]
> Audience members do not sign in. Anonymous access depends on the unsupported
> `anonymous-data-access` Rayfin CLI feature flag.

The `dev`, `rayfin:up`, and `rayfin:db` scripts set the flag automatically. Commands without it
fail while anonymous decorators are present.

Presenters use Fabric SSO in production. Rayfin password authentication is also enabled in the
deployment configuration, while local development uses the app's mock sign-in flow.

Important boundaries:

- **A room code is not an access boundary.** Direct API callers can enumerate open rooms and post
  to them.
- **There is no captcha or rate limiting.** Q&A, votes, and answers can be spammed.
- **Participant identity is browser-local.** Clearing storage bypasses vote and answer
  deduplication.
- **Quiz timing is client-supplied.** It supports friendly competition, not high-stakes scoring.
- **The answer key stays private.** `ActivityOption.isCorrect` is excluded from anonymous reads;
  only the separate `revealedCorrect` field becomes public after reveal.
- **Draft activities remain hidden.** Audience reads begin only after an activity leaves draft.

<details>
<summary><strong>Detailed permissions and answer behavior</strong></summary>

| Entity | Anonymous | Authenticated |
| --- | --- | --- |
| `Room` | Read while open | Owner CRUD |
| `Question` | Create and read while visible | Owner moderate/delete |
| `Vote` | Create and read | Owner read/delete |
| `Activity` | Read after draft | Owner CRUD |
| `ActivityOption` | Read without `isCorrect` | Owner CRUD |
| `Answer` | Create and read visible rows | Owner read/update/delete |

Anonymous callers cannot update or delete. Changing an answer writes a new submission with the
same browser-local participant identity; tallies keep only the latest submission. Word clouds and
open text activities configured for multiple entries intentionally keep several submissions.
Upvotes are final.

`participantKey` and `voterKey` are readable because Rayfin selects written fields after a
mutation. They are pseudonymous IDs, not credentials.

</details>

<details>
<summary><strong>Presenter controls and embedding</strong></summary>

| Key | Action |
| --- | --- |
| `Right`, `Space`, `N` | Next activity |
| `Left`, `P` | Previous activity |
| `Enter` | Start a prepared quiz or open the next activity |
| `E` | End the current activity |
| `R` | Reveal quiz answers |
| `J` | Toggle join information and QR |
| `L` | Toggle the leaderboard |
| `?` | Show shortcut help |

The manage page provides an embeddable stage:

```html
<iframe src="https://<your-app>/present/<code>?embed=1" width="100%" height="600"></iframe>
```

- `embed=1` removes outer chrome.
- `hideAnswered=1` hides covered Q&A items.
- `leaderboard=1` projects quiz standings.

The phone remote is owner-only and uses the Fabric Portal authentication handoff.

</details>

## Reference

### Data model

Six entities live under `rayfin/data/`:

- `Room` - owner, share code, open state, Q&A controls, and theme.
- `Question` and `Vote` - moderated Q&A with client-side vote aggregation.
- `Activity` - type, lifecycle, timer, and activity settings.
- `ActivityOption` - choices plus private and revealed correctness.
- `Answer` - participant submissions, including multi-select and ranking rows.

`owner_id` and `room_id` are denormalized onto child entities because Rayfin policies cannot
traverse relationships. Tallies remain client-side because the fluent client has no `count()` and
anonymous callers could forge denormalized counters.

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Deploy the backend and start Vite with anonymous access enabled |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run rayfin:up` | Deploy to Fabric with anonymous access enabled |
| `npm run rayfin:db` | Apply schema changes with anonymous access enabled |

<details>
<summary><strong>Theming and project layout</strong></summary>

Rooms store background, text, and accent colors. `src/lib/theme.ts` resolves presets and emits CSS
variables; `src/main.css` derives surfaces, borders, and muted text with `color-mix()`.

```text
rayfin/data/          Room, Q&A, activity, option, answer, and vote entities
src/components/       Builders, answer forms, results, leaderboard, QR, and auth
src/hooks/            Authentication and polling hooks
src/lib/              Tallying, quiz rules, run order, reordering, and theming
src/pages/            Dashboard, management, audience, stage, and remote views
src/services/         Rayfin access, anonymous writes, identity, and bootstrap
```

</details>

## More resources

- [Full feature specification](SPEC.md)
- [Ray|Works design system](../DESIGN.md)
- [Ray|Works logo guide](../docs/logo.md)
- [Fabric Apps documentation](https://learn.microsoft.com/fabric/apps/)
- [Rayfin SDK documentation](https://aka.ms/rayfin/docs)
