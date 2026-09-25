<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/logos/rayforms-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../docs/logos/rayforms.svg">
  <img src="../docs/logos/rayforms.svg" alt="Ray|Forms" height="72">
</picture>

**Build forms, share public response links, and turn submissions into insight.**

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

Ray|Forms is an enterprise form builder built with [Microsoft Fabric Apps](https://learn.microsoft.com/en-us/fabric/apps/overview)
and [Project Rayfin](https://aka.ms/rayfin/docs). Admins create and manage forms with Fabric
Entra SSO; respondents open a shared link and submit without signing in.

## Features

- **Seven question types** - short answer, paragraph, number, rating, date, single choice, and
  multiple choice.
- **Flexible numeric input** - optional inclusive bounds and configurable whole-number rating
  scales with endpoint labels.
- **Public sharing** - unguessable form links and locally generated QR codes.
- **Form lifecycle** - open or close collection without deleting the form.
- **Response analysis** - KPIs, filters, per-question charts, raw responses, and CSV export.
- **Authentication options** - Fabric Entra SSO and password auth are enabled in the deployment;
  local development can use the mock sign-in service.

## Getting started

### Prerequisites

- Node.js 20.19+, 22.12+, or 24.x
- A Microsoft Fabric workspace with Fabric Apps enabled

Install dependencies, deploy with the required anonymous-access flag, and start the dev server:

```bash
npm install
RAYFIN_FEATURE_FLAGS=anonymous-data-access npm run dev
```

Open the Vite URL shown in the terminal. Use `npm run dev:fabric` when the Fabric backend is
already deployed and you only need the frontend dev server.

## Security model

> [!WARNING]
> Respondents do not sign in. Anonymous access depends on the unsupported
> `anonymous-data-access` Rayfin CLI feature flag, which may change or disappear in a future
> release.

The `rayfin:up` and `rayfin:db` scripts set the flag automatically. Commands that deploy or apply
the schema without it fail with `AnonymousAccessBlockedError`.

Important boundaries:

- **Anonymous callers can submit but cannot read responses.** Results remain owner-only.
- **A share link is not an access boundary.** Direct API callers can enumerate open forms and
  submit to them without knowing the link.
- **There is no captcha or rate limiting.** Open forms can receive spam or repeated submissions.
- **Closing a form is the kill switch.** Closed forms and questions disappear from anonymous
  reads.
- **Do not put confidential wording in questions.** Open form definitions are anonymously
  readable.
- **Validation and multi-row submissions are client-managed.** Direct clients can bypass field
  validation, and a failed submission can leave partial data.

<details>
<summary><strong>Detailed permissions and implementation caveats</strong></summary>

The feature flag can also be supplied explicitly:

```bash
RAYFIN_FEATURE_FLAGS=anonymous-data-access npx rayfin up
RAYFIN_FEATURE_FLAGS=anonymous-data-access npx rayfin up db apply
```

| Entity | Anonymous | Authenticated |
| --- | --- | --- |
| `Form` | Read while open | Owner CRUD; create binds `owner_id` |
| `FormField` | Read while open | Owner CRUD |
| `FormResponse` | Create only | Owner and respondent read; owner delete |
| `Answer` | Create only | Owner and respondent read; owner delete |

- Anonymous writes commit even though DAB rejects the read-back. `RayfinResponseService`
  generates IDs client-side and tolerates only that specific error.
- `owner_id` and `isClosed` are denormalized because Rayfin policies cannot traverse
  relationships. Closing a form updates both `Form` and `FormField`, but not transactionally.
- Removed questions are soft-deleted to preserve `Answer.field_id` foreign keys.
- Deleting a form permanently deletes its responses and answers.
- The fluent client has no `count()`, so counts use array length.
- `findById` selects only the primary key in this SDK version; explicit field selections are used
  instead.

</details>

## Product behavior

<details>
<summary><strong>Number and rating questions</strong></summary>

Number questions support optional inclusive minimum and maximum values, including negative and
decimal numbers. Rating questions default to `1-5` with an interval of `1`; all values must be
whole numbers and the interval must reach the maximum exactly.

Scales with five or fewer choices render numbered buttons; larger scales use a slider. Ratings
start unanswered, required ratings need an explicit selection, and optional ratings can be
cleared. Results and CSV exports store the selected number, not its endpoint label.

</details>

<details>
<summary><strong>Sharing with QR codes</strong></summary>

Use **Show QR code** from **Your forms** or **Results**. The browser generates the code locally
for the exact public URL; no link is sent to an external QR service. Closing the form stops QR
submissions just like copied links.

</details>

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Signed in | List, create, edit, close, share, and delete forms |
| `/forms/new` | Signed in | Create a form |
| `/forms/:id/edit` | Signed in | Edit a form |
| `/forms/:id/results` | Owner | Analyze and export responses |
| `/f/:token` | **Public** | Fill in a shared form |
| `/auth`, `/auth/callback` | Public | Sign-in and Entra callback |

## Reference

### Data model

```text
Form ──< FormField
  └──< FormResponse ──< Answer
```

Every `@text()` field has a maximum length because unbounded `NVARCHAR(MAX)` columns break GraphQL
schema generation on MSSQL. Choice arrays and numeric settings are stored as validated JSON.
`Answer.fieldLabel` snapshots question text so historical results remain readable after edits.

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Deploy the backend and start Vite; set the anonymous-access flag in the shell |
| `npm run dev:fabric` | Start Vite against an existing Fabric deployment |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run test:coverage` | Run tests with text coverage |
| `npm run rayfin:up` | Deploy to Fabric with anonymous access enabled |
| `npm run rayfin:db` | Generate and apply the schema with anonymous access enabled |

<details>
<summary><strong>Environment and project layout</strong></summary>

Rayfin stores deployment configuration in `rayfin/.env`. The `predev` hook generates the
Vite-compatible `.env.local`; deployment metadata lives in `rayfin/.deployments.json`.

```text
rayfin/data/          Form, field, response, and answer entities
src/components/       App shell, form controls, sharing, and results UI
src/hooks/            Authentication and form/result data hooks
src/lib/              Choice parsing, CSV export, and aggregation
src/pages/            Dashboard, editor, results, public form, and auth callback
src/services/         Mock/Fabric auth and typed Rayfin data services
src/styles/           Shared design tokens and shadcn/Radix theme
```

</details>

## More resources

- [Ray|Works design system](../DESIGN.md)
- [Ray|Works logo guide](../docs/logo.md)
- [Fabric Apps documentation](https://learn.microsoft.com/fabric/apps/)
- [Rayfin SDK documentation](https://aka.ms/rayfin/docs)
