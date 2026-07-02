/**
 * app.js
 * Entry point — boots bookmark engine, UI, widgets.
 * Theme is handled natively via CSS system colors (Canvas, CanvasText etc.)
 * which automatically reflect the active OS/browser theme.
 */

document.addEventListener("DOMContentLoaded", async () => {
  await UIController.init();
  Widgets.initAll();

  // "/" focuses search, Escape blurs
  document.addEventListener("keydown", (e) => {
    const input = document.getElementById("search-input");
    if (!input) return;
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
        if (e.key === "Escape" && document.activeElement === input) {
      input.blur();
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && document.activeElement !== input) {
      e.preventDefault();
      UIController.switchByOffset(e.key === "ArrowRight" ? 1 : -1);
    }
  });
});
