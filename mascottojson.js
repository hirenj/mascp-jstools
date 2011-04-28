#!/usr/bin/env node

if (typeof module != 'undefined' && module.exports){
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
}

MascotToJSON = function() {
    
};

(function() {
var mascot_base = 'http://proteinid.jbei.org/mascot/cgi/export_dat_2.pl?';

var mascot_params = {
    /** Parameters that can be changed */
    'file'          : '',
    '_ignoreionsscorebelow':'0',

    /** Required parameters */

    'do_export'     : '1',
    'export_format' : 'CSV',
    'protein_master': '1',
    'peptide_master': '1',
    'pep_seq'       : '1',
    'REPORT'        : 'AUTO',
    'show_same_sets': '1',
    '_requireboldred': '1',
    
    /** optional parameters */
    
    'prot_hit_num'  : '0',
    'pep_query'     : '0',
    'pep_rank'      : "0",
    'pep_isbold'    : '0',
    'pep_exp_mz'    : '0',
    '_sigthreshold' : '0.05',
    '_showallfromerrortolerant':'0',
    '_onlyerrortolerant':'0',
    '_noerrortolerant':'0',
    '_show_decoy_report':'0',
    '_showsubsets'  : '0',
    '_server_mudpit_switch':'0.000000001',
};

var clone = function(obj){
    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = obj.constructor(); // changed

    for(var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

var params_to_url = function(params) {
    var result = [];
    for (name in params) {
        result.push(name +'='+params[name]);
    }
    return result.join('&');
};

// This will parse a delimited string into an array of
// arrays. The default delimiter is the comma, but this
// can be overriden in the second argument.
var CSVToArray = function( strData, strDelimiter ){
    // Check to see if the delimiter is defined. If not,
    // then default to comma.
    strDelimiter = (strDelimiter || ",");

    // Create a regular expression to parse the CSV values.
    var objPattern = new RegExp(
    (
    // Delimiters.
    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

    // Quoted fields.
    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

    // Standard fields.
    "([^\"\\" + strDelimiter + "\\r\\n]*))"
    ),
    "gi"
    );


    // Create an array to hold our data. Give the array
    // a default empty first row.
    var arrData = [[]];

    // Create an array to hold our individual pattern
    // matching groups.
    var arrMatches = null;


    // Keep looping over the regular expression matches
    // until we can no longer find a match.
    while (arrMatches = objPattern.exec( strData )){

    // Get the delimiter that was found.
    var strMatchedDelimiter = arrMatches[ 1 ];

    // Check to see if the given delimiter has a length
    // (is not the start of string) and if it matches
    // field delimiter. If id does not, then we know
    // that this delimiter is a row delimiter.
    if (
    strMatchedDelimiter.length &&
    (strMatchedDelimiter != strDelimiter)
    ){

    // Since we have reached a new row of data,
    // add an empty row to our data array.
    arrData.push( [] );

    }


    // Now that we have our delimiter out of the way,
    // let's check to see which kind of value we
    // captured (quoted or unquoted).
    if (arrMatches[ 2 ]){

    // We found a quoted value. When we capture
    // this value, unescape any double quotes.
    var strMatchedValue = arrMatches[ 2 ].replace(
    new RegExp( "\"\"", "g" ),
    "\""
    );

    } else {

    // We found a non-quoted value.
    var strMatchedValue = arrMatches[ 3 ];

    }


    // Now that we have our value string, let's add
    // it to the data array.
    arrData[ arrData.length - 1 ].push( strMatchedValue );
    }

    // Return the parsed data.
    return( arrData );
};

var data_matrix_to_summary = function(data) {
    var results = [];
    var agi = null;
    var seen = {};
    data.forEach(function(row) {
        if (row[1] && row[1] !== '') {
            agi = row[1];
        }
        var pep_seq = row[6]+row[7]+row[8];
        if ( pep_seq && ! seen[agi+pep_seq]) {
            results.push([agi,pep_seq]);            
        }
        seen[agi+pep_seq] = 1;
    });
    return results;
}


MascotToJSON.convertReport = function(report,score,callback) {
    var xhr = new window.XMLHttpRequest();
    var report_base = report.replace(/master_results.pl.*/,'export_dat_2.pl');
    var file_url = /file=([^&]*)/.exec(report), file_url = file_url ? file_url[1] : null;
    var params = clone(mascot_params);
    params['file'] = file_url;
    params['_ignoreionsscorebelow'] = score || 0;
    
    // console.log(report_base);
    // console.log(file_url);
    // console.log(report_base+'?'+params_to_url(params));
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if(xhr.status == 200) {
                var response = xhr.responseText;
                // Remove the header lines from the mascot response
                response = response.replace(/(.+\n)+\n.*\n/m,'');
                callback.call(null,data_matrix_to_summary(CSVToArray(response)));
            } else {
                console.log("Error loading page\n");
            }
        }        
    };
    xhr.open("GET", report_base+'?'+params_to_url(params), true);
    xhr.send(null);
};

})();

if (typeof module != 'undefined' && module.exports){
    if (process.env['REQUEST_URI']) {
        console.log("Content-Type: application/json\n");        
        var request_url = unescape(process.env['REQUEST_URI']);
        var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        var my_uri = /uri=(.*)/.exec(request_url), my_uri = my_uri ? my_uri[1] : null;
        my_uri = regexp.test(my_uri) ? my_uri : null;
        var my_score = /score=(\d+)/.exec(request_url), my_score = my_score ? my_score[1] : null;
        if (my_uri) {
            MascotToJSON.convertReport(my_uri,my_score,function(data) {
                console.log(JSON.stringify(data));
            })
        }
    }
}
