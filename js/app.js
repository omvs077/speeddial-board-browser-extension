/**
 * app.js
 * Entry point — boots the bookmark engine, UI controller, and widgets once
 * the DOM is ready.
 */

document.addEventListener("DOMContentLoaded", async () => {
  await UIController.init();
  Widgets.initAll();
});
