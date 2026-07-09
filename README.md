# SpeedDial Board

A Manifest V3 browser extension that replaces the new tab page with a Vivaldi-style speed dial dashboard. Bookmarks live in an isolated `Dashboard Hub` folder using the native `chrome.bookmarks` API (so they sync across devices but stay out of the visible bookmark bar), grid density is explicitly controlled (4–10 columns), and a bottom dock holds three resizable, toggleable widgets: weather, a live clock with ISO week tracking, and a local to-do list.

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
- Fixed settings menu, opened via a dedicated trigger button (vertically centered, scrollable, clamped to viewport)
- Custom right-click context menu on categories and individual dial tiles (rename/delete, open all in new tabs, edit/remove link)
- Inline add/edit modal for bookmarks (no native browser prompts)
- **Search bar** with relevance-ranked autosuggestions blending:
  - Bookmarked pages
  - Browsing history (ranked by visit count)
  - Live web suggestions (via Google's suggest API)
  - Your own recent searches (removable individually)
  - Configurable engine: Google, Bing, or DuckDuckGo
- **Weather widget**: 3-day forecast pager, full WMO condition coverage, wind + live temperature. If location access is denied (by the browser or another extension), falls back to manual city entry with geocoding, plus a direct link to Chrome's location settings. City choice is remembered and changeable anytime from the widget menu.
- Live clock with full date + ISO calendar week number
- Local to-do list (`chrome.storage.local`)
- Per-widget size control (small/medium/large) and show/hide toggle
- **Wallpaper system**: upload a custom image or a short video (up to 100MB) as your background. Dominant-color sampling adapts card/text contrast automatically; wallpaper-free state uses your OS/browser's light-dark system theme throughout.
- Light/dark mode synced to system preference by default

## Permissions

| Permission | Used for |
|---|---|
| `bookmarks` | Reading/organizing your isolated speed-dial folder |
| `storage` | Saving preferences, recent searches, and image wallpapers locally |
| `unlimitedStorage` | Storing larger local data, e.g. video wallpapers |
| `tabs` | "Open all in new tabs" on a category |
| `history` | Matching browsing history in search suggestions |
| `geolocation` | Local weather (optional — manual city entry is always available) |

Full breakdown of data handling: see [`PRIVACY.md`](./PRIVACY.md).

## File layout

```
SpeedDial-Board/
├── manifest.json
├── newtab.html
├── PRIVACY.md
├── css/
│   ├── main.css         # tokens, reset, wallpaper layer
│   ├── grid.css         # explicit column grid + drag states
│   └── components.css   # glass cards, ribbon, widgets, context menu, search
├── js/
│   ├── bookmarks.js      # isolated folder CRUD via chrome.bookmarks
│   ├── widgets.js         # weather / clock / todo
│   ├── videoStorage.js    # IndexedDB helper for video wallpaper blobs
│   ├── UIController.js    # rendering, drag-drop, swipe, context menu, search, wallpaper, prefs
│   └── app.js             # boot sequence
└── icons/                 # toolbar/store icons (placeholder art — swap freely)
```

## Notes

- Favicons are fetched via Google's public favicon endpoint (`https://www.google.com/s2/favicons`); no API key needed.
- Weather and manual-city geocoding use Open-Meteo (`api.open-meteo.com`, `geocoding-api.open-meteo.com`) — no API key needed.
- Web search suggestions use Google's public suggest endpoint (`suggestqueries.google.com`) regardless of your selected search engine.
- Video wallpapers play natively via HTML5 `<video>`; supported formats depend on your browser's codec support (MP4/H.264 and WebM are safest).

Crafted by **Dvvyom** | [GitHub](https://github.com/omvs077) |
[omvs077@gmail.com](mailto:omvs077@gmail.com) — suggestions/feedback welcomed

## License

[MIT](./LICENSE)