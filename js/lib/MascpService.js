//"use strict";

/**
 *  @fileOverview   Basic classes and defitions for the MASCP services
 */

/** Convenience logging function. If there is no log function defined, add a log method that simply
 *  forwards the message on to the console.log.
 *  @function
 *  @param  {Object}    message Message to log
 */

var window = window || null;

if (window !== null && typeof window.jQuery !== 'undefined' && window.jQuery) {
    window.jQuery.noConflict();
}

/**
 *  @namespace MASCP namespace
 */
var MASCP = MASCP || {};

if (typeof module != 'undefined' && module.exports){
    var events = require('events');
    var bean = require('./bean.js');
    
    MASCP.events = new events.EventEmitter();
    module.exports = MASCP;
    var jsdom = require('jsdom').jsdom,
        sys = require('sys');
    
    window = jsdom().createWindow();
    var document;
    if (typeof document == 'undefined') {
        document = window.document;
    }
    window.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    
    var svgns = 'http://ns';
    MASCP.events.emit('ready');
} else {
    window.MASCP = MASCP;
    var ie = (function(){

        var undef,
            v = 3,
            div = document.createElement('div'),
            all = div.getElementsByTagName('i');

            do {
                div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->';
            } while (all[0]);

        return v > 4 ? v : undef;

    }());
    if (ie) {
        if (ie === 7) {
            MASCP.IE = true;
            MASCP.IE7 = true;
        }
        if (ie === 8) {
            MASCP.IE = true;
            MASCP.IE8 = true;
        }
    }
}

/** Build a data retrieval class that uses the given function to extract result data.
 *  @static
 *  @param  {Function}  dataExtractor   Function to extract data from the resultant data (passed as an argument
 *                                      to the function), and then populate the result object. The function is
 *                                      bound to a hash to populate data in to. When no data is passed to the
 *                                      function, the hash should be populated with default values.
 */
MASCP.buildService = function(dataExtractor)
{
    var clazz = function(agi,endpointURL)
    {
        if (typeof endpointURL != 'undefined') {
            this._endpointURL = endpointURL;
        } else {
            this._endpointURL = clazz.SERVICE_URL;
        }
        this.agi = agi;
        return this;
    };

    clazz.Result = function(data)
    {
        var new_fields = dataExtractor.apply(this,[data]);
        MASCP.extend(this,new_fields);
        return this;
    };
    
    
    clazz.prototype = MASCP.extend(new MASCP.Service(),{
        '__class__'       :       clazz,
        '__result_class'  :       clazz.Result,
        '_endpointURL'    :       null
    });
    
    clazz.Result.prototype = MASCP.extend(new MASCP.Service.Result(),{
       '__class__'        :       clazz.Result
    });

    clazz.Result.prototype = MASCP.extend(clazz.Result.prototype,dataExtractor.apply({},[]));
        
    clazz.toString = function() {
        for (var serv in MASCP) {
            if (this == MASCP[serv]) {
                return "MASCP."+serv;
            }
        }
    };
    
    return clazz;
};

MASCP.extend = function(in_hsh,hsh) {
    for (var i in hsh) {
        if (true) {
            in_hsh[i] = hsh[i];
        }
    }
    return in_hsh;        
};

/** Default constructor for Services
 *  @class      Super-class for all MASCP services to retrieve data from
 *              proteomic databases. Sub-classes of this class override methods
 *              to change how requests are built, and how the data is parsed.
 *  @param      {String}    agi             AGI to retrieve data for
 *  @param      {String}    endpointURL     Endpoint for the service
 */
MASCP.Service = function(agi,endpointURL)
{
};

/**
 *  @lends MASCP.Service.prototype
 *  @property   {String}  agi               AGI to retrieve data for
 *  @property   {MASCP.Service.Result}  result  Result from the query
 *  @property   {Boolean} async             Flag for using asynchronous requests - defaults to true
 */
MASCP.Service.prototype = {
  'agi'     : null,
  'result'  : null, 
  '__result_class' : null,
  'async'   : true
};


/*
 * Internal callback for new data coming in from a XHR
 * @private
 */

