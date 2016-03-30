/*global define*/
/**
* @overview
* @author Simon Schmidt <simon-schmidt@alarie.de>
* @copyright Simon Schmidt 2014
*/

/* Be less strict for module header. */
/*jshint maxparams:30, maxstatements:100 */
define([

],
/** @module custom-undo-manager */
function (

) {
    /*jshint maxparams:4, maxstatements:10 */
    'use strict';

    return function (scribe) {

      function UndoManager() {
        this.position = -1;
        this.stack = [];
        this.debug = scribe.isDebugModeEnabled();
      }

      UndoManager.prototype.maxStackSize = 100;

      UndoManager.prototype.push = function (item) {
        var itemObj = {
            item : item,
            el : scribe.el
        };

        if (this.debug) {
          console.log('UndoManager.push: %s', item);
        }
        this.stack.length = ++this.position;
        this.stack.push(itemObj);

        while (this.stack.length > this.maxStackSize) {
          this.stack.shift();
          --this.position;
        }
      };

      UndoManager.prototype.undo = function () {
        if (this.position > 0) {
          return this.stack[--this.position];
        }
      };

      UndoManager.prototype.redo = function () {
        if (this.position < (this.stack.length - 1)) {
          return this.stack[++this.position];
        }
      };

      return UndoManager;
    };
});
