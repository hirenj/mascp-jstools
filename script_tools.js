var print_line;
if (typeof module !== 'undefined' && module.exports) {
    fs = require('fs');
    print_line = function(message) {
        console.log(message);
    };
} else if (typeof window !== 'undefined') {
    exports = window;
} else {
    exports = {};
}

exports.get_data = function(agi,service) {
    var result = {};
    (new service()).retrieve(agi,function(err) {
        if (err) {
            result.error = err;
            return;
        }
        result.result = this.result;
    })
    return result;
};

exports.find_motif = function(agi,motif) {
    var result_struct = {};
    (new MASCP.TairReader()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        var seq = this.result.getSequence();
        motif.global = true;
        var result = [];
        var last_hit = 0;
        seq.match(motif).forEach(function(match) {
            var pos = seq.indexOf(match,last_hit+1);
            result.push(pos+1);
            last_hit = pos;
        });
        return result_struct.result = result;
    });
    return result_struct;
};

exports.find_peptide = function(agi,seq) {
    (new MASCP.TairReader()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        print_line(this.result.getSequence().indexOf(seq));
    })
};

exports.find_sequence = function(agi) {
    (new MASCP.TairReader()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        print_line(this.result.getSequence());
    })    
};

exports.find_region = function(agi,region) {
    (new MASCP.TairReader()).retrieve(agi,function(err) {
        if (err) {
            return;
        }
        var min = region[0] - 10;
        if (min < 0) {
            min = 0;
        }
        var max = region[1] + 10;
        if (max > this.result.getSequence().length) {
            max = this.result.getSequence().length;
        }
        print_line(this.result.getSequence().substring(region[0],region[1])+'xx'+this.result.getSequence().substring(min,region[0]-1)+'[1m'+this.result.getSequence().substring(region[0]-1,region[1]-1)+'[22m'+this.result.getSequence().substring(region[1]-1,max));
        
    })    
};

exports.print_result = function() {
    print_line(arguments);
};

(function() {
    if (typeof module === 'undefined' || ! module.exports ) {
        return;
    }
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
    
    exports.read_csv = function(filename) {
        var data = fs.readFileSync(filename);
        return CSVToArray(data,",");
    };
    
    exports.load_data = function(filename,setname) {
        var reader = new MASCP.UserdataReader();
        reader.setData(setname,exports.read_csv(filename));
        return reader;
    };
    
})();
