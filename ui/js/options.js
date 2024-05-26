/**
 * @fileOverview sidebar script
 * @name options.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg;

window.addEventListener('load', async () => {
    bg = await browser.runtime.getBackgroundPage();
    restorePrefs();
    detectChanges();
    vivify();
    localization();
});

// コンフィグ反映
const restorePrefs = () => {
    const prefs = bg.config.getPref();
    for (let item in prefs) {
        switch (typeof prefs[item]) {
        case 'string':
        case 'number':
            $('#'+item).val(prefs[item]);
            break;
        case 'boolean':
            $('#'+item).prop('checked', prefs[item]);
            break;
        }
    }

    initPrefs();
};

// 初期化
const initPrefs = () => {
    $('#useragent').prop('disabled', !bg.config.getPref('webrequestHeaderChangingUseragent'));
    if (!$('#useragent').val()) $('#useragent').val(navigator.userAgent);
    // for side-twitter
    $('#timelineUpdateInterval').prop('disabled', !bg.config.getPref('timelineAutoUpdate'));
};

// 変更検知
const detectChanges = () => {
    $('input, select').on('change', (e) => {
        //console.log(e.target.id, e.target.checked, e.target.value);
        // チェックボックスの場合はboolean
        if (e.target.type === 'checkbox') {
            bg.config.setPref(e.target.id, e.target.checked);
        }
        else {
            if (e.target.value !== '') {
                bg.config.setPref(e.target.id, e.target.value);
            }
            // 空の場合初期化
            else {
                bg.config.setPref(e.target.id);
                // 初期値
                if (e.target.id == 'useragent')
                    $('#'+e.target.id).val(navigator.userAgent);
                else
                    $('#'+e.target.id).val(bg.config.getPref(e.target.id));
            }
        }
    });
};

// 個別アクション
const vivify = () => {
    $('#webrequestHeaderCleaningAll').on('click', confirmChanging);
    $('#webrequestHeaderCleaningAll').on('change', confirmedChanging);
    $('#webrequestHeaderChangingUseragent').on('change', disableUseragentTextbox);
    $('#unregister').on('click', unregister);
    // for side-twitter
    $('#timelineAutoUpdate').on('change', disableUpdateIntervalTextbox);
};

// ローカライズ
const localization = () => {
    const suffixList = [''];

    for (const suffix of suffixList) {
        const attr = 'data-string' + (suffix ? '-' + suffix : '');
        $('['+attr+']').each(function(i, e) {
            suffix
                ? $(e).attr(suffix, browser.i18n.getMessage($(e).attr(attr)))
                : $(e).text(browser.i18n.getMessage($(e).attr(attr)));
        });
    }
};

// useragentテキストボックスの無効化
const disableUseragentTextbox = (e) => {
    $('#useragent').prop('disabled', !e.target.checked);
    bg.startHeaderChanging();
};

// updateIntervalテキストボックスの無効化
const disableUpdateIntervalTextbox = (e) => {
    $('#timelineUpdateInterval').prop('disabled', !e.target.checked);
};

// webrequestHeaderCleaningAll変更確認 on click
const confirmChanging = (e) => {
    // 有効化
    if (e.target.checked) {
        // 実施確認
        return confirm(browser.i18n.getMessage('confirmChanging-confirm'));
    }
    return true;
};

// webrequestHeaderCleaningAll変更実施 on change
const confirmedChanging = (e) => {
    // 有効化
    if (e.target.checked) {
        // 切り替え
        bg.startHeaderCleaning();
        // service worker登録解除
        unregister();
    }
    // 無効化
    else {
        bg.startHeaderCleaning();
    }
};

// service worker登録解除ボタン
const unregister = () => {
    // 実施確認
    if (confirm(browser.i18n.getMessage('unregister-confirm'))) {
        // 実施
        browser.browsingData.remove({}, { serviceWorkers: true }).then(() => {
            // 完了通知
            alert(browser.i18n.getMessage('unregister-alert'));
        });
    }
};
