/*global define*/
define(/*'custom-events', */[
    '../dom-observer'
], function (
    observeDomChanges
) {
    'use strict';

    return function () {
        return function (scribe) {

            scribe.stopListening('focus.scribe_events');
            scribe.stopListening('keydown.scribe_events');
            scribe.stopListening('paste.scribe_events');

            /**
             * Push the first history item when the editor is focused.
             */
            var pushHistoryOnFocus = function () {
                // Tabbing into the editor doesn't create a range immediately, so we
                // have to wait until the next event loop.
                setTimeout(function () {
                    var selection = new scribe.api.Selection();
                    if (selection.selection.type !== 'None') {
                        scribe.pushHistory();
                    }
                }.bind(scribe), 0);

                scribe.stopListening('focus.scribe_events', pushHistoryOnFocus);
            }.bind(scribe);
            scribe.listenTo('focus.scribe_events', pushHistoryOnFocus);

            /**
             * Firefox: Giving focus to a `contenteditable` will place the caret
             * outside of any block elements. Chrome behaves correctly by placing the
             * caret at the  earliest point possible inside the first block element.
             * As per: http://jsbin.com/eLoFOku/1/edit?js,console,output
             *
             * We detect when this occurs and fix it by placing the caret ourselves.
             */
            scribe.listenTo('focus.scribe_events', function placeCaretOnFocus() {
                var selection = new scribe.api.Selection();
                // In Chrome, the range is not created on or before this event loop.
                // It doesn’t matter because this is a fix for Firefox.
                // We always want to do this because Chrome >= 38 does create the event
                // loop and doesn't leave things alone
                if (selection.range) {
                    selection.placeMarkers();
                    selection.removeMarkers();

                    var focusElement = getFirstDeepestChild(scribe.el.firstChild);

                    var range = selection.range;

                    range.setStart(focusElement, 0);
                    range.setEnd(focusElement, 0);

                    selection.selection.removeAllRanges();
                    selection.selection.addRange(range);
                }

                function getFirstDeepestChild(node) {
                    var treeWalker = document.createTreeWalker(node);
                    var previousNode = treeWalker.currentNode;
                    if (treeWalker.firstChild()) {
                        // TODO: build list of non-empty elements (used elsewhere)
                        // Do not include non-empty elements
                        if (treeWalker.currentNode.nodeName === 'BR') {
                            return previousNode;
                        } else {
                            return getFirstDeepestChild(treeWalker.currentNode);
                        }
                        } else {
                            return treeWalker.currentNode;
                        }
                    }
                }.bind(scribe));

                /**
                 * Apply the formatters when there is a DOM mutation.
                 */
                var applyFormatters = function() {
                    if (!scribe._skipFormatters) {
                        var selection = new scribe.api.Selection();
                        var isEditorActive = selection.range;

                        var runFormatters = function () {
                            if (isEditorActive) {
                                selection.placeMarkers();
                            }
                            scribe.setHTML(scribe._htmlFormatterFactory.format(scribe.getHTML()));
                            selection.selectMarkers();
                        }.bind(scribe);

                        // We only want to wrap the formatting in a transaction if the editor is
                        // active. If the DOM is mutated when the editor isn't active (e.g.
                        // `scribe.setContent`), we do not want to push to the history. (This
                        // happens on the first `focus` event).
                        if (isEditorActive) {
                        // Discard the last history item, as we're going to be adding
                        // a new clean history item next.
                        scribe.undoManager.undo();

                        // Pass content through formatters, place caret back
                        scribe.transactionManager.run(runFormatters);
                    } else {
                        runFormatters();
                    }
                }

                delete scribe._skipFormatters;
            }.bind(scribe);

            observeDomChanges(scribe.el, applyFormatters);

            // TODO: disconnect on tear down:
            // observer.disconnect();

            /**
             * If the paragraphs option is set to true, we need to manually handle
             * keyboard navigation inside a heading to ensure a P element is created.
             */
            if (scribe.allowsBlockElements()) {
                scribe.listenTo('keydown.scribe_events', function (event) {


                    if (event.keyCode === 13) { // enter

                        var selection = new scribe.api.Selection();
                        var range = selection.range;

                        var headingNode = selection.getContaining(function (node) {
                            return (/^(H[1-6])$/).test(node.nodeName);
                        });

                        /**
                        * If we are at the end of the heading, insert a P. Otherwise handle
                        * natively.
                        */
                        if (headingNode && range.collapsed) {
                            var contentToEndRange = range.cloneRange();
                            contentToEndRange.setEndAfter(headingNode, 0);

                            // Get the content from the range to the end of the heading
                            var contentToEndFragment = contentToEndRange.cloneContents();

                            if (contentToEndFragment.firstChild.textContent === '') {
                                event.preventDefault();

                                scribe.transactionManager.run(function () {
                                    // Default P
                                    // TODO: Abstract somewhere
                                    var pNode = document.createElement('p');
                                    var brNode = document.createElement('br');
                                    pNode.appendChild(brNode);

                                    headingNode.parentNode.insertBefore(pNode, headingNode.nextElementSibling);

                                    // Re-apply range
                                    range.setStart(pNode, 0);
                                    range.setEnd(pNode, 0);

                                    selection.selection.removeAllRanges();
                                    selection.selection.addRange(range);
                                });
                            }
                        }
                    }
                });
            }

            /**
             * If the paragraphs option is set to true, we need to manually handle
             * keyboard navigation inside list item nodes.
             */
            if (scribe.allowsBlockElements()) {
                scribe.listenTo('keydown.scribe_events', function (event) {

                    if (event.keyCode === 13 || event.keyCode === 8) { // enter || backspace

                        var selection = new scribe.api.Selection();
                        var range = selection.range;

                        if (range.collapsed) {
                            var containerLIElement = selection.getContaining(function (node) {
                                return node.nodeName === 'LI';
                            });

                            if (containerLIElement && containerLIElement.textContent.trim() === '') {
                                /**
                                 * LIs
                                 */

                                event.preventDefault();

                                var listNode = selection.getContaining(function (node) {
                                    return node.nodeName === 'UL' || node.nodeName === 'OL';
                                });

                                var command = scribe.getCommand(listNode.nodeName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');

                                command.execute();
                            }
                        }
                    }
                });
            }


        };
    };
});
