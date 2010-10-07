/**
 *  @fileOverview   Basic classes and defitions for the MASCP services
 */

/** Convenience logging function. If there is no log function defined, add a log method that simply
 *  forwards the message on to the console.log.
 *  @function
 *  @param  {Object}    message Message to log
 */

if (typeof jQuery != 'undefined') {
    jQuery.noConflict();
}

log = (typeof log == 'undefined') ? (typeof console == 'undefined') ? function() {} : function(msg) {    
    if (typeof msg == 'String') {
        console.log("%s: %o", msg, this);
    } else {
        console.log("%o: %o", msg, this);
    }
    return this;
} : log ;

if ( typeof MASCP == 'undefined' ) {
    /**
     *  @namespace MASCP namespace
     */
    MASCP = {};
}

if (document.write) {
    document.write('<!--[if IE 7]><script type="text/javascript">MASCP.IE = true; MASCP.IE7 = true; MASCP.IELTE7 = true;</script><![endif]-->');
    document.write('<!--[if IE 8]><script type="text/javascript">MASCP.IE = true; MASCP.IE8 = true; MASCP.IELTE8 = true;</script><![endif]-->');
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
        jQuery.extend(this,dataExtractor.apply(this,[data]));
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
    return clazz;
};

MASCP.extend = function(in_hsh,hsh) {
    for (var i in hsh) {
        in_hsh[i] = hsh[i];
    }
    return in_hsh;        
};

/**
 * Create a set of data readers that will populate data into the given element, using the given proxy as a
 * proxy URL
 * @static
 * @param {Element} element Element to place results in. Marked up with a data-agi attribute that contains the AGI to look up.
 * @returns Array of reader objects that will be used to read the data from the remote sources
 * @type Array
 */
MASCP.lazyDataFetch = function(element,proxy)
{
    var an_agi = element.getAttribute("data-agi");
    
    /* There's nothing uglier than sticking HTML into JS */
    var result_container = jQuery('\
        <div style="width: 100%; position: relative;">\
            <input type="button" value="Fetch" style="position: relative; top: 0px; height: 1.1em;" class="toggle"/>\
            <div style="width: 100%;" class="results">\
                <h3>Data Provided by the MASC Proteomics Subcommittee <a href="#"><img src="tair-at5g50600_files/questionmark.gif" alt="(?)" border="0" height="12" width="10"></a></h3>\
                <div style="display: none;" class="mass_spec">\
                    <h3>Spectral Data <a href="#"><img src="tair-at5g50600_files/questionmark.gif" alt="(?)" border="0" height="12" width="10"></a></h3>\
                </div>\
                <div style="display:none" class="ptm">\
                    <h3>Post Translational Modifications <a href="#"><img src="tair-at5g50600_files/questionmark.gif" alt="(?)" border="0" height="12" width="10"></a></h3>\
                    <div>Deamidation (NQ) <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">PPDB</a></div>\
                    <div>Hydroxylation (P) <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">PPDB</a></div>\
                    <div>Propionylation (C) <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">PPDB</a></div>\
                    <div>Formylation (N-term, STK) <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">PPDB</a></div>\
                    <div>Amino Acid substitution <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">PPDB</a></div>\
                    <div>Acetylation (N-term) <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">PPDB</a></div>\
                    <div>Processing (N-term) <input type="checkbox" disabled="true"/> <a style="display: block; float: right;" href="#">mito/cpt</a></div>\
                </div>\
                <div style="display:none" class="localisation">\
                    <h3>Subcellular Localization <a href="#"><img src="tair-at5g50600_files/questionmark.gif" alt="(?)" border="0" height="12" width="10"></a></h3>\
                </div>\
            </div>\
        </div>\
        ');
    
    var readers = jQuery([MASCP.SubaReader, MASCP.PromexReader, MASCP.PhosphatReader, MASCP.AtProteomeReader]).map(function(){
        var clazz = this;
        var a_reader = new clazz(an_agi,proxy);
        return a_reader;
    });

    jQuery('.results',result_container).each(function(i) {
        jQuery(this).hide();
    });

    jQuery(element).append(result_container);
    
    
    var result_count = 0;
    
    
    jQuery(readers).each(function(i) {
        var a_reader = this;
       jQuery(this).bind('resultReceived',function() {
           result_count++;
           jQuery('.results',result_container).each(function(i) {
               if (a_reader.result) {
                   if (a_reader instanceof MASCP.PromexReader || a_reader instanceof MASCP.AtProteomeReader) {
                       jQuery('.mass_spec', this).css({'display': 'block'}).append(a_reader.result.render());
                   } else if (a_reader instanceof MASCP.PhosphatReader ) {
                       jQuery('.ptm', this).css({'display': 'block'}).append(a_reader.result.render());
                   } else if (a_reader instanceof MASCP.SubaReader ) {
                       jQuery('.localisation', this).css({'display':'block'}).append(a_reader.result.render());
                   } else {
                       jQuery(this).append(a_reader.result.render());
                   }
               }
           })
           if (result_count == readers.length) {
               jQuery('.toggle',result_container).each(function(i) {                   
                   jQuery(this).hide();
                   jQuery('.results',result_container).each(function(i) {
                       jQuery(this).slideDown();
                       jQuery('#footer').css({'display':'none'});
                   });
               });
           }
       });
       
       jQuery(this).bind('error',function() {
           result_count++;
           jQuery('.results', result_container).each(function(i) {
               jQuery(this).append("<div>An error occurred retrieving the data for a service</div>");
           });
       });       
    });
    
    jQuery('.toggle',result_container).each(function(i) {
        var toggler = this;
        jQuery(this).bind('click',function() {
            if (this.fetching) {
                return;
            }
            result_count = 0;
            this.fetching = true;       
            this.value = "Fetching..";
            jQuery(readers).each(function() {
                this.retrieve();
            });
        });
    });
    
    
    return readers;
    
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
  'async'   : true,
};


