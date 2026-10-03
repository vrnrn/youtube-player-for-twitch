// Layout and sample data are capture fixtures, never shipped in the extension.
const asset = new URLSearchParams(location.search).get("asset") || "watch";
const media = "/site/assets/adventure-stream.jpg";
const mark = "/docs/chrome-web-store/source/branding/icon128.png";
const messages = [
  ["pixelpilot", "#bda0ff", "this view is unreal"],
  ["mossy", "#8cd7b1", "we made it 🌿"],
  ["lunar", "#f3bd95", "the colors!"],
  ["riverstone", "#93cde6", "one more adventure?"],
  ["softglow", "#e3a4ce", "YouTube video + this chat 💜"],
  ["mossy", "#8cd7b1", "best of both worlds"],
  ["pixelpilot", "#bda0ff", "let’s keep going ✨"],
  ["lunar", "#f3bd95", "chat came along for the ride"],
  ["riverstone", "#93cde6", "that mountain in the distance 👀"],
  ["softglow", "#e3a4ce", "next stop: the valley"],
];
const chat = () =>
  messages
    .map(
      ([name, color, text]) =>
        `<div class="chat-line__message" data-a-target="chat-line-message"><span data-a-target="chat-message-username" style="color:${color}">${name}</span><span class="colon">:</span> <span data-a-target="chat-line-message-body">${text}</span></div>`,
    )
    .join("");
const brand = `<div class="brand"><img src="${mark}" alt=""><span>YouTube Player <span class="brand-second">for Twitch</span></span></div>`;
const credit = `<div class="credit">by vrnrn</div>`;
const foot = `<footer><span>Extension interface · illustrative stream &amp; chat</span><span>youtube-player-for-twitch.vrnrn.com</span></footer>`;
const shell = (extra = "") =>
  `<div class="channel-shell ${extra}"><div class="channel-nav"><div class="top-nav__menu"><div><span class="twitch-word">twitch</span><span>Browse</span></div></div><span class="channel-search">Search</span><span class="avatar">v</span></div><div class="channel-content"><div class="channel-main"><div class="video-player" data-a-target="video-player-layout"><img src="${media}" alt="Illustrative stream"><button class="theatre-native" aria-label="Theatre Mode (alt+t)" data-a-target="player-theatre-mode-button">▣</button></div><div class="channel-info"><span class="channel-avatar">v</span><div><b>vrnrn</b><p>A new adventure · Exploring the valley</p><small>Adventure &nbsp; · &nbsp; English</small></div><span class="follow">♡ Follow</span></div></div><aside class="native-chat"><div class="native-chat-title">STREAM CHAT <span>⌄</span></div><div class="chat-scrollable-area__message-container" data-test-selector="chat-scrollable-area__message-container">${chat()}</div><div class="chat-compose">Send a message</div><div class="chat-send">Chat</div></aside></div></div>`;
const variants = {
  watch: {
    title: "Your video on YouTube.<br><em>Your people on Twitch.</em>",
    sub: "Watch the stream you want. Stay with the chat you love.",
    stage: shell(),
    type: "wide",
  },
  find: {
    eyebrow: "01 / FIND YOUR STREAM",
    title: "Less searching.<br><em>More watching.</em>",
    sub: "Find the linked YouTube stream,<br>or paste a link and go.",
    stage: shell(),
    type: "split",
  },
  floating: {
    eyebrow: "02 / FLOATING CHAT",
    title: "Bring chat<br><em>into the picture.</em>",
    sub: "Move it. Resize it. Keep the reactions<br>right there with your stream.",
    stage: shell(),
    type: "split floating",
  },
  history: {
    eyebrow: "03 / RECENT STREAMS",
    title: "Your favorites.<br><em>One click away.</em>",
    sub: "Revisit recent streams and pin<br>the ones you keep coming back to.",
    stage: shell(),
    type: "split history",
  },
  settings: {
    eyebrow: "04 / MAKE IT YOURS",
    title: "Little controls.<br><em>A better view.</em>",
    sub: "Catch up to live, choose your chat style,<br>and make the player feel like yours.",
    stage: shell(),
    type: "split settings",
  },
};
if (variants[asset]) {
  const v = variants[asset];
  document.body.className = `asset ${asset}`;
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<main class="canvas">${brand}${credit}<div class="copy ${v.type}">${v.eyebrow ? `<div class="eyebrow">${v.eyebrow}</div>` : ""}<h1>${v.title}</h1><p>${v.sub}</p>${asset === "watch" ? "" : `<div class="copy-rule"></div><div class="copy-detail">YouTube video.<br>Twitch community.<br><strong>One browser tab.</strong></div>`}</div><div class="stage ${v.type}">${v.stage}</div>${foot}<span class="page-number">${String(Object.keys(variants).indexOf(asset) + 1).padStart(2, "0")} / 05</span></main>`,
  );
} else if (asset === "small" || asset === "marquee") {
  document.body.className = `asset ${asset}`;
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<main class="canvas promo">${brand}${credit}${asset === "marquee" ? "<h1>Your stream.<br><em>Your people.</em></h1><p>YouTube video. Twitch chat. One tab.</p>" : ""}<div class="promo-player"><div class="promo-bar"><i></i><i></i><i></i></div><img src="${media}" alt=""><div class="promo-play">▶</div><div class="promo-chat"><svg viewBox="0 0 24 24"><path d="M4 4h16v12H11l-5 4v-4H4Z"/><path d="M8 8h8M8 12h5"/></svg><span></span><span></span><span></span></div></div>${asset === "small" ? '<div class="small-caption">YouTube video. Twitch chat.</div>' : '<div class="promo-footer">by vrnrn</div>'}</main>`,
  );
} else if (asset === "icon") {
  document.body.className = "asset icon";
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<main class="canvas"><img src="${mark}" alt="YouTube Player for Twitch icon"></main>`,
  );
}
const sample = {
  videoId: "vrnrnSample",
  title: "A new adventure · Exploring the valley",
  channel: "vrnrn",
};
const stored =
  asset === "history"
    ? {
        ytot_history: [
          { ...sample, videoId: "vrnrnDemo01", pinned: true },
          {
            videoId: "vrnrnDemo02",
            title: "Late night builds · Making something new",
            channel: "vrnrn",
            pinned: false,
          },
          {
            videoId: "vrnrnDemo03",
            title: "One more game · Hanging out with chat",
            channel: "vrnrn",
            pinned: false,
          },
        ],
      }
    : {};
if (asset === "settings") stored.ytot_autosync = true;
// Mock Chrome's storage and search response. No real accounts, chat connection,
// YouTube requests or private browser state are used to compose these assets.
window.chrome = {
  runtime: {
    id: "asset-capture",
    async sendMessage(m) {
      if (m.type === "GET_VAFT_SETTINGS")
        return { enabled: false, registered: false };
      if (m.type.startsWith("SEARCH_YOUTUBE")) return { results: [sample] };
      if (m.type === "GET_VIDEO_DETAILS") return { ...sample };
      return { error: "Not available in capture fixture" };
    },
  },
  storage: {
    local: {
      get(keys, cb) {
        cb(Object.fromEntries(keys.map((k) => [k, stored[k]])));
      },
      async set(data) {
        Object.assign(stored, data);
      },
    },
    onChanged: { addListener() {} },
  },
};
document
  .querySelector(".theatre-native")
  ?.addEventListener("click", (e) =>
    e.currentTarget.setAttribute(
      "aria-pressed",
      e.currentTarget.getAttribute("aria-pressed") !== "true",
    ),
  );
