/*global define*/
define([
    'lodash-amd/modern/collections/contains'
], function (
    contains
) {
    'use strict';

    return function () {
        return function (scribe) {
            scribe.stopListening('paste.scribe_paste');

            scribe = scribe;


            /**
             * We have to hijack the paste event to ensure it uses
             * `scribe.insertHTML`, which executes the Scribe version of the command
             * and also runs the formatters.
             */

            /**
             * TODO: could we implement this as a polyfill for `event.clipboardData` instead?
             * I also don't like how it has the authority to perform `event.preventDefault`.
             */
            scribe.listenTo('paste.scribe_paste', function handlePaste(event) {
                event = event.originalEvent;

                /**
                * Browsers without the Clipboard API (specifically `ClipboardEvent.clipboardData`)
                * will execute the second branch here.
                */
                if (event.clipboardData) {
                    event.preventDefault();

                    if (contains(event.clipboardData.types, 'text/html')) {
                      console.log('pastning:', event.clipboardData.getData('text/html'));
                        scribe.insertHTML(event.clipboardData.getData('text/html'));
                    } else {
                        scribe.insertPlainText(event.clipboardData.getData('text/plain'));
                    }
                } else {
                    /**
                    * If the browser doesn't have `ClipboardEvent.clipboardData`, we run through a
                    * sequence of events:
                    *
                    *   - Save the text selection
                    *   - Focus another, hidden textarea so we paste there
                    *   - Copy the pasted content of said textarea
                    *   - Give focus back to the scribe
                    *   - Restore the text selection
                    *
                    * This is required because, without access to the Clipboard API, there is literally
                    * no other way to manipulate content on paste.
                    * As per: https://github.com/jejacks0n/mercury/issues/23#issuecomment-2308347
                    *
                    * Firefox <= 21
                    * https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent.clipboardData
                    */

                    var selection = new scribe.api.Selection();

                    // Store the caret position
                    selection.placeMarkers();

                    var bin = document.createElement('div');
                    document.body.appendChild(bin);
                    bin.setAttribute('contenteditable', true);
                    bin.focus();

                    // Wait for the paste to happen (next loop?)
                    setTimeout(function () {
                        var data = bin.innerHTML;
                        bin.parentNode.removeChild(bin);

                        /**
                        * Firefox 19 (and maybe others): even though the applied range
                        * exists within the Scribe instance, we need to focus it.
                        */

                        // Restore the caret position
                        selection.selectMarkers();

                        scribe.el.focus();
                        scribe.insertHTML(data);

                    }, 1);
                }
            });
        };
    };
});
