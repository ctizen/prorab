(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    exports.__esModule = true;
    function workerInit() {
        var _this = this;
        this.msgHandlers = {};
        this.options = {};
        this.imports = {};
        this.registerMsgHandler = function (handlerName, handler) {
            if (!_this.msgHandlers[handlerName]) {
                _this.msgHandlers[handlerName] = handler;
            }
        };
        this.dropMsgHandler = function (handlerName) {
            delete _this.msgHandlers[handlerName];
        };
        this.send = function (message) {
            _this.postMessage(JSON.stringify(message));
        };
        self.onmessage = function (event) {
            switch (event.data.type) {
                case 'init':
                    for (var i in event.data.options) {
                        var elem = event.data.options[i];
                        if (elem && elem.substr && elem.substr(0, 4) == 'blob') {
                            importScripts(elem);
                        }
                        else {
                            _this.options[i] = elem;
                        }
                    }
                    break;
                default:
                    var payload = JSON.parse(event.data.payload);
                    payload.type = event.data.type;
                    if (_this.msgHandlers[event.data.type]) {
                        _this.msgHandlers[event.data.type](payload);
                    }
            }
        };
    }
    function getMainFunc(func, umdImports) {
        return URL.createObjectURL(new Blob([
            '(', workerInit.toString(), ')();',
            '(', func.toString(), ')();'
        ].concat(umdImports), {
            type: 'application/javascript'
        }));
    }
    function getFunctionalParameter(func, paramName) {
        return URL.createObjectURL(new Blob([
            'options["' + paramName, '"] = ', func.toString()
        ], {
            type: 'application/javascript'
        }));
    }
    function makeWebpackImports(imports) {
        if (typeof __webpack_modules__ === 'undefined') {
            return [];
        }
        var procImports = [];
        for (var i in imports) {
            procImports.push('var mod = {}; (' + __webpack_modules__[imports[i]] +
                ')(mod, undefined, () => {}); imports["' + i + '"] = mod.exports;');
        }
        return procImports;
    }
    exports.createWorker = function (mainFunc, options, webpackImports) {
        var worker = new Worker(getMainFunc(mainFunc, makeWebpackImports(webpackImports || {})));
        for (var i in options) {
            if (typeof options[i] == 'function') {
                options[i] = getFunctionalParameter(options[i], i);
            }
        }
        worker.postMessage({
            type: 'init',
            options: options
        });
        var controlObject = {
            worker: worker,
            messageListeners: {},
            registerMsgHandler: function (eventType, handler) {
                if (!controlObject.messageListeners[eventType]) {
                    controlObject.messageListeners[eventType] = handler;
                }
                return controlObject;
            },
            dropMsgHandler: function (eventType) {
                delete controlObject.messageListeners[eventType];
                return controlObject;
            },
            send: function (_a) {
                var type = _a.type, payload = _a.payload;
                worker.postMessage({
                    type: type,
                    payload: JSON.stringify(payload)
                });
                return controlObject;
            }
        };
        worker.onmessage = function (e) {
            var data = JSON.parse(e.data);
            var payload = data.payload;
            if (controlObject.messageListeners[data.type]) {
                payload.type = data.type;
                controlObject.messageListeners[data.type](payload);
            }
        };
        return controlObject;
    };
});