MASCP.Service.prototype._dataReceived = function(data,status)
{
    var clazz = this.__result_class;
    if (data instanceof Array) {
        this.result = [];
        for (var i = 0; i < data.length; i++ ) {
            var rez;
            try {
                rez = new clazz(data[i]);
            } catch(err1) {
                bean.fire(this,'error',[err1]);
            }
            rez.reader = this;
            rez.retrieved = data[i].retrieved;
            this.result.push(rez);
        }
        this.result._raw_data = data;
        
        this.result.collect = function(callback) {
            var results = this;
            var result = [];
            for (var i = 0; i < results.length; i++ ) {
                result.push(callback.call(this,results[i]));
            }
            return result;
        };
    } else if ( ! this.result ) {
        var result;
        try {
            result = new clazz(data);
        } catch(err2) {
            bean.fire(this,'error',[err2]);
        }
        result._raw_data = data;
        this.result = result;
    } else {
        var new_result = {};
        try {
            new_result = new clazz(data);
        } catch(err3) {
            bean.fire(this,'error',[err3]);
        }
        for(var field in new_result) {
            if (new_result.hasOwnProperty(field)) {
                this.result[field] = new_result[field];
            }
        }
        this.result._raw_data = data;
    }

    if (data && data.retrieved) {
        this.result.retrieved = data.retrieved;
    }

    this.result.reader = this;
    this.result.agi = this.agi;
    return true;
};

MASCP.Service.prototype.gotResult = function()
{
    var self = this;
    
    var reader_cache = function(e,thing) {
        if ( ! thing.readers ) {
            thing.readers = [];
        }
        thing.readers.push(self.toString());
    };
    
    bean.add(MASCP,'layerRegistered', reader_cache);
    bean.add(MASCP,'groupRegistered', reader_cache);
    
    bean.fire(self,"resultReceived");
    
    try {
        bean.remove(MASCP,'layerRegistered',reader_cache);
        bean.remove(MASCP,'groupRegistered',reader_cache);
    } catch (e) {
    }

    bean.fire(MASCP.Service,"resultReceived");
    bean.fire(MASCP.Service,'requestComplete');
};

MASCP.Service.registeredLayers = function(service) {
    var result = [];
    for (var layname in MASCP.layers) {
        if (MASCP.layers.hasOwnProperty(layname)) {
            var layer = MASCP.layers[layname];
            if (layer.readers && layer.readers.indexOf(service.toString()) >= 0) {
                result.push(layer);
            }
        }
    }
    return result;
};

MASCP.Service.registeredGroups = function(service) {
    var result = [];
    for (var nm in MASCP.groups) {
        if (MASCP.groups.hasOwnProperty(nm)) {
            var group = MASCP.groups[nm];
            if (group.readers && group.readers.indexOf(service.toString()) >= 0) {
                result.push(group);
            }            
        }
    }
    return result;  
};

/**
 *  Binds a handler to one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to bind
 *  @param  {Function}  function    Handler to execute on event
 */

MASCP.Service.prototype.bind = function(type,func)
{
    bean.add(this,type,func);
    return this;
};

/**
 *  Unbinds a handler from one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to unbind
 *  @param  {Function}  function    Handler to unbind from event
 */
MASCP.Service.prototype.unbind = function(type,func)
{
    bean.remove(this,type,func);
    return this;    
};

/**
 * @name    MASCP.Service#resultReceived
 * @event
 * @param   {Object}    e
 */

/**
 * @name    MASCP.Service#error
 * @event
 * @param   {Object}    e
 */

/**
 *  Asynchronously retrieves data from the remote source. When data is received, a 
 *  resultReceived.mascp event is triggered upon this service, while an error.mascp
 *  event is triggered when an error occurs. This method returns a reference to self
 *  so it can be chained.
 */
