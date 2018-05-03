//"use strict";

import bean from '../bean';
import JSandbox from '../jsandbox';

import MASCP from './MASCP';

/** Default constructor for Services
 *  @class      Super-class for all MASCP services to retrieve data from
 *              proteomic databases. Sub-classes of this class override methods
 *              to change how requests are built, and how the data is parsed.
 *  @param      {String}    agi             AGI to retrieve data for
 *  @param      {String}    endpointURL     Endpoint for the service
 */
const Service = function(agi,endpointURL) {};

/** Build a data retrieval class that uses the given function to extract result data.
 *  @static
 *  @param  {Function}  dataExtractor   Function to extract data from the resultant data (passed as an argument
 *                                      to the function), and then populate the result object. The function is
 *                                      bound to a hash to populate data in to. When no data is passed to the
 *                                      function, the hash should be populated with default values.
 */

let resultsymb = Symbol('resultclass');

Service.buildService = function(dataExtractor)
{

    let clazz = class extends Service {
        constructor(agi,endpointURL) {
            super();
            if (typeof endpointURL != 'undefined') {
                this._endpointURL = endpointURL;
            } else {
                this._endpointURL = clazz.SERVICE_URL;
            }
            this.agi = agi;
            return this;
        }

        toString() {
            for (var serv in MASCP) {
                if (this === MASCP[serv]) {
                    return "MASCP."+serv;
                }
            }
        }

        get Result() {
            return this[resultsymb] || this.constructor.Result;
        }

        set Result(resultclass) {
            this[resultsymb] = resultclass;
        }
    };

    clazz.Result = class {
        constructor(data) {
            dataExtractor.apply(this,[data]);
            return this;
        }
    };

    Object.assign(dataExtractor.apply({},[]),clazz.Result.prototype);

    return clazz;
};

Service.clone = function(service,name) {
    var new_service = Service.buildService(function() { return this; });
    new_service.Result = service.Result;
    new_service.prototype = new service();
    MASCP[name] = new_service;
    new_service.prototype['__class__'] = new_service;
    return new_service;
};


/**
 *  @lends Service.prototype
 *  @property   {String}  agi               AGI to retrieve data for
 *  @property   {Service.Result}  result  Result from the query
 *  @property   {Boolean} async             Flag for using asynchronous requests - defaults to true
 */
Service.prototype = Object.assign({
  'agi'     : null,
  'result'  : null, 
  'async'   : true
},Service.prototype);


/*
 * Internal callback for new data coming in from a XHR
 * @private
 */

Service.prototype._dataReceived = function(data,status)
{
    if (! data ) {
        return false;
    }
    var clazz = this.Result;
    if (data && data.error && data.error != '' && data.error !== null ) {
        bean.fire(this,'error',[data.error]);
        return false;
    }
    if (Object.prototype.toString.call(data) === '[object Array]') {
        for (var i = 0; i < data.length; i++ ) {
            arguments.callee.call(this,data[i],status);
        }
        if (i === 0) {
            this.result = new clazz();
        }
        this.result._raw_data = { 'data' : data };
    } else if ( ! this.result ) {
        var result;
        try {
            result = new clazz(data);
        } catch(err2) {
            bean.fire(this,'error',[err2]);
            return false;
        }
        if ( ! result._raw_data ) {
            result._raw_data = data;
        }
        this.result = result;
    } else {
        // var new_result = {};
        try {
            clazz.call(this.result,data);
        } catch(err3) {
            bean.fire(this,'error',[err3]);
            return false;
        }
        // for(var field in new_result) {
        //     if (true && new_result.hasOwnProperty(field)) {
        //         this.result[field] = new_result[field];
        //     }
        // }
        if (! this.result._raw_data) {
            this.result._raw_data = data;
        }
        // this.result._raw_data = data;
    }

    if (data && data.retrieved) {
        this.result.retrieved = data.retrieved;
        this.result._raw_data.retrieved = data.retrieved;
    }

    this.result.agi = this.agi;
    
    
    
    return true;
};

