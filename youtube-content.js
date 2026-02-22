(() => {
    if (!document.referrer.startsWith('https://www.twitch.tv')) return;

    window.addEventListener('message', receiveMessage, false);
    try {
        sendMessageToParent({ iframeLoaded: true });
    } catch (err) {
        console.error('Error sending message to parent:', err);
    }

    function sendMessageToParent(data) {
        const msg = typeof data === 'string' ? { msg: data } : data;
        window.parent.postMessage(
            { type: 'YPFT_IFRAME', ...msg },
            'https://www.twitch.tv',
        );
    }

    function receiveMessage(event) {
        if (
            event.source !== window.parent ||
            event.origin !== 'https://www.twitch.tv' ||
            event.data?.type !== 'YPFT_IFRAME'
        )
            return;
        if (event.data.loadTheaterButton) {
            insertTheaterButton();
        }
    }

    function toggleTheaterMode() {
        sendMessageToParent({ toggleTheaterMode: true });
    }

    // allow the alt+t shortcut to work even when the focus is inside the youtube iframe
    window.addEventListener('keydown', e => {
        if (e.altKey && e.key.toLowerCase() === 't') {
            toggleTheaterMode();
        }
    });

    function insertTheaterButton() {
        const fullscreenButton = document.querySelector(
            'div.ytp-right-controls>button.ytp-fullscreen-button',
        );
        if (!fullscreenButton) {
            console.warn(
                'Fullscreen button not found, cannot add theater mode button',
            );
            return;
        }
        const theaterButton = fullscreenButton.cloneNode(true);
        theaterButton.classList.remove('ytp-fullscreen-button');
        theaterButton.classList.add('ypft-theater-button');
        theaterButton.setAttribute('aria-label', 'Theater mode');
        theaterButton.innerHTML = /*html*/ `
          <svg width="24" height="24" viewBox="0 0 24 24" focusable="false" aria-hidden="true" role="presentation" fill="currentColor">
              <path fill-rule="evenodd"
                  d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Zm14 0h4v14h-4V5Zm-2 0H4v14h10V5Z"
                  clip-rule="evenodd">
              </path>
          </svg>
          `;
        fullscreenButton.parentNode.insertBefore(
            theaterButton,
            fullscreenButton,
        );
        theaterButton.addEventListener('click', toggleTheaterMode);
    }
})();
