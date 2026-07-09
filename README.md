# SpeedDial Board

A new-tab dashboard extension with a Vivaldi-style speed dial grid, live widgets, and custom wallpapers — bookmarks stay in their own isolated folder so they sync but don't clutter your bookmark bar.

## Install (any Chromium browser)

1. Go to `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** → select this folder
4. Open a new tab

## Features

- 🔖 Speed dial grid (4–10 columns), drag-and-drop reordering, swipe to switch categories
- 🔍 Search bar with live suggestions — bookmarks, history, web, and recent searches, all blended by relevance
- 🌦️ Weather widget with 3-day forecast; falls back to manual city entry if location is blocked
- 🕒 Clock with ISO week number, plus a local to-do list
- 🖼️ Custom wallpaper — image or video (up to 100MB), with auto-adapting text contrast
- 🌓 Light/dark theme, synced to your system

## Permissions

`bookmarks`, `storage`, `unlimitedStorage`, `tabs`, `history`, `geolocation` — each tied to a specific feature above. Full details: [`PRIVACY.md`](./PRIVACY.md).

## Structure

```
manifest.json  newtab.html  PRIVACY.md
css/    main, grid, components
js/     bookmarks, widgets, UIController, videoStorage, app
icons/
```

## Notes

- Favicons via Google's favicon endpoint · Weather/geocoding via Open-Meteo · Suggestions via Google Suggest — all no API key needed
- Video wallpapers use HTML5 `<video>`; MP4/WebM are safest for compatibility

---

Crafted by **Dvvyom** · [GitHub](https://github.com/omvs077) · [omvs077@gmail.com](mailto:omvs077@gmail.com)
Suggestions welcome · [MIT License](./LICENSE)