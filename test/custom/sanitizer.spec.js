var chai = require('chai');
var expect = chai.expect;

var helpers = require('./custom-helpers.js');
var initializeScribe = helpers.initializeScribe;
helpers.registerChai(chai);
var when = helpers.when;
var whenPastingHTMLOf = helpers.whenPastingHTMLOf;
var given = helpers.given;
var givenContentOf = helpers.givenContentOf;
var executeCommand = helpers.executeCommand;
var insertCaretPositionMarker = helpers.insertCaretPositionMarker;



var content = '<meta charset=\'utf-8\'> <h2 style="font-family: Lato">1</h2> <div class="a-class " style="padding: 6px;"> <div class="a-class"> <a href="https://link" title="#2837">2</a> <span class="Apple-converted-space"> </span>|<span class="Apple-converted-space"> </span> <a href="https://link" title="#2753">3</a> </div> <div class="a-class"> <div> <h3 style="font-family: Lato">4</h3></div> </div> <p class="a-class">5</p> </div>';
// Get new referenceS each time a new instance is created
var driver;
before(function () {
  driver = helpers.driver;
});

var scribeNode, scribeNode2;
beforeEach(function () {
  scribeNode = helpers.scribeNode;
  scribeNode2 = helpers.scribeNode2;
});

describe('sanitizer', function () {
  when('in inline mode', function () {
    beforeEach(function () {
      return initializeScribe({sanitize : true, allowBlockElements: false});
    });

    given('default content', function () {
      whenPastingHTMLOf(content, function () {
        it('should insert the html without <p>-tags', function () {
          return scribeNode.getInnerHTML().then(function (innerHTML) {
            expect(innerHTML).to.have.html('1 <a>2</a>  |  <a>3</a>45&nbsp;<bogus-br>');
          });
        });
      });
    });
  });

  when('in block mode', function () {
    beforeEach(function () {
      return initializeScribe({sanitize : true, allowBlockElements: true});
    });

    given('default content', function () {
      whenPastingHTMLOf(content, function () {
        it('should insert the html with <p>-tags', function () {
          return scribeNode.getInnerHTML().then(function (innerHTML) {
            expect(innerHTML).to.have.html('<p>1 <a>2</a>  |  <a>3</a>4</p><p>5</p>');
          });
        });
      });
    });
  });

  when('using two editors', function () {
    beforeEach(function () {
      initializeScribe({
        sanitize : true,
        allowBlockElements: false
      });
      return initializeScribe({
        sel : '.scribe2',
        sanitize : true,
        allowBlockElements: true
      });
    });

    given('the default content', function () {

      when('selecting the block editor', function () {
        beforeEach(function () {
          scribeNode2.click();
          return driver.sleep(1000);
        });

        it('should be selected', function () {
          return driver.executeScript(function (text) {
            return window.scribe.el.className;
          }).then(function (className) {
            expect(className).to.equal('scribe2 scribe-events-bound');
          });
        });


        whenPastingHTMLOf(content, function () {
          it('should have been inserted in the correct editor', function () {
            return driver.executeScript(function (text) {
              return window.scribe.el.innerHTML;
            }).then(function (className) {
              expect(className).to.not.equal('');
            });
          });
          it('should insert the html with <p>-tags', function () {
            return scribeNode.getInnerHTML().then(function (innerHTML) {
              expect(innerHTML).to.have.html('<p>1 <a>2</a>  |  <a>3</a>4</p><p>5</p>');
            });
          });
        });
      });

      when('selectng the inline editor', function () {
        beforeEach(function () {
          scribeNode.click();
          return driver.sleep(1000);
        });

        it('should be selected', function () {
          return driver.executeScript(function (text) {
            return window.scribe.el.className;
          }).then(function (className) {
            expect(className).to.equal('scribe scribe-events-bound');
          });
        });




        whenPastingHTMLOf(content, function () {
          it('should have been inserted in the correct editor', function () {
            return driver.executeScript(function (text) {
              return window.scribe.el.innerHTML;
            }).then(function (className) {
              expect(className).to.not.equal('');
            });
          });

          it('should insert the html without <p>-tags', function () {
            return scribeNode.getInnerHTML().then(function (innerHTML) {
              expect(innerHTML).to.have.html('1 <a>2</a>  |  <a>3</a>45&nbsp;<bogus-br>');
            });
          });
        });
      });
    });
  });
});
