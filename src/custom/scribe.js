/*global define*/
/**
* @overview
* @author Simon Schmidt <simon-schmidt@alarie.de>
* @copyright Simon Schmidt 2014
*/

/* Be less strict for module header. */
/*jshint maxparams:30, maxstatements:100 */
define([
    'jquery',
    '../scribe',
    './undo-manager',
    // // 'plugins/core/events',
    './events',
    './event-patches',
    './paste',
    // // 'plugins/core/inline-elements-mode',
    './inline-elements-mode',
    '../plugins/core/set-root-p-element',
    '../plugins/core/formatters/html/enforce-p-elements',
    '../plugins/core/formatters/html/ensure-selectable-containers'
],
/** @module custom-scribe */
function (
    $,
    _Scribe,
    buildUndoManager,
    events,
    eventPatches,
    pasteEvents,
    inlineElementsMode,
    setRootPElement,
    enforcePElements,
    ensureSelectableContainers
) {
    /*jshint maxparams:4, maxstatements:10 */
    'use strict';

    // Extend the FormatterFactory

    // var tmp = new _Scribe(document.createElement('div'));
    // using __proto__ works, but due to optimizers in browsers, modifying
    // this is really slow. Consider rather extending from it and setting the
    // extended class as new formatter;
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto
    // var FormatterFactory = tmp._plainTextFormatterFactory.__proto__;
    // var HTMLFormatterFactory = tmp._htmlTextFormatterFactory.__proto__;
    // FormatterFactory.prototype.register = function (fn) {};
    // FormatterFactory.prototype.unregister = function (fn) {};


    // HTMLFormatterFactory.prototype.register = function (phase, fn) {
    //     var str = fn.toString();
    //     if (Array.isArray(this.formatters[phase])) {
    //         this.formatters[phase] = {};
    //     }
    //     if (!(str in this.formatters[phase])) {
    //         this.formatters[phase][str] = fn;
    //     }
    // };

    // FormatterFactory.prototype.unregister = function (phase, fn) {
    //     var str = fn.toString();
    //     if (str in this.formatters[phase]) {
    //         delete this.formatters[phase][str];
    //     }
    // };

    var FormatterHelperScribeProxy = function (scribe) {
        this.scribe = scribe;

        this.fn = null;
        this.phase = null;
    };

    FormatterHelperScribeProxy.prototype = {

        registerHTMLFormatter : function (phase, fn) {
            this.phase = phase;
            this.fn = fn;
            this.scribe.registerHTMLFormatter(phase, fn);
        },

        unregister : function () {
            if (this.scribe && this.phase && this.fn) {
                this.scribe.unregisterHTMLFormatter(this.phase, this.fn);
            }
        }

    };

    /**
     * Formatter interceptors allow checking a formatter for a specific pattern
     * and then ater or skip the formatter before it's applied to the editor.
     * This is useful for formatters that are loaded by the default scribe and
     * which cannot be overwritten.
     *
     */
    function FormatterInterceptorChain () {
        this.interceptors = [];
    }

    FormatterInterceptorChain.prototype.add = function (interceptor) {
        this.interceptors.push(interceptor);
    };

    FormatterInterceptorChain.prototype.process = function (phase, formatter) {
        if (!this.interceptors.length) {
            return formatter;
        }

        return [formatter]
            .concat(this.interceptors)
            .reduce(function (formatter, interceptor) {
                return interceptor.process(phase, formatter);
            });
    };

    function FormatterInterceptor (phase, pattern) {
        this.phase = phase;
        this.pattern = new RegExp(pattern);
    }

    FormatterInterceptor.prototype.process = function (phase, formatter) {
        if (phase === this.phase && this.pattern.test(formatter.toString())) {
            formatter = this.match(formatter);
        }
        return formatter;
    };

    FormatterInterceptor.prototype.match = function (formatter) {
        return formatter;
    };

    function ReplaceNBSPCharsFormatterInterceptor () {
        FormatterInterceptor.apply(this, ['export', 'nbspCharRegExp']);

        var nbspCharRegExp = /((?:&nbsp;|\s)+)/;
        this.formatter = function (html) {
            return html.replace(nbspCharRegExp, function(all, match) {
                var tmp = match.replace(/&nbsp;/g, ' ');
                // return new Array(window.parseInt(match.length / 2) + 1).join(' &nbsp;');
                return new Array(tmp.length + 1).join(' ');
            });
        };
    }

    ReplaceNBSPCharsFormatterInterceptor.prototype =
        Object.create(FormatterInterceptor.prototype);

    ReplaceNBSPCharsFormatterInterceptor.prototype.constructor = ReplaceNBSPCharsFormatterInterceptor;

    ReplaceNBSPCharsFormatterInterceptor.prototype.match = function (/*formatter*/) {
        return this.formatter;
    };


    // var EventListenerProxy = function (el) {
    //     this.el = el;

    //     this.origAddEventListener = el.addEventListener;
    //     this.origRemoveEventListener = el.removeEventListener;

    //     el.addEventListener = this.addEventListener;
    //     el.removeEventListener = this.removeEventListener;
    // };

    // EventListenerProxy.prototype = {
    //     addEventListener : function () {
    //         this.origAddEventListener.apply(this, arguments);
    //     },

    //     removeEventListener : function () {
    //         this.origRemoveEventListener.apply(this, arguments);
    //     },

    //     destroy : function () {
    //         this.el.addEventListener = this.origAddEventListener;
    //         this.el.removeEventListener = this.origRemoveEventListener;
    //     }
    // };


    var EventCaptureProxy = {

        evt : null,
        fn : null,
        capture : null,

        installToScribe : function (scribe) {
            if (scribe && this.evt && this.fn) {
                scribe.listenTo(this.evt, this.fn);
            }
        },

        uninstallFromScribe : function (scribe) {
            if (scribe && this.evt && this.fn) {
                scribe.stopListening(this.evt, this.fn);
            }
        },

        addEventListener : function (evt, fn, capture) {
            this.evt = evt;
            this.fn = fn;
            this.capture = capture;
        }
    };


    function Scribe (el, options) {
        var fakeEl = this._beforeSetup();

        this.formatterInterceptorChain = new FormatterInterceptorChain();
        this.formatterInterceptorChain.add(new ReplaceNBSPCharsFormatterInterceptor());

        _Scribe.apply(this, [fakeEl, options]);

        this._afterSetup(fakeEl);

        if (el) {
          this.applyToElement(el);
        }
    }

    Scribe.prototype = Object.create(_Scribe.prototype);
    Scribe.prototype.constructor = Scribe;


    Scribe.prototype._beforeSetup = function () {
        var fakeEl = document.createElement('div'),
            that = this;

        this.undoEventCaptureProxy = Object.create(EventCaptureProxy);
        this.redoEventCaptureProxy = Object.create(EventCaptureProxy);

        document.body.appendChild(fakeEl);

        fakeEl.addEventListener = function (ev, fn, capture) {
            // This is a really nasty hack to get the original events from
            // the undo/redo plugin
            if (fn.toString().indexOf('redo') > 0) {
                that.redoEventCaptureProxy.addEventListener(ev, fn, capture);
            }

            if (fn.toString().indexOf('undo') > 0) {
                that.undoEventCaptureProxy.addEventListener(ev, fn, capture);
            }

        };

        return fakeEl;
    };

    Scribe.prototype._afterSetup = function (fakeEl) {
        var UndoManager = buildUndoManager(this);
        this.undoManager = new UndoManager();

        // TODO bind undo/redo shortcuts. They are being bound on the
        // fakeEl.

        this.enforcePElementsScribeProxy =
            new FormatterHelperScribeProxy(this);

        this.ensureSelectableContainersScribeProxy =
            new FormatterHelperScribeProxy(this);

        document.body.removeChild(fakeEl);
    };



    Scribe.prototype.applyToElement = function (editorElement) {

        if (!editorElement) {
          return null;
        }

        // set the reference to the current element, so scribe can use
        // it internally
        this.setScribeElement(editorElement);

        this.makeElementEditable();

        this._removeInternalEventListeners();

        if (this.allowsBlockElements()) {
            this.enableBlockElementsMode();

        } else {
            this.disableBlockElementsMode();
        }

        this._addInternalEventListeners();

        this.trigger('scribe:rebound');
    };

    Scribe.prototype.setScribeElement = function (el) {
        this.el = el;
    };

    Scribe.prototype.makeElementEditable = function () {
        this.el.setAttribute('contenteditable', true);
    };

    Scribe.prototype._removeInternalEventListeners = function() {
        this.stopListening('input');
        this.undoEventCaptureProxy.uninstallFromScribe(this);
        this.redoEventCaptureProxy.uninstallFromScribe(this);

        this.el.classList.remove('scribe-events-bound');
    };

    Scribe.prototype._addInternalEventListeners = function() {
        var that = this;

        if (!this.el.classList.contains('scribe-events-bound')) {

            this.use(eventPatches());


            this.use(events());
            this.use(pasteEvents());


            this.undoEventCaptureProxy.installToScribe(this);
            this.redoEventCaptureProxy.installToScribe(this);

            this.listenTo('input', function () {
                that.transactionManager.run();
            });

            this.el.classList.add('scribe-events-bound');

        }
    };



    Scribe.prototype.triggerCommand = function(name, target, opts) {
        var cmd = this.getCommand(name);

        if (!(target instanceof window.Node)) {
            opts = target;
        }

        if (cmd) {
            this.el.focus();
            cmd.execute(opts);
        }
    };

    Scribe.prototype.restoreFromHistory = function (historyItem) {
        this.el = historyItem.el;
        historyItem = historyItem.item;

        this.setHTML(historyItem, true);

        // Restore the selection
        var selection = new this.api.Selection();
        selection.selectMarkers();

        // Because we skip the formatters, a transaction is not run, so we have to
        // emit this event ourselves.
        this.trigger('content-changed');

    };

    Scribe.prototype.getHTMLFormattersForPhase = function (phase) {
        return this._htmlFormatterFactory.formatters[phase];
    };


    Scribe.prototype.pushHistory = function () {
      var previousUndoItem = this.undoManager.stack[this.undoManager.position];
      var previousContent = previousUndoItem && previousUndoItem.item &&
          previousUndoItem.item
          .replace(/<em class="scribe-marker">/g, '').replace(/<\/em>/g, '');

      /**
       * Chrome and Firefox: If we did push to the history, this would break
       * browser magic around `Document.queryCommandState` (http://jsbin.com/eDOxacI/1/edit?js,console,output).
       * This happens when doing any DOM manipulation.
       */

      // We only want to push the history if the content actually changed.
      if (! previousUndoItem || (previousUndoItem && this.getContent() !== previousContent)) {
        var selection = new this.api.Selection();

        selection.placeMarkers();
        var html = this.getHTML();
        selection.removeMarkers();

        this.undoManager.push(html);

        return true;
      } else {
        return false;
      }

    };


    Scribe.prototype.allowsBlockElements = function () {
        if (arguments.length && typeof arguments[0] !== 'undefined') {
            this.options.allowBlockElements = arguments[0];
        }
        return _Scribe.prototype.allowsBlockElements.apply(this);
    };

    /**
     * Registers a formatter.
     * Formatters are registered in two ways, firstly as the functions
     * in an array as they are needed by scribe.
     * Secondly in a map of the fn.toString() => index in the array.
     *
     * @param  {String}   phase The phase name.
     * @param  {Function} fn    The formatter function
     */
    Scribe.prototype.registerHTMLFormatter = function (phase, fn) {

        fn = this.formatterInterceptorChain.process(phase, fn);

        var index;

        if (this._htmlFormatterFactory.formattersMap &&
            this._htmlFormatterFactory.formattersMap[phase] &&
            fn.toString() in this._htmlFormatterFactory.formattersMap[phase]) {
            return;
        }

        index = this._htmlFormatterFactory.formatters[phase].length;
        if (!this._htmlFormatterFactory.formattersMap) {
            this._htmlFormatterFactory.formattersMap = {
                'normalize' : {},
                'sanitize' : {},
                'export' : {}
            };
        }
        this._htmlFormatterFactory.formattersMap[phase][fn.toString()] = index;

        return _Scribe.prototype.registerHTMLFormatter.apply(this, [phase, fn]);
    };

    /**
     * Unregister a formatter.
     * @param  {String}   phase The name of the formatter.
     * @param  {Function} fn    The formatter function.
     */
    Scribe.prototype.unregisterHTMLFormatter = function (phase, fn) {
      return;
        var formattersMap, fnStr = fn.toString();
        if ((formattersMap = this._htmlFormatterFactory.formattersMap[phase])) {

            var index = formattersMap[fnStr];

            if (index >= 0) {
                var formatters = this._htmlFormatterFactory.formatters[phase];
                if (formatters) {
                    formatters.splice(index, 1);
                }
            }
            delete formattersMap[fnStr];
            Object.keys(formattersMap).map(function(value, index) {
                if (formattersMap[value] > index) {
                    formattersMap[value] -= 1;
                }
            });
        }

    };


    Scribe.prototype.use = function (configurePlugin, proxy) {
        configurePlugin(proxy || this);
        return this;
    };



    Scribe.prototype.enableBlockElementsMode = function () {
        // Commands assume block elements are allowed, so all we
        // have to do is set the content.
        // TODO: replace this by initial formatter application?

        // This is only executed once at initialization of the element,
        // so it is sufficient to call this here.
        this.use(setRootPElement());

        // Warning: enforcePElements must come before
        // ensureSelectableContainers

        // This just installs a formatter
        this.use(enforcePElements(),
            this.enforcePElementsScribeProxy);

        this.use(ensureSelectableContainers(),
            this.ensureSelectableContainersScribeProxy);
    };

    Scribe.prototype.disableBlockElementsMode = function () {
        this.enforcePElementsScribeProxy
            .unregister();

        this.ensureSelectableContainersScribeProxy
            .unregister();

        // Commands assume block elements are not allowed,
        // so we have to set the
        // content and override some UX.

        // This is only executed once at initialization of the element,
        // so it is sufficient to call this here. It registers an event
        // handler on the element
        this.use(inlineElementsMode());
    };

    Scribe.prototype.removeEventListeners = function() {
        this.stopListening('');
    };



    Scribe.prototype.removeFromElement = function () {
        this.removeEventListeners();
    };

    Scribe.prototype.listenTo = function (event, handler) {
        var namespace = '';
        if (event.indexOf('.') < 0) {
            namespace = '.scribe';
        }
        $(this.el).on(event + namespace, handler);
        return this;
    };

    Scribe.prototype.stopListening = function (event, handler) {
        var namespace = '';
        if (event.indexOf('.') < 0) {
            namespace = '.scribe';
        }
        event = event || '';

        $(this.el).off(event + namespace, handler);

        return this;
    };

    Scribe.prototype.isBoundTo = function (editorElement) {
        window.debug.todo('The check here should be more specific');
        return editorElement.getAttribute('contenteditable') === 'true';
    };


    // Scribe.prototype.use = function (configurePlugin) {
    //     var addEventListener = this.el.addEventListener,
    //         removeEventListener = this.el.removeEventListener,
    //         scribe = this;

    //     this.el.addEventListener = function (name, cb) {
    //         console.log(name  + '.internal');
    //         scribe.listenTo(name + '.internal', cb);
    //     };

    //     this.el.removeEventListener = function (name, cb) {
    //         scribe.stopListening(name + '.internal', cb);
    //     };

    //     configurePlugin(this);

    //     this.el.addEventListener = addEventListener;
    //     this.el.removeEventListener = removeEventListener;
    //     return this;
    // };

    return Scribe;
});