(function(base) {

var make_params = function(params) {
    var qpoints = [];
    for(var fieldname in params) {
        if (params.hasOwnProperty(fieldname)) {
            qpoints.push(fieldname +'='+params[fieldname]);
        }
    }
    return qpoints.join('&');
};

var do_request = function(request_data) {
    var request = new window.XMLHttpRequest();
    var datablock = null;
    
    if ( ! request_data.url ) {
        request_data.success.call(null,null);
        return;
    }
    
    if (request_data.type == 'GET' && request_data.data) {
        request_data.url = request_data.url.replace(/\?$/,'') + '?' + make_params(request_data.data);
    }
    request.open(request_data.type,request_data.url,request_data.async);
    if (request_data.type == 'POST') {
        request.setRequestHeader("Content-type","application/x-www-form-urlencoded");
        datablock = make_params(request_data.data);
    }
    
    request.onreadystatechange = function(evt) {
        if (request.readyState == 4) {
            if (request.status == 200) {
                console.log("Request out firing stuff");
                var data_block = request_data.dataType == 'xml' ? document.implementation.createDocument(null, "nodata", null) : {};
                try {
                    data_block = request_data.dataType == 'xml' ?request.responseXML || MASCP.importNode(request.responseText) : JSON.parse(request.responseText);
                } catch (e) {
                    request_data.error.call(null,request.responseText,request,request.status);
                }
                request_data.success.call(null,data_block,request.status,request);
            } else {
                console.log(request.status);
                request_data.error.call(null,request.responseText,request,request.status);
            }
        }
    };
    console.log("Request out sending");
    request.send(datablock);
};

/**
 * Private method for performing a cross-domain request using Internet Explorer 8 and up. Adapts the 
 * parameters passed, and builds an XDR object. There is no support for a locking
 * synchronous method to do these requests (that is required for Unit testing) so an alert box is used
 * to provide the locking.
 * @private
 * @param {Object} dataHash Hash with the data and settings used to build the query.
 */


var do_request_ie = function(dataHash)
{
    // Use XDR
    var xdr = new XDomainRequest();
    var loaded = false;
    var counter = 0;
    xdr.onerror = dataHash.error;
    xdr.open("GET",dataHash.url+"?"+make_params(dataHash.data));
    xdr.onload = function() {
        loaded = true;
        if (dataHash.dataType == 'xml') {
            var dom = new ActiveXObject("Microsoft.XMLDOM");
            dom.async = false;
            dom.loadXML(xdr.responseText);
            dataHash.success(dom, 'success',xdr);
        } else if (dataHash.dataType == 'json') {
            var parsed = null;
            try {
                parsed = JSON.parse(xdr.responseText);
            } catch(err) {
                dataHash.error(xdr,xdr,{});           
            }
            if (parsed) {
                dataHash.success(parsed,'success',xdr);
            }
        } else {
            dataHash.success(xdr.responseText, 'success', xdr);
        }
    };
    
    // We can't set the content-type on the parameters here to url-encoded form data.
    xdr.send();
    while (! dataHash.async && ! loaded && counter < 3) {
        alert("This browser does not support synchronous requests, click OK while we're waiting for data");
        counter += 1;
    }
    if ( ! dataHash.async && ! loaded ) {
        alert("No data");
    }
};

base.retrieve = function(agi,callback)
{
    var self = this;

    MASCP.Service._current_reqs = MASCP.Service._current_reqs || 0;
    MASCP.Service._waiting_reqs = MASCP.Service._waiting_reqs || 0;
    
    if (MASCP.Service.MAX_REQUESTS) {
        var my_func = arguments.callee;
        if (MASCP.Service._current_reqs > MASCP.Service.MAX_REQUESTS) {
            MASCP.Service._waiting_reqs += 1;
            bean.add(MASCP.Service,'requestComplete',function() {
                bean.remove(this,'requestComplete',arguments.callee);
                setTimeout(function() {
                    MASCP.Service._waiting_reqs -= 1;
                    my_func.call(self,agi,callback);
                },0);
            });
            return this;
        }
    }
    if (agi) {
        this.agi = agi;
    }

    if (agi && callback) {
        this.agi = agi;
        self.removeEventListener = function() {};
        bean.add(self,"resultReceived",function() {
            bean.remove(self,"resultReceived",arguments.callee);
            callback.call(self);
        });
        bean.add(self,"error",function(resp,req,status) {
            bean.remove(self,"error",arguments.callee);
            callback.call(self,status);
        });
    }
    var request_data = this.requestData();
    if (! request_data ) {
        return this;
    }
        
    var default_params = {
    async:      this.async,
    url:        request_data.url || this._endpointURL,
    timeout:    5000,
    error:      function(response,req,status) {
                    MASCP.Service._current_reqs -= 1;
                    bean.add(self,"error",[response,req,status]);
                    bean.fire(MASCP.Service,'requestComplete');
                    //throw "Error occurred retrieving data for service "+self._endpointURL;
                },
    success:    function(data,status,xhr) {
                    MASCP.Service._current_reqs -= 1;
                    if ( xhr && xhr.status !== null && xhr.status === 0 ) {
                        bean.fire(self,"error");
                        throw "Error occurred retrieving data for service "+self._endpointURL;
                    }
                    if (self._dataReceived(data,status)) {
                        self.gotResult();
                    }
                }
    };
    MASCP.extend(default_params,request_data);

    do_request(default_params);
    
    MASCP.Service._current_reqs += 1;

    return this;
};

})(MASCP.Service.prototype);