Service.prototype.gotResult = function()
{
    var self = this;
    
    var reader_cache = function(thing) {
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

    bean.fire(Service,"resultReceived");
};

Service.prototype.requestComplete = function()
{
    bean.fire(this,'requestComplete');
    bean.fire(Service,'requestComplete',[this]);
};

Service.prototype.requestIncomplete = function()
{
    bean.fire(this,'requestIncomplete');
    bean.fire(Service,'requestIncomplete',[this]);
};


Service.registeredLayers = function(service) {
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

Service.registeredGroups = function(service) {
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

Service.prototype.bind = function(type,func)
{
    bean.add(this,type,func);
    return this;
};

Service.prototype.once = function(type,func) {
    var self = this;
    var wrapped_func = function() {
        bean.remove(self,type,wrapped_func);
        func.apply(self,[].slice.call(arguments));
    };
    self.bind(type,wrapped_func);
};

/**
 *  Unbinds a handler from one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to unbind
 *  @param  {Function}  function    Handler to unbind from event
 */
Service.prototype.unbind = function(type,func)
{
    bean.remove(this,type,func);
    return this;    
};

/**
 * @name    Service#resultReceived
 * @event
 * @param   {Object}    e
 */

/**
 * @name    Service#error
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

var cached_requests = {};

var do_request = function(request_data) {
    
    request_data.async = true;

    var datablock = null;
    
    if ( ! request_data.url ) {
        request_data.success.call(null,null);
        return;
    }

    var request = new XMLHttpRequest();
    
    if (request_data.type == 'GET' && request_data.data) {
        var index_of_quest = request_data.url.indexOf('?');

        if (index_of_quest == (request_data.url.length - 1)) {
            request_data.url = request_data.url.slice(0,-1);
            index_of_quest = -1;
        }
        var has_question =  (index_of_quest >= 0) ? '&' : '?';
        request_data.url = request_data.url.replace(/\?$/,'') + has_question + make_params(request_data.data);
    }
    if (request_data.type == 'GET' && request_data.session_cache) {
        if (cached_requests[request_data.url]) {
            cached_requests[request_data.url].then( function(data) {
                request_data.success.call(null,data);
            }).catch(function(error_args) {
                request_data.error.apply(null,[null,request,error_args]);
            });
            return;
        } else {
            var success_callback = request_data.success;
            var error_callback = request_data.error;
            cached_requests[request_data.url] = new Promise(function(resolve,reject) {
                request_data.success = function(data){
                    resolve(data);
                };
                request_data.error = function(message,req,error_obj) {
                    reject([message,req,error_obj]);
                    delete cached_requests[request_data.url];
                };
            });
            cached_requests[request_data.url].catch(function(error_args) {
                error_callback.apply(null,error_args);
            }).then(function(data) {
                success_callback.call(null,data);
            });
        }
    }

    request.open(request_data.type,request_data.url,request_data.async);

    if (request_data.type == 'POST') {
        request.setRequestHeader("Content-Type",request_data.content ? request_data.content : "application/x-www-form-urlencoded");
        datablock = request_data.content ? request_data.data : make_params(request_data.data);
    }

    if (request.customUA) {
        request.setRequestHeader('User-Agent',request.customUA);
    }

    if (request_data.auth) {
        request.setRequestHeader('Authorization','Bearer '+request_data.auth);
    }

    if (request_data.api_key) {
        request.setRequestHeader('x-api-key',request_data.api_key);
    }

    var redirect_counts = 5;

    request.onreadystatechange = function(evt) {
        if (request.readyState == 4) {
            if (request.status >= 300 && request.status < 400 && redirect_counts > 0) {
                var loc = (request.getResponseHeader('location')).replace(/location:\s+/,'');
                redirect_counts = redirect_counts - 1;
                request.open('GET',loc,request_data.async);
                request.send();
                return;
            }
            if (request.status == 503) {
                // Let's encode an exponential backoff
                request.last_wait = (request_data.last_wait || 500) * 2;
                setTimeout(function(){
                    request.open(request_data.type,request_data.url,request_data.async);
                    if (request_data.type == 'POST') {
                        request.setRequestHeader("Content-Type",request_data.content ? request_data.content : "application/x-www-form-urlencoded");
                    }
                    if (request.customUA) {
                        request.setRequestHeader('User-Agent',request.customUA);
                    }
                    request.send(datablock);
                },request_data.last_wait);
                return;
            }
            if (request.status == 403) {
                // Make sure our S3 buckets expose the Server header cross-origin
                var server = request.getResponseHeader('Server');
                if (server === 'AmazonS3') {
                    request_data.success.call(null,{"error" : "No data"},403,request);
                    return;
                }
            }
            if (request.status >= 200 && request.status < 300) {
                var data_block;
                if (request_data.dataType == 'xml') {
                    data_block = typeof(document) !== 'undefined' ? document.implementation.createDocument(null, "nodata", null) : { 'getElementsByTagName' : function() { return []; } };
                } else {
                    data_block = {};
                }
                try {
                    var text = request.responseText;
                    data_block = request_data.dataType == 'xml' ? request.responseXML :
                                 request_data.dataType == 'txt' ? request.responseText : JSON.parse(request.responseText);
                } catch (e) {
                    if (e.type == 'unexpected_eos') {
                        request_data.success.call(null,{},request.status,request);
                        return;
                    } else {
                        request_data.error.call(null,request.responseText,request,{'error' : e.type || e.message, 'stack' : e });
                        return;
                    }
                }
                if (request.status == 202 && data_block.status == "RUNNING") {
                    setTimeout(function(){
                        request.open(request_data.type,request_data.url,request_data.async);
                        if (request_data.type == 'POST') {
                            request.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
                        }
                        if (request.customUA) {
                            request.setRequestHeader('User-Agent',request.customUA);
                        }
                        request.send(datablock);
                    },5000);
                    return;
                }
                request_data.success.call(null,data_block,request.status,request);
                data_block = null;
            } else {
                request_data.error.call(null,request.responseText,request,request.status);
            }
        }
    };
    if (MASCP.NETWORK_FAIL && MASCP.NETWORK_FAIL.enabled) {
        setTimeout(function() {
            console.log("Causing network failure");
            request = { 'onreadystatechange' : request.onreadystatechange};
            request.readyState = 4;
            request.status = MASCP.NETWORK_FAIL.status || 500;
            request.responseText = "Intercepted by Network Failure simulator";
            request.onreadystatechange();
        },1000);
        return;
    }

    request.send(datablock);
};

Service.request = function(url,callback,noparse) {
    var method =  MASCP.IE ? do_request_ie : do_request;
    if (MASCP.IE && ! url.match(/^https?\:/)) {
        method = do_request;
    }
    var params;
    if ( ! url ) {
        callback(null);
        return;
    }
    if (typeof url == 'string') {
        params =  { async: true, url: url, timeout: 5000, type : "GET",
                        error: function(response,req,status) {
                            callback.call(null,{"status" : status });
                        },
                        success:function(data,status,xhr) {
                            callback.call(null,null,data);
                        }
                    };
    } else if (url.hasOwnProperty('url')) {
        params = url;
        params.success = function(data) {
            callback.call(null,null,data);
        };
        params.error = function(resp,req,status) {
            callback.call(null,{"status": status});
        };
    }
    if (noparse) {
        params.dataType = 'txt';
        if (noparse === "xml") {
            params.dataType = 'xml';
        }
    }
    method.call(null,params);
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
    xdr.onerror = function(ev) {
        dataHash.error(xdr,xdr,{"message" : "XDomainRequest error"});
    };
    xdr.onprogress = function() { };
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
                dataHash.error(xdr,xdr,{"message" : "JSON parsing error"});
            }
            if (parsed) {
                dataHash.success(parsed,'success',xdr);
            }
        } else {
            dataHash.success(xdr.responseText, 'success', xdr);
        }
    };
    // We can't set the content-type on the parameters here to url-encoded form data.
    setTimeout(function () {
        xdr.send();
    }, 0);
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

    Service._current_reqs = Service._current_reqs || 0;
    Service._waiting_reqs = Service._waiting_reqs || 0;
    
    if (Service.MAX_REQUESTS) {
        var my_func = arguments.callee;
        if (Service._current_reqs > Service.MAX_REQUESTS) {
            Service._waiting_reqs += 1;
            bean.add(Service,'requestComplete',function() {
                bean.remove(this,'requestComplete',arguments.callee);
                setTimeout(function() {
                    Service._waiting_reqs -= 1;
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

        this.result = null;
        
        var done_result = false;
        var done_func = function(err,obj) {
            bean.remove(self,"resultReceived",done_func);
            bean.remove(self,"error",done_func);
            bean.remove(self,"requestComplete",done_func);
            if ( ! done_result ) {
                if (err) {
                    callback.call(self,err);
                } else {
                    callback.call(self);
                }
            }
            done_result = true;
        };
        bean.add(self,"resultReceived",done_func);
        bean.add(self,"error",done_func);
        bean.add(self,"requestComplete",done_func);
    }
    var request_data = this.requestData();

    if (request_data === false) {
        return;
    }

    if (! request_data ) {
        bean.fire(self,"error",["No request data"]);
        bean.fire(Service,"requestComplete",[self]);
        this.requestComplete();
        return this;
    }
        
    var default_params = {
    async:      this.async,
    url:        request_data.url || this._endpointURL,
    timeout:    5000,
    error:      function(response,req,status) {
                    Service._current_reqs -= 1;
                    if (typeof status == 'string') {
                        status = { 'error' : status , 'request' : req };
                    }
                    if (! isNaN(status) ) {
                        status = { "error" : "Reqeust error", "status" : status, 'request' : req };
                    }
                    bean.fire(self,"error",[status]);
                    bean.fire(Service,'requestComplete');
                    self.requestComplete();
                    //throw "Error occurred retrieving data for service "+self._endpointURL;
                },
    success:    function(data,status,xhr) {
                    Service._current_reqs -= 1;
                    if ( xhr && xhr.status !== null && xhr.status === 0 ) {
                        bean.fire(self,"error",[{"error": "Zero return status from request "}]);
                        self.requestComplete();
                        return;
                    }
                    var received_flag = self._dataReceived(data,status);

                    if (received_flag) {
                        self.gotResult();
                    }

                    if (received_flag !== null && typeof received_flag !== 'undefined') {
                        self.requestComplete();
                    } else {
                        self.requestIncomplete();
                    }
                }
    };
    default_params = Object.assign(request_data,default_params);
    if (MASCP.IE) {
        do_request_ie(default_params);
    } else {
        do_request(default_params);
    }
    
    Service._current_reqs += 1;

    return this;
};

})(Service.prototype);

/**
 *  Get the parameters that will be used to build this request. Implementations of services will
 *  override this method, returning the parameters to be used to build the XHR.
 */

Service.prototype.requestData = function()
{
    
};

Service.prototype.toString = function()
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
Service.prototype.registerSequenceRenderer = function(sequenceRenderer,options)
{
    if (this.setupSequenceRenderer) {
        this.renderers = this.renderers || [];
        this.setupSequenceRenderer(sequenceRenderer,options);
        this.renderers.push(sequenceRenderer);
    }
    sequenceRenderer.trigger('readerRegistered',[this]);
    return this;
};

Service.prototype.resetOnResult = function(sequenceRenderer,rendered,track) {
    var self = this;
    var result_func = function() {
        self.unbind('resultReceived',result_func);
        sequenceRenderer.bind('resultsRendered',clear_func);
    };

    var clear_func = function(reader) {
        if (reader !== self) {
            return;
        }
        sequenceRenderer.unbind('resultsRendered',clear_func);
        rendered.forEach(function(obj) {
            sequenceRenderer.remove(track,obj);
        });
    };
    this.bind('resultReceived',result_func);
};


/**
 * For this service, set up a sequence renderer so that the events are connected up with receiving data.
 * This method should be overridden to wire up the sequence renderer to the service.
 * @param {MASCP.SequenceRenderer} sequenceRenderer Sequence renderer object to render results upon
 */
Service.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    return this;
};

/** Default constructor
 *  @class  Super-class for all results from MASCP services.
 */
Service.Result = function()
{  
};

Service.Result.prototype = {
    agi     :   null,
    reader  :   null
};


Service.Result.prototype.render = function() {
};

export default Service;