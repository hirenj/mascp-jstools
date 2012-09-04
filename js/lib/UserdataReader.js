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
                        if ( ! data ) {
                            return this;
                        }
                        this._raw_data = data;
                        return this;
                    });

MASCP.UserdataReader.prototype.toString = function() {
    return 'MASCP.UserdataReader.'+this.datasetname;
};

MASCP.UserdataReader.prototype.requestData = function()
{
    var agi = this.agi.toUpperCase();
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : this.datasetname 
        }
    };
};


MASCP.UserdataReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    
    var is_array = function(arr) {
        return Object.prototype.toString.call(arr) == '[object Array]';
    };
    
    reader.bind('resultReceived',function() {
        var results = [].concat(this.result.data);
        while(results.length > 0) {
            var my_data = results.shift();
            if ( ! my_data ) {
                continue;
            }
            MASCP.registerLayer(reader.datasetname,{'fullname' : reader.datasetname,'color' : '#00ff00'});
            var data_func = function() { return function(row) {
                renderer.getAminoAcidsByPeptide(row).addToLayer(reader.datasetname);
            }; }();
            if (is_array(my_data) && (! (is_array(my_data[0])))) {
                data_func = function() { return function(row) {
                    var start = parseInt(row[0],10);
                    var end = parseInt(row[1],10);
                    if (! isNaN(start) && ! isNaN(end)) {
                        renderer.getAA(start).addBoxOverlay(reader.datasetname,end-start);
                    } else {
                        row.forEach(function(cell) {
                            renderer.getAminoAcidsByPeptide(cell).addToLayer(reader.datasetname);                            
                        });
                    }
                }; }();
            } else if (is_array(my_data) && ( is_array(my_data[0]) )) {
                data_func = function() { return function(peps) {
                    peps.forEach(function(row) {
                        var start = parseInt(row[0],10);
                        var end = parseInt(row[1],10);
                        renderer.getAA(start).addBoxOverlay(reader.datasetname,end-start);
                    });
                }; }();                
            } else if (my_data === parseInt(my_data[0],10)) {
                data_func = function() { return function(row) {
                    var pos = row;
                    renderer.getAA(pos).addAnnotation(reader.datasetname,1);
                }; }();
            }
            data_func.call(this,my_data);
        }
        jQuery(renderer).trigger('resultsRendered',[reader]);        
    });
};

(function() {
var filter_agis = function(data_matrix,agi) {
    if (! data_matrix || data_matrix.length < 1) {
        return [];
    }
    var id_col = -1,i;
    
    for (i = 0; i < data_matrix[0].length; i++) {
        if ((data_matrix[0][i] || '').toString().toLowerCase().match(/at[\dA-Z]g\d+/)) {
            id_col = i;
            break;
        }
    }
    if (id_col == -1) {
        return data_matrix;
    }
    var results = [];
    for (i = 0; i < data_matrix.length; i++ ) {
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
    var retriever = null, i;
    for (i = 0; i < data_matrix[0].length; i++) {
        var cell = data_matrix[0][i];
        var col = i;
        if (cell.toString().match(/\d+-\d+/)) {
            retriever = function() { return function(row) {
                var results = [];
                row[col].split(/,/).forEach(function(data) {
                    results.push(data.split(/-/));
                });
                return results;
            };}(i);
        }
        if (cell.toString().match(/^\d+$/)) {
            if (data_matrix[0][i+1] && data_matrix[0][i+1].toString().match(/^\d+$/)) {
                retriever = function() { return function(row) {
                    return [ row[col], row[col+1] ];
                };}(i);
            } else {
                retriever = function() { return function(row) {
                    return row[col];
                };}(i);
            }
            break;
        }
        if (cell.toString().match(/^[A-Z]+$/)) {
            retriever = function() { return function(row) {
                return row[col];
            };}(i);
        }
    }
    if (! retriever) {
        return [];
    }
    var results = [];
    for (i = 0; i < data_matrix.length; i++) {
        results.push(retriever.call(this,data_matrix[i]));
    }
    return results;
};

MASCP.UserdataReader.prototype.setData = function(name,data) {
    
    if ( ! data ) {
        return;
    }

    var self = this;
    
    // Call CacheService on this object/class
    // just to make sure that it has access
    // to the cache retrieval mechanisms

    MASCP.Service.CacheService(this);
    
    this.datasetname = name;
    this.data = data;
    
    var inserter = new MASCP.UserdataReader();
    inserter.datasetname = name;
    inserter.data = data;
    
    inserter.retrieve = function(an_acc,cback) {
        this.agi = an_acc;
        this._dataReceived(data[this.agi]);
        cback.call(this);
    };
    
    MASCP.Service.CacheService(inserter);

    var accs = [];
    var acc;
    for (acc in data) {
        if (data.hasOwnProperty(acc)) {
            accs.push(acc);
        }
    }

    var retrieve = this.retrieve;

    this.retrieve = function(id,cback) {
        console.log("Data not ready! Waiting for ready state");
        var self = this;        
        bean.add(self,'ready',function() {
            bend.remove(self,'ready',arguments.callee);
            self.retrieve(id,cback);
        });
    };

    (function() {
        if (accs.length === 0) {
            self.retrieve = retrieve;
            bean.fire(self,'ready');
            return;
        }
        var acc = accs.shift();     
        inserter.retrieve(acc,arguments.callee);
    })();

};

MASCP.UserdataReader.datasets = function(cback) {
    MASCP.Service.FindCachedService(this,function(services) {
        var result = [];
        for (var i = 0, len = services.length; i < len; i++){
            result.push(services[i].replace(/MASCP.UserdataReader./,''));
        }
        if (result.forEach) {
            result.forEach(cback);
        }
    });
};

})();