(function() {

    var get_db_data, store_db_data, search_service, clear_service, find_latest_data, data_timestamps, sweep_cache, cached_agis, begin_transaction, end_transaction;
    
    var max_age = 0, min_age = 0;

    MASCP.Service.BeginCaching = function() {
        MASCP.Service.CacheService(MASCP.Service.prototype);
    };

    // To do 7 days ago, you do
    // var date = new Date();
    // date.setDate(date.getDate() - 1);
    // MASCP.Service.SetMinimumFreshnessAge(date);
    MASCP.Service.SetMinimumAge = function(date) {
        if (date === 0) {
            min_age = 0;
        } else {
            min_age = date.getTime();
        }
    };

    MASCP.Service.SetMaximumAge = function(date) {
        if (date === 0) {
            max_age = 0;
        } else {
            max_age = date.getTime();
        }
    };

    MASCP.Service.SweepCache = function(date) {
        if (! date) {
            date = date.getTime();
        }
        sweep_cache(date.getTime());
    };

    MASCP.Service.CacheService = function(reader) {
        if (reader.retrieve.caching) {
            return;
        }
        var _oldRetrieve = reader.retrieve;
        
        reader.retrieve = function(agi,cback) {
            var self = this;
            var id = agi ? agi : self.agi;
            if ( ! id ) {
                _oldRetrieve.call(self,id,cback);
                return self;
            }

            id = id.toLowerCase();
            self.agi = id;

            get_db_data(id,self.toString(),function(err,data) {
                if (data) {
                    if (cback) {
                        bean.add(self,"resultReceived",function() {
                            bean.remove(self,"resultReceived",arguments.callee);
                            cback.call(self);
                        });
                    }
                    if (self._dataReceived(data,"db")) {
                        self.gotResult();
                    }
                } else {
                    var old_received = self._dataReceived;
                    self._dataReceived = (function() { return function(dat) {
                        store_db_data(id,this.toString(),dat || {});
                        var res = old_received.call(this,dat);
                        this._dataReceived = null;
                        this._dataReceived = old_received;
                        dat = {};
                        return res;
                    };})();
                    _oldRetrieve.call(self,id,cback);                    
                }             
            });
            return self;
        };
        reader.retrieve.caching = true;
    };

    MASCP.Service.FindCachedService = function(service,cback) {
        var serviceString = service.toString();
        search_service(serviceString,cback);
        return true;
    };

    MASCP.Service.CachedAgis = function(service,cback) {
        var serviceString = service.toString();
        cached_agis(serviceString,cback);
        return true;
    };

    MASCP.Service.ClearCache = function(service,agi) {
        var serviceString = service.toString();
        clear_service(serviceString,agi);
        return true;
    };

    MASCP.Service.HistoryForService = function(service,cback) {
        var serviceString = service.toString();
        data_timestamps(serviceString,null,cback);
    };

    MASCP.Service.BulkOperation = function() {
        begin_transaction();
        return function() {
            end_transaction();
        };
    };

    var db;

    if (typeof module != 'undefined' && module.exports) {
        console.log("Starting sqlite");
        var sqlite = require('sqlite');
        db = new sqlite.Database();
        db.open("cached.db",function() {});
        console.log("Opened db");
    } else if ("openDatabase" in window) {
        try {
            db = openDatabase("cached","","MASCP Gator cache",1024*1024);
        } catch (err) {
            throw err;
        }

        db.execute = function(sql,args,callback) {
            var self = this;
            self.transaction(function(tx) {
                tx.executeSql(sql,args,function(tx,result) {
                    var res = [];
                    for (var i = 0; i < result.rows.length; i++) {
                        res.push(result.rows.item(i));
                    }
                    if (callback) {
                        callback.call(db,null,res);
                    }
                },function(tx,err) {
                    if (callback) {
                        callback.call(db,err);
                    }
                });
            });
        };
    }
        
    if (typeof db != 'undefined') {

        if (! db.version || db.version == "") {
            db.execute("CREATE TABLE if not exists datacache (agi TEXT,service TEXT,retrieved REAL,data TEXT)",null,function(err) { if (err && err != "Error: not an error") { throw err; } });
        }
        
        var old_get_db_data = get_db_data;
        
        begin_transaction = function() {
            get_db_data = function(id,clazz,cback) {
                 setTimeout(function() {
                     cback.call(null,null);
                 },0);
            };
            db.execute("BEGIN_TRANSACTION;",function() {});
        };
        
        end_transaction = function() {
            get_db_data = old_get_db_data;
            db.execute("END TRANSACTION;",function() {});
        };
        
        sweep_cache = function(timestamp) {
            db.execute("DELETE from datacache where retrieved <= ? ",[timestamp],function() {});
        };
        
        clear_service = function(service,agi) {
            var servicename = service;
            servicename += "%";
            if ( ! agi ) {
                db.execute("DELETE from datacache where service like ? ",[servicename],function() {});
            } else {
                db.execute("DELETE from datacache where service like ? and agi = ?",[servicename,agi.toLowerCase()],function() {});
            }
            
        };
        
        search_service = function(service,cback) {
            db.execute("SELECT distinct service from datacache where service like ? ",[service+"%"],function(err,records) {
                var results = {};
                if (records && records.length > 0) {
                    records.forEach(function(record) {
                        results[record.service] = true;
                    });
                }
                var uniques = [];
                for (var k in results) {
                    if (results.hasOwnProperty(k)) {                    
                        uniques.push(k);
                    }
                }
                cback.call(MASCP.Service,uniques);
                return uniques;
            });
        };
        
        cached_agis = function(service,cback) {
            db.execute("SELECT distinct AGI from datacache where service = ?",[service],function(err,records) {
                var results = [];
                for (var i = 0; i < records.length; i++ ){
                    results.push(records[i].agi);
                }
                cback.call(MASCP.Service,results);
            });
        };
        
        get_db_data = function(agi,service,cback) {
            var timestamps = max_age ? [min_age,max_age] : [min_age, (new Date()).getTime()];
            return find_latest_data(agi,service,timestamps,cback);
        };

        var insert_report_func = function(agi,service) {
            return function(err,rows) {
                if ( ! err && rows) {
                    console.log("Caching result for "+agi+" in "+service);
                }
            };
        };

        store_db_data = function(agi,service,data) {
            if (typeof data != 'object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
                return;
            }
            var str_rep;
            try {
                str_rep = JSON.stringify(data);
            } catch (err) {
                return;
            }
            var dateobj = data.retrieved ? data.retrieved : (new Date());
            dateobj.setUTCHours(0);
            dateobj.setUTCMinutes(0);
            dateobj.setUTCSeconds(0);
            dateobj.setUTCMilliseconds(0);
            var datetime = dateobj.getTime();
            data = {};
            db.execute("INSERT INTO datacache(agi,service,retrieved,data) VALUES(?,?,?,?)",[agi,service,datetime,str_rep],insert_report_func(agi,service));
        };
        
        find_latest_data = function(agi,service,timestamps,cback) {
            var sql = "SELECT * from datacache where agi=? and service=? and retrieved >= ? and retrieved <= ? ORDER BY retrieved DESC LIMIT 1";
            var args = [agi,service,timestamps[0],timestamps[1]];
            db.execute(sql,args,function(err,records) {
                if (records && records.length > 0 && typeof records[0] != "undefined") {
                    var data = typeof records[0].data === 'string' ? JSON.parse(records[0].data) : records[0].data;
                    if (data) {
                        data.retrieved = new Date(records[0].retrieved);
                    }
                    cback.call(null,null,data);
                } else {
                    cback.call(null,null,null);
                }
            });
        };
        
        data_timestamps = function(service,timestamps,cback) {
            if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
                timestamps = [0,(new Date()).getTime()];
            }
            var sql = "SELECT distinct retrieved from datacache where service=? and retrieved >= ? and retrieved <= ? ORDER BY retrieved ASC";
            var args = [service,timestamps[0],timestamps[1]];
            db.execute(sql,args,function(err,records) {
                var result = [];
                if (records && records.length > 0 && typeof records[0] != "undefined") {
                    for (var i = records.length - 1; i >= 0; i--) {
                        result.push(new Date(records[i].retrieved));
                    }
                }
                cback.call(null,result);
            });            
        };
        
    } else if ("localStorage" in window) {
        
        sweep_cache = function(timestamp) {
            if ("localStorage" in window) {
                var key;
                for (var i = 0, len = localStorage.length; i < len; i++) {
                    key = localStorage.key(i);
                    if (new RegExp("^MASCP.*").test(key)) {
                        var data = localStorage[key];
                        if (data && typeof data === 'string') {
                            var datablock = JSON.parse(data);
                            datablock.retrieved = timestamp;
                            localStorage.removeItem(key);
                        }
                    }
                }
            }
        };
        
        clear_service = function(service,agi) {
            if ("localStorage" in window) {
                var key;
                for (var i = 0, len = localStorage.length; i < len; i++){
                    key = localStorage.key(i);
                    if ((new RegExp("^"+service+".*"+(agi?agi+"$" : ""))).test(key)) {
                        localStorage.removeItem(key);
                        if (agi) {
                            return;
                        }
                    }
                }
            }            
        };
        
        search_service = function(service,cback) {
            var results = {};
            if ("localStorage" in window) {
                var key;
                var re = new RegExp("^"+service+".*");
                for (var i = 0, len = localStorage.length; i < len; i++){
                    key = localStorage.key(i);
                    if (re.test(key)) {                        
                        results[key.replace(/\.at[\dcm].*$/g,'')] = true;
                    }
                }
            }

            var uniques = [];
            for (var k in results) {
                if (results.hasOwnProperty(k)) {
                    uniques.push(k);
                }
            }

            cback.call(MASCP.service,uniques);

            return uniques;
        };

        cached_agis = function(service,cback) {
            if ("localStorage" in window) {
                var key;
                var re = new RegExp("^"+service);
                for (var i = 0, len = localStorage.length; i < len; i++){
                    key = localStorage.key(i);
                    if (re.test(key)) {
                        key = key.replace(service,'');
                        results[key] = true;
                    }
                }
            }

            var uniques = [];
            for (var k in results) {
                if (results.hasOwnProperty(k)) {
                    uniques.push(k);
                }
            }

            cback.call(MASCP.service,uniques);
        };

        get_db_data = function(agi,service,cback) {
            var data = localStorage[service.toString()+"."+(agi || '').toLowerCase()];
            if (data && typeof data === 'string') {
                var datablock = JSON.parse(data);
                datablock.retrieved = new Date(datablock.retrieved);
                cback.call(null,null,datablock);
            } else {
                cback.call(null,null,null);
            }
            
        };
        
        store_db_data = function(agi,service,data) {
            if (data && typeof data !== 'object' || data instanceof Document){
                return;
            }
            data.retrieved = (new Date()).getTime();
            localStorage[service.toString()+"."+(agi || '').toLowerCase()] = JSON.stringify(data);
        };

        find_latest_data = function(agi,service,timestamp,cback) {
            // We don't actually retrieve historical data for this
            return get_db_data(agi,service,cback);
        };

        data_timestamps = function(service,timestamp,cback) {
            cback.call(null,[]);
        };
        
        begin_transaction = function() {
            // No support for transactions here. Do nothing.
        };
        end_transaction = function() {
            // No support for transactions here. Do nothing.
        };
    }
    
    
    

})();

