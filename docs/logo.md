# Ray|Works Logo Family

Canonical app logos live in `docs/logos/`. Each product has a light-background SVG and a
`-dark.svg` variant.

## Creating a logo

1. Copy the `Ray` path geometry and separator dimensions exactly from the existing root Ray|Works
   SVGs. Never redraw or typeset `Ray`.
2. Draw the product suffix as paths in the same rounded, bold style, baseline, spacing, and weight.
3. Use navy `#0B2A5B` for `Ray` on light backgrounds and near-white `#F8FAFC` on dark backgrounds.
4. Give the separator and complete suffix one unused product color from the brand palette.
5. Keep the SVG transparent, tightly cropped, and standalone. Do not use `<text>`, raster images,
   external fonts, scripts, or external styles.
6. Add product-specific `<title>` and `<desc>` metadata. App-local runtime copies must remain exact
   copies of the canonical files.

## Product colors

| Product | Light `Ray` | Dark `Ray` | Separator and suffix |
| --- | --- | --- | --- |
| Ray\|Forms | `#0B2A5B` | `#F8FAFC` | Blue `#2F80FF` |
| Ray\|Live | `#0B2A5B` | `#F8FAFC` | Teal `#00C2AB` |
| Ray\|Trip | `#0B2A5B` | `#F8FAFC` | Coral `#FF6B6B` |
| Ray\|Deck | `#0B2A5B` | `#F8FAFC` | Purple `#7C3AED` |

Yellow `#FFC629` is currently unused. Check its contrast before assigning it as lettering on a
light background.
