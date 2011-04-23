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
                        this.data = data;
                        return this;
                    });

/* File formats

ATXXXXXX.XX,123-456
ATXXXXXX.XX,PSDFFDGFDGFDG
ATXXXXXX.XX,123,456

*/

MASCP.UserdataReader.prototype.toString = function() {
    return 'MASCP.UserdataReader.'+this.datasetname;
};

MASCP.UserdataReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    reader.bind('resultReceived',function() {
        var results;
        if (! this.result instanceof Array) {
            results = [this.result];
        } else {
            results = [].concat(this.result);
        }
        while(results.length > 0) {
            var my_data = results.shift().data;
            MASCP.registerLayer(reader.datasetname,{'fullname' : reader.datasetname,'color' : '#00ff00'});
            var data_func = function(row) {
                renderer.getAminoAcidsByPeptide(row).addToLayer(reader.datasetname);
            };
            if (my_data instanceof Array) {
                data_func = function(row) {
                    var start = parseInt(row[0]);
                    var end = parseInt(row[1]);
                    renderer.getAA(start).addBoxOverlay(reader.datasetname,end-start);
                };
            } else if (my_data === parseInt(my_data[0])) {
                data_func = function(row) {
                    var pos = row;
                    renderer.getAA(pos).addAnnotation(reader.datasetname,1);
                };
            }
            data_func.call(this,my_data);
        }
        renderer.trackOrder = renderer.trackOrder.concat([reader.datasetname]);
        renderer.showLayer(reader.datasetname);
        jQuery(renderer).trigger('resultsRendered',[reader]);        
        
    });
};

(function() {
var filter_agis = function(data_matrix,agi) {
    if (data_matrix.length < 1) {
        return [];
    }
    var id_col = -1;
    for (var i = 0; i < data_matrix[0].length; i++) {
        if ((data_matrix[0][i] || '').toString().toLowerCase().match(/at[\dA-Z]g\d+/)) {
            id_col = i;
            break;
        }
    }
    if (id_col == -1) {
        return data_matrix;
    }
    var results = [];
    for (var i = 0; i < data_matrix.length; i++ ) {
        if ( ! agi ) {
            results.push(data_matrix[i][id_col].toLowerCase());
        }
        if (agi && (data_matrix[i][id_col].toLowerCase() === agi.toLowerCase())) {
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
        if (cell.toString().match(/\d+-\d+/)) {
            retriever = function(row) {
                return row[col].split(/-/);
            }
        }
        if (cell.toString().match(/^\d+$/)) {
            if (data_matrix[0][i+1] && data_matrix[0][i+1].toString().match(/^\d+$/)) {
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
        if (cell.toString().match(/^[A-Z]+$/)) {
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

MASCP.UserdataReader.prototype.setData = function(name,data) {
    this.datasetname = name;
    if ( ! data ) {
        return;
    }
    this.data = data;
    var agis = filter_agis(data);
    
    this._has_data = false;
    for (var i = 0; i < agis.length; i++ ) {
        this.retrieve(agis[i]);
    }
    this._has_data = true;
};

MASCP.UserdataReader.prototype.retrieve = function(agi,cback) {
    if (agi) {
        this.agi = agi;
    }
    this._dataReceived(find_peptide_cols(filter_agis(this.data,this.agi)));
    
    if (this._has_data) {
        window.jQuery(this).trigger("resultReceived");
        window.jQuery(MASCP.Service).trigger("resultReceived");
    }
};

})();