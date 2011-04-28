#!/usr/bin/env node

var events = require('events');
var jsdom = require('jsdom').jsdom,
    sys = require('sys');

if (typeof window === 'undefined') {
    window = jsdom().createWindow();
    window.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
}
if (typeof document == 'undefined') {
    document = window.document;
}

MascotToJSON = require('./js/MascotToJSON.js');

if (process.env['REQUEST_URI']) {
    console.log("Content-Type: application/json\n");        
    var request_url = unescape(process.env['REQUEST_URI']);
    var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    var my_uri = /uri=(.*)/.exec(request_url), my_uri = my_uri ? my_uri[1] : null;
    my_uri = regexp.test(my_uri) ? my_uri : null;
    if (my_uri) {
        (new MascotToJSON()).convertReport(my_uri,function(data,err) {
            console.log(JSON.stringify(data));
        })
    }
}
