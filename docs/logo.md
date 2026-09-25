# Ray|Works Logo Family

Canonical app logos live in `docs/logos/`. Each product has a light-background SVG and a
`-dark.svg` variant.

## Creating a logo

1. Copy the `Ray` path geometry and separator dimensions exactly from `rayworks.svg` and
   `rayworks-dark.svg` in this directory. Never redraw or typeset `Ray`.
2. Draw the product suffix as paths in the same rounded, bold style, baseline, spacing, and weight.
3. Use navy `#0B2A5B` for `Ray` on light backgrounds and near-white `#F8FAFC` on dark backgrounds.
4. Give the separator and complete suffix one unused product color from the brand palette.
5. Keep the SVG transparent, tightly cropped, and standalone. Do not use `<text>`, raster images,
   external fonts, scripts, or external styles.
6. Add product-specific `<title>` and `<desc>` metadata. App-local runtime copies must remain exact
   copies of the canonical files.
7. Give each product one subtle motif integrated into an existing suffix letter. It must communicate
   the product at compact header size without becoming a separate icon. Use the light/dark `Ray`
   color for the motif detail.

Each app displays only its own product logo. Ray|Works is reserved for suite-level and portal
surfaces; do not combine it with an app wordmark. App-local SVGs are deployment copies and must
remain byte-identical to their canonical files. Select light/dark variants for background contrast
rather than recoloring the SVG in application CSS.

Use a 32px wordmark height in standard desktop app headers and 28px on mobile. Auth or hero
placements may use 36–40px. Avoid rendering motif-bearing wordmarks below 28px; use the product
favicon when only a compact square is available.

## Product colors

| Product | Light `Ray` | Dark `Ray` | Separator and suffix |
| --- | --- | --- | --- |
| Ray\|Works | `#0B2A5B` | `#F8FAFC` | Brand blue `#2F80FF` |
| Ray\|Forms | `#0B2A5B` | `#F8FAFC` | Blue `#2F80FF` |
| Ray\|Live | `#0B2A5B` | `#F8FAFC` | Teal `#00C2AB` |
| Ray\|Trip | `#0B2A5B` | `#F8FAFC` | Coral `#FF6B6B` |
| Ray\|Deck | `#0B2A5B` | `#F8FAFC` | Purple `#7C3AED` |
| Ray\|Stick | `#0B2A5B` | `#F8FAFC` | Yellow `#FFC629` |
| Ray\|Burn | `#0B2A5B` | `#F8FAFC` | Orange `#F97316` |

Yellow is assigned to Stick; orange extends the palette for Burn. These bright logo accents are
not normal UI text colors on white. See [product themes](themes.md) for accessible functional
shades and interaction states.

## Product motifs

| Product | Integrated motif |
| --- | --- |
| Ray\|Works | Smile inside the `o` |
| Ray\|Forms | Checkmark inside the first `o` |
| Ray\|Live | Broadcast beacon as the `i` dot |
| Ray\|Trip | Location pin as the `i` dot |
| Ray\|Deck | Slide-content lines inside the `D` |
| Ray\|Stick | Peeled sticker with a lifted corner replacing the `i` dot |
| Ray\|Burn | Flame inside the lower `B` counter |

## Favicons

Canonical favicons live in `docs/favicons/`. Full wordmarks are not legible at browser-tab size, so
each favicon uses a product-family rounded tile, a near-white product initial, and a simplified
motif. Stick and Burn darken only their tiles to maintain initial contrast; their motifs use
tile-colored cutouts instead of navy on dark backgrounds.

| Product | Initial | Tile | Motif |
| --- | --- | --- | --- |
| Ray\|Works | `W` | Blue | Smile |
| Ray\|Forms | `F` | Blue | Checkmark |
| Ray\|Live | `L` | Teal | Broadcast beacon |
| Ray\|Trip | `T` | Coral | Location pin |
| Ray\|Deck | `D` | Purple | Slide-content lines |
| Ray\|Stick | `S` | Dark gold `#854D0E` | Peeled sticker |
| Ray\|Burn | `B` | Burnt orange `#9A3412` | Flame-shaped counter |

App-local `favicon.svg` files must be exact copies of these canonical assets.
