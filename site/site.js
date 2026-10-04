// The demo changes an illustration only; it never loads a stream or connects to chat.
const demoWindow = document.querySelector("[data-demo-window]");
const demoCaption = document.querySelector("[data-demo-caption]");
const layoutButtons = document.querySelectorAll("[data-layout]");
const demoToolbar = document.querySelector(".demo-toolbar");

if (demoWindow && demoCaption && demoToolbar && layoutButtons.length) {
  demoToolbar.hidden = false;
  for (const button of layoutButtons) {
    button.addEventListener("click", () => {
      const floating = button.dataset.layout === "floating";
      demoWindow.classList.toggle("is-floating", floating);
      for (const option of layoutButtons) {
        option.setAttribute("aria-pressed", String(option === button));
      }
      demoCaption.textContent = floating
        ? "Fullscreen video with a movable, read-only chat overlay."
        : "YouTube video beside the channel’s Twitch chat.";
    });
  }
}
