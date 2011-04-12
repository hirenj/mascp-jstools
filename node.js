var jsdom = require('jsdom').jsdom,
    sys = require('sys'),
    window = jsdom().createWindow();

window.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    
var svgns = 'http://ns';

var runSubaScript = function(window) {    
    var suba = new window.MASCP.SubaReader();
    suba.agi = 'AT1G22710.1';
    suba.bind('resultReceived',function() {
       console.log(this.result.getGfpLocalisation());
    });
    suba.bind('error', function(e,x,y,z) {
        console.log("Errored out");
    });
    suba.retrieve();
}

jsdom.jQueryify(window, 'http://code.jquery.com/jquery-1.4.2.js', function (window, jquery) {
  var script = window.document.createElement('script');
  script.src = './js/maschup.min.js';
  script.addEventListener('load', function() {
      runSubaScript(window);
  });
  window.document.head.appendChild(script);
});