/**
 * Set the async parameter for this service.
 * @param {Boolean} asyncFlag   Asynchronous flag - true for asynchronous action, false for asynchronous
 * @returns Reference to self
 * @type MASCP.Service.prototype
 */
MASCP.Service.prototype.setAsync = function(asyncFlag)
{
    this.async = asyncFlag;
    return this;
};

/**
 *  Get the parameters that will be used to build this request. Implementations of services will
 *  override this method, returning the parameters to be used to build the XHR.
 */

MASCP.Service.prototype.requestData = function()
{
    
};

MASCP.Service.prototype.toString = function()
{
    for (var clazz in MASCP) {
        if (this.__class__ == MASCP[clazz]) {
            return "MASCP."+clazz;
        }
    }
};

/**
 * For this service, register a sequence rendering view so that the results can be marked up directly
 * on to a sequence. This method will do nothing if the service does not know how to render the 
 * results onto the sequence.
 * @param {MASCP.SequenceRenderer} sequenceRenderer Sequence renderer object to render results upon
 */
MASCP.Service.prototype.registerSequenceRenderer = function(sequenceRenderer)
{
    if (this.setupSequenceRenderer) {
        this.renderers = this.renderers || [];
        this.setupSequenceRenderer(sequenceRenderer);        
        this.renderers.push(sequenceRenderer);
    }
    return this;
};

