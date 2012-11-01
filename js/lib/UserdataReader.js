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

var apply_map = function(data_block) {
    var map = this.map;
    var databits = data_block.data;
    var headers = databits.shift();
    var dataset = {};
    var id_col = headers.indexOf(map.id);
    var cols_to_add = [];
    for (var col in map) {
        if (col == "id") {
            continue;
        }
        if (map.hasOwnProperty(col)) {
            cols_to_add.push({ "name" : col, "index" : headers.indexOf(map[col]) });
        }
    }
    while (databits.length > 0) {
        var row = databits.shift();
        var id = row[id_col].toLowerCase();
        if ( ! dataset[id] ) {
            dataset[id] = {"data" : {}};
        }
        var obj = dataset[id];
        var i;
        for (i = cols_to_add.length - 1; i >= 0; i--) {
            if ( ! obj.data[cols_to_add[i].name] ) {
                obj.data[cols_to_add[i].name] = [];
            }
            obj.data[cols_to_add[i].name] = obj.data[cols_to_add[i].name].concat((row[cols_to_add[i].index] || '').split(','));
        }
        obj.retrieved = data_block.retrieved;
        obj.title = data_block.title;
        if (data_block.etag) {
            obj.etag = data_block.etag;
        }
    }
    return dataset;
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

    if ( ! data.retrieved ) {
        data.retrieved = new Date();
    }
    if ( ! data.title ) {
        data.title = name;
    }

    var dataset = {}; // Format is { "accession" : { "data" : {}, "retrieved" : "" , "title" : ""  } };

    if (typeof this.map == 'object') {
        dataset = apply_map.call(this,data);
    }
    if (typeof this.map == 'function') {
        dataset = this.map(data);
    }

    this.data = dataset;
    
    var inserter = new MASCP.UserdataReader();

    inserter.toString = function() {
        return self.toString();
    };

    inserter.data = dataset;
    
    inserter.retrieve = function(an_acc,cback) {
        this.agi = an_acc;
        // this._dataReceived(dataset[this.agi]);
        cback.call(this);
    };
    
    MASCP.Service.CacheService(inserter);

    var accs = [];
    var acc;
    for (acc in dataset) {
        if (dataset.hasOwnProperty(acc)) {
            if (acc.match(/[A-Z]/)) {
                dataset[acc.toLowerCase()] = dataset[acc];
                delete dataset[acc];
                acc = acc.toLowerCase();
            }
            accs.push(acc);
        }
    }
    var total = accs.length;

    var retrieve = this.retrieve;

    this.retrieve = function(id,cback) {
        console.log("Data not ready! Waiting for ready state");
        var self = this;        
        bean.add(self,'ready',function() {
            bend.remove(self,'ready',arguments.callee);
            self.retrieve(id,cback);
        });
    };
    if (accs.length < 1) {
        bean.fire(self,'ready');
        return;
    }
    var trans = MASCP.Service.BulkOperation();

    inserter.avoid_database = true;
    inserter.retrieve(accs[0],function() {
        while (accs.length > 0) {
            var acc = accs.shift();
            bean.fire(self,'progress',[100 * ((total - accs.length) / total), total - accs.length, total]);
            inserter.agi = acc;
            inserter._dataReceived(dataset[acc]);
            if (accs.length === 0) {
                self.retrieve = retrieve;
                trans(function(err) {
                    if ( ! err ) {
                        bean.fire(self,'ready');
                    } else {
                        bean.fire(self,'error');
                    }
                });
                return;
            }
        }
    });

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