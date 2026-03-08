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
        oldHref;

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

            // 読み込み済み
            if (loaded) onload();
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
}
