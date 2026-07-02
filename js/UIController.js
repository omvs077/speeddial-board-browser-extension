/**
 * UIController.js
 * Owns all rendering + interaction logic for the dashboard: the tab ribbon,
 * the speed dial grid (including drag-and-drop reordering and swipe
 * gestures), the custom context menu, and persisted UI preferences
 * (grid column count + widget visibility).
 */

const UIController = {
  activeCategory: null,
  prefs: {
    columns: 6,
    widgets: { weather: true, clock: true, todo: true },
    sizes: { weather: "md", clock: "md", todo: "md" },
  },

  async init() {
    await this._loadPrefs();
    this._applyColumns();
    this._applyWidgetVisibility();
    this._applyWidgetSizes();

    await BookmarkEngine.init();
    this.activeCategory = BookmarkEngine.getCategoryNames()[0] || null;

    this.renderTabs();
    this.renderGrid();
    this._bindSearch();
    this._bindContextMenu();
    this._bindSwipe();
  },

  async _loadPrefs() {
    const { dashboardPrefs } = await chrome.storage.local.get("dashboardPrefs");
    if (dashboardPrefs) this.prefs = { ...this.prefs, ...dashboardPrefs };

    const { wallpaper } = await chrome.storage.local.get("wallpaper");
    if (wallpaper) this._applyWallpaper(wallpaper);
  },

  async _savePrefs() {
    await chrome.storage.local.set({ dashboardPrefs: this.prefs });
  },

  _applyColumns() {
    document.documentElement.style.setProperty("--grid-columns", this.prefs.columns);
  },

  _applyWidgetVisibility() {
    for (const [key, visible] of Object.entries(this.prefs.widgets)) {
      const el = document.getElementById(`widget-${key}`);
      if (el) el.classList.toggle("hidden", !visible);
    }
  },

  _applyWidgetSizes() {
    for (const [key, size] of Object.entries(this.prefs.sizes)) {
      const el = document.getElementById(`widget-${key}`);
      if (!el) continue;
      el.classList.remove("size-sm", "size-md", "size-lg");
      el.classList.add(`size-${size}`);
    }
  },

  setWidgetSize(key, size) {
    this.prefs.sizes[key] = size;
    this._savePrefs();
    this._applyWidgetSizes();
  },

  /* ---------------- Tab Ribbon ---------------- */
  renderTabs() {
    const ribbon = document.getElementById("tab-ribbon");
    ribbon.innerHTML = "";
    const names = BookmarkEngine.getCategoryNames();

    names.forEach((name) => {
      const pill = document.createElement("div");
      pill.className = "tab-pill" + (name === this.activeCategory ? " active" : "");
      pill.textContent = name;
      pill.addEventListener("click", () => this.switchCategory(name));
      pill.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openContextMenu(e.clientX, e.clientY, [
          {
            label: name,
            items: [
              {
                text: "Rename",
                onClick: () => this.openCategoryModal("rename", name),
              },
              {
                text: "Delete collection",
                onClick: () => this.openCategoryModal("delete", name),
              },
              {
                text: "Open all in new tabs",
                onClick: () => this._openAllInCategory(name),
              },
            ],
          },
        ]);
      });
      ribbon.appendChild(pill);
    });
  },

  switchCategory(name) {
    if (!BookmarkEngine.structure[name]) return;
    this.activeCategory = name;
    this.renderTabs();
    this.renderGrid();
  },

  switchByOffset(offset) {
    const names = BookmarkEngine.getCategoryNames();
    const idx = names.indexOf(this.activeCategory);
    const next = names[(idx + offset + names.length) % names.length];
    if (next) this.switchCategory(next);
  },

  /* ---------------- Grid Rendering ---------------- */
  renderGrid() {
    const canvas = document.getElementById("grid-canvas");
    canvas.innerHTML = "";
    if (!this.activeCategory) return;

    const cat = BookmarkEngine.structure[this.activeCategory];

    if (cat.items.length === 0) {
      canvas.classList.add("is-empty");
      canvas.appendChild(this._buildEmptyState());
      return;
    }

    canvas.classList.remove("is-empty");
    cat.items.forEach((item) => {
      canvas.appendChild(this._buildTile(item));
    });

    canvas.appendChild(this._buildAddTile());
  },

  _buildEmptyState() {
    const wrap = document.createElement("div");
    wrap.className = "empty-state";
    wrap.innerHTML = `
      <div class="empty-state-text">No links yet in <strong>${this.activeCategory}</strong></div>
    `;
    const addTile = this._buildAddTile();
    wrap.appendChild(addTile);
    return wrap;
  },

  _buildTile(item) {
    const tile = document.createElement("div");
    tile.className = "dial-tile";
    tile.draggable = true;
    tile.dataset.id = item.id;

    tile.innerHTML = `
      <div class="dial-icon"><img src="${BookmarkEngine.faviconUrl(item.url)}" alt="" onerror="this.replaceWith(UIController._letterFallback('${(item.title || item.url).replace(/'/g, "\\'")}'))" /></div>
      <div class="dial-label">${item.title || item.url}</div>
    `;

    tile.addEventListener("click", () => {
      window.location.href = item.url;
    });

    tile.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openContextMenu(e.clientX, e.clientY, this._linkMenuItems(item));
    });

    this._wireDragEvents(tile, item.id);
    return tile;
  },

  _letterFallback(label) {
    const span = document.createElement("span");
    span.textContent = (label.trim()[0] || "?").toUpperCase();
    span.style.cssText = "font-family:var(--font-display);font-size:1.1rem;color:var(--text-muted);";
    return span;
  },

  _buildAddTile() {
    const tile = document.createElement("div");
    tile.className = "dial-tile add-tile";
    tile.innerHTML = `<div class="dial-icon add-icon">+</div>`;
    tile.addEventListener("click", () => this.openLinkModal({ mode: "add" }));
    return tile;
  },

  openLinkModal({ mode, bookmarkId = null, title = "", url = "" }) {
    const overlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("link-modal");
    const titleInput = document.getElementById("link-title-input");
    const urlInput = document.getElementById("link-url-input");
    document.getElementById("link-modal-title").textContent =
      mode === "edit" ? "Edit Link" : "Add Link";

    titleInput.value = title;
    urlInput.value = url;
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    titleInput.focus();

    const close = () => {
      overlay.classList.add("hidden");
      modal.classList.add("hidden");
      saveBtn.removeEventListener("click", onSave);
      cancelBtn.removeEventListener("click", close);
      overlay.removeEventListener("click", close);
    };

    const onSave = async () => {
      const newUrl = urlInput.value.trim();
      if (!newUrl) return;
      const newTitle = titleInput.value.trim() || new URL(newUrl).hostname;

      if (mode === "edit") {
        await BookmarkEngine.updateLink(bookmarkId, { title: newTitle, url: newUrl });
      } else {
        await BookmarkEngine.addLink(this.activeCategory, newTitle, newUrl);
      }
      this.renderGrid();
      close();
    };

    const saveBtn = document.getElementById("link-save-btn");
    const cancelBtn = document.getElementById("link-cancel-btn");
    saveBtn.addEventListener("click", onSave);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);
  },

  openCategoryModal(mode, name) {
    const overlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("cat-modal");
    const input = document.getElementById("cat-name-input");
    const saveBtn = document.getElementById("cat-save-btn");
    const cancelBtn = document.getElementById("cat-cancel-btn");

    document.getElementById("cat-modal-title").textContent =
      mode === "rename" ? `Rename "${name}"` : `Delete "${name}"`;

    if (mode === "rename") {
      input.value = name;
      input.style.display = "";
      saveBtn.textContent = "Rename";
    } else {
      input.style.display = "none";
      saveBtn.textContent = "Delete";
      saveBtn.style.background = "var(--danger)";
      saveBtn.style.borderColor = "var(--danger)";
    }

    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    if (mode === "rename") { input.focus(); input.select(); }

    const close = () => {
      overlay.classList.add("hidden");
      modal.classList.add("hidden");
      saveBtn.style.background = "";
      saveBtn.style.borderColor = "";
      saveBtn.removeEventListener("click", onSave);
      cancelBtn.removeEventListener("click", close);
      overlay.removeEventListener("click", close);
    };

    const onSave = async () => {
      if (mode === "rename") {
        const newName = input.value.trim();
        if (!newName || newName === name) return close();
        await chrome.bookmarks.update(
          BookmarkEngine.structure[name].folderId, { title: newName }
        );
        await BookmarkEngine.refresh();
        if (this.activeCategory === name) this.activeCategory = newName;
      } else {
        await BookmarkEngine.removeCategory(name);
        if (this.activeCategory === name) {
          this.activeCategory = BookmarkEngine.getCategoryNames()[0] || null;
        }
      }
      this.renderTabs();
      this.renderGrid();
      close();
    };

    saveBtn.addEventListener("click", onSave);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);
  },

  /* ---------------- Drag & Drop Reordering ---------------- */
  _wireDragEvents(tile, bookmarkId) {
    tile.addEventListener("dragstart", () => {
      tile.classList.add("dragging");
      tile.dataset.dragId = bookmarkId;
    });

    tile.addEventListener("dragend", () => {
      tile.classList.remove("dragging");
    });

    tile.addEventListener("dragover", (e) => {
      e.preventDefault();
      tile.classList.add("drag-over");
    });

    tile.addEventListener("dragleave", () => {
      tile.classList.remove("drag-over");
    });

    tile.addEventListener("drop", async (e) => {
      e.preventDefault();
      tile.classList.remove("drag-over");
      const draggingTile = document.querySelector(".dial-tile.dragging");
      if (!draggingTile || draggingTile === tile) return;

      const canvas = document.getElementById("grid-canvas");
      const tiles = [...canvas.querySelectorAll(".dial-tile")];
      const targetIndex = tiles.indexOf(tile);

      await BookmarkEngine.reorderLink(draggingTile.dataset.id, targetIndex);
      this.renderGrid();
    });
  },

  /* ---------------- Swipe Gestures ---------------- */
  _bindSwipe() {
    const canvas = document.getElementById("grid-canvas");
    let startX = 0;
    let startY = 0;

    canvas.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });

    canvas.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        this.switchByOffset(dx < 0 ? 1 : -1);
      }
    });

    // Trackpad horizontal wheel swipe support.
    let wheelLock = false;
    canvas.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) < 40 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      if (wheelLock) return;
      wheelLock = true;
      this.switchByOffset(e.deltaX > 0 ? 1 : -1);
      setTimeout(() => (wheelLock = false), 400);
    });
  },

  /* ---------------- Search ---------------- */
  _bindSearch() {
    const form = document.getElementById("search-form");
    const input = document.getElementById("search-input");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    });
  },

  /* ---------------- Custom Context Menu ---------------- */
  _bindContextMenu() {
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.openContextMenu(e.clientX, e.clientY, this._defaultMenuItems());
    });

    document.addEventListener("click", (e) => {
      const menu = document.getElementById("context-menu");
      if (!menu.contains(e.target)) menu.classList.add("hidden");
    });
  },

  openContextMenu(x, y, sections) {
    const menu = document.getElementById("context-menu");
    menu.innerHTML = "";

    sections.forEach((section) => {
      if (section.label) {
        const label = document.createElement("div");
        label.className = "ctx-section-label";
        label.textContent = section.label;
        menu.appendChild(label);
      }
      section.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "ctx-item";
        row.innerHTML = `<span>${item.text}</span>${item.checked ? '<span class="ctx-check">✓</span>' : ""}`;
        row.addEventListener("click", () => {
          item.onClick();
          menu.classList.add("hidden");
        });
        menu.appendChild(row);
      });
      const divider = document.createElement("div");
      divider.className = "ctx-divider";
      menu.appendChild(divider);
    });
    menu.lastChild?.remove(); // drop trailing divider

    menu.classList.remove("hidden");

    // Keep menu within viewport bounds.
    const { innerWidth, innerHeight } = window;
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${Math.min(x, innerWidth - rect.width - 10)}px`;
      menu.style.top = `${Math.min(y, innerHeight - rect.height - 10)}px`;
    });
  },

  _defaultMenuItems() {
    const names = BookmarkEngine.getCategoryNames();
    return [
      {
        label: "Switch Collection",
        items: names.map((n) => ({
          text: n,
          checked: n === this.activeCategory,
          onClick: () => this.switchCategory(n),
        })),
      },
      {
        label: "Toggle Widgets",
        items: Object.keys(this.prefs.widgets).map((key) => ({
          text: key[0].toUpperCase() + key.slice(1),
          checked: this.prefs.widgets[key],
          onClick: () => this._toggleWidget(key),
        })),
      },
      {
        label: "Background",
        items: [
          { text: "Set Wallpaper...", onClick: () => this._pickWallpaper() },
          { text: "Remove Wallpaper", onClick: () => this._clearWallpaper() },
        ],
      },
      {
        label: "Grid Density",
        items: [4, 6, 8, 10].map((n) => ({
          text: `${n} columns`,
          checked: this.prefs.columns === n,
          onClick: () => this._setColumns(n),
        })),
      },
      {
        label: null,
        items: [
          {
            text: "Add new collection…",
            onClick: async () => {
              const name = prompt("New collection name:");
              if (!name) return;
              await BookmarkEngine.addCategory(name);
              this.renderTabs();
            },
          },
        ],
      },
    ];
  },

  _linkMenuItems(item) {
    return [
      {
        label: item.title || item.url,
        items: [
          {
            text: "Open in new tab",
            onClick: () => window.open(item.url, "_blank"),
          },
          {
            text: "Edit",
            onClick: () =>
              this.openLinkModal({
                mode: "edit",
                bookmarkId: item.id,
                title: item.title,
                url: item.url,
              }),
          },
          {
            text: "Remove from Speed Dial",
            onClick: async () => {
              await BookmarkEngine.removeLink(this.activeCategory, item.id);
              this.renderGrid();
            },
          },
        ],
      },
    ];
  },

  async _toggleWidget(key) {
    this.prefs.widgets[key] = !this.prefs.widgets[key];
    await this._savePrefs();
    this._applyWidgetVisibility();
  },

  // Public alias used by widgets.js's own "⋯" menu.
  toggleWidgetByMenu(key) {
    return this._toggleWidget(key);
  },

  _pickWallpaper() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await chrome.storage.local.set({ wallpaper: dataUrl });
      this._applyWallpaper(dataUrl);
    });
    input.click();
  },

  async _clearWallpaper() {
    await chrome.storage.local.remove("wallpaper");
    this._applyWallpaper(null);
  },

  _applyWallpaper(dataUrl) {
    document.body.style.backgroundImage = dataUrl ? "url(\"" + dataUrl + "\")" : "";
    document.body.style.backgroundSize = dataUrl ? "cover" : "";
    document.body.style.backgroundPosition = dataUrl ? "center" : "";
    document.body.classList.toggle("has-wallpaper", !!dataUrl);
    if (dataUrl) {
      this._sampleDominantColor(dataUrl);
    } else {
      document.documentElement.style.removeProperty("--wallpaper-tint");
    }
  },

  _sampleDominantColor(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = (canvas.width = 32);
      const h = (canvas.height = 32);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      document.documentElement.style.setProperty("--wallpaper-tint", r + ", " + g + ", " + b);
    };
    img.src = dataUrl;
  },

  async _setColumns(n) {
    this.prefs.columns = n;
    await this._savePrefs();
    this._applyColumns();
  },
};









