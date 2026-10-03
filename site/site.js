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
        ? "More room for the stream. Your Twitch chat comes along."
        : "YouTube handles the stream. Twitch keeps the conversation.";
    });
  }
}
