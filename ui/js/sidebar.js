/**
 * @fileOverview sidebar script
 * @name sidebar.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const FRAMEIDS = [],
      // update common.scss, options.xhtml
      scaleMin = 50,
      scaleMax = 150;
let bg;

window.addEventListener('load', async () => {
    bg = await browser.runtime.getBackgroundPage();
    // wait config
    await waitConfig();
    vivify();
    localization();
    initDialog();
    initBrowserPanels();
});

window.addEventListener('unload', () => {
    FRAMEIDS.forEach(frameId => {
        // 終了
        bg.FRAMES[frameId].destroy();
        delete bg.FRAMES[frameId];
    });
});

// wait config initialized
const waitConfig = async () => {
    if (bg.config.initialized) return;
    await new Promise(resolve => setTimeout(async () => {
        await waitConfig();
        resolve();
    }, 1000));
};

// 個別アクション
const vivify = () => {
    $('#popup-webrequestHeaderCleaningAll button').on('click', shownDialog);
    $('.popup-panel .close-dialog').on('click', closeDialog);
    $('.popup-panel .open-option').on('click', openOptionsPage);
};

// ローカライズ
const localization = () => {
    const suffixList = ['', 'title', 'src'];

    for (const suffix of suffixList) {
        const attr = 'data-string' + (suffix ? '-' + suffix : '');
        $('['+attr+']').each(function(i, e) {
            suffix
                ? $(e).attr(suffix, browser.i18n.getMessage($(e).attr(attr)))
                : $(e).text(browser.i18n.getMessage($(e).attr(attr)));
        });
    }
};

// ダイアログ表示済み
function initDialog()
{
    // popup-webrequestHeaderCleaningAll
    if (!bg.config.getPref('popup-webrequestHeaderCleaningAll')) {
        $('#popup-webrequestHeaderCleaningAll').fadeIn();
    }
}

// ダイアログ表示済み
function shownDialog(e)
{
    const pref = $(e.target).closest('.popup-panel').attr('id');
    bg.config.setPref(pref, true);
}

// ダイアログを閉じる
function closeDialog(e)
{
    $(e.target).closest('.popup-panel').fadeOut();
}

// 設定ページを開く
function openOptionsPage(e)
{
    closeDialog(e);
    browser.runtime.openOptionsPage();
}

// UI初期化
function initBrowserPanels()
{
    addBrowserPanel('panel1');
}

// ブラウザーフレームを追加
function addBrowserPanel(panelId)
{
    // パネルを追加
    const $panel = $('.browser-panel.template').clone(true)
          .removeClass('template').attr('id', panelId).appendTo('body');

    $panel.find('iframe.browser')[0].contentWindow.addEventListener('load', (e) => {
        const _window = e.currentTarget,
              iframe  = _window.document.getElementById('inline-browser'),
              frameId = browser.runtime.getFrameId(iframe);
        $panel.attr('data-inner-frameid', frameId);

        FRAMEIDS.push(frameId);
        // background script
        bg.FRAMES[frameId] = new frameUI($panel);
    });
}

// ブラウザーフレームを削除
function removeBrowserPanel(panelId)
{
    const $panel = $('#'+panelId),
          frameId = $panel.attr('data-inner-frameid');

    // パネルを削除
    $panel.remove();

    // 終了
    bg.FRAMES[frameId].destroy();
    delete bg.FRAMES[frameId];
}

class frameUI {
    constructor($panel) {
        this._$panel        = $panel;
        this._frameId       = parseInt(this._$panel.attr('data-inner-frameid'));
        this._subframeIds   = [];
        this._$iframe       = this._$panel.find('iframe.browser');
        this._iframeWindow  = this._$iframe[0].contentWindow;
        this._browserIframe = this._iframeWindow.document.getElementById('inline-browser');
        this._browserWindow = this._browserIframe.contentWindow;
        this._$menuContainer= $panel.find('.menu-container');
        this._$copied       = $panel.find('.copied');
        this._$scale        = $panel.find('.scale');
        browser.windows.getCurrent().then((win) => { this._windowId = win.id; });

        // ボタンイベント
        this._$panel.find('button.prev').on('click', () => { this.prev(); });
        this._$panel.find('button.next').on('click', () => { this.next(); });
        this._$panel.find('button.home').on('click', () => { this.home(); });
        this._$panel.find('button.refresh').on('click', () => { this.refresh(); });
        this._$panel.find('button.copy-url').on('click', () => { this.copyUrl(); });
        this._$panel.find('button.run').on('click', () => { this.run(); });
        this._$panel.find('button.share').on('click', () => { this.share(); });
        this._$panel.find('button.menu').on('click', e => { this.menu(e); });
        this._$panel.find('button.scale-minus').on('click', e => { this.scaleMinus(e); });
        this._$panel.find('button.scale-plus').on('click', e => { this.scalePlus(e); });
        this._$panel.find('button.open-option').on('click', e => { this.openOption(e); });

        // アドレスバー
        this._$panel.find('.textbox.address').on('keypress', e => {
            e.originalEvent.key === 'Enter' && this.run();
        });

        // webrequestイベント
        browser.webRequest.onBeforeRequest.addListener(
            (details) => { this.webrequestBeforerequest(details); },
            { urls : ['https://x.com/*' ], types : ['sub_frame' ], tabId : -1 }
        );
        browser.webRequest.onCompleted.addListener(
            (details) => { this.webrequestCompleted(details); },
            { urls : ['https://x.com/*' ], types : ['sub_frame' ], tabId : -1 }
        );
        browser.webRequest.onErrorOccurred.addListener(
            (details) => { this.webrequestErrorOccured(details); },
            { urls : ['https://x.com/*' ], types : ['sub_frame' ], tabId : -1 }
        );

        // 拡大率
        this.scale(bg.config.getPref('defaultScale'));
        // ホームページ
        this.home();
    }

    // アドレスバー更新
    set href(address) {
        this._$panel.find('.address').text(address);
    }
    // アドレスバー更新後読み込み
    set hrefLoad(address) {
        this.href = address;
        this._browserWindow.location.href = address;
    }
    // アドレスバー取得
    get href() {
        return this._$panel.find('.address').text();
    }
    // 読み込み中設定
    set _loading(bool) {
        this._$panel.attr('data-loading', bool ? 'true' : 'false');
    }
    // 読み込み中取得
    get loading() {
        return this._$panel.attr('data-loading') === 'true';
    }

    // 戻るボタン
    prev() {
        this._iframeWindow.history.back();
    }
    // 次へボタン
    next() {
        this._iframeWindow.history.forward();
    }
    // ホームボタン
    home() {
        this.href = bg.config.getPref('homeURL');
        this.run();
    }
    // 再読込・中断ボタン
    refresh() {
        if (this.loading) {
            return;
        }
        else {
            this.run();
        }
    }
    // 実行ボタン
    run() {
        let url = this.href;
        if (!url) return;
        if (!/^\w+:\/\//.test(url) && !/^about:/.test(url))
            url = (bg.config.getPref('appendHttps') ? 'https://' : 'http://') + url;
        this.hrefLoad = url;
    }
    // URLコピー
    copyUrl() {
        navigator.clipboard.writeText(this._$panel.find('.address').text()).then(
            () => {
                this._$copied.stop(true, true).fadeIn(200).delay(400).fadeOut(200);
            });
    }
    // ページ共有
    share() {
        browser.tabs.query({ active : true }).then((tabs) => {
            bg.console.log(tabs);
            this.hrefLoad = 'https://x.com/compose/post?'
                + 'text=' + encodeURIComponent(tabs[0].title)
                + '&url=' + encodeURIComponent(tabs[0].url);
        });
    }
    // メニューボタン
    menu(e) {
        this._$menuContainer.fadeToggle();
    }
    // 縮小
    scaleMinus(e) {
        e.preventDefault();
        e.stopPropagation();
        const now = parseInt(this._$scale.text());
        if (now >= scaleMin && now <= scaleMax) {
            let next = parseInt((now -1) / 10) * 10;
            next = next < scaleMin ? scaleMin : next;
            this.scale(next);
        }
        // 100%
        else {
            this.scale(100);
        }
    }
    // 拡大
    scalePlus(e) {
        e.preventDefault();
        e.stopPropagation();
        const now = parseInt(this._$scale.text());
        if (now >= scaleMin && now <= scaleMax) {
            let next = parseInt((now +11) / 10) * 10;
            next = next > scaleMax ? scaleMax : next;
            this.scale(next);
        }
        // 100%
        else {
            this.scale(100);
        }
    }
    // 拡大率
    scale(ratio) {
        this._$iframe.attr('data-scale', ratio);
        this._$scale.text(ratio);
    }
    // オプション
    openOption(ratio) {
        this._$menuContainer.fadeOut();
        browser.runtime.openOptionsPage();
    }

    // webrequestイベント
    webrequestBeforerequest(details) {
        if (details.frameId === this._frameId) {
            this._loading = true;
            this.href = details.url;
        }
    }
    // webrequestイベント
    webrequestCompleted(details) {
        if (details.frameId === this._frameId) {
            this._loading = false;
        }
    }
    // webrequestイベント
    webrequestErrorOccured(details) {
        //console.log(details);
        if (details.frameId === this._frameId) {
            this._loading = false;
        }
    }

    // 子フレーム管理
    addFrameId(frameId, parentId) {
        frameId  = parseInt(frameId);
        parentId = parseInt(parentId);
        // parentIdが存在するか
        if (this.showFrameIds().includes(parentId)) {
            this._subframeIds.push(frameId);
            return true;
        }
        return false;
    }
    deleteFrameId(frameId) {
        frameId = parseInt(frameId);
        // frameIdが存在するか
        let i = this._subframeIds.indexOf(frameId);
        if (i >= 0) {
            this._subframeIds.splice(i, 1);
            return true;
        }
        return false;
    }
    showFrameIds() {
        return [this._frameId, this._subframeIds].flat(1);
    }

    // 終了
    destroy() {
        browser.webRequest.onBeforeRequest.removeListener(this.webrequestBeforerequest);
        browser.webRequest.onCompleted.removeListener(this.webrequestCompleted);
        browser.webRequest.onErrorOccurred.removeListener(this.webrequestErrorOccured);
    }
};
