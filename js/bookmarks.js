/**
 * bookmarks.js
 * Manages an isolated folder tree inside the browser's native bookmark manager.
 * Root folder: "Dashboard Hub" (lives at the bottom of "Other Bookmarks" so it
 * never shows up in the user's visible bookmark bar).
 */

const BookmarkEngine = {
  ROOT_NAME: "Dashboard Hub",
  DEFAULT_CATEGORIES: ["Home", "developer", "Entertainment", "shopping"],

  DEFAULT_LINKS: {
    Home: [
      { title: "Google", url: "https://www.google.com" },
      { title: "YouTube", url: "https://www.youtube.com" },
      { title: "Maps", url: "https://maps.google.com" },
    ],
    developer: [
      { title: "GitHub", url: "https://github.com" },
      { title: "Stack Overflow", url: "https://stackoverflow.com" },
      { title: "VS Code", url: "https://code.visualstudio.com" },
    ],
    Entertainment: [
      { title: "Netflix", url: "https://www.netflix.com" },
      { title: "Spotify", url: "https://open.spotify.com" },
      { title: "Twitch", url: "https://www.twitch.tv" },
    ],
    shopping: [
      { title: "Amazon", url: "https://www.amazon.com" },
      { title: "eBay", url: "https://www.ebay.com" },
      { title: "Flipkart", url: "https://www.flipkart.com" },
    ],
  },

  rootId: null,
  // structure: { categoryName: { folderId, items: [{id, title, url}] } }
  structure: {},

  async init() {
    this.rootId = await this._getOrCreateRoot();
    await this._ensureDefaultCategories();
    await this.refresh();
    return this.structure;
  },

  async _getOrCreateRoot() {
    // "Other Bookmarks" is id "2" in Chrome's bookmark tree.
    const others = await chrome.bookmarks.getChildren("2");
    const existing = others.find(
      (n) => !n.url && n.title === this.ROOT_NAME
    );
    if (existing) return existing.id;

    const created = await chrome.bookmarks.create({
      parentId: "2",
      title: this.ROOT_NAME,
    });
    return created.id;
  },

  async _ensureDefaultCategories() {
    const children = await chrome.bookmarks.getChildren(this.rootId);
    const existingNames = new Set(children.filter((c) => !c.url).map((c) => c.title));

    for (const cat of this.DEFAULT_CATEGORIES) {
      if (!existingNames.has(cat)) {
        const folder = await chrome.bookmarks.create({ parentId: this.rootId, title: cat });
        const seedLinks = this.DEFAULT_LINKS[cat] || [];
        for (const link of seedLinks) {
          await chrome.bookmarks.create({
            parentId: folder.id,
            title: link.title,
            url: link.url,
          });
        }
      }
    }
  },

  async refresh() {
    const children = await chrome.bookmarks.getChildren(this.rootId);
    const folders = children.filter((c) => !c.url);

    this.structure = {};
    for (const folder of folders) {
      const items = await chrome.bookmarks.getChildren(folder.id);
      this.structure[folder.title] = {
        folderId: folder.id,
        items: items
          .filter((i) => i.url)
          .map((i) => ({ id: i.id, title: i.title, url: i.url, index: i.index })),
      };
    }
    return this.structure;
  },

  getCategoryNames() {
    return Object.keys(this.structure);
  },

  async addCategory(name) {
    if (this.structure[name]) return this.structure[name].folderId;
    const folder = await chrome.bookmarks.create({ parentId: this.rootId, title: name });
    await this.refresh();
    return folder.id;
  },

  async removeCategory(name) {
    const cat = this.structure[name];
    if (!cat) return;
    await chrome.bookmarks.removeTree(cat.folderId);
    await this.refresh();
  },

  async addLink(category, title, url) {
    const cat = this.structure[category];
    if (!cat) throw new Error(`Unknown category: ${category}`);
    await chrome.bookmarks.create({ parentId: cat.folderId, title, url });
    await this.refresh();
  },

  async updateLink(bookmarkId, { title, url }) {
    await chrome.bookmarks.update(bookmarkId, { title, url });
    await this.refresh();
  },

  async removeLink(category, bookmarkId) {
    await chrome.bookmarks.remove(bookmarkId);
    await this.refresh();
  },

  /**
   * Reorders a link within its category folder using chrome.bookmarks.move,
   * which natively supports an `index` field for drag-and-drop reordering.
   */
  async reorderLink(bookmarkId, newIndex) {
    await chrome.bookmarks.move(bookmarkId, { index: newIndex });
    await this.refresh();
  },

  faviconUrl(pageUrl) {
    try {
      const domain = new URL(pageUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return "";
    }
  },
};
