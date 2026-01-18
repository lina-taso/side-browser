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
    await waitBackground();
    await waitConfig();
    vivify();
    localization();
    listenConfigChange();
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

// wait background initialized
const waitBackground = async () => {
    bg = await browser.runtime.getBackgroundPage();
    if (bg) return Promise.resolve();
    return new Promise(resolve => setTimeout(() => { waitBackground().then(resolve); }, 1000));
};

// wait config initialized
const waitConfig = async () => {
    if (bg.config.initialized) return Promise.resolve();
    return new Promise(resolve => setTimeout(() => { waitConfig().then(resolve); }, 1000));
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

// コンフィグ変更検知
function listenConfigChange()
{
    browser.storage.onChanged.addListener((change, area) => {
        if (change.panelSettings) {
            // newValueは初期値が空になる
            const settings = JSON.parse(bg.config.getPref('panelSettings'));
            // パネル削除チェック
            $('.browser-panel:not(.template)').each((i,panel) => {
                if (!settings.some(e => e.id === panel.id))
                    removeBrowserPanel(panel.id);
            });
            settings.forEach((setting, i) => {
                // パネル追加チェック
                if ($('#'+setting.id).length === 0) addBrowserPanel(setting, i);
                // 設定反映
                else updateBrowserPanel(setting);
            });
            // TODO: パネル順序実装したら順序チェック
       }
    });
}

// ダイアログ初期化
function initDialog()
{
    // popup-webrequestHeaderCleaningAll
    if (!bg.config.getPref('popup-webrequestHeaderCleaningAll'))
        showDialog('#popup-webrequestHeaderCleaningAll');
}

// ダイアログ表示
function showDialog(selector)
{
    const $target = $(selector).fadeIn();
    $target.siblings($target.attr('data-veil')).fadeIn();
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
    const $target = $(e.target).closest('.popup-panel').fadeOut();
    $target.siblings($target.attr('data-veil')).fadeOut();
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
    const settings = JSON.parse(bg.config.getPref('panelSettings'));
    settings.forEach(addBrowserPanel);
}

// ブラウザーフレームを追加
function addBrowserPanel(panelSetting, position)
{
    // パネルを追加
    const $panel = $('.browser-panel.template').clone(true).removeClass('template').attr('id', panelSetting.id);
    // 末尾に追加
    if (!position) $panel.appendTo('#panel-container');
    // positionに挿入
    else $panel.insertAfter($('#panel-container').children().eq(position-1));

    $panel.find('iframe.browser')[0].contentWindow.addEventListener('load', (e) => {
        const _window = e.currentTarget,
              iframe  = _window.document.getElementById('inline-browser'),
              frameId = browser.runtime.getFrameId(iframe);
        $panel.attr('data-inner-frameid', frameId);

        FRAMEIDS.push(frameId);
        // background script
        bg.FRAMES[frameId] = new frameUI($panel);
        // settings
        updateBrowserPanel(panelSetting);
    });
}

// ブラウザーフレームの更新
function updateBrowserPanel(panelSetting)
{
    const $panel  = $('#'+panelSetting.id),
          frameId = parseInt($panel.attr('data-inner-frameid'));

    // settings
    bg.FRAMES[frameId].height = panelSetting.height;
    bg.FRAMES[frameId].scale = panelSetting.scale;
}

// ブラウザーフレームを削除
function removeBrowserPanel(panelId)
{
    const $panel = $('#'+panelId),
          frameId = parseInt($panel.attr('data-inner-frameid'));

    // パネルを削除
    $panel.remove();

    const myidx = FRAMEIDS.indexOf(frameId);
    FRAMEIDS.splice(myidx, 1);
    // 終了
    bg.FRAMES[frameId].destroy();
    delete bg.FRAMES[frameId];
}

class frameUI {
    constructor($panel) {
        this._$panel        = $panel;
        this._frameId       = parseInt($panel.attr('data-inner-frameid'));
        this._subframeIds   = [];
        this._$iframe       = $panel.find('iframe.browser');
        this._iframeWindow  = this._$iframe[0].contentWindow;
        this._browserIframe = this._iframeWindow.document.getElementById('inline-browser');
        this._browserWindow = this._browserIframe.contentWindow;
        this._$handler      = $panel.find('.browser-panel-handler');
        this._$menuContainer= $panel.find('.menu-container');
        this._$copied       = $panel.find('.copied');
        this._$scale        = $panel.find('.scale');
        browser.windows.getCurrent().then((win) => { this._windowId = win.id; });

        // ボタンイベント
        $panel.find('button.prev').on('click', () => { this.prev(); });
        $panel.find('button.next').on('click', () => { this.next(); });
        $panel.find('button.home').on('click', () => { this.home(); });
        $panel.find('button.refresh').on('click', () => { this.refresh(); });
        $panel.find('button.copy-url').on('click', () => { this.copyUrl(); });
        $panel.find('button.share').on('click', () => { this.share(); });
        $panel.find('button.menu').on('click', () => { this.menu(); });
        $panel.find('.panel-veil').on('click', () => { this.panelVeil(); });
        $panel.find('button.scale-minus').on('click', e => { this.scaleMinus(e); });
        $panel.find('button.scale-plus').on('click', e => { this.scalePlus(e); });
        $panel.find('button.open-option').on('click', () => { this.openOption(); });

        // アドレスバー
        $panel.find('.textbox.address').on('keypress', e => {
            e.originalEvent.key === 'Enter' && this.run();

        });
        // リサイザー
        $panel.find('.browser-panel-handler')
            .on('mousedown', () => { this.mousedownHandler(); })
            .on('mousemove', (e) => { this.mousemoveHandler(e); })
            .on('mouseup mouseout', () => { this.mouseupHandler(); });

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
        this._$panel.attr('data-loading', bool.toString());
    }
    // 読み込み中取得
    get loading() {
        return this._$panel.attr('data-loading') === 'true';
    }
    // 拡大率
    set scale(ratio) {
        this._$iframe.css('zoom', (ratio || 100)/100);
        this._$scale.text(ratio || 100);
    }
    // パネル高さ
    set height(height) {
        if (height)
            this._$panel.css({height : height, flex : 'unset'});
        // リセット
        else
            this._$panel.css({flex : '1', height : ''});
    }
    // 設定
    set config(setting) {
        const settings = JSON.parse(bg.config.getPref('panelSettings'));
        const i = settings.findIndex(e => e.id === this._$panel[0].id);
        settings[i] = setting;
        bg.config.setPref('panelSettings', JSON.stringify(settings));
    }
    // 設定取得
    get config() {
        const settings = JSON.parse(bg.config.getPref('panelSettings'));
        return settings.filter(e => e.id === this._$panel[0].id)[0];
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
        this.href = this.config.home;
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
        browser.tabs.query({ active : true, currentWindow : true }).then((tabs) => {
            bg.console.log(tabs);
            this.hrefLoad = 'https://x.com/compose/post?'
                + 'text=' + encodeURIComponent(tabs[0].title)
                + '&url=' + encodeURIComponent(tabs[0].url);
        });
    }
    // メニューボタン
    menu() {
        this._$menuContainer.fadeToggle();
        this._$menuContainer.siblings('.panel-veil').fadeToggle();
    }
    //パネルveil
    panelVeil() {
        this._$menuContainer.fadeOut();
        this._$menuContainer.siblings('.panel-veil').fadeOut();
    }
    // 縮小
    scaleMinus(e) {
        e.preventDefault();
        e.stopPropagation();
        const setting = this.config;
        const now = parseInt(this._$scale.text());
        if (now >= scaleMin && now <= scaleMax) {
            let next = parseInt((now -1) / 10) * 10;
            next = next < scaleMin ? scaleMin : next;
            this.scale = next;
            setting.scale = next;
        }
        // 100%
        else {
            this.scale = 100;
            setting.scale = 100;
        }
        // 設定値保存
        this.config = setting;
    }
    // 拡大
    scalePlus(e) {
        e.preventDefault();
        e.stopPropagation();
        const setting = this.config;
        const now = parseInt(this._$scale.text());
        if (now >= scaleMin && now <= scaleMax) {
            let next = parseInt((now +11) / 10) * 10;
            next = next > scaleMax ? scaleMax : next;
            this.scale = next;
            setting.scale = next;
        }
        // 100%
        else {
            this.scale = 100;
            setting.scale = 100;
        }
        // 設定値保存
        this.config = setting;
    }
    // オプション
    openOption() {
        this._$menuContainer.fadeOut();
        this._$menuContainer.siblings('.panel-veil').fadeOut();
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
