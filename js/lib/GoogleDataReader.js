/**
 * @fileOverview    Retrieve data from a Google data source
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
MASCP.GoogledataReader = MASCP.buildService(function(data) {
                        if ( ! data ) {
                            return this;
                        }
                        this.data = data ? data.data : data;
                        (function(self) {
                            self.getPeptides = function() {
                                return data.data;
                            };
                        })(this);
                        return this;
                    });

/* File formats

ATXXXXXX.XX,123-456
ATXXXXXX.XX,PSDFFDGFDGFDG
ATXXXXXX.XX,123,456

*/

MASCP.GoogledataReader.prototype.toString = function() {
    return 'MASCP.GoogledataReader.'+this.datasetname;
};

(function() {

var attach_google_scripts = function() {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = "http://www.google.com/jsapi";
    head.appendChild(script);
    return;
};

if ( typeof google == 'undefined') {
    attach_google_scripts();
}

var scope = "https://docs.google.com/feeds/ https://spreadsheets.google.com/feeds/";

var authenticate = function() {
    if (! google.accounts.user.checkLogin(scope)=='') {
        return true;
    } else {
        // This kicks you out of the current page.. better way to do this?
        google.accounts.user.login(scope);
    }
    return;
};

var documents = function(callback) {
    
    authenticate();

    var feedUrl = "https://docs.google.com/feeds/documents/private/full";
    var service = new google.gdata.client.GoogleService('writely','gator');
    service.getFeed(feedUrl,function(data) {
        var results = [];
        if (data) {
            var entries = data.feed.entry;
            var i;
            for ( i = entries.length - 1; i >= 0; i-- ) {
                results.push( [ entries[i].title.$t,
                                entries[i]['gd$resourceId'].$t,
                                new Date(entries[i]['updated'].$t) ]
                            );
            }
        }
        callback.call(null,null,results);
    },callback);
};

var parsedata = function ( data ){
    /* the content of this function is not important to the question */
    var entryidRC = /.*\/R(\d*)C(\d*)/;
    var retdata = {};
    retdata.mat = {};
    var max_rows = 0;
    for( var l in data.feed.entry )
    {
        var entry = data.feed.entry[ l ];
        var id = entry.id.$t;
        var m = entryidRC.exec( id );
        var R,C;
        if( m != null )
        {
            R = new Number( m[ 1 ] );
            C = new Number( m[ 2 ] );
        }
        var row = retdata.mat[ R ];                                                                                                                           
        if( typeof( row ) == 'undefined' ) {
            retdata.mat[ R ] = {};
        }
        retdata.mat[ R ][ C ] = entry.content.$t;
        if (R > max_rows) { 
            max_rows = R;
        }
    }
    retdata.max_rows = max_rows;
    return retdata;                                                                       
};

var get_document_using_script = function(doc_id,callback) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.setAttribute('id','ssheet-'+doc_id);
    script.src = "http://spreadsheets.google.com/feeds/cells/"+doc_id+"/1/public/basic?alt=json-in-script&callback=gotData";
    script.addEventListener('error', function() {
        if (script.parentNode) {
            script.parentNode.removeChild(script);
        }
        callback.call(null,"error",doc_id);
    });
    window["cback"+doc_id] = function(dat) {
        delete window["cback"+doc_id];
        callback.call(null,null,parsedata(dat));
    }
    head.appendChild(script);
}

var get_document = function(doc,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');
    

    get_document_using_script(doc_id,function(err,dat){
        if (err) {
            authenticate();
            var feedUrl = "https://spreadsheets.google.com/feeds/cells/"+doc_id+"/1/private/basic";
            var service = new google.gdata.client.GoogleService('wise','gator');
            service.getFeed(feedUrl,function(data) {
                callback.call(null,null,parsedata(data));
            },callback);
        } else {
            callback.call(null,null,dat);
        }
    });

};

MASCP.GoogledataReader.prototype.getDocumentList = documents;

MASCP.GoogledataReader.prototype.getDocument = get_document;


})();

MASCP.GoogledataReader.prototype.setupSequenceRenderer = function(renderer) {
};