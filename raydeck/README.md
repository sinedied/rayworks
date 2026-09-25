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

Use **Speaker notes** below the editor or in presenter mode to keep per-slide
talking points. Notes are plain text, share the same local save status, and are
included in **Copy changes as prompt**. Existing drafts without notes remain
compatible. Notes are excluded from audience messages and never rendered on
slides; they are not a security boundary against someone with access to the
same browser or bundled source.

The **− / +** controls change notes text from 14px to 48px in 2px steps (16px by
default). The size is shared between editor and presenter notes and remembered
in this browser. It changes only how notes are displayed, not their content.

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

Open **Present** and choose:

- **Start presentation** to present the active slide in the current window.
  It requests browser fullscreen; **Exit** or **Escape** returns to the editor
  without losing edits. Blocked/unsupported fullscreen falls back visibly to
  in-window presentation.
- **Enter presenter mode** to keep a presenter console in this window and open
  a separate audience window. The header-free console fills the window without
  page scrolling: the current slide is on the left, with a next-slide preview
  and speaker notes on the right. Long notes scroll inside their pane.
  The bottom bar holds navigation, a slide picker, save/export and theme actions,
  audience status/recovery, and an elapsed timer with pause/resume/reset.
  Reset retains the timer's running/paused state. Timer ticks are not saved or
  exported.

The presenter starts with **one third current slide / two thirds next slide and
notes**. Drag the vertical divider to adjust the split, or focus it and use
Left/Right arrows (2 percentage points per press), Home, or End. The current-slide
share ranges from 15% to 85%, with tighter limits on small windows to keep both
panes usable. The preferred ratio is remembered; temporarily shrinking a window
does not replace the ratio you chose for a larger screen.

Layout and notes-size preferences are stored separately from the deck. They are
not included in copied change prompts or audience updates, and resetting the
sample deck does not reset them. If browser storage is unavailable, adjustments
still work for the current tab and a notice explains that they cannot be remembered.

Navigation from either window stays synchronized. Move the audience window to
your display and choose **Enter fullscreen** there; browsers control whether a
new window or tab is opened and generally require a click in that window for
fullscreen. Leaving audience fullscreen keeps it connected.

Slideshow/audience controls hide after three seconds. Move the mouse into the
bottom 80px or tap that area to reveal them. Deliberately tabbing into the toolbar
also reveals it for keyboard use. Slide changes, navigation keys, and updates
from the presenter never bring hidden controls back or restart their hide timer.
Hovered or keyboard-focused controls stay visible. Presenter-console controls
never auto-hide.

Closing the audience window does not stop the timer: use **Reopen audience
window** to continue. Refreshing the audience reconnects to the current slide.
**End presentation** returns the presenter to the editor and closes its audience
window. Closing/reloading the presenter ends the session; if the connection is
lost unexpectedly, the audience freezes the last received slide with an explicit
notice rather than silently continuing.

This is a same-browser, same-device workflow using a paired window connection,
not a remote sharing link. Popup blockers, embedding sandbox policies, or opener
isolation can prevent it; the app shows an error/retry action instead of claiming
it is connected. Allow popups for the app or use single-window presentation.

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

Rayfin packages and the analytics pack's Rayfin declarations use the **1.35.1** stable
baseline, with resolved versions recorded in `package-lock.json`. The upgrade preserves
the offline sample, existing browser-local drafts, and presenter/audience behavior.
It does not enable app sign-in or Rayfin data, and the empty Fabric model profile remains
unchanged. Client factories use their configured absolute backend URL directly; the
deprecated no-op `useProxy` option is omitted.

Static hosting explicitly uses `assetAccess: public` to preserve the existing direct-link
and audience-window access. CLI 1.35.1 otherwise defaults an unspecified value to protected.
This does not enable anonymous data access; Rayfin data remains disabled.

Use a supported Node LTS version (20, 22, or 24). After upgrading the CLI, preview and
refresh its managed guidance with `npx rayfin init ai-files install --dry-run --json`
and `npx rayfin init ai-files install`. Keep custom agent instructions intact.

Before deploying, run `npm test`, `npm run lint`, and `npm run build`.
The separate `build:fabric` command generates Fabric configuration but skips TypeScript
checking, so it is not a replacement for the checked build.

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
