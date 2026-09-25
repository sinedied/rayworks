# Product themes

Ray|Stick and Ray|Burn inherit the [shared design contract](../DESIGN.md): IBM Plex Sans, neutral
surfaces, semantic feedback, 8px corners, and the same app shell. Standard header logos remain
32px desktop / 28px mobile. These are light-UI specifications, not application code or dark-UI
themes. [Logo rules and assets](logo.md) include separate dark-background wordmarks.

## Ray|Stick — sticker studio

Playful content, calm tools. Use a neutral workspace and white preview surfaces so the user's
sticker is the focus. Yellow identifies primary actions and selection; a checkerboard belongs only
behind transparent artwork. The logo's peeled-sticker `i` dot is the signature detail.

| Role | Color |
| --- | --- |
| Accent / hover / pressed | `#FFC629` / `#F0B916` / `#E0A80C` |
| On-accent text and icons | Navy `#0B2A5B` |
| Strong accent: links, focus, control/selection outline | Dark gold `#854D0E` |
| Soft accent / on-soft text | `#FFF7D6` / `#854D0E` |
| Favicon tile / initial | `#854D0E` / `#F8FAFC` |

## Ray|Burn — meeting and outcome cost

A calm cost dashboard, not an alarm panel. Use orange sparingly to emphasize the active calculation
and primary actions, with neutral surfaces and aligned tabular figures. Label currency, duration,
rate periods, and outcome units explicitly. Show assumptions and estimates separately from totals;
spend alone is not a measure of meeting value. The logo's flame sits inside the `B`.

| Role | Color |
| --- | --- |
| Accent / hover / pressed | `#F97316` / `#FA8128` / `#FB923C` |
| On-accent text and icons | Navy `#0B2A5B` |
| Strong accent: links, focus, control/selection outline | Burnt orange `#9A3412` |
| Soft accent / on-soft text | `#FFF1E6` / `#9A3412` |
| Favicon tile / initial | `#9A3412` / `#F8FAFC` |

Burn's hover/pressed fills intentionally lighten to retain navy-label contrast. Do not equate orange
with an error or color every cost red; retain the shared success/warning/error roles and text labels.

## Contrast and usage

| Measured pair | Stick | Burn |
| --- | --- | --- |
| Navy text on accent / hover / pressed | 8.93 / 7.79 / 6.53:1 | 5.01 / 5.50 / 6.20:1 |
| Strong accent text on soft accent | 6.37:1 | 6.60:1 |
| Strong accent on white / canvas / inset | 6.85 / 6.55 / 6.25:1 | 7.31 / 6.98 / 6.67:1 |
| Near-white favicon initial on its tile | 6.55:1 | 6.98:1 |

These text pairs exceed 4.5:1. Strong accent outlines exceed 3:1 against shared white, canvas, and
inset surfaces. Use a visible strong-accent border when a control depends on its outline, and a
2px focus outline with a 2px surface-colored offset; do not rely on the bright fill alone.
Underline links; reinforce selection with an outline and a check or label, not just color.

Raw yellow/orange logo lettering is decorative brand color, not accessible body/link text on white.
Keep canonical logo colors unchanged. Both new favicons use darker tiles and near-white initials;
their simplified peel/flame details use tile-colored cutouts rather than low-contrast navy strokes.
Do not turn the stronger favicon shades into a replacement for the primary logo accents.
