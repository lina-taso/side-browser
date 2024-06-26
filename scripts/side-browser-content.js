/**
 * @fileOverview
 * @name side-browser-content.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const frameId  = parseInt(browser.runtime.getFrameId(window)),
      parentId = parseInt(browser.runtime.getFrameId(window.parent));

let loaded  = false,
    init    = false,
    observe = false,
    oldHref;

const onload = () => {
    if (init) {
        // 読み込み完了通知
        browser.runtime.sendMessage({
            frameId : frameId,
            type    : 'loaded' });
        // 監視
        if (observe) {
            observer.observe(document.body, { childList : true, subtree : true });
        }

        const onunload = () => {
            browser.runtime.sendMessage({
                frameId : frameId,
                type    : 'unload' });
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
        browser.runtime.sendMessage({
            frameId : frameId,
            type    : 'url_change',
            url     : oldHref });
    }
});

if (frameId !== 0, parentId !== 0) {
    browser.runtime.sendMessage({
        frameId  : frameId,
        parentId : parentId,
        type     : 'init',
        url      : window.location.href })
        .then((res, err) => {
            init = true;

            // URL変更を記録（親フレームのみ）
            if (res.observeUrlChange)
                observe = true;
            // 解像度変更
            if (res.changeScreen)
                changeScreen(res.width, res.height);
            // UA変更
            if (res.changeUseragent)
                changeUseragent(res.useragent);
            // 異ドメイン間ページ遷移
            if (res.xdomainTransition) {
                document.addEventListener('click', checkClickEvent, true);
            }

            // 読み込み済み
            if (loaded) onload();
        });
}

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
                browser.runtime.sendMessage({
                    frameId : frameId,
                    type    : 'url_load',
                    url     : el.href });
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