/**
 * For this service, set up a sequence renderer so that the events are connected up with receiving data.
 * This method should be overridden to wire up the sequence renderer to the service.
 * @param {MASCP.SequenceRenderer} sequenceRenderer Sequence renderer object to render results upon
 */
MASCP.Service.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    return this;
};


/**
 *  Move a node from an externally retrieved document into this current document.
 *  @static
 *  @param  {Node}  externalNode    Node from XHR data source that is to be imported into the current document.
 */
MASCP.Service.importNode = function(external_node)
{
    if (typeof external_node == 'string') {
        var new_data = document.createElement('div');
        new_data.innerHTML = external_node;
        return new_data.firstChild;        
    }
    
    if ( document.importNode ) {
        return document.importNode(external_node,true);
    } else {
        var new_data = document.createElement('div');
        new_data.innerHTML = external_node.xml;
        return new_data.firstChild;
    }    
};

/** Default constructor
 *  @class  Super-class for all results from MASCP services.
 */
MASCP.Service.Result = function()
{  
};

MASCP.Service.Result.prototype = {
    agi     :   null,
    reader  :   null
};


MASCP.Service.Result.prototype.render = function() {
//    return window.jQuery('<span>Result received for '+this.agi+'</span>');
};


MASCP.BatchRead = function()
{
    this._make_readers();
};

