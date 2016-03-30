require([
  '../src/custom/scribe',
  '../src/custom/plugin-sanitizer',
  '../bower_components/scribe-plugin-toolbar/src/scribe-plugin-toolbar',
  '../bower_components/scribe-plugin-formatter-plain-text-convert-new-lines-to-html/src/scribe-plugin-formatter-plain-text-convert-new-lines-to-html',
  // '../bower_components/scribe-plugin-sanitizer/src/scribe-plugin-sanitizer',
  '../bower_components/scribe-plugin-inline-styles-to-elements/src/scribe-plugin-inline-styles-to-elements',
  '../bower_components/scribe-plugin-heading-command/src/scribe-plugin-heading-command',
  '../bower_components/scribe-plugin-link-prompt-command/src/scribe-plugin-link-prompt-command'
], function (
  Scribe,
  scribePluginSanitizer,
  scribePluginToolbar,
  scribePluginFormatterPlainTextConvertNewLinesToHtml,
  // scribePluginSanitizer,
  scribePluginInlineStyles,
  scribePluginHeadingCommand,
  scribePluginLinkPromptCommand
) {

  var scribe = null;

  function merge(o1, o2) {
    if (!o1 || !o2)
      return o1;

    for (var key in o2)
      if (o2.hasOwnProperty(key))
        o1[key] = o2[key];

    return o1;
  }

  function enableOnElement (el, opts) {
    scribe.setScribeElement(el);
    scribe.allowsBlockElements(opts.allowsBlockElements);
    scribe.applyToElement(el);

    var sanitizer = scribe.getSanitizerByName('defaultSanitizer');
    sanitizer.setConfig(opts.config);
  }


  var defaultSanitizerConfig = {
    tags: {
      b: {},
      i: {},
      br: {},
      a: {}
    }
  };


  function getScribe (el, opts) {
    if (!scribe) {
      scribe = new Scribe(null, {debug : true});

      window.scribe = scribe;

      scribe.use(scribePluginToolbar(document.querySelector('.rte-toolbar')));
      scribe.use(scribePluginFormatterPlainTextConvertNewLinesToHtml());
      scribe.use(scribePluginInlineStyles());
      scribe.use(scribePluginHeadingCommand(2));
      scribe.use(scribePluginLinkPromptCommand());

      scribe.use(scribePluginSanitizer({
          name : 'defaultSanitizer',
          tags: defaultSanitizerConfig
      }));

      scribe.on('content-changed', updateHtml);
    }

    enableOnElement(el, opts);


    return scribe;
  }

  var el1 = document.querySelector('.rte1'),
    opts1 = {
      allowsBlockElements : false,
      config : {
        tags : merge(merge({}, defaultSanitizerConfig.tags), {

        })
      }
    };
  getScribe(el1, opts1);
  scribe.setContent('<p>Hello, World!<\/p>');
  el1.addEventListener('focus', function () {
    enableOnElement(el1, opts1);
  });



  var el2 = document.querySelector('.rte2'),
    opts2 = {
      allowsBlockElements : true,
      config : {
        tags : merge(merge({}, defaultSanitizerConfig.tags), {
          p: {},
          h2: {},
        })
      }
    };
  getScribe(el2, opts2);
  scribe.setContent('<p>Hello, World!<\/p>');
  el2.addEventListener('focus', function () {
    enableOnElement(el2, opts2);
  });


  var el3 = document.querySelector('.rte3'),
    opts3 = {
      allowsBlockElements : true,
      config : {
        tags : merge(merge({}, defaultSanitizerConfig.tags), {
          p: {},
          h2: {},
        })
      }
    };
  getScribe(el3, opts3);
  scribe.setContent('<p>Hello, World!<\/p>');
  el3.addEventListener('focus', function () {
    enableOnElement(el3, opts3);
  });


window.scribe = scribe;

  function updateHtml() {
    document.querySelector('.rte-output').value = scribe.getHTML();
  }

  updateHtml();
});
