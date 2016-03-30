/*global define*/
define([], function () {
    'use strict';

     function ScribeHelper (target) {
        this.originalElement = null;
        this.clonedElement = null;
        this.target = target;

        this._createHelperClone();
    }

    ScribeHelper.create = function (target) {
        return new ScribeHelper(target);
    };

    ScribeHelper.prototype._createHelperClone = function () {
        this.originalElement = this.target.scribe.el;
        this.clonedElement = document.createElement('div');
        this.clonedElement.style.position = 'absolute';
        this.clonedElement.style.marginLeft = '-999999999px';
        this.clonedElement.setAttribute('contenteditable', true);
        document.body.appendChild(this.clonedElement);
    };

    ScribeHelper.prototype.use = function () {
        this.target.scribe.el = this.clonedElement;

        return this;
    };

    ScribeHelper.prototype.focus = function () {
        this.clonedElement.focus();

        return this;
    };

    ScribeHelper.prototype.applyToTarget = function () {
        this.target.scribe.el = this.originalElement;
        this.cloneContentsToTarget();

        return this;
    };

    ScribeHelper.prototype.destroy = function () {
        document.body.removeChild(this.clonedElement);
    };

    ScribeHelper.prototype.setContents = function (contents) {
        this.clonedElement.innerHTML = contents;

        return this;
    };

    ScribeHelper.prototype.getContents = function (contents) {
        return this.clonedElement.innerHTML;
    };

    ScribeHelper.prototype.cloneContentsFromTarget = function () {
        this.setContents(this.originalElement.innerHTML);

        return this;
    };

    ScribeHelper.prototype.cloneContentsToTarget = function () {
        this.originalElement.innerHTML = this.clonedElement.innerHTML;

        return this;
    };

    return ScribeHelper;
});
