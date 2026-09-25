<div align="center">

# Ray|Trip

**Capture business travel as it happens, then turn the trail into a focused report.**

</div>

Ray|Trip is a Microsoft Fabric application built with Rayfin, React, and
TypeScript. Trip owners keep private daily notes and photos, generate a draft
summary through an Azure Foundry model, review the result, and publish a unique
link for other authenticated Fabric users.

## Features

- **Owner-protected trips** with destination, purpose, dates, and lifecycle state.
- **Daily field notes** organized into a chronological travel journal.
- **Private SQL-backed photos** with optional captions and day associations.
- **Azure Foundry briefs** generated as one editable Markdown document by a typed Rayfin function using Entra delegated access.
- **Review and finalization** before a report becomes shareable.
- **Authenticated share links** that are read-only for everyone except the trip owner.

## Trip workflow

Use **Notes & photos** to capture the trip, then switch to **Report** directly
below the trip header. Generate a brief, review its Markdown preview, and use
**Edit** to revise the single report field. Switching views keeps unsaved edits.
Regeneration asks before replacing a draft; failed generation keeps the previous
report. **Save & finalize** saves the current text and publishes it together.

New and revised reports allow **2,500 characters**, including Markdown markup
(after trimming surrounding whitespace). Headings, lists, links, and tables
render in both preview and shared reports. Raw HTML and remote images are not
rendered.

Existing two-field reports remain readable in full as one combined document.
Their content, finalization state, and share links are preserved. Longer legacy
drafts must be shortened before saving a revision; finalized legacy reports are
not changed.

Phone layouts use wrapping toolbars, full-width report editing, 44px touch
targets, and viewport-aware dialogs. Headers retain the shared Ray|Works shell
geometry and Ray|Trip coral/navy branding.

## Photo storage

Native Rayfin Storage is experimental and **not available on Microsoft Fabric**.
Ray|Trip therefore stores optimized photos in the existing Rayfin SQL database;
it does not require an Azure Blob Storage account.

- Select a browser-decodable raster image up to **20 MiB**. JPEG, PNG, and WebP
  are typical inputs. If the browser cannot decode a format such as HEIC,
  convert it to JPEG or PNG first. SVG uploads are rejected.
- The browser preserves aspect ratio/orientation and saves a JPEG copy up to
  **1,600 pixels** on its longest side and **512 KiB**. Originals and source
  metadata are not retained; transparency is flattened onto white.
- Image bytes are Base64-encoded into bounded 4,000-character SQL chunk rows
  (at most 175 per photo), protected by owner-only permissions. SQL/Base64 has
  more storage and request overhead than blob storage; the optimization limit
  and lazy downloads keep that overhead bounded.
- The upload becomes visible only after a Rayfin function validates every part,
  byte count, SHA-256 digest, and JPEG dimensions. Only completed photo captions
  are included in report generation.
- Interrupted uploads and deletions appear under **Photos needing attention**.
  Discard an incomplete upload before selecting the image again. Failed cleanup
  is reported explicitly and can be retried after reconnecting.
- Legacy native-storage records are retained, but their image bytes cannot be
  recovered through Fabric's unsupported native storage service. Re-upload the
  source image and remove the old record when appropriate.

Finalized report sharing does not grant access to the private photos or chunks.

## Architecture

```text
React + Vite
  ├── Fabric SSO through Rayfin Auth
  ├── Typed CRUD through Rayfin Data
  ├── Photo bytes through owner-protected Rayfin SQL chunks
  ├── Upload validation and cleanup through Rayfin Functions
  └── Typed report generation through Rayfin Functions
        └── Azure Foundry model deployment (managed separately)
```

The main entities live under `rayfin/data/`:

| Entity | Purpose |
|---|---|
| `Trip` | Assignment details and owner |
| `TripDay` | One daily note within a trip |
| `TripPhoto` | Photo metadata, upload state, and integrity manifest |
| `TripPhotoChunk` | Ordered, owner-protected image content |
| `TripReport` | Markdown content, retained legacy text, finalization state, and share ID |

Row-level policies keep trips, notes, and photos owner-only. A finalized
`TripReport` grants read access to authenticated users while retaining
owner-only update and delete access.

## Prerequisites

- Node.js 20, 22, or 24
- Git
- Access to a Microsoft Fabric workspace with Fabric Apps enabled
- An Azure Foundry model deployment that accepts Entra authentication

## Configure Azure Foundry

The Rayfin function reads the OpenAI-compatible `/openai/v1/` base URL from the
`AZURE_FOUNDRY_ENDPOINT` deployment secret and the deployment name from
`AZURE_AI_MODEL_DEPLOYMENT_NAME`. Report generation intentionally fails until
both are present.

After the first Fabric deployment, set it with:

```bash
npx -y @microsoft/rayfin-cli secret set AZURE_FOUNDRY_ENDPOINT
npx -y @microsoft/rayfin-cli secret set AZURE_AI_MODEL_DEPLOYMENT_NAME
```

The function declares an `AudienceType.AzureAI` connection and sends the
delegated Entra token with the inference request. The calling users and Fabric
item must have the required Azure AI access to the separately managed model.

## Commands

Install dependencies if needed:

```bash
npm install
```

Build and validate:

```bash
npm run build
npm test
npm run lint
npm run test:responsive
```

Responsive tests use isolated fixtures with the real UI, not production auth or
data. They require Google Chrome (configured in `playwright.config.ts`) and
start a test-only Vite server automatically. Desktop/phone emulation does not
replace a physical iOS/Android keyboard check.

Deploy the app, SQL schema, static frontend, and functions:

```bash
npm run rayfin:up
```

> [!NOTE]
> The app requires Rayfin data and Fabric authentication, so the static
> no-backend preview from the starter is no longer representative. Follow the
> deployment and development workflow generated by Rayfin when you are ready
> to run it.

## Project structure

```text
rayfin/
  data/                  # Decorated data entities and schema registration
  functions/             # Photo validation/cleanup and AzureAI report generation
  rayfin.yml              # Auth, SQL data, functions, and hosting services
src/
  components/            # Shared application UI
  pages/                 # Dashboard, trip workspace, shared report
  services/              # Typed Rayfin client and trip operations
  hooks/                 # Fabric authentication context
```
