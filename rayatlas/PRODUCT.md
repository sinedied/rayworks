# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Authenticated Microsoft Fabric users who present spatial narratives: operations and supply chain
leads walking through a network review, strategy teams pitching an expansion plan, sustainability
owners explaining where emissions come from, and account teams running quarterly business reviews.
Their audiences are executives, partners, and colleagues who need to understand a story about
places, flows, and distances quickly, either reading on their own or watching it presented.

## Product Purpose

Ray|Atlas turns shared location and route data into a cinematic story map. Each chapter pairs a
short passage with a camera move, a focused set of sites and routes, and a few figures computed
from the data. Success means a reader understands how the network fits together and why it
matters by the last chapter, and a presenter can tell the same story fullscreen without switching
tools.

## Positioning

Ray|Atlas is the Ray|Works template for stories where geography drives the narrative. Ray|Deck
frames a story as slides with charts; Atlas frames it as one continuous flight across a living
globe, where where things are and how they connect is the argument. It is a storytelling surface,
not a GIS workspace or an operational dashboard. The bundled story, data, and basemap are all
replaceable for another company or industry.

## Operating Context

Users open Atlas inside Fabric or as a protected standalone app, usually on a laptop or a meeting
room display, and sometimes on a phone to read ahead. The default story uses the fictional
Ridgeline Coffee network; the app can switch to shared read-only Rayfin `Site` and `Route` rows.
The main flows are scrolling the reader, presenting with keyboard or autoplay, and editing copy and
camera views before exporting the changes as a prompt.

## Capabilities and Constraints

- Fabric Entra SSO and protected static hosting are required; password auth stays disabled.
- The story lives in code (`sampleStory.ts`). In-app edits are browser-local drafts exported as a
  reintegration prompt; there is no server-side story storage or collaborative editing.
- `Site` and `Route` data is read-only in the client. Chapter metrics are computed from it, never
  typed into copy.
- MapLibre renders a generated night or day basemap over public no-key services by default, with
  environment overrides for tiles, glyphs, terrain, buildings, or a full style.
- One MapLibre instance serves reading, editing, and presenting.
- Out of scope: data CRUD, multi-story libraries, choropleths, heatmaps, time sliders, live
  tracking, and geometry editing.
- Sample content and basemap attribution remain visible; style and data failures are explicit.

## Brand Commitments

Ray|Atlas belongs to the Ray|Works family and follows the root `DESIGN.md`: Ray|Name wordmark,
IBM Plex Sans, navy and neutral application chrome, 4px spacing rhythm, accessible focus and
contrast, and app-local copies of canonical assets. The story stage is a deep navy night scene
where Atlas yellow is the only warm light: routes, focus rings, and progress. Darker ochre carries
functional controls on light surfaces where yellow lacks contrast.

## Evidence on Hand

- Root product positioning and application list: `../README.md`
- Shared visual and interaction contract: `../DESIGN.md`
- Canonical logo construction rules and existing family assets: `../docs/logo.md`
- Presentation and draft conventions to mirror: `../raydeck/README.md`
- Fictional Ridgeline Coffee story and network in `packages/frontend/src/story/sampleStory.ts` and
  `packages/frontend/src/data/sample-network.ts`

No customer names, operational benchmarks, or production network data are available and none
should be fabricated. Places are real; companies, volumes, and metrics are sample values.

## Product Principles

- Let geography carry the argument: every chapter earns its camera move.
- Keep the map the hero; copy stays short and the chrome recedes.
- Compute numbers from data so the story stays honest when the data changes.
- Label sample content plainly and make the path to real data obvious.
- One story, two ways to tell it: reading and presenting share the same chapters and map.
- Preserve a useful last-good view when data refreshes fail.

## Accessibility & Inclusion

Meet WCAG AA for text, controls, focus indicators, and meaningful boundaries. All chapter content,
metrics, and navigation are available as text and by keyboard without interacting with the map.
Presentation mode is fully keyboard operable and its controls return on focus. Respect
`prefers-reduced-motion` by replacing camera flights and route animation with direct cuts. Mobile
and coarse-pointer targets are at least 44px.
