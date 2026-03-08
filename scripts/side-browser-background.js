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
browser.runtime.onConnect.addListener(connect);
browser.runtime.onMessage.addListener(message);
browser.browserAction.onClicked.addListener(onclicked);

async function startup()
{
}

function install(details)
{
    if (details.reason == 'install' || details.reason == 'update') {

        return browser.tabs.create({
            url : FIRSTRUNURL,
            active : true
        });
    }
    return Promise.resolve();
}

function connect(port)
{
    if (!port.sender.tab) {
        DEBUG && console.log('onconnect', port);
        const frameId = parseInt(port.name);

        // init_response.data
        const data = {
            observeUrlChange  : true,
            changeScreen      : config.getPref('changeScreen'),
            width             : config.getPref('changeScreenWidth'),
            height            : config.getPref('changeScreenHeight'),
            changeUseragent   : config.getPref('changeUseragent'),
            useragent         : config.getPref('useragent') || navigator.userAgent,
            xdomainTransition : config.getPref('xdomainTransition')
        };

        // 親フレーム
        if (FRAMES[frameId]) {
            // Portイベント追加・保存する
            port.onMessage.addListener(message);
            port.onDisconnect.addListener(disconnect);
            FRAMES[frameId]._port = port;

            port.postMessage({
                type : 'init_response',
                data : data
            });
        }
        // 子フレーム？
        else {
            for (let frame in FRAMES) {
                // 子フレーム追加
                if (FRAMES[frame].addFrameId(frameId, message.parentId)) {
                    // Portイベント追加・保存しない
                    port.onMessage.addListener(message);
                    port.onDisconnect.addListener(disconnect);

                    data.observeUrlChange = false;
                    port.postMessage({
                        type : 'init_response',
                        data : data
                    });
                }
            }
        }
    }
}

function message(message, port)
{
    DEBUG && console.log('onmessage', message, port);
    const frameId = parseInt(port.name);

    switch (message.type) {
    case 'loaded':
        // 親フレームの場合
        if (!FRAMES[frameId]) break;
        // 読み込み完了
        FRAMES[frameId]._loading = false;
        break;
    case 'unload':
        // 子フレームの場合
        if (FRAMES[frameId]) break;
        // フレーム削除
        for (let frame in FRAMES) {
            if (FRAMES[frame].deleteFrameId(frameId)) break;
        }
        break;
    case 'url_change':
        // 親フレームの場合
        if (!FRAMES[frameId]) break;
        // URL変更検知
        FRAMES[frameId].href = message.data.url;
        break;
    case 'url_load':
        for (let frame in FRAMES) {
            if (FRAMES[frame].showFrameIds().includes(frameId)) {
                // 親フレームのURL遷移
                FRAMES[frame].hrefLoad = message.data.url;
                break;
            }
        }
        break;
    case 'log':
        console.log(frameId, message, port);
        break;
    }
}

function disconnect(port) {
    DEBUG && console.log('ondisconnect', port);
    const frameId = parseInt(port.name);

    // 親フレーム
    if (FRAMES[frameId]) {
        FRAMES[frameId]._port = undefined;
    }
}

// サイドバー開く
function onclicked() {
    browser.sidebarAction.open();
    browser.sidebarAction.setPanel({ panel : ORIGINURL });
};

// ヘッダー削除ルール
const headerCleaningRule = {
    id : 1,
    priority : 1,
    action : {
        type : 'modifyHeaders',
        responseHeaders: [
            { operation : 'remove', header : 'x-frame-options' },
            { operation : 'remove', header : 'frame-options' },
            { operation : 'remove', header : 'frame-ancestors' },
            { operation : 'remove', header : 'content-security-policy' }
        ]
    },
    condition : {
        urlFilter : "|*://*/*",
        resourceTypes : [ 'sub_frame' ],
        tabIds : [ -1 ]
    }
};

// ヘッダー削除ルール
const headerCleaningAllRule = {
    id : 2,
    priority : 1,
    action : {
        type : 'modifyHeaders',
        responseHeaders: [
            { operation : 'remove', header : 'x-frame-options' },
            { operation : 'remove', header : 'frame-options' },
            { operation : 'remove', header : 'frame-ancestors' },
            { operation : 'remove', header : 'content-security-policy' }
        ]
    },
    condition : {
        urlFilter : "|*://*/*",
        resourceTypes : [ 'script', 'xmlhttprequest' ],
        tabIds : [ -1 ]
    }
};

// ヘッダー書換ルール
const getHeaderChangingRule = () => {
    return {
        id : 3,
        priority : 1,
        action : {
            type : 'modifyHeaders',
            requestHeaders : [
                { operation : 'set', header : 'user-agent',
                  value : config.getPref('useragent') || navigator.userAgent }
            ]
        },
        condition : {
            urlFilter : "|*://*/*",
            resourceTypes : [ 'sub_frame' ],
            tabIds : [ -1 ]
        }
    };
};

// ヘッダー削除ルール適用
var updateCleaningRule = () => {
    if (config.getPref('webrequestHeaderCleaningAll') === false) {
        browser.declarativeNetRequest.updateSessionRules({
            removeRuleIds : [1, 2],
            addRules : [headerCleaningRule]
        });
    }
    else {
        browser.declarativeNetRequest.updateSessionRules({
            removeRuleIds : [1, 2],
            addRules : [headerCleaningRule, headerCleaningAllRule]
        });
    }
};

// ヘッダー書換ルール適用
var updateChangingRule = () => {
    if (config.getPref('webrequestHeaderChangingUseragent') === false) {
        browser.declarativeNetRequest.updateSessionRules({
            removeRuleIds : [3]
        });
    }
    else {
        browser.declarativeNetRequest.updateSessionRules({
            removeRuleIds : [3],
            addRules : [getHeaderChangingRule()]
        });
    }
};

// コンフィグ取得・取得後処理
config.initialize().then(() => {
    updateCleaningRule();
    updateChangingRule();
});
