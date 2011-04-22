/**
 * @fileOverview    Classes for getting arbitrary user data onto the GATOR
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve sequence data for a given AGI from a given ecotype
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UserdataReader = MASCP.buildService(function(data) {
                        return this;
                    });

/* File formats

ATXXXXXX.XX,123-456
ATXXXXXX.XX,PSDFFDGFDGFDG
ATXXXXXX.XX,123,456

*/

MASCP.UserdataReader.prototype.retrieve = function() {
};


(function() {
var filter_agis = function(data_matrix,agi) {
    if (data_matrix.length < 1) {
        return [];
    }
    var id_col = -1;
    for (var i = 0; i < data_matrix[0].length; i++) {
        if (data_matrix[0][i].match(/at[\dA-Z]g\d+/)) {
            id_col = i;
            break;
        }
    }
    if (id_col == -1) {
        return data_matrix;
    }
    var results = [];
    for (var i = 0; i < data_matrix.length; i++ ) {
        if (data_matrix[i][id_col].toLowerCase() === agi.toLowerCase()) {
            results.push(data_matrix[i]);
        }
    }
    return results;
};

var find_peptide_cols = function(data_matrix) {
    if (data_matrix.length < 1) {
        return [];
    }
    var retriever = null;
    for (var i = 0; i < data_matrix[0].length; i++) {
        var cell = data_matrix[0][i];
        var col = i;
        if (cell.match(/\d+-\d+/)) {
            retriever = function(row) {
                return row[col].split(/-/);
            }
        }
        if (cell.match(/^\d+$/)) {
            if (data_matrix[0][i+1] && data_matrix[0][i+1].match(/^\d+$/)) {
                retriever = function(row) {
                    return [ row[col], row[col+1] ];
                }
            } else {
                retriever = function(row) {
                    return row[col];
                }
            }
            break;
        }
        if (cell.match(/^[A-Z]+$/)) {
            retriever = function(row) {
                return row[col];
            }
        }
    }
    if (! retriever) {
        return [];
    }
    var results = [];
    for (var i = 0; i < data_matrix.length; i++) {
        results.push(retriever.call(this,data_matrix[i]));
    }
    return results;
};

MASCP.UserdataReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    reader.bind('resultReceived',function() {
        var my_data = find_peptide_cols(filter_agis(this.data,this.agi));
        if (my_data.length == 0) {
            return;
        }
        MASCP.registerLayer('userdata',{'fullname' : 'User data','color' : '#00ff00'});
        var data_func = function(row) {
            renderer.getAminoAcidsByPeptide(row).addToLayer('userdata');
        };
        if (my_data[0] && my_data[0] instanceof Array) {
            data_func = function(row) {
                var start = parseInt(row[0]);
                var end = parseInt(row[1]);
                renderer.getAA(start).addBoxOverlay('userdata',end-start);
            };
        } else if (my_data[0] === parseInt(my_data[0])) {
            data_func = function(row) {
                var pos = row;
                renderer.getAA(pos).addAnnotation('userdata',1);
            };
        }
        for (var i = 0; i < my_data.length; i++ ) {
            data_func.call(this,my_data[i]);
        }
        renderer.trackOrder = renderer.trackOrder;
        renderer.showLayer('userdata');
        jQuery(renderer).trigger('resultsRendered',[reader]);        
        
    });
}

})();