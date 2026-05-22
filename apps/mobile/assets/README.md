# Mobile App Assets

Drop production PNGs here before running `eas build`. Brand color: `#1f7a4d` (leaf green) on `#ffffff` or vice versa.

## Required files

| File | Size | Notes |
|---|---|---|
| `icon.png` | **1024×1024** | App icon, full bleed, no transparency. iOS will round the corners automatically. |
| `adaptive-icon.png` | **1024×1024** | Android adaptive foreground. Keep the brand mark inside the inner **66% safe area** (≈ 338px margin all sides). Transparent background. |
| `splash.png` | **1284×2778** (or any 2:3-ish) | Shown on cold start, centered (resizeMode: contain) on `#1f7a4d`. Use a white version of the logo. |
| `notification-icon.png` | **96×96** | Optional. Android notification icon — must be flat white on transparent. |

## Generation tips
- Figma: 1024×1024 frame, brand bg, centered leaf glyph (60% of frame), export PNG @1x.
- Quick CLI from an SVG: `npx svgexport icon.svg icon.png 1024:1024`.
- For pure-text "SmokeShop" mark: 700 weight, letter-spacing -0.02em, white on `#1f7a4d`.

## Store screenshots (separate — don't commit, upload to App Store Connect / Play Console)
- **iPhone 6.7"**: 1290×2796 — 3–5 screens (login, owner dashboard, store cards, employee close, success state).
- **iPhone 6.5" / 5.5"**: required by App Store. Easiest path: capture 6.7" then scale.
- **Android phone**: 1080×1920 minimum, up to 8 screens.
- **iPad**: not required (`supportsTablet: false` in `app.json`).
