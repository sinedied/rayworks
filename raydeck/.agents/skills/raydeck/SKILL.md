---
name: raydeck
description: >
  Customize the Ray|Deck template into a short, branded presentation. Use when
  changing company fonts, colors, logos, slide copy, slide order, sample charts,
  or connecting a slide to a Microsoft Fabric semantic model.
---

# Ray|Deck customization

Ray|Deck is a focused 3–10 slide presentation template. Keep each deck concise,
editable, and presentation-ready. The app must remain useful with bundled sample
data, while Fabric-connected visuals can replace individual sample charts.

## Start here

1. Read the repository `DESIGN.md` and `docs/logo.md`.
2. Read `.agents/skills/rayfin/SKILL.md`; never recall Rayfin or Fabric APIs from
   memory.
3. Edit the deck model in `src/deck/sampleDeck.ts`.
4. Edit layout and interaction in `src/App.tsx`.
5. Edit visual tokens in `src/global.css`.
6. Build with `npm run build`. Do not start or deploy unless explicitly asked.

## Branding workflow

- Product branding uses the exact files in `public/raydeck.svg`,
  `public/raydeck-dark.svg`, and `public/favicon.svg`.
- For a customer deck, add exact customer-provided assets under `public/brand/`.
  Never redraw a supplied logo or recolor it in CSS.
- Change the shared color tokens in `src/global.css`, especially
  `--color-primary`, `--color-primary-strong`, `--color-ring`, and
  `--color-chart-1`. Keep navy or another dark neutral for primary text.
- Change `--font-display` and `--font-sans` together. Install a font package only
  when the requested font is licensed and not already available.
- Preserve WCAG AA contrast, 16:9 slide geometry, and the 28px minimum product
  wordmark height.

## Editing the deck

Each item in `SAMPLE_DECK` is one slide:

- `eyebrow`, `title`, and `body` are editable in the running app and persisted
  to browser local storage.
- `kind` selects a layout: `cover`, `metrics`, `chart`, `comparison`, or
  `closing`.
- `metrics` supplies the executive summary rows.
- `chart` is a Graphein `ChartSpec` with bundled fallback data.
- `source` states whether the visual is sample or Fabric-backed.

Keep the deck between 3 and 10 slides. Prefer one claim per slide, short titles,
and no more than one primary visual. Update slide `number` values when the slide
count changes; the footer total updates automatically.

## Connecting a Fabric semantic model

Use the version-pinned Fabric tooling already installed in this project:

1. Read `.agents/skills/fabric-data/SKILL.md`, `.agents/skills/dax/SKILL.md`, and
   `.agents/skills/headless-preview/SKILL.md`.
2. Add the model:
   `npx fabric-app-data add <alias> --from-url "<Fabric portal URL>"`.
3. Generate config:
   `npx fabric-app-data generate -o src/fabric.generated.ts`.
4. Discover only the tables and measures required for the slide.
5. Put each visual-grain query in `src/queries/<slide-name>.dax`.
6. Query through `useSemanticModelQuery`; always check `result.status`.
7. Map positional result rows deliberately before creating the Graphein spec.
8. Keep sample rows as an explicit preview fallback, not a silent production
   fallback.
9. Preview each finished spec with `npm run preview -- --spec ...` and fix all
   `ok:false` diagnostics before shipping.

Never hand-edit `src/fabric.generated.ts`, use raw `fetch`, or put formatting in
DAX. Aggregation belongs in DAX; number/date formatting belongs in the chart
spec.

## Presentation quality

- Use the thumbnail rail for editing and presentation mode for delivery.
- Titles should remain legible from a distance and body copy should stay above
  14px at normal presentation size.
- Format every axis and value. Avoid raw large numbers.
- Respect reduced-motion preferences and keyboard navigation.
- Keep browser-local persistence for template portability. Add Rayfin entities
  only when the user explicitly asks for shared, server-persisted decks; then
  route through the `data-modeling` and `authentication` skills first.
