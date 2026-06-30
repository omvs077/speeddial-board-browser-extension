# SpeedDial Board

A Manifest V3 browser extension that replaces the new tab page with a Vivaldi-style speed dial dashboard. Bookmarks live in an isolated `Dashboard Hub` folder using the native `chrome.bookmarks` API (so they sync across devices but stay out of the visible bookmark bar), grid density is explicitly controlled (4–10 columns), and a bottom dock holds three resizable, toggleable widgets: geolocation weather (Open-Meteo), a live clock with ISO week tracking, and a local to-do list.

## Load it (Chrome, Edge, Brave, Ulaa, or any Chromium browser)

1. Open `chrome://extensions` (or the equivalent in your browser, e.g. `ulaa://extensions`).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `SpeedDial-Board` folder.
4. Open a new tab — the dashboard should load immediately.

Since Ulaa is Chromium-based, the same Manifest V3 extension loads there without changes.

## Features

- Isolated, natively-synced bookmark folders (Home, developer, Entertainment, shopping by default — fully customizable)
- Explicit speed dial grid (4–10 columns), auto-scaling icon sizes
- Drag-and-drop bookmark reordering
- Swipe / trackpad gestures to switch categories
- Custom right-click context menu (switch collection, toggle widgets, grid density, add collection)
- Inline add/edit modal for bookmarks (no native browser prompts)
- Category rename/delete
- Weather widget with 3-day forecast pager (Open-Meteo, no API key)
- Live clock with full date + ISO calendar week number
- Local to-do list (`chrome.storage.local`)
- Per-widget size control (small/medium/large) and show/hide toggle
- Light/dark mode synced to system preference

## File layout

```
SpeedDial-Board/
├── manifest.json
├── newtab.html
├── css/
│   ├── main.css         # tokens, reset
│   ├── grid.css         # explicit column grid + drag states
│   └── components.css   # glass cards, ribbon, widgets, context menu
├── js/
│   ├── bookmarks.js      # isolated folder CRUD via chrome.bookmarks
│   ├── widgets.js         # weather / clock / todo
│   ├── UIController.js    # rendering, drag-drop, swipe, context menu, prefs
│   └── app.js             # boot sequence
└── icons/                 # toolbar/store icons (placeholder art — swap freely)
```
## Notes

- The placeholder icons in `icons/` are simple generated shapes — replace them with your own artwork before publishing to a store.
- Favicons are fetched via Google's public favicon endpoint (`https://www.google.com/s2/favicons`); no API key needed.

Crafted by **Dvvyom** | [GitHub](https://github.com/omvs077) |
[omvs077@gmail.com](mailto:omvs077@gmail.com) — suggestions/feedback welcome
