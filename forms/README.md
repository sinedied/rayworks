# Rayfin Forms

A forms app in the spirit of Microsoft Forms / Google Forms, built on [Project Rayfin](http://aka.ms/rayfin/docs).

Create a form in the browser, share its unique link, and review the responses.
Admins sign in with Fabric Entra SSO; **respondents fill in a shared form without any sign-in.**

## Features

- **Form builder** — add, reorder, and delete questions across six question kinds
  (short answer, paragraph, number, date, single choice, multiple choice)
- **Share links** — each form gets an unguessable token; recipients open `/f/<token>` with no
  account and no workspace access
- **Open / closed forms** — close a form to stop accepting responses, reopen it any time
- **Results view** — KPI strip, filters, per-question charts, and a foldable raw table
  with CSV export
- **Fabric Entra SSO** — Fabric sign-in in production, mock email/password locally

## ⚠️ Security model — read this first

> **Respondents do NOT need to sign in.** Anyone with the share link can open a form and submit
> a response anonymously. Authentication is required only for admins who create and manage forms.

This works, but it depends on an **unsupported CLI feature flag**. Read this section before
relying on the sample.

### Anonymous access requires an undocumented feature flag

By default the Rayfin CLI **refuses** to apply any configuration that grants the `anonymous`
role: `rayfin up db apply` throws `AnonymousAccessBlockedError`. The `@anonymous()` decorator
is published only from `@microsoft/rayfin-core/experimental`, and the stable `role()` export is
typed to accept `'authenticated'` only.

The block is skipped when the `anonymous-data-access` feature flag is set:

```bash
RAYFIN_FEATURE_FLAGS=anonymous-data-access npx rayfin up
RAYFIN_FEATURE_FLAGS=anonymous-data-access npx rayfin up db apply
```

The `npm run rayfin:up` and `npm run rayfin:db` scripts set it for you. **Deploys without it
will fail** while the anonymous decorators are present.

That flag's own source describes it as a **contributor-only escape hatch for internal test
infrastructure**, deliberately not advertised to builders. Consequences you are accepting:

- It is unsupported and may change or disappear in any Rayfin upgrade.
- It disables the guard for the whole configuration, not per entity.
- The Fabric data plane itself does honour anonymous permissions — verified against a live
  deployment — so this is a tooling gate, not a server capability gate.

If that trade-off is unacceptable, remove the `@anonymous(...)` decorators from
`rayfin/data/*.ts` and drop the flag from the npm scripts. Sharing then falls back to
"anyone signed in with the link", which requires giving every respondent workspace access.

### Permissions

| Entity | anonymous | authenticated |
| --- | --- | --- |
| `Form` | `read` while the form is open | Owner CRUD; `create` binds `owner_id` to the caller |
| `FormField` | `read` while the form is open | Owner CRUD |
| `FormResponse` | `create` only | Owner + respondent read, owner delete |
| `Answer` | `create` only | Owner + respondent read, owner delete |

The important guarantee holds: **anonymous callers can never read submissions.** Results are
visible only to the form owner (and to a signed-in respondent for their own rows). This is
verified — an unauthenticated query against `formResponses` returns `AUTH_NOT_AUTHORIZED`.

### What the share link does *not* protect

**The link is not an access boundary.** Permissions are per-entity, not per-row-secret, so
anyone on the internet can query the GraphQL endpoint directly to:

- list every **open** form, including its `title`, `shareToken`, and questions, without the link;
- submit responses to any open form they can name — there is no captcha or rate limiting, so
  spam and ballot-stuffing are possible.

Closing a form removes it and its questions from anonymous reads entirely, and is the only
kill switch. **Do not put confidential wording in a form's questions.**

Why the token cannot be checked server-side: the policy DSL can only reference the `sub`,
`email`, and `role` claims with `eq`/`ne`/`and`/`or`. A share token arrives as a request
parameter, not a claim, so no policy can express "return this row only if the caller supplied
the matching token". Closing that hole needs a trusted server-side broker — see the preview
Rayfin Functions feature (`RAYFIN_FEATURE_FLAGS=functions npx rayfin functions`), which this
app deliberately does not depend on.

### Anonymous writes cannot be read back

DAB rejects the *read-back* of a row an anonymous caller just wrote, even though the write
commits. `RayfinResponseService` therefore generates response and answer IDs client-side and
tolerates that specific error (`isWriteSucceededButUnreadable`), rather than granting anonymous
read permission that would leak submissions.

### Other caveats

- **`owner_id` is denormalized** onto `FormField`, `FormResponse`, and `Answer` because Rayfin
  policies cannot traverse relationships. Nothing validates that a submitted `form_id` belongs to
  the claimed `owner_id`, so a caller can attach rows to another user's form. Anonymous `create`
  carries no policy at all, since an anonymous caller has no claims to bind.
- **`FormField.isClosed` mirrors `Form.isClosed`** for the same reason, and is kept in sync by
  `setFormClosed`. The two writes are not transactional.
- **Submissions are not atomic.** `RayfinResponseService.submitResponse` writes the response and
  then each answer in sequence; a failure part-way leaves a partial submission. Required-field
  and choice validation is client-side only.
- **Editing a form soft-deletes removed questions** (`FormField.isDeleted`) rather than dropping
  them, because `Answer.field_id` holds a foreign key. Results still show those columns.
- **Deleting a form permanently deletes its responses and answers**, since they are FK-bound to it.
- **`count()` is unavailable** on the fluent client, so counts are computed from array length.
- **`findById` only selects the primary key** in this SDK version, so this app queries with an
  explicit `.select(...).where({ id: { eq } })` instead.

## Getting started

### Prerequisites

- Node.js 20+
- A Microsoft Fabric workspace

### Run it

1. Install dependencies:

   ```bash
   npm install
   ```

2. Deploy the app to Fabric and start the local dev server:

   ```bash
   npm run dev
   ```

3. Open the Vite dev server URL shown in the terminal.

Subsequent deploys (including schema changes) are a single `npx rayfin up`.

## Data model

Four entities in `rayfin/data/`, registered in `rayfin/data/schema.ts`:

```text
Form ──< FormField
  └──< FormResponse ──< Answer
```

`Form` carries the share token and open/closed state:

```typescript
@entity()
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.isClosed.eq(false)),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Form {
  @uuid() id!: string;
  @text({ min: 1, max: 200 }) title!: string;
  @text({ optional: true, max: 2000 }) description?: string;
  @text({ min: 8, max: 64, unique: true }) shareToken!: string;
  @boolean() isClosed!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @text({ max: 200 }) owner_id!: string;
  @many(() => FormField) fields?: FormField[];
}
```

Notes on the modelling choices:

- Every `@text()` sets `max` — on MSSQL an unbounded `NVARCHAR(MAX)` column breaks GraphQL
  schema generation.
- `FormField.choices` and multi-choice `Answer.value` store JSON-encoded string arrays, parsed
  defensively via `src/lib/choices.ts`.
- `Answer.fieldLabel` snapshots the question text so old results stay readable after a form
  is edited.
- Editing a form updates questions in place and soft-deletes removed ones, preserving the
  `Answer.field_id` foreign key.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Signed in | Your forms: create, edit, close, copy link, view results |
| `/forms/new` | Signed in | Form builder |
| `/forms/:id/edit` | Signed in | Edit an existing form |
| `/forms/:id/results` | Form owner | Responses table |
| `/f/:token` | **Public — no sign-in** | Fill in a shared form |
| `/auth`, `/auth/callback` | Public | Sign-in and Entra OAuth callback |

Share links work for anyone with the URL. Admin routes still redirect to `/auth`, stashing the
destination so you return there after signing in.

## Project structure

```text
forms/
├── rayfin/
│   ├── data/
│   │   ├── Form.ts            # Form: share token, open/closed, owner policy
│   │   ├── FormField.ts       # Questions, with kind + choices
│   │   ├── FormResponse.ts    # One submission
│   │   ├── Answer.ts          # One answer within a submission
│   │   └── schema.ts          # Schema export for type safety
│   └── rayfin.yml             # Rayfin configuration (auth and data enabled)
├── src/
│   ├── components/
│   │   ├── ui/                # Radix-based UI components (shadcn)
│   │   ├── results/           # Dashboard: charts, filters, raw table
│   │   ├── AppHeader.tsx      # Masthead
│   │   ├── AuthPage.tsx       # Fabric sign-in page
│   │   ├── EmptyState.tsx     # Halftone blank-page state
│   │   ├── FieldEditor.tsx    # Single-question editor
│   │   ├── MockSignInDialog.tsx # Local dev mock sign-in dialog
│   │   ├── PageShell.tsx      # Shared layout and page title
│   │   ├── ShareLinkButton.tsx  # Copy-to-clipboard share link
│   │   └── StatCard.tsx       # KPI tile
│   ├── hooks/
│   │   ├── AuthContext.tsx    # Authentication state management
│   │   ├── useForms.ts        # List/create/close/delete your forms
│   │   ├── useFormResults.ts  # Responses joined into rows
│   │   └── usePublicForm.ts   # Resolve a share token to a form
│   ├── lib/
│   │   ├── choices.ts         # Defensive JSON array parsing
│   │   ├── csv.ts             # CSV export and escaping
│   │   └── results.ts         # Pure filtering and aggregation
│   ├── pages/
│   │   ├── AuthCallback.tsx   # Fabric Entra OAuth callback
│   │   ├── Dashboard.tsx      # Your forms
│   │   ├── FormEditor.tsx     # Create and edit forms
│   │   ├── FormResults.tsx    # Results dashboard (lazy-loaded)
│   │   └── PublicForm.tsx     # Fill in a shared form
│   ├── services/
│   │   ├── interfaces/        # IAuthService, IFormService, IResponseService
│   │   ├── mock/              # MockAuthService (local dev)
│   │   ├── rayfin/            # Rayfin client, auth, form and response services
│   │   └── ServiceContainer.ts  # Service initialization with auth-mode detection
│   ├── styles/
│   │   ├── design.css         # Design tokens and shared primitives
│   │   └── theme.css          # shadcn/Radix base tokens
│   ├── App.tsx                # Router with protected and public routes
│   └── main.tsx               # Entry point with AuthProvider
└── package.json
```

## Design

A clean, professional, blue-led light theme: white surfaces on a soft grey canvas, cool
neutral text, and a single brand blue (`#2563EB`). Set in IBM Plex Sans, with IBM Plex Mono
reserved for figures that benefit from aligning in columns. Tokens live in
`src/styles/design.css`.

Semantic tokens (`--surface`, `--text`, `--text-muted`, `--border-subtle`, `--brand`) map
onto the shadcn token names, so the `ui/*` components stay on-palette without being forked.
Shared primitives: `.card`, `.card-interactive`, `.font-heading`, `.font-data`,
`.label-caps`, `.fade-in`.

Two things to know before editing styles:

- Tokens are declared on `:root:root`, not `:root`. `theme.css` declares the same shadcn
  token names and is emitted later in the bundle, so a single `:root` loses the cascade and
  the stock palette silently wins.
- The results route is lazy-loaded. Recharts is large and only that page needs it; importing
  it eagerly nearly doubles the bundle for respondents who only ever see the public form.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Deploy app to Fabric and start local dev server |
| `npm run dev:fabric` | Start dev server against an already-deployed Fabric backend |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run rayfin:up` | Deploy app to Fabric (no local dev server) |
| `npm run rayfin:db` | Generate and apply database schema |

## Environment variables

All Rayfin environment variables live in `rayfin/.env` using the `RAYFIN_PUBLIC_*` prefix.
The `predev` hook runs `rayfin env --framework vite` to generate `.env.local` with
Vite-compatible names.

| Source (`rayfin/.env`) | Vite variable (`.env.local`) | Description | Default |
| --- | --- | --- | --- |
| `RAYFIN_PUBLIC_API_URL` | `VITE_RAYFIN_API_URL` | Rayfin backend URL | `http://localhost:5168` |
| `RAYFIN_PUBLIC_PUBLISHABLE_KEY` | `VITE_RAYFIN_PUBLISHABLE_KEY` | Rayfin publishable key | (generated on dev) |
| `RAYFIN_PUBLIC_ITEM_ID` | `VITE_FABRIC_ITEM_ID` | Fabric item/project ID (written by `rayfin up`) | -- |
| `RAYFIN_PUBLIC_WORKSPACE_ID` | `VITE_FABRIC_WORKSPACE_ID` | Fabric workspace ID for auth | -- |
| `RAYFIN_PUBLIC_PORTAL_URL` | `VITE_FABRIC_PORTAL_URL` | Fabric portal URL for auth | -- |

Deployment metadata (including the hosting URL) is stored in `rayfin/.deployments.json`.
Use `rayfin up list` to view all deployments.

## License

See the [LICENSE](LICENSE) file for details.
