/**
 * @fileOverview
 * @name side-browser-content.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const frameId  = parseInt(browser.runtime.getFrameId(window)),
      parentId = parseInt(browser.runtime.getFrameId(window.parent));

if (frameId !== 0 && parentId !== 0) {
    let loaded  = false,
        init    = false,
        observe = false,
        // for side-twitter
        updateInterval    = 600,
        removeAds         = false,
        removePremiumLink = false,
        showFollowTlFirst = false,
        // flag
        waitingLoadHome   = false,
        // state
        oldHref;
    let autoUpdateTimer;

    const port = browser.runtime.connect({ name: frameId.toString() });

    const onmessage = (message) => {
        switch (message.type) {
        case 'init_response':
            init = true;

            // URL変更を記録（親フレームのみ）
            if (message.data.observeUrlChange)
                observe = true;
            // 解像度変更
            if (message.data.changeScreen)
                changeScreen(message.data.width, message.data.height);
            // UA変更
            if (message.data.changeUseragent)
                changeUseragent(message.data.useragent);
            // 異ドメイン間ページ遷移
            if (message.data.xdomainTransition) {
                document.addEventListener('click', checkClickEvent, true);
            }
            // 自動更新
            updateInterval = message.data.timelineUpdateInterval;
            // 広告削除
            removeAds = message.data.timelineRemoveAds;
            // プレミアムリンク削除
            removePremiumLink  = message.data.timelineRemovePremiumLink;
            // 最初にフォロータイムライン表示
            showFollowTlFirst = message.data.timelineShowFollowTlFirst;

            // 読み込み済み
            if (loaded) onload();
            break;
        case 'update_timeline_response':
            // フォーカスされたウィンドウのみ
            document.querySelector('[href="/home"]').click();
            break;
        }
    };
    port.onMessage.addListener(onmessage);

    const onload = () => {
        if (init) {
            // 読み込み完了通知
            port.postMessage({ type : 'loaded' });
            // 監視
            if (observe) {
                observer.observe(document.body, { childList : true, subtree : true });
            }

            const onunload = () => {
                port.postMessage({ type : 'unload' });
            };
            window.addEventListener('unload', onunload);
        }
        else {
            loaded = true;
        }
    };
    window.addEventListener('load', onload);

    const observer = new MutationObserver(mutations => {
        // ホームタイムラインの読み込み待ち
        if (waitingLoadHome) {
            // ホームタイムライン読み込み前にページ遷移
            if (oldHref !== 'https://x.com/home')
                waitingLoadHome = false;

            else {
                // フォロータイムラインを表示
                if (showFollowTlFirst) {
                    if (document.querySelector('[role=tablist]:has([role=tab]) [role=presentation]:nth-child(2) [role=tab]')) {
                        if (document.querySelector('[role=tablist]:has([role=tab]) [role=presentation]:nth-child(2) [role=tab][aria-selected=false]'))
                            document.querySelector('[role=tablist]:has([role=tab]) [role=presentation]:nth-child(2) [role=tab][aria-selected=false]').click();
                        waitingLoadHome = false;
                    }
                }
            }
        }

        // URL変更
        if (oldHref !== window.location.href) {
            const before = oldHref;
            oldHref = window.location.href;
            // URL変更通知
            port.postMessage({
                type : 'url_change',
                data : {
                    url : oldHref
                }
            });

            if (oldHref === 'https://x.com/home') {
                // Twitter自動更新
                clearInterval(autoUpdateTimer);
                autoUpdateTimer = setInterval(updateTimeline, updateInterval * 1000);

                // フォロータイムラインを表示
                if (showFollowTlFirst) {
                    if (document.querySelector('[role=tablist]:has([role=tab]) [role=presentation]:nth-child(2) [role=tab]')) {
                        if (document.querySelector('[role=tablist]:has([role=tab]) [role=presentation]:nth-child(2) [role=tab][aria-selected=false]'))
                            document.querySelector('[role=tablist]:has([role=tab]) [role=presentation]:nth-child(2) [role=tab][aria-selected=false]').click();
                    }
                    else
                        waitingLoadHome = true;
                }
            }
            else {
                clearInterval(autoUpdateTimer);
            }
        }

        // 広告削除
        if (removeAds) {
            document.querySelectorAll('[data-testid="placementTracking"]:has(>[data-testid="top-impression-pixel"])').forEach(ele => {
                ele.parentElement.parentElement.parentElement.style.display = 'none';
            });
        }
        // プレミアムリンク削除
        if (removePremiumLink) {
            document.querySelectorAll('[href="/i/premium_sign_up"]').forEach(ele => {
                ele.parentElement.style.display = 'none';
            });
        }
    });

    const changeScreen = (width, height) => {
        const s = document.createElement('script');
        s.textContent = `( function() { Object.defineProperties(window.screen, { width: { value: ${width}, enumerable: true }, height: { value: ${height}, enumerable: true } }); } )()`;
        document.documentElement.appendChild(s);
        s.remove();
    };

    const changeUseragent = (ua) => {
        const s = document.createElement('script');
        s.textContent = `( function() { Object.defineProperties(window.navigator, { userAgent: { value: ${ua}, enumerable: true } }); } )()`;
        document.documentElement.appendChild(s);
        s.remove();
    };

    const checkClickEvent = (e) => {
        let el = e.target;

        while (el.tagName !== 'HTML') {
            // Aタグ、リンク先あり
            if (el.tagName === 'A' && el.href) {
                // _blank
                if (el.target === '_blank') return true;
                // _top
                if (el.target === '_top') {
                    port.postMessage({
                        type : 'url_load',
                        data : {
                            url : el.href
                        }
                    });
                    return false;
                }

                // 通常対応
                const domainPattern = new RegExp('^(.+\\.)?' + window.location.hostname.replaceAll('.', '\\.') + '$');
                const hrefDomain = (new URL(el.href)).hostname;
                // 異ドメインの場合
                if (!domainPattern.test(hrefDomain)) {
                    window.location.href = el.href;
                    e.preventDefault();
                    return false;
                }

                break;
            }
            el = el.parentElement;
        }

        return true;
    };

    const updateTimeline = () => {
        // タイムラインが最上部にあるとき
        if (window.scrollY !== 0) return;
        port.postMessage({ type : 'update_timeline' });
    };
}
