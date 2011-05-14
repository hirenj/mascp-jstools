MascotToJSON = function() {
};

(function() {

var mascot_params = {
    /** Parameters that can be changed */
    'file'          : '',

    /** Required parameters */

    'do_export'     : '1',
    'export_format' : 'CSV',
    'protein_master': '1',
    'peptide_master': '1',
    'pep_seq'       : '1',
    'pep_score'     : '0',
    'REPORT'        : 'AUTO',
    'show_same_sets': '1',
    '_requireboldred': '1',
    '_ignoreionsscorebelow':'0.05',
    
    /** optional parameters */
    
    'prot_hit_num'  : '0',
    'pep_end'       : '0',
    'pep_miss'      : '0',
    'pep_homol'     : '0',
    'pep_ident'     : '0',
    'pep_frame'     : '0',
    'pep_var_mod'   : '0',
    'pep_num_match' : '0',
    'pep_scan_title': '0',
    'pep_query'     : '0',
    'pep_rank'      : "0",
    'pep_isbold'    : '0',
    'pep_exp_mz'    : '0',
    'pep_calc_mr'   : '0',
    'pep_exp_z'     : '0',
    'pep_exp_mr'    : '0',
    'pep_delta'     : '0',
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

var CSVToArray = function( strData, strDelimiter ){
    strDelimiter = (strDelimiter || ",");

    var objPattern = new RegExp(
    (
    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
    "([^\"\\" + strDelimiter + "\\r\\n]*))"
    ),
    "gi"
    );

    var arrData = [[]];
    var arrMatches = null;
    while (arrMatches = objPattern.exec( strData )){
        var strMatchedDelimiter = arrMatches[ 1 ];
        if (
        strMatchedDelimiter.length &&
        (strMatchedDelimiter != strDelimiter)
        ){
            arrData.push( [] );
        }
        if (arrMatches[ 2 ]){
            var strMatchedValue = arrMatches[ 2 ].replace(
            new RegExp( "\"\"", "g" ),
            "\""
            );
        } else {
            var strMatchedValue = arrMatches[ 3 ];
        }
        arrData[ arrData.length - 1 ].push( strMatchedValue );
    }
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
};


MascotToJSON.prototype.convertReport = function(report,callback) {
    var self = this;
    var xhr = new window.XMLHttpRequest();
    var report_base = report.replace(/master_results(_2)?.pl.*/,'export_dat_2.pl');
    var file_url = /file=([^&]*)/.exec(report), file_url = file_url ? file_url[1] : null;
    var params = clone(mascot_params);
    params['file'] = file_url;
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if(xhr.status == 200) {
                var response = xhr.responseText;
                // Remove the header lines from the mascot response
                response = response.replace(/(.+\n)+\n.*\n/m,'');
                if (callback) {
                    callback.call(self,data_matrix_to_summary(CSVToArray(response)));
                }
            } else if (xhr.status == 0) {
                if (callback) {
                    callback.call(self,[],new Error("Could not load page"));
                }
            }
        }        
    };
    xhr.open("GET", report_base+'?'+params_to_url(params), true);
    xhr.send(null);
};

})();


if (typeof module != 'undefined' && module.exports){
    module.exports.MascotToJSON = MascotToJSON;
}