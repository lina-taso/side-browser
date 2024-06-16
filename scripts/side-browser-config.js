/**
 * @fileOverview
 * @name side-browser-config.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

var config = {
    _initialized : false,
    _debug       : false,
    _config      : {},
    get debug() { return this._debug; },
    get initialized() { return this._initialized; },
    initialize : async function() {
        this._config = Object.assign({},
                                     defaultconfig,
                                     await browser.storage.local.get());
        this._debug = this._config.debug ? true : false;
        this._initialized = true;
    },
    getPref : function(key) {
        if (!this.initialized)
            throw new Error('CONFIG_MUST_BE_INITIALIZED');

        return key == null ? this._config : this._config[key];
    },
    setPref : function(key, val) {
        if (!this._initialized)
            throw new Error('CONFIG_MUST_BE_INITIALIZED');

        if (!key) return Promise.reject();

        // debugのみ
        if (key === 'debug')
            this._debug = val === true ? true : false;

        if (val == null) {
            this._config[key] = defaultconfig[key] !== null ? defaultconfig[key] : null;
            return browser.storage.local.remove(key);
        }
        else {
            this._config[key] = val;
            const set = {};
            set[key] = val;
            return browser.storage.local.set(set);
        }
    }
};

const defaultconfig = {
    // popup
    'popup-webrequestHeaderCleaningAll' : false,
    // options
    homeURL : 'about:blank',
    defaultScale : 100,
    appendHttps : true,
    xdomainTransition : false,
    webrequestHeaderChangingUseragent : false,
    useragent : '',
    enableKeyboardShortcut : false,
    shortcutKey : 'T',
    webrequestHeaderCleaningAll : false,
    // debug options
    changeScreen : false,
    changeScreenWidth : 400,
    changeScreenHeight : 800,
    changeUseragent : false,
};
