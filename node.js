MASCP = require('./dist/js/maschup.services.min.js');
suba = new MASCP.TairReader();
suba.agi = "at1g22710.1";
setTimeout(function() {
//    suba.bind('resultReceived',);
    suba.retrieve('at1g22710.1',function() { console.log(this.result.getSequence()); });
},1000);