MASCP.BatchRead.prototype._make_readers = function() {
    this._readers = [
        new MASCP.SubaReader(),
        new MASCP.PhosphatReader(null,'proxy.pl'),
        new MASCP.RippdbReader(),
        new MASCP.PromexReader(),
        new MASCP.PpdbReader(null,'proxy.pl'),
        new MASCP.AtPeptideReader(),
        new MASCP.AtProteomeReader()
    ];
};


// For every event for a particular class (or null for all classes), bind
// this function to run. e.g. do something whenever a resultReceived for all MASCP.PhosphatReader

MASCP.BatchRead.prototype.bind = function(ev, clazz, func) {
    if (ev == 'resultReceived') {
        ev = '_resultReceived';
    }
    if (ev == 'error') {
        ev = '_error';
    }
    for (var i = 0; i < this._readers.length; i++ ) {
        if (! clazz || this._readers[i].__class__ == clazz) {
            this._readers[i].bind(ev,func);
        }
    }
};

MASCP.BatchRead.prototype.retrieve = function(agi, opts) {

    var self = this;


    if ( ! opts ) {
        opts = {};
    }

    if (self._in_call) {
        var self_func = arguments.callee;
        bean.add(self,'resultReceived', function() {
            bean.remove(self,'resultReceived',arguments.callee);
            self_func.call(self,agi,opts);
        });
        return;
    }

    // for a single reader, events: single_success
    // bound for all readers, events: error, success

    self._in_call = true;


    var result_count = self._readers.length;

    var trigger_done = function() {
        if (result_count === 0) {
            if (opts.success) {
                opts.success.call();
            }
            self._in_call = false;
            bean.fire(self,'resultReceived');
        }
    };
    
    for (var i = 0; i < this._readers.length; i++ ) {
        var a_reader = this._readers[i];

        a_reader.unbind('resultReceived');
        a_reader.unbind('error');


        a_reader.result = null;
        a_reader.agi = agi;
                    
        if (opts.single_success) {
            a_reader.bind('resultReceived',function(){ return function() {
                opts.single_success.call(this);
            };}(i) );
        }
        if (opts.error) {
            a_reader.bind('error', function(){ return function() {
                opts.error.call(this);
            };}(i));
        }

        a_reader.bind('resultReceived',function() { return function() {
            bean.fire(this,'_resultReceived');
            bean.remove(this,'resultReceived');
            result_count -= 1;
            trigger_done.call(this);
        };}(i));
        
        a_reader.bind('error',function() { return function() {
            bean.fire(this,'_error');
            bean.remove(this,'error');
            result_count -= 1;
            trigger_done.call(this);
        };}(i));

        a_reader.retrieve();
    }
};