/*global define */
define(['dom-helpers-closest'],function (closest) {
    'use strict';

    // TODO:
    // This plugin should become merely a bridge between scribe and
    // the ToolbarView. That way the View could take over all the
    // event handling and the bridge just passes the events from the
    // view to scribe





    return function () {
        return function (scribe) {

            // A small proxy that may be passed around with a limited set
            // of publicly available functions
            var toolbar = {
                registerContextTools : function (tools) {
                    // notifies the view to show the given tools
                    // in the context tools element
                    scribe.trigger('toolbar:show-context-tools', [tools]);
                }
            };

            function updateToobarUI () {
                // the timeout is necessary to ensure the selection
                // is made, which cannot been guaranteed for at the
                // time of the event in Chrome it seems.
                window.setTimeout(function () {
                    scribe.trigger('toolbar:update');
                }, 1);

            }




            var $currentlyBoundScribeEl = null;
            function rebind () {
                var $el = $(scribe.el);

                if ($currentlyBoundScribeEl) {
                    $currentlyBoundScribeEl.off('mouseup.scribe.toolbar')
                        .off('keyup.scribe.toolbar')
                        .off('focus.scribe.toolbar')
                        .off('blur.scribe.toolbar');
                }

                // var handler = createUpdateUiHandler(button);
                // Keep the state of toolbar buttons in sync with the current selection.
                // Unfortunately, there is no `selectionchange` event.

                $el.on('mouseup.scribe.toolbar', function () {
                        // This timeout is necessary for the case when a text is selected
                        // and then clicked into the selection. In that case the selection
                        // gets collapsed again, yet the selection change seems to be
                        // recognized only after the mouseup event. To ensure the
                        // collapsed selection is evaluated properly, the timeout should
                        // postpone the handler accordingly.
                        window.setTimeout(updateToobarUI, 1);
                    })
                    .on('keyup.scribe.toolbar', updateToobarUI)
                    .on('focus.scribe.toolbar', updateToobarUI)
                    .on('blur.scribe.toolbar', updateToobarUI);

                $currentlyBoundScribeEl = $el;
            }

            // needs to be exectued initially -----------

            scribe.on('scribe:rebound', rebind);

            // We also want to update the UI whenever the content changes. This
            // could be when one of the toolbar buttons is actioned.
            scribe.on('content-changed', updateToobarUI);

            scribe.on('toolbar:update-context-tools', function () {

                scribe.trigger('toolbar:set-buttons', [toolbar]);

            });

            rebind();
        };
    };

});
