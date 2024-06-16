/**
 * @fileOverview
 * @name side-browser-background.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const FIRSTRUNURL = 'https://www2.filewo.net/wordpress/category/products/side-browser/';
const ORIGINURL = browser.runtime.getURL('/ui/sidebar.xhtml');
const DOCUMENTURL = browser.runtime.getURL('/ui/inline-browser.xhtml');

var FRAMES = {},
    DEBUG  = false;

browser.runtime.onStartup.addListener(startup);
browser.runtime.onInstalled.addListener(install);
//browser.runtime.onConnect.addListener(connect);
browser.runtime.onMessage.addListener(message);
browser.browserAction.onClicked.addListener(onclicked);

async function startup()
{
}

function install()
{
}

function message(message, sender, sendResponse)
{
    if (!sender.tab) {
        DEBUG && console.log('onmessage', message, sender);
        switch (message.type) {
        case 'init':
            let res = {
                observeUrlChange  : true,
                changeScreen      : config.getPref('changeScreen'),
                width             : config.getPref('changeScreenWidth'),
                height            : config.getPref('changeScreenHeight'),
                changeUseragent   : config.getPref('changeUseragent'),
                useragent         : config.getPref('useragent') || navigator.userAgent,
                xdomainTransition : config.getPref('xdomainTransition')
            };
            // 親フレーム
            if (FRAMES[message.frameId]) {
                sendResponse(res);
            }
            // 子フレーム？
            else {
                for (let frame in FRAMES) {
                    // 子フレーム追加
                    if (FRAMES[frame].addFrameId(message.frameId, message.parentId)) {
                        res.observeUrlChange = false;
                        sendResponse(res);
                    }
                }
            }
            break;
        case 'loaded':
            // 親フレームの場合
            if (!FRAMES[message.frameId]) break;
            // 読み込み完了
            FRAMES[message.frameId]._loading = false;
            break;
        case 'unload':
            // 子フレームの場合
            if (FRAMES[message.frameId]) break;
            // フレーム削除
            for (let frame in FRAMES) {
                if (FRAMES[frame].deleteFrameId(message.frameId)) break;
            }
            break;
        case 'url_change':
            // 親フレームの場合
            if (!FRAMES[message.frameId]) break;
            // URL変更検知
            FRAMES[message.frameId].href = message.url;
            break;
        case 'url_load':
            for (let frame in FRAMES) {
                if (FRAMES[frame].showFrameIds().includes(message.frameId)) {
                    // 親フレームのURL遷移
                    FRAMES[frame].hrefLoad = message.url;
                    break;
                }
            }
            break;
        case 'log':
            console.log(Boolean(message.frameId && FRAMES[message.frameId]), message);
            break;
        }
    }
}

// サイドバー開く
function onclicked() {
    browser.sidebarAction.open();
    browser.sidebarAction.setPanel({ panel : ORIGINURL });
};

// 余分なヘッダー削除
const webrequestHeaderCleaning = details => {
    // 自アドオンのリクエストのみ
    if (details.documentUrl !== DOCUMENTURL) return {};

    const headers = details.responseHeaders;
    // ヘッダー書き換え
    for (let i=0; i<headers.length; i++) {
        let name = headers[i].name.toLowerCase();
        // x-frame-optionsヘッダー、content-security-policyヘッダーを除去
        if (name === 'x-frame-options'
            || name === 'frame-options'
            || name === 'frame-ancestors'
            || name === 'content-security-policy') {
            headers.splice(i, 1);
            i--;
            continue;
        }
    }
    return { responseHeaders: headers };
};

// 余分なヘッダー削除
const webrequestHeaderCleaningAll = details => {
    const headers = details.responseHeaders;
    // ヘッダー書き換え
    for (let i=0; i<headers.length; i++) {
        let name = headers[i].name.toLowerCase();
        // x-frame-optionsヘッダー、content-security-policyヘッダーを除去
        if (name === 'x-frame-options'
            || name === 'frame-options'
            || name === 'frame-ancestors'
            || name === 'content-security-policy') {
            headers.splice(i, 1);
            i--;
            continue;
        }
    }
    return { responseHeaders: headers };
};

// ヘッダー削除開始
var startHeaderCleaning = () => {
    browser.webRequest.onHeadersReceived.removeListener(webrequestHeaderCleaning);
    browser.webRequest.onHeadersReceived.removeListener(webrequestHeaderCleaningAll);

    if (config.getPref('webrequestHeaderCleaningAll') === false) {
        // レスポンス受信時
        browser.webRequest.onHeadersReceived.addListener(
            webrequestHeaderCleaning,
            { urls : [ '<all_urls>' ],
              types : [ 'sub_frame' ],
              tabId : -1 // タブ以外
            },
            [ 'blocking', 'responseHeaders' ]
        );
    }
    else {
        // レスポンス受信時（スクリプト）
        browser.webRequest.onHeadersReceived.addListener(
            webrequestHeaderCleaningAll,
            { urls : [ '<all_urls>' ],
              types : [ 'sub_frame', 'script', 'xmlhttprequest' ],
              tabId : -1 // タブ以外
            },
            [ 'blocking', 'responseHeaders' ]
        );
    }
};

// ユーザエージェント書き換え
const webrequestHeaderChangingUseragent = details => {
    // 自アドオンのリクエストのみ
    if (details.documentUrl !== DOCUMENTURL) return {};

    const headers = details.requestHeaders;
    // ヘッダー書き換え
    for (let i=0; i<headers.length; i++) {
        let name = headers[i].name.toLowerCase();
        // UserAgentヘッダーを書き換え
        if (name === 'user-agent') {
            headers[i].value = config.getPref('useragent') || navigator.userAgent;
            break;
        }
    }

    return { requestHeaders : headers };
};

// ヘッダー書き換え開始
var startHeaderChanging = () => {
    browser.webRequest.onBeforeSendHeaders.removeListener(webrequestHeaderChangingUseragent);

    if (config.getPref('webrequestHeaderChangingUseragent') === true) {
        // リクエスト送信前
        browser.webRequest.onBeforeSendHeaders.addListener(
            webrequestHeaderChangingUseragent,
            { urls : [ '<all_urls>' ],
              types : [ 'sub_frame' ],
              tabId : -1 // タブ以外
            },
            [ 'blocking', 'requestHeaders' ]
        );
    }
};

// ショートカット
var updateKeyboardShortcut = () => {
    if (config.getPref('enableKeyboardShortcut') === true) {
        browser.commands.update({
            name :"_execute_sidebar_action",
            shortcut :"Ctrl+Alt+" + config.getPref('shortcutKey')
        });
    }
    else {
        browser.commands.update({
            name :"_execute_sidebar_action",
            shortcut :""
        });
    }
};


// コンフィグ取得・取得後処理
config.initialize().then(() => {
    startHeaderCleaning();
    startHeaderChanging();
    updateKeyboardShortcut();
});
