/*global define */
define([
    'dom-helpers-closest',
    'plugins-scribe-helper'
], function (
    closest,
    ScribeHelper
) {
    'use strict';

    function LinkCommandImpl (scribe, cmd) {
        this.cachedContent = null;
        this.scribe = scribe;
        this.cmd = cmd;
    }


    LinkCommandImpl.prototype.cacheSelection = function () {
        this._ensureSelectionIsInContenteditable();

        var selection = new this.scribe.api.Selection(),
            anchorNode;

        selection.placeMarkers();

        // Due to the asynchronus nature of the link prompt, it is very likely
        // that scribes formatting will ckick in before the link was applied
        // (this happens for example once the TransactionManager runs, which
        // pushes the editor state onto the stack. and therefor removes all
        // selection markers). Thus we have to chache the editor contents
        // ourselves and restore them afterwards.
        this.helper = ScribeHelper.create(this);

        this.helper.cloneContentsFromTarget();

        anchorNode = this._getAnchorNodeInSelection(selection);
        this.initialLinkData = this._getInitialLinkData(anchorNode);
        this.linkHadContent = this._getHadContent();
    };

    LinkCommandImpl.prototype.restoreSelection = function () {
        return new Promise(function (fulfill) {
            var selection = new this.scribe.api.Selection();

            this.helper.use()
                .focus();

            window.setTimeout(function () {
                selection.selectMarkers(true);
                fulfill();
            }.bind(this), 0);
        }.bind(this));

    };

    LinkCommandImpl.prototype.executeCommand = function (cmd, data) {
        var promise;

        if (cmd === 'unlink') {
            promise = this._unlink();
        }
        else if (cmd === 'link') {
            promise = this._link(data);
        }

        return promise.then(function () {
            this.helper.applyToTarget()
                .destroy();
            var selection = new this.scribe.api.Selection();
            selection.selectMarkers();
        }.bind(this));
    };



    LinkCommandImpl.prototype._ensureSelectionIsInContenteditable = function () {
        var selection = new this.scribe.api.Selection(),
            editable = selection.getContaining(function (node) {
                return node.hasAttribute && node.hasAttribute('contenteditable');
            });

        if (editable) {
            var range = document.createRange();
            range.selectNodeContents(editable);

            selection.selection.removeAllRanges();
            selection.selection.addRange(range);
        }
    };


    /**
     * @private
     */
    LinkCommandImpl.prototype._unlink = function () {

        var selection = new this.scribe.api.Selection(),
            parent = this._getAnchorNodeAroundSelection();

        if (!parent) {
            return;
        }

        selection.range.selectNode(parent);
        selection.selection.removeAllRanges();
        selection.selection.addRange(selection.range);

        var command = this.scribe.getCommand('unlink');
        if (command) {
            command.execute();
        }

        return Promise.resolve();
    };

    /**
     * @private
     * @param  {Object} linkData The data for the link.
     */
    LinkCommandImpl.prototype._link = function (linkData) {
        return new Promise (function (fulfill) {

            var anchor = this._getAnchorNodeAroundSelection();

            if (!anchor) {
                this.scribe.api.SimpleCommand.prototype.execute
                .call(this.cmd, linkData.href);
            }


            // Wait for the node to appear in the dom after the next
            // rendering cycle.
            window.setTimeout(function () {
                var selection = new this.scribe.api.Selection(),
                    anchor = anchor || this._ensureAnchorInSelection(selection);

                this._setLinkDataOnAcnhor(anchor, linkData);
                this._selectAnchor(anchor);
                selection = new this.scribe.api.Selection();
                selection.placeMarkers();

                fulfill();
            }.bind(this), 1);
        }.bind(this));
    };



    /**
     * @private
     * @param {scribe.Selection} selection The selection to try to find the
     * anchor node in.
     * @return {Node} The DOM node within the selection, that's a tag of tye
     * defined in the cmd.nodeName property.
     */
    LinkCommandImpl.prototype._getAnchorNodeInSelection = function (selection) {
        var that = this;
        return selection.getContaining(function (node) {
            return node.nodeName === that.cmd.nodeName;
        });
    };


    LinkCommandImpl.prototype._getAnchorNodeAroundSelection = function () {
        var selection = new this.scribe.api.Selection(),
            parent,
            anchor = null;

        if (selection.range &&
            (parent = selection.range.commonAncestorContainer)) {
            anchor = closest(parent, 'a');
        }

        return anchor;
    };

    /**
     * @private
     * @param {scribe.Selection} selection The selection to ensure the anchor
     * node in.
     * @return {Node}           The anchor node.
     */
    LinkCommandImpl.prototype._ensureAnchorInSelection = function (selection) {
        var anchor = this._getAnchorNodeInSelection(selection);
        if (!anchor && selection.selection.anchorNode.nodeType === Node.TEXT_NODE) {
            anchor = selection.selection.anchorNode.parentNode;
        }
        return anchor;
    };



    /**
     * @private
     * @return {Object} The data found in any pre-existing link, or a default
     * object if no pre-existing link was found.
     */
    LinkCommandImpl.prototype._getInitialLinkData = function (anchorNode) {

        var initialLinkData = {
            href : 'http://',
            target : '_self',
            title : '',
            exists : false,
            appearance : null
        },
        className;

        if (anchorNode) {
            className = anchorNode.className
                .match(/link-appearance-[a-z0-9-_]+/);

            initialLinkData.exists = true;
            initialLinkData.href = anchorNode.href || 'http://';
            initialLinkData.target = anchorNode.target || '_self';
            initialLinkData.title = anchorNode.title || '';
            initialLinkData.content = anchorNode.innerText || '';

            initialLinkData.appearance = className && className.length ? className[0] : null;
        }
        else {
            var selection = new this.scribe.api.Selection();
            initialLinkData.content = selection.selection.toString();
        }

        return initialLinkData;
    };

    /**
     * @private
     * @return {Boolean} True if the selection was not collapsed or whitespace.
     */
    LinkCommandImpl.prototype._getHadContent = function () {
        return !!this.initialLinkData.content.trim().length;
    };


    /**
     * @private
     * @param {Node} anchor   The DOM anchor node.
     * @param {Object} linkData The link data.
     */
    LinkCommandImpl.prototype._setLinkDataOnAcnhor = function (anchor, linkData) {

        anchor.title = linkData.title;

        anchor.target = linkData.target;

        anchor.href = linkData.href;

        if (!anchor.target) {
            anchor.removeAttribute('target');
        }

        if (!this.linkHadContent) {
            anchor.textContent = linkData.content;
        }

        anchor.className = anchor.className &&
            anchor.className.indexOf('link-appearance') >= 0 ?
            anchor.className
                .replace(/link-appearance-[a-z0-9-_]+/, linkData.appearance) :
            linkData.appearance;
    };

    /**
     * @private
     * @param  {Node} anchor The anchor to be selected.
     */
    LinkCommandImpl.prototype._selectAnchor = function (anchor) {
        var selection = new this.scribe.api.Selection();
        selection.range.setStartAfter(anchor);
        selection.range.setEndAfter(anchor);

        selection.selection.removeAllRanges();
        selection.selection.addRange(selection.range);
        selection.selection.collapseToEnd();

        this._focusEditable(selection);
    };

    /**
     * @private
     * @param  {scribe.Selection} selection The selection containing the
     * element to be focused
     */
    LinkCommandImpl.prototype._focusEditable = function (selection) {
        var el = $(selection.range.commonAncestorContainer)
                .closest('[contenteditable]')[0];

        if (!el) {
            el = selection.getContaining(function (node) {
                return node.hasAttribute && node.hasAttribute('contenteditable');
            });
        }

        if (el) {
            el.focus();
        }
    };


    /**
     * This plugin adds a command for creating links, including a extended prompt.
     */
    return function (dispatcher) {
        return function (scribe) {

            var linkPromptCommand = new scribe.api.Command('createLink');

            linkPromptCommand.nodeName = 'A';

            linkPromptCommand.execute = function () {

                var impl = new LinkCommandImpl(scribe, this);

                scribe.transactionManager.runAsync(function (complete) {

                    impl.cacheSelection();

                    dispatcher.trigger('showLinkPrompt', impl.initialLinkData, function (cmd, link) {

                        impl.restoreSelection()
                            .then(impl.executeCommand.bind(impl, cmd, link))
                            .then(complete);

                    });

                });
            };

            linkPromptCommand.queryState = function () {
                /**
                * We override the native `document.queryCommandState` for links because
                * the `createLink` and `unlink` commands are not supported.
                * As per: http://jsbin.com/OCiJUZO/1/edit?js,console,output
                */
                var selection = new scribe.api.Selection();
                return !! selection.getContaining(function (node) {
                    return node.nodeName === this.nodeName;
                }.bind(this));
            };

            scribe.commands.linkPrompt = linkPromptCommand;

        };
    };

});
