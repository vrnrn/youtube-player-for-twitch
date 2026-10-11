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
    dropdown.classList.add("visible");
    await window.assetUI.renderHistory();
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
    window.assetUI.openSettings();
    window.assetUI.selectSettingsTab("chat");
  }
  await document.fonts.ready;
  document.body.dataset.ready = "true";
})();
