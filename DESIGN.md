# Ray|Works Design

## Brand

- Use `docs/logos/rayworks.svg` on light backgrounds and `docs/logos/rayworks-dark.svg` on dark
  backgrounds. Keep their proportions, clear space, and colors intact; do not recreate them with a
  font.
- Product names follow the `Ray|Name` pattern: Ray|Forms, Ray|Live, Ray|Trip, Ray|Deck.
- Prefer the full wordmark on primary brand surfaces. Use a compact text treatment only where the
  full mark would not fit.
- See [`docs/logo.md`](docs/logo.md) for app-logo construction rules and product color assignments.

## Color

| Role | Color |
| --- | --- |
| Brand navy | `#0B2A5B` |
| Brand blue | `#2F80FF` |
| Teal | `#00C2AB` |
| Purple | `#7C3AED` |
| Yellow | `#FFC629` |
| Coral | `#FF6B6B` |
| Light neutral | `#E5E7EB` |
| Dark neutral | `#1F2937` |

Each app uses its logo's accent for primary actions and selected states: Forms blue, Live teal,
Trip coral, Deck purple. Keep secondary controls neutral and semantic colors independent of
product accents. Never recolor logos to match a UI state.

| Shared UI role | Color |
| --- | --- |
| Canvas / surface / inset | `#F8FAFC` / `#FFFFFF` / `#F1F5F9` |
| Heading / body / muted text | `#0B2A5B` / `#1F2937` / `#4B5563` |
| Subdued metadata | `#6B7280` |
| Subtle / control border | `#E5E7EB` / `#CBD5E1` |
| Success / tint | `#047857` / `#ECFDF5` |
| Warning / tint | `#9A6700` / `#FFFBEB` |
| Error / tint | `#B42318` / `#FEF3F2` |
| Information / tint | `#246BDB` / `#EDF5FF` |

Use local semantic tokens for accent, strong accent, soft accent, and on-accent text. Functional
shades may differ from the logo: Forms uses `#246BDB` with white action labels; Live teal and Trip
coral use navy labels; Deck purple uses white. Check hover/pressed states too. Use strong accent
shades for links and focus, not low-contrast decorative colors. Text must meet WCAG AA (4.5:1 for
normal text); meaningful control boundaries and focus indicators need 3:1 contrast.

## App shell

- Standard headers are sticky at the top, z-index 20, with an opaque surface and 1px bottom border.
  Total height, including the border: 64px desktop, 56px below 640px.
- Use full-width headers with 24px horizontal padding, 16px below 640px; no centered width cap.
  Logo height is 32px desktop / 28px mobile. Keep its aspect ratio and link home where applicable.
- Put the app logo left and account controls right. Show one truncated email (name fallback) and
  a quiet **Sign out** action; hide identity text on mobile, not the action. No extra avatar/menu.
- Put back navigation, page titles, and workflow actions in the main content below the header.
  Let the page toolbar wrap, not the header. Content widths may differ by task.
- Deck may keep its document context and reset/theme/Present controls in the header; hide
  nonessential context first on small screens. Do not add account UI to an unauthenticated app.
- Auth pages use the same brand-only header geometry, without account controls. Their content
  layouts can differ. Audience, embedded, remote, and slideshow views need no management header.

## UI

- Load IBM Plex Sans for app UI, with a system fallback. Use weight 600 for headings, 14px+
  body/control text, and 12px+ metadata. Standard page titles are 24px mobile / 30px desktop;
  section titles are 18-20px. Keep monospace for codes and aligned figures.
- Use a 4px spacing base, favoring 8/12/16/24/32px gaps; 8px corners, subtle borders, restrained
  shadows. Standard controls are 40px tall; compact desktop controls may be 36px. Mobile/coarse
  pointer targets are at least 44px. UI icons are 16-20px and icon-only controls have accessible names.
- Secondary controls use neutral surfaces/borders. Keep visible keyboard focus, disabled states,
  and semantic error feedback. Prefer calm functional UI; respect reduced-motion preferences.
- Preserve task-specific content: slide/thumbnail typography, charts, report prose, public forms,
  and audience/presentation layouts. Live room themes retain their colors and readable branding;
  Deck retains its dark mode with corresponding dark roles. Do not force universal content widths.
- Reuse app-local components and tokens; this contract does not require a shared runtime library.
