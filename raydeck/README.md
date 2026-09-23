# Ray|Deck

Ray|Deck is a short-form presentation template for turning Microsoft Fabric data
into a concise, editable 3–10 slide narrative. The included five-slide sample
runs with bundled data, supports inline text editing and browser-local drafts,
and includes a distraction-free presentation mode.

## Edit, save, and reintegrate

Edit the eyebrow, title, or body directly on a slide. The thumbnail, editor, and
presentation use the same 16:9 composition, including charts. Text wraps and
automatically fits within its region. If it cannot fit at the minimum readable
size, an editor warning identifies the slide and field to shorten; the full text
remains available in the text control and exported prompt.

A checkmark beside **Saved locally** confirms that the current edits were saved
in this browser. Open that menu and choose **Copy changes as prompt**, then paste
the prompt into your coding assistant in this repository. It includes only
changed text fields, stable slide IDs, and original/replacement values, with
instructions to follow `DESIGN.md` and preserve the rest of the deck. Copying
does not modify source files or commit anything.

The comparison baseline is the bundled deck in the running app, not a live Git
checkout. If the source has changed since then, the prompt asks the assistant to
report conflicting values instead of overwriting them. Export is disabled when
there are no local changes. If clipboard access fails, the menu provides the
prompt for manual copying.

Local saving is not cloud synchronization. If storage is blocked or full, the
app displays an error and keeps edits available for prompt export. An unreadable
stored draft is not automatically overwritten; **Reset sample deck** explicitly
replaces it with the bundled sample.

## Present

**Present** requests browser fullscreen for the active slide. Use arrow keys or
the navigation buttons to move between slides; **Exit** or **Escape** returns to
the editor without losing edits. If fullscreen is unsupported or blocked (for
example, by an embedding host), presentation continues in the current window
with a visible notice.

## Customize

The project-specific workflow lives in `.agents/skills/raydeck/SKILL.md`. It
covers:

- company fonts, colors, logos, and chart palette;
- slide copy, order, layouts, and sample data;
- Fabric semantic-model connections with `fabric.yaml`;
- DAX queries and Graphein visual validation.

The canonical Ray|Deck wordmarks and favicon are copied into `public/` from the
Ray|Works brand assets and must remain exact copies.

## Commands

| Command | Description |
| --- | --- |
| `npm run gallery` | Open the sample deck in a local Vite preview |
| `npm run build` | Type-check and create the production build |
| `npm run preview -- --spec <file>` | Render one Graphein spec to PNG and diagnostics |
| `npm test` | Run the project test suite |
| `npm run lint` | Run ESLint |
| `npm run rayfin:up` | Deploy the app to Microsoft Fabric |

## Structure

```text
├── .agents/skills/raydeck/SKILL.md  # Branding, editing, and Fabric workflow
├── fabric.yaml                       # Semantic-model connection profiles
├── public/                           # Canonical Ray|Deck brand assets
├── rayfin/rayfin.yml                 # Rayfin services and static hosting
└── src/
    ├── App.tsx                       # Editor, thumbnails, and presentation mode
    ├── deck/sampleDeck.ts            # Five-slide sample content and chart specs
    ├── global.css                    # Ray|Deck visual tokens and layouts
    ├── hooks/use-semantic-model-query.ts
    └── components/Chart.tsx          # Graphein React binding
```

The template keeps Rayfin data disabled because slide content is stored locally
and analytics are read from an existing Fabric semantic model. Enable Rayfin
data and authentication only when shared, server-persisted decks are required.
