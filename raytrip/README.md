<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/logos/raytrip-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../docs/logos/raytrip.svg">
  <img src="../docs/logos/raytrip.svg" alt="Ray|Trip" height="72">
</picture>

**Capture business travel as it happens, then turn the trail into a focused report.**

[![Built with Copilot](https://img.shields.io/badge/Built%20with-Copilot-8957E5?style=flat-square&logo=githubcopilot&logoColor=white)](https://github.com/features/copilot)
[![Microsoft Fabric Apps](https://img.shields.io/badge/Microsoft-Fabric%20Apps-7FBA00?style=flat-square&logo=microsoft&logoColor=white)](https://learn.microsoft.com/en-us/fabric/apps/overview)
[![Rayfin SDK](https://img.shields.io/badge/Rayfin-SDK-00C2AB?style=flat-square)](https://aka.ms/rayfin/docs)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[&larr; Ray|Works](../README.md) &middot;
[Features](#features) &middot;
[Getting started](#getting-started) &middot;
[Access](#access-model) &middot;
[Reference](#reference)

</div>

## Overview

Ray|Trip is a private business-travel workspace built with
[Microsoft Fabric Apps](https://learn.microsoft.com/en-us/fabric/apps/overview) and
[Project Rayfin](https://aka.ms/rayfin/docs). Trip owners capture daily notes and photos,
generate a report with an Azure Foundry model, revise the Markdown, and publish an authenticated
read-only link.

## Features

- **Owner-protected trips** - destination, purpose, dates, lifecycle, notes, and photos.
- **Daily field journal** - chronological notes organized by trip day.
- **Private photo capture** - optimized images stored in owner-protected Rayfin SQL rows.
- **AI-assisted reports** - typed Rayfin Functions call an Azure Foundry model with delegated
  Entra access.
- **Markdown review** - edit and preview one focused report before finalizing it.
- **Authenticated sharing** - finalized reports are read-only for other signed-in users.
- **Responsive workflow** - mobile-friendly capture, editing, dialogs, and touch targets.

## Getting started

### Prerequisites

- Node.js 20.19+, 22.12+, or 24.x
- Git
- A Microsoft Fabric workspace with Fabric Apps enabled
- An Azure Foundry model deployment that accepts Entra authentication

Install dependencies and deploy the app:

```bash
npm install
npm run rayfin:up
```

After the first deployment, configure the model endpoint and deployment name:

```bash
npx -y @microsoft/rayfin-cli secret set AZURE_FOUNDRY_ENDPOINT
npx -y @microsoft/rayfin-cli secret set AZURE_AI_MODEL_DEPLOYMENT_NAME
```

Use the OpenAI-compatible `/openai/v1/` base URL for `AZURE_FOUNDRY_ENDPOINT` and the deployed
model name for `AZURE_AI_MODEL_DEPLOYMENT_NAME`.

Then start the local frontend against the deployed services:

```bash
npm run dev
```

> [!IMPORTANT]
> Report generation intentionally fails until both deployment secrets exist and the calling user
> and Fabric item have the required Azure AI permissions.

## Access model

- Frontend HTML, JavaScript, styles, fonts, and logos are public so visitors see
  Ray|Trip's branded sign-in page. This does not grant access to app data or functions.
  Setting `staticHosting.assetAccess` to `protected` instead makes Fabric show its
  own sign-in screen before the app can load.
- Trips, notes, photo metadata, and photo chunks are owner-only.
- Finalizing a report grants authenticated read access while keeping updates and deletion
  owner-only.
- Owners can reopen a finalized report after confirmation. The shared link is unavailable while
  it is a draft and works again at the same URL after finalization.
- Report photo headers are opt-in: viewers receive a flattened collage, never access to the
  original private photos or their SQL chunks.
- Share links do not provide anonymous access; recipients must sign in with Fabric SSO.
  Sign-in returns visitors to the requested trip or report. Password authentication
  is not available in the Fabric deployment.
- Functions use `auth.type: application`, required by CLI 1.36. Azure Foundry
  access uses the Fabric app owner's identity and permissions. Function calls
  still require sign-in, and database operations retain the caller's identity
  and owner-scoped permissions.

## Trip workflow

1. Create a trip with its destination, purpose, and dates.
2. Capture daily notes and photos under **Notes & photos**.
3. Open **Report** and generate a draft from the trip trail.
4. Review or edit the Markdown without losing unsaved text when switching views.
5. Choose **Save & finalize** to save and publish the report together.

To revise a finalized report, choose **Reopen for editing** and confirm the warning.
Its content and share URL are preserved, but sharing pauses until you finalize again.
Canceling leaves it finalized. Reopening cannot retract copies already viewed or saved.

Generated reports aim for **250–300 words**, with a **300-word maximum**: a brief summary,
2–3 key-takeaway bullets, and optional next steps already mentioned in the notes. Sparse notes
can produce fewer takeaways rather than invented content. Generation avoids em dashes, filler,
and repeated points, and makes at most one corrective attempt before reporting a failure.
Important facts, blockers, decisions, and next steps use selective **bold emphasis**, not
whole bold paragraphs or repeated labels.

Manual edits still allow **2,500 characters**, including Markdown syntax, without the
generation-only word or punctuation restrictions. Headings, lists,
links, and tables render in previews and shared reports; raw HTML and remote images do not.
Existing legacy reports remain readable, but an over-limit legacy draft must be shortened before
it can be saved again.

<details>
<summary><strong>Report replacement and compatibility behavior</strong></summary>

Regeneration asks before replacing a draft, and a failed generation keeps the previous report.
Existing two-field reports render as one combined document without changing their finalized state
or share links. Finalized legacy reports remain untouched unless the owner explicitly reopens
them; reopening preserves the full text, including reports longer than the current edit limit.

</details>

## Photo headers

The trip banner automatically uses the **earliest six completed uploads** until you
save a custom selection. Newer uploads do not displace those photos. Choose
**Edit header photos** to select up to six in your preferred order, or save an empty
selection for a plain header. Canceling keeps the existing selection mode. Custom
selections stay fixed rather than being automatically refilled when photos are deleted.
A deterministic BSP-style mosaic adapts the tiles to the header dimensions, with a
navy overlay keeping the trip details readable.

The draft report has a separate **Include photo header in shared report** option in
a compact row below the report body, **off by default**. Automatic trip-header
photos are not automatically shared. Enabling the option previews a flattened JPEG
copy of the selected photos, below the Edit/Preview controls.
Use **Update from trip photos** when you explicitly want to replace an existing cover.
Changing or deleting source photos does not silently alter a saved report cover.

The editor and shared report use the same header layout: a prominent title and the
**trip date or date range**, not the date the report was generated or finalized.
Trip dates are saved on the report when generating, saving, or finalizing a draft,
so readers do not need access to the private trip. Older finalized reports without
saved trip dates remain readable without a date until the owner reopens and
finalizes them again; they are never rewritten automatically.

The report snapshot is at most **32 KiB** and **1,200 × 360px**, stored in bounded text
fields on the report row. Saving/finalizing publishes the content, setting, and image
together under the same permissions. Turning the option off and saving clears the
image fields. Reopening pauses access to both text and image while preserving them
for editing; finalizing again restores the same link.

On narrow screens the full collage appears as a photo band above the title. Prose
regeneration leaves the cover settings unchanged. Failed image preparation must be
retried or the option turned off before publishing.

## Photo storage

> [!NOTE]
> Native Rayfin Storage is experimental and unavailable on Microsoft Fabric. Ray|Trip stores
> optimized photos in the existing Rayfin SQL database and does not require Azure Blob Storage.

- Browser-decodable raster images can be up to **20 MiB**; SVG is rejected and formats such as
  HEIC must be converted first.
- The browser saves an oriented JPEG up to **1,600 pixels** and **512 KiB**.
- Base64 data is split into bounded SQL chunks protected by owner-only permissions.
- A Rayfin function validates chunk order, byte count, SHA-256 digest, and JPEG dimensions before
  publishing the upload.
- Finalized report access never grants access to private photos or chunks.

<details>
<summary><strong>Photo recovery and storage trade-offs</strong></summary>

SQL/Base64 storage has more overhead than blob storage, so images are optimized and downloaded
lazily. Interrupted uploads and failed deletions appear under **Photos needing attention** and can
be retried or discarded.

Upload errors identify whether starting the upload, writing a numbered photo part, or
verifying the image failed. The selected file is kept after failure so you can retry.
Transient HTTP errors and SDK request timeouts use bounded retries; ambiguous chunk
writes are checked before retrying to avoid duplicates.

Legacy native-storage records are retained, but Fabric cannot recover their image bytes through
the unsupported storage service. Re-upload the original image and remove the old record when
appropriate.

</details>

## Reference

### Architecture

```text
React + Vite
  ├── Fabric SSO through Rayfin Auth
  ├── Typed CRUD through Rayfin Data
  ├── Photo content in owner-protected SQL chunks
  ├── Upload validation and cleanup through Rayfin Functions
  └── Report generation through Rayfin Functions
        └── Azure Foundry model deployment
```

| Entity | Purpose |
| --- | --- |
| `Trip` | Assignment details, owner, and private header-photo selection |
| `TripDay` | Daily notes |
| `TripPhoto` | Photo metadata, state, and integrity manifest |
| `TripPhotoChunk` | Ordered image content |
| `TripReport` | Markdown, optional frozen photo cover, finalization, and share ID |

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Deploy backend changes and start Vite |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run test:responsive` | Run Playwright responsive tests in Chrome |
| `npm run rayfin:up` | Deploy auth, SQL data, functions, and hosting |

Responsive tests use isolated fixtures and start a test-only Vite server. Browser emulation does
not replace checking a physical mobile keyboard.

The functions build also loads its compiled entrypoint to catch missing runtime
imports before deployment. Shared runtime helpers live inside `rayfin/functions/`;
frontend code imports those same helpers without leaving runtime dependencies
outside the service. A successful TypeScript check alone does not guarantee that
the deployed function host can start.

Rayfin CLI and the Functions runtime are pinned to **1.36.0**. Keep them aligned:
this runtime requires metadata schema **2.0**, generated by CLI 1.36 during
deployment. Older CLIs cannot deploy this runtime correctly. Use the project's
`npm run rayfin:up` rather than an older global CLI.

<details>
<summary><strong>Project layout</strong></summary>

```text
rayfin/data/          Trip, day, photo, chunk, and report entities
rayfin/functions/     Photo validation/cleanup and Azure AI report generation
rayfin/rayfin.yml     Auth, SQL data, functions, and hosting
src/components/       Shared application and report UI
src/pages/            Dashboard, trip workspace, and shared report
src/services/         Typed Rayfin clients and trip operations
src/hooks/            Fabric authentication context
```

</details>

## More resources

- [Ray|Works design system](../DESIGN.md)
- [Ray|Works logo guide](../docs/logo.md)
- [Fabric Apps documentation](https://learn.microsoft.com/fabric/apps/)
- [Rayfin SDK documentation](https://aka.ms/rayfin/docs)
