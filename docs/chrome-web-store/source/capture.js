(async () => {
  if (!["watch", "find", "floating", "history", "settings"].includes(asset)) {
    await document.fonts.ready;
    document.body.dataset.ready = "true";
    return;
  }
  await window.assetUI.init();
  const dropdown = document.getElementById("ytot-dropdown");
  if (asset === "find") {
    await window.assetUI.handleAutoFind();
    dropdown.classList.add("visible");
  }
  if (asset === "history") {
    await window.assetUI.renderHistory();
    dropdown.classList.add("visible");
  }
  if (asset === "watch" || asset === "floating")
    window.assetUI.injectYouTube("vrnrnDemo01", sample);
  if (asset === "floating")
    window.__ypftChat.configure({
      ...window.__ypftChat.settings(),
      enabled: true,
      fullscreenOnly: false,
      opacity: 80,
      fontSize: 16,
      width: 315,
      height: 0.75,
      x: 0.98,
      y: 0.4,
    });
  if (asset === "settings") {
    window.__ypftChat.configure({
      ...window.__ypftChat.settings(),
      enabled: true,
    });
    window.assetUI.renderChatControls();
    document.getElementById("ytot-additional-settings").open = true;
    document.getElementById("ytot-chat-settings").open = true;
    dropdown.classList.add("visible");
    dropdown.scrollTop = document.getElementById(
      "ytot-additional-settings",
    ).offsetTop;
  }
  await document.fonts.ready;
  document.body.dataset.ready = "true";
})();
