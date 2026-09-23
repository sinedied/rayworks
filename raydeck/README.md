# Ray|Deck

Ray|Deck is a short-form presentation template for turning Microsoft Fabric data
into a concise, editable 3–10 slide narrative. The included five-slide sample
runs with bundled data, supports inline text editing and browser-local drafts,
and includes a distraction-free presentation mode.

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
