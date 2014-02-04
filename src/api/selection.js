define(function () {

  'use strict';

  return function (scribe) {
    function Selection() {
      this.selection = window.getSelection();

      if (this.selection.rangeCount) {
        this.range = this.selection.getRangeAt(0);
      }
    }

    Selection.prototype.getContaining = function (nodeFilter) {
      var node = new scribe.api.Node(this.range.commonAncestorContainer);
      return nodeFilter(node.node) && node.node || node.getAncestor(nodeFilter);
    };

    Selection.prototype.placeMarkers = function () {
      var startMarker = document.createElement('em');
      startMarker.classList.add('scribe-marker');
      var endMarker = document.createElement('em');
      endMarker.classList.add('scribe-marker');

      // End marker
      var rangeEnd = this.range.cloneRange();
      rangeEnd.collapse(false);
      rangeEnd.insertNode(endMarker);

      /**
       * Chrome: `Range.insertNode` inserts a bogus text node after the inserted
       * element. We just remove it.
       * As per: http://jsbin.com/ODapifEb/1/edit?js,console,output
       */
      // TODO: abstract into polyfill for `Range.insertNode`
      if (endMarker.nextSibling && endMarker.nextSibling.nodeType === 3 && endMarker.nextSibling.data === '') {
        endMarker.parentNode.removeChild(endMarker.nextSibling);
      }

      if (!this.range.collapsed) {
        // Start marker
        var rangeStart = this.range.cloneRange();
        rangeStart.collapse(true);
        rangeStart.insertNode(startMarker);

        /**
         * Chrome: `Range.insertNode` inserts a bogus text node after the inserted
         * element. We just remove it.
         * As per: http://jsbin.com/ODapifEb/1/edit?js,console,output
         */
        // TODO: abstract into polyfill for `Range.insertNode`
        if (startMarker.nextSibling && startMarker.nextSibling.nodeType === 3 && startMarker.nextSibling.data === '') {
          startMarker.parentNode.removeChild(startMarker.nextSibling);
        }
      }

      this.selection.removeAllRanges();
      this.selection.addRange(this.range);
    };

    Selection.prototype.getMarkers = function () {
      return scribe.el.querySelectorAll('em.scribe-marker');
    };

    Selection.prototype.removeMarkers = function () {
      var markers = this.getMarkers();
      Array.prototype.forEach.call(markers, function (marker) {
        marker.parentNode.removeChild(marker);
      });
    };

    Selection.prototype.selectMarkers = function (keepMarkers) {
      var markers = this.getMarkers();
      if (!markers.length) {
        return;
      }

      this.range.setStartBefore(markers[0]);
      if (markers.length >= 2) {
        this.range.setEndAfter(markers[1]);
      } else {
        // We always reset the end marker because otherwise it will just
        // use the current range’s end marker.
        this.range.setEndAfter(markers[0]);
      }

      if (! keepMarkers) {
        this.removeMarkers();
      }

      this.selection.removeAllRanges();
      this.selection.addRange(this.range);
    };

    return Selection;
  };

});
