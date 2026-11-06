<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/logos/rayatlas-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../docs/logos/rayatlas.svg">
  <img src="../docs/logos/rayatlas.svg" alt="Ray|Atlas" height="72">
</picture>

**Tell cinematic, data-driven stories on an interactive globe.**

[![Built with Copilot](https://img.shields.io/badge/Built%20with-Copilot-8957E5?style=flat-square&logo=githubcopilot&logoColor=white)](https://github.com/features/copilot)
[![Microsoft Fabric Apps](https://img.shields.io/badge/Microsoft-Fabric%20Apps-7FBA00?style=flat-square&logo=microsoft&logoColor=white)](https://learn.microsoft.com/en-us/fabric/apps/overview)
[![Rayfin SDK](https://img.shields.io/badge/Rayfin-SDK-00C2AB?style=flat-square)](https://aka.ms/rayfin/docs)
[![MapLibre GL](https://img.shields.io/badge/MapLibre-GL-396CB2?style=flat-square&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[&larr; Ray|Works](../README.md) &middot;
[Features](#features) &middot;
[Getting started](#getting-started) &middot;
[Private access](#private-access-and-data) &middot;
[Customize](#customize) &middot;
[Reference](#reference)

</div>

## Overview

Ray|Atlas is a story map app built with
[Microsoft Fabric Apps](https://learn.microsoft.com/en-us/fabric/apps/overview),
[Project Rayfin](https://aka.ms/rayfin/docs), React, and MapLibre GL. A narrative unfolds as
readers scroll: each chapter flies the camera across a night globe, highlights the sites and routes
it talks about, and states the numbers behind it.

The bundled story, **Ridgeline Coffee: From ridge to cup**, follows a fictional coffee supply chain
from highland farms in Colombia, Ethiopia, and Brazil, through the export ports of Cartagena,
Djibouti, and Santos, across the sea lanes to a Hamburg roastery, then out to four European
distribution centers and the cafés they serve. Swap the story and the network to tell supply chain
reviews, expansion plans, sustainability updates, or quarterly business reviews in the same format.

## Features

- **Scroll-driven chapters** - camera flights, focus highlights, animated routes, and count-up
  metrics follow the chapter in view, with `#chapter` deep links.
- **Cinematic basemap** - a custom night style on a 3D globe with atmosphere, hillshade, terrain,
  3D buildings, and a graticule that marks the Equator and Tropics.
- **Data-backed metrics** - chapter figures are computed from shared `Site` and `Route` rows
  instead of typed into the copy.
- **Presentation mode** - fullscreen or in-window, keyboard navigation, autoplay, and controls that
  auto-hide while presenting.
- **In-place editing** - rewrite titles, body copy, and metric labels, and capture the current map
  view as a chapter's camera.
- **Browser-local drafts** - edits save in the browser and export as a precise reintegration prompt.
- **Responsive and accessible** - a docked map on small screens, keyboard-reachable chapters, and
  reduced-motion support that replaces flights with cuts.
- **Protected access** - Fabric Entra SSO gates every surface.

## Getting started

### Prerequisites

- Node.js 20.19+, 22.12+, or 24.x
- A Microsoft Fabric workspace with Fabric Apps enabled

Install dependencies and start the Rayfin development workflow:

```bash
npm install
npm run dev
```

The first run asks for the target Fabric workspace, provisions the protected app, and starts Vite.
Deploy later changes with:

```bash
npm run rayfin:up
```

The story, sample network, and basemap need no API keys.

## Private access and data

> [!WARNING]
> Every Ray|Atlas surface requires Microsoft Fabric Entra SSO: reader, editor, and presentation.
> Do not add public or anonymous access without explicit product and security approval.

- Static hosting uses `assetAccess: protected`; password authentication remains disabled.
- The `Site` and `Route` Rayfin entities grant authenticated **read** access only. Atlas has no
  create, update, delete, or admin UI.
- The default `sample` source is the bundled, fictional Ridgeline Coffee network, visibly labeled
  **Sample data**. With shared rows the chapter text is still the sample narrative, so the label
  reads **Sample story** until you replace it.
- Set `VITE_ATLAS_DATA_SOURCE=rayfin` (in `packages/frontend/.env.local` for local development, or
  the build environment for deployment) to read shared rows instead.
- Load rows through an approved ingestion or administration path outside this read-only client.
  Do not temporarily grant every signed-in user write access just to seed data.
- If a refresh fails, Atlas keeps the last successfully loaded network and offers a retry.

<details>
<summary><strong>Site and Route contracts</strong></summary>

The browser-safe contracts live in `packages/shared/src/index.ts`:

```text
Site:  id, code, name, role (origin | port | plant | distribution | customer),
       city, country, latitude, longitude, summary, capacityTonnes, outlets,
       elevationMeters, updatedAt
Route: id, code, name, mode (sea | rail | road | air), originCode, destinationCode,
       waypoints (JSON [longitude, latitude][]), annualVolumeTonnes, transitDays,
       co2Tonnes, updatedAt
```

Routes reference sites by `code`, and chapters select both by code, role, mode, or code prefix.
Sea routes store intermediate waypoints so lanes follow real shipping corridors; the frontend
densifies them along great circles for the globe.

</details>

## Editing and presenting

Open **Edit story** (or add `?mode=edit` to the URL) to edit the title, subtitle, chapter eyebrows,
titles, body copy, and metric labels in place. The map becomes interactive: pan, tilt, and zoom,
then **Use current view** to save that camera for the chapter.

Edits save in the browser. **Copy changes as prompt** exports only changed fields with stable
chapter and metric IDs and original/replacement values, ready for a coding agent to apply to
`sampleStory.ts`; it never modifies source files or creates a commit.

<details>
<summary><strong>Draft behavior</strong></summary>

- Drafts are stored under `rayatlas.story.<story id>.v<version>`. Bumping the story `version`
  discards drafts made against an older chapter layout.
- The comparison baseline is the bundled story in the running app, not a live Git checkout.
  Conflicting source values are reported instead of overwritten by the exported prompt.
- If browser storage is unavailable or a stored draft is unreadable, current edits remain available
  for prompt export, and **Reset sample story** explicitly replaces the stored draft.
- Drafts survive sign-out. On a shared browser profile the next authenticated user can see them;
  reset the story or clear site data before signing out of a shared device.

</details>

<details>
<summary><strong>Presentation controls</strong></summary>

- **Present fullscreen** requests native fullscreen with an in-window fallback; **Present in this
  window** stays windowed with the same layout and controls.
- Navigate with <kbd>→</kbd>, <kbd>↓</kbd>, <kbd>Page Down</kbd>, or <kbd>Space</kbd>; go back
  with <kbd>←</kbd>, <kbd>↑</kbd>, <kbd>Page Up</kbd>, or <kbd>Shift</kbd>+<kbd>Space</kbd>;
  jump with <kbd>Home</kbd> and <kbd>End</kbd>; exit with <kbd>Esc</kbd>.
- **Autoplay** advances after a dwell time based on each chapter's length and stops on any manual
  navigation.
- Controls auto-hide and return on pointer, touch, or keyboard focus. Exiting returns the reader to
  the chapter the presentation ended on.

</details>

## Customize

- **Story** - edit `packages/frontend/src/story/sampleStory.ts`: chapter copy, camera, focus
  (site and route codes, roles, modes), metrics, terrain, and route animation. Keep chapter and
  metric IDs stable, and bump `version` when the chapter layout changes.
- **Network data** - replace `packages/frontend/src/data/sample-network.ts` and keep synthetic
  data labeled, or load shared rows and switch to `VITE_ATLAS_DATA_SOURCE=rayfin`. Change the
  schema in `packages/shared/src/index.ts`, `packages/data/src/Site.ts`,
  `packages/data/src/Route.ts`, and `packages/frontend/src/services/network.service.ts` together.
- **Branding** - edit canonical assets under `../docs/`, then copy them byte-for-byte into
  `packages/frontend/src/assets/`.
- **Theme** - use the tokens in `packages/frontend/src/global.css` and the basemap palette in
  `packages/frontend/src/map/atlas-style.ts`.

### Basemap

Atlas generates its style in code over public, no-key services: [OpenFreeMap](https://openfreemap.org)
vector tiles and fonts, and [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
on AWS Open Data for hillshade and 3D terrain. Configure it with build-time variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_ATLAS_MAP_STYLE_URL` | unset | Full MapLibre style URL; replaces the generated basemap |
| `VITE_ATLAS_TILES_URL` | OpenFreeMap planet | OpenMapTiles-schema vector tiles (TileJSON or `{z}/{x}/{y}`) |
| `VITE_ATLAS_GLYPHS_URL` | OpenFreeMap fonts | Glyph URL template for labels |
| `VITE_ATLAS_DEM_URL` | AWS terrarium tiles | Raster DEM for hillshade and terrain; empty or `none` disables both |
| `VITE_ATLAS_DEM_ENCODING` | `terrarium` | `terrarium` or `mapbox` |
| `VITE_ATLAS_BUILDINGS` | `true` | `false` turns off 3D buildings |
| `VITE_ATLAS_MAP_VARIANT` | `night` | `night` or `day` palette |

> [!IMPORTANT]
> Keep provider attribution visible. The default basemap requires credit to OpenFreeMap,
> © OpenMapTiles, and © OpenStreetMap contributors, plus Mapzen Terrain Tiles via AWS Open Data
> (USGS, NOAA, Copernicus, and others). Atlas shows it through the map's attribution control. A
> custom style or tile source must carry its own attribution, and private tokens never belong in
> committed source files.

## Reference

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Deploy Rayfin services and start Vite |
| `npm run dev:frontend` | Start only the Vite frontend |
| `npm run build` | Build the data package and the frontend |
| `npm run build:fabric` | Build for Fabric hosting without TypeScript checking |
| `npm run typecheck` | Type-check every workspace package |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run rayfin:up` | Deploy the protected app to Fabric |

Run `npm run typecheck`, `npm run build`, `npm run lint`, and `npm test` before deployment.
`build:fabric` is not a replacement for the checked build.

### Architecture

One MapLibre instance serves the reader, editor, and presentation. React owns layout and story
state; the map engine owns sources, layers, markers, camera choreography, and animation. MapLibre
loads as a separate chunk so authentication and the app shell do not wait for it.

```text
packages/data/src/Site.ts, Route.ts            Read-only Rayfin entities
packages/shared/src/index.ts                   Browser-safe typed contracts
packages/frontend/src/
  story/sampleStory.ts                         Bundled story: chapters, cameras, focus, metrics
  story/metrics.ts, draft.ts                   Metric evaluation and browser-local drafts
  data/sample-network.ts                       Fictional Ridgeline Coffee network
  services/network.service.ts                  Sample or Rayfin data source
  hooks/use-network.ts                         Loading, last-good data, and retry
  map/atlas-style.ts                           Generated night/day basemap and env configuration
  map/story-map-engine.ts                      Camera flights, layers, markers, and animation
  components/StoryExperience.tsx               Reader, editor, and presentation modes
```

Story scenes, metrics, drafts, navigation, label placement, route geometry, and style generation
are unit-tested without WebGL.

## More resources

- [Ray|Works design system](../DESIGN.md)
- [Ray|Works logo guide](../docs/logo.md)
- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [Fabric Apps documentation](https://learn.microsoft.com/fabric/apps/)
- [Rayfin SDK documentation](https://aka.ms/rayfin/docs)