/*
 * Internal callback for new data coming in from a XHR
 * @private
 */

MASCP.Service.prototype._dataReceived = function(data,status)
{
    var clazz = this.__result_class;
    if ( ! this.result ) {
        result = new clazz(data);
        this.result = result;
    } else {
        var new_result = new clazz(data);
        jQuery.extend( this.result, new_result );        
    }
    this.result.reader = this;
    this.result.agi = this.agi;
};

/**
 *  Binds a handler to one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to bind
 *  @param  {Function}  function    Handler to execute on event
 *  @see jQuery <a href="http://docs.jquery.com/Events/bind">bind function</a>.
 */

MASCP.Service.prototype.bind = function(type,func)
{
    jQuery(this).bind(type,func);
    return this;
};

/**
 *  Unbinds a handler from one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to unbind
 *  @param  {Function}  function    Handler to unbind from event
 *  @see jQuery <a href="http://docs.jquery.com/Events/unbind">unbind function</a>.
 */
MASCP.Service.prototype.unbind = function(type,func)
{
    jQuery(this).unbind(type,func);
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
MASCP.Service.prototype.retrieve = function()
{
    var self = this;

    var request_data = this.requestData();
    if (! request_data ) {
        return this;
    }
    request_data = jQuery.extend({
    async:      this.async,
    url:        this._endpointURL,
    timeout:    5000,
    error:      function(response,req,settings) {
                    jQuery(self).trigger("error");
                    //throw "Error occurred retrieving data for service "+self._endpointURL;
                },
    success:    function(data,status,xhr) {
                    if ( xhr && xhr.status != null && xhr.status == 0 ) {
                        jQuery(self).trigger("error");
                        throw "Error occurred retrieving data for service "+self._endpointURL;
                    }
                    self._dataReceived(data,status);
                    jQuery(self).trigger("resultReceived");
                    jQuery(MASCP.Service).trigger("resultReceived");
                },
    /*  There is a really strange WebKit bug, where when you make a XDR request
        with the X-Requested-With header set, it caused the body to be returned
        to be duplicated. We're going to disable the preflighting on these requests
        for now.
        Submitted a bug to the webkit people https://bugs.webkit.org/show_bug.cgi?id=36854
    */
    xhr:        function() {
                    var xhr = jQuery.ajaxSettings.xhr();
                    if ( ! MASCP.IE ) {
                        var oldSetRequestHeader = xhr.setRequestHeader;
                        xhr.setRequestHeader = function(key,val) {
                            if (key != 'X-Requested-With') {
                                oldSetRequestHeader.apply(xhr,[key,val]);
                            }
                        };
                    }
                    return xhr;
                }, 
    },request_data);
    
    if (jQuery.browser.msie && window.XDomainRequest && this._endpointURL.match(/^https?\:/) ) {
        this._retrieveIE(request_data);
        return this;
    }    
    jQuery.ajax(request_data);
    return this;
};

/**
 * Private method for performing a cross-domain request using Internet Explorer 8 and up. Adapts the 
 * parameters passed to the jQuery method, and builds an XDR object. There is no support for a locking
 * synchronous method to do these requests (that is required for Unit testing) so an alert box is used
 * to provide the locking.
 * @private
 * @param {Object} dataHash Hash with the data and settings used to build the query.
 */


MASCP.Service.prototype._retrieveIE = function(dataHash)
{
    // Use XDR
    var xdr = new XDomainRequest();
    var loaded = false;
    var counter = 0;
    xdr.onerror = dataHash['error'];
    xdr.open("GET",dataHash['url']+"?"+jQuery.param(dataHash['data']));
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
 *  override this method, returning the parameters to be used to build the XHR. The format for
 *  parameters follows the options used in jQuery
 *  @see <a href="http://docs.jquery.com/Ajax/jQuery.ajax#toptions">jQuery options</a>.
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
    if ( document.importNode ) {
        return document.importNode(external_node,true);
    } else {
        var new_data = jQuery('<div></div>');
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
    return jQuery('<span>Result received for '+this.agi+'</span>');
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
        jQuery(self).bind('resultReceived', function() {
            jQuery(self).unbind('resultReceived',arguments.callee);
            self_func.call(self,agi,opts);
        });
        return;
    }

    // for a single reader, events: single_success
    // bound for all readers, events: error, success

    self._in_call = true;


    var result_count = self._readers.length;

    var trigger_done = function() {
        if (result_count == 0) {
            if (opts['success']) {
                opts['success'].call();
            }
            self._in_call = false;
            jQuery(self).trigger('resultReceived');
        }
    };
    
    for (var i = 0; i < this._readers.length; i++ ) {
        var a_reader = this._readers[i];

        a_reader.unbind('resultReceived');
        a_reader.unbind('error');


        a_reader.result = null;
        a_reader.agi = agi;
                    
        if (opts['single_success']) {
            a_reader.bind('resultReceived',function() {
                opts['single_success'].call(this);
            });
        }
        if (opts['error']) {
            a_reader.bind('error',function() {
                opts['error'].call(this);
            });
        }

        a_reader.bind('resultReceived',function() {
            jQuery(this).trigger('_resultReceived');
            jQuery(this).unbind('resultReceived');
            result_count -= 1;
            trigger_done.call(this);
        });
        
        a_reader.bind('error',function() {
            jQuery(this).trigger('_error');
            jQuery(this).unbind('error');
            result_count -= 1;
            trigger_done.call(this);
        });

        a_reader.retrieve();
    }
};
