fs = require('fs');

exports.get_data = function(agi,service) {
    var result = {};
    (new service()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        result.result = this.result;
    })
    return result;
};

exports.find_peptide = function(agi,seq) {
    (new MASCP.TairReader()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        console.log(this.result.getSequence().indexOf(seq));
    })
};

exports.find_sequence = function(agi) {
    (new MASCP.TairReader()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        console.log(this.result.getSequence());
    })    
};

(function() {
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
    
    var read_csv = function(filename) {
        var data = fs.readFileSync(filename);
        return CSVToArray(data,",");
    };
    
    exports.load_data = function(filename,setname) {
        var reader = new MASCP.UserdataReader();
        reader.setData(setname,read_csv(filename));
        return reader;
    };
    
})();
