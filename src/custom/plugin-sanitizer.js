/*global define*/
/**
* @overview
* @author Simon Schmidt <simon-schmidt@alarie.de>
* @copyright Simon Schmidt 2014
*/

/* Be less strict for module header. */
/*jshint maxparams:30, maxstatements:100 */
define([
    'html-janitor',
    'lodash-amd/modern/objects'
],
/** @module custom-scribe */
function (
    _HTMLJanitor,
    objects
) {
    /*jshint maxparams:4, maxstatements:10 */
    'use strict';

    // TODO: not exhaustive?
    var blockElementNames = ['P', 'LI', 'DIV'];
    function isBlockElement(node) {
        return blockElementNames.indexOf(node.nodeName) !== -1;
    }

    function createTreeWalker(node) {
        return document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT
        );
    }

    function HTMLJanitor () {
      _HTMLJanitor.apply(this, arguments);
    }

    HTMLJanitor.prototype = Object.create(_HTMLJanitor.prototype);

    HTMLJanitor.prototype.setConfig = function (config) {
        this.config = config;
    };


    HTMLJanitor.prototype._sanitize = function (parentNode) {
        var treeWalker = createTreeWalker(parentNode);
        var node = treeWalker.firstChild();
        if (!node) { return; }

        do {
          var nodeName = node.nodeName.toLowerCase();
          var allowedAttrs = this.config.tags[nodeName];

          // Ignore nodes that have already been sanitized
          if (node._sanitized) {
            continue;
          }

          if (node.nodeType === Node.TEXT_NODE) {
            // If this text node is just whitespace and the previous or next element
            // sibling is a block element, remove it
            // N.B.: This heuristic could change. Very specific to a bug with
            // `contenteditable` in Firefox: http://jsbin.com/EyuKase/1/edit?js,output
            // FIXME: make this an option?
            if (node.data.trim() === '' &&
                ((node.previousElementSibling && isBlockElement(node.previousElementSibling)) ||
                    (node.nextElementSibling && isBlockElement(node.nextElementSibling)))) {
              parentNode.removeChild(node);
              this._sanitize(parentNode);
              break;
            } else {
              continue;
            }
          }

          // Remove all comments
          if (node.nodeType === Node.COMMENT_NODE) {
            parentNode.removeChild(node);
            this._sanitize(parentNode);
            break;
          }

          var isInlineElement = nodeName === 'b';
          var containsBlockElement;
          if (isInlineElement) {
            containsBlockElement = Array.prototype.some.call(node.childNodes, isBlockElement);
          }

          var isInvalid = isInlineElement && containsBlockElement;

          // Block elements should not be nested (e.g. <li><p>...); if
          // they are, we want to unwrap the inner block element.
          var isNotTopContainer = !! parentNode.parentNode;
          // TODO: Don't hardcore this — this is not invalid markup. Should be
          // configurable.
          var isNestedBlockElement =
                isBlockElement(parentNode) &&
                isBlockElement(node) &&
                isNotTopContainer;

          var isNestingAllowed = (allowedAttrs && allowedAttrs.allowNesting) ||
            false;

          // Drop tag entirely according to the whitelist *and* if the markup
          // is invalid.
          if (!this.config.tags[nodeName] ||
            isInvalid ||
            (!isNestingAllowed && isNestedBlockElement)) {
            // Do not keep the inner text of SCRIPT/STYLE elements.
            if (! (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE')) {
              while (node.childNodes.length > 0) {
                parentNode.insertBefore(node.childNodes[0], node);
              }
            }
            parentNode.removeChild(node);

            this._sanitize(parentNode);
            break;
          }

          // Sanitize attributes
          for (var a = 0; a < node.attributes.length; a += 1) {
            var attr = node.attributes[a];
            var attrName = attr.name.toLowerCase();

            // Allow attribute?
            var allowedAttrValue = allowedAttrs[attrName];

            var notInAttrList = ! allowedAttrValue;

            var valueNotAllowed = allowedAttrValue !== true &&
                (typeof allowedAttrValue !== 'function' ?
                    attr.value !== allowedAttrValue : false);

            var attrValue;
            if (typeof allowedAttrValue === 'function') {
                if ((attrValue = allowedAttrValue(attr.value))) {
                    attr.value = attrValue;
                }
                else {
                    valueNotAllowed = true;
                }
            }

            if (notInAttrList || valueNotAllowed) {
              node.removeAttribute(attr.name);
              // Shift the array to continue looping.
              a = a - 1;
            }
          }

          // Sanitize children
          this._sanitize(node);

          // Mark node as sanitized so it's ignored in future runs
          node._sanitized = true;
        } while ((node = treeWalker.nextSibling()));
    };

    function makeJanitoraAccessibleOnScribe (name, janitor, scribe) {
        if(!scribe.sanitizers) {
            scribe.sanitizers = {};
        }

        // intercept the config to make sure scribe-markers are allowed
        var setConfig = janitor.setConfig;
        janitor.setConfig = function (config) {
            var configAllowMarkers = objects.merge(objects.cloneDeep(config), {
                tags: {
                    em: {class: 'scribe-marker'}
                }
            });
            setConfig.call(janitor, configAllowMarkers);
        };

        scribe.sanitizers[name] = janitor;

        scribe.getSanitizerByName = function (name) {
            return scribe.sanitizers[name];
        };
    }



    return function (config) {
        // We extend the config to let through Scribe position markers,
        // otherwise we lose the caret position when running the Scribe
        // content through this sanitizer.
        var configAllowMarkers = objects.merge(objects.cloneDeep(config), {
          tags: {
            em: {class: 'scribe-marker'}
          }
        });

        return function (scribe) {
            var janitor = new HTMLJanitor(configAllowMarkers);

            scribe.registerHTMLFormatter('sanitize', janitor.clean.bind(janitor));


            // make sanitizer accessible in order to allow behaviour
            // modifications at runtime
            if (config.name) {
                makeJanitoraAccessibleOnScribe(config.name, janitor, scribe);
            }

        };
    };
});
