/**
 * @fileOverview    Retrieve data from a Google data source
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 */
MASCP.GoogledataReader =    MASCP.buildService(function(data) {
                                return this;
                            });

(function() {

if ( typeof google == 'undefined' && typeof document !== 'undefined') {

    // You need the scripts attached already. Writing the script tag
    // doesn't seem to work

    // http://www.google.com/jsapi?autoload=%7B%22modules%22%3A%5B%7B%22name%22%3A%22gdata%22%2C%22version%22%3A%222%22%7D%5D%7D
    //return;
    // attach_google_scripts();
}

var scope = "https://docs.google.com/feeds/ https://spreadsheets.google.com/feeds/";

var authenticate = function() {
    if (! google.accounts || ! google.accounts.user.checkLogin(scope)=='') {
        return true;
    } else {
        // This kicks you out of the current page.. better way to do this?
        google.accounts.user.login(scope);
    }
    return;
};

var parsedata = function ( data ){
    /* the content of this function is not important to the question */
    var entryidRC = /.*\/R(\d*)C(\d*)/;
    var retdata = {};
    retdata.data = [];
    var max_rows = 0;
    for( var l in data.feed.entry )
    {
        var entry = data.feed.entry[ l ];
        var id = entry.id.$t;
        var m = entryidRC.exec( id );
        var R,C;
        if( m != null )
        {
            R = m[ 1 ] - 1;
            C = m[ 2 ] - 1;
        }
        var row = retdata.data[ R ];                                                                                                                           
        if( typeof( row ) == 'undefined' ) {
            retdata.data[ R ] = [];
        }
        retdata.data[ R ][ C ] = entry.content.$t;
    }
    retdata.retrieved = new Date(data.feed.updated.$t);
    
    /* When we cache this data, we don't want to
       wipe out the hour/minute/second accuracy so
       that we can eventually do some clever updating
       on this data.
     */
    retdata.retrieved.setUTCHours = function(){};
    retdata.retrieved.setUTCMinutes = function(){};
    retdata.retrieved.setUTCSeconds = function(){};
    retdata.retrieved.setUTCMilliseconds = function(){};
    retdata.etag = data.feed.gd$etag;
    retdata.title = data.feed.title.$t;

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

var get_document, get_document_list;

if (typeof module != 'undefined' && module.exports){
    get_document_list = function(callback) {    

        var headers_block = { 'GData-Version' : '3.0' };

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
        } else {
            callback.call(null,"Not authorized");
            return;
        }

        var req = require('https').get(
            {
                host: "docs.google.com",
                path: "/feeds/default/private/full/-/spreadsheet?alt=json",
                headers: headers_block,
            },function(res) {
                res.setEncoding('utf8');
                var response = "";
                res.on('data',function(chunk) {
                    response += chunk;
                });
                res.on('end',function() {
                    var data = JSON.parse(response);
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
                });
            }
        );
    };


    get_document = function(doc,etag,callback) {
        var headers_block = { 'GData-Version' : '3.0' };

        var feed_type = 'public';

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
            feed_type = 'private';
        }

        if (etag) {
            headers_block["If-None-Match"] = etag;
        }

        var req = require('https').get(
            {
                host: "spreadsheets.google.com",
                path: "/feeds/cells/"+doc+"/1/"+feed_type+"/basic?alt=json",
                headers: headers_block,
            },function(res) {
                res.setEncoding('utf8');
                var data = "";
                res.on('data',function(chunk) {
                    data += chunk;
                });
                res.on('end',function() {
                    var response = JSON.parse(data);
                    callback.call(null,null,parsedata(response));
                });
            }
        );
    };
} else {

    get_document_list = function(callback) {    

        authenticate();

        var feedUrl = "https://docs.google.com/feeds/default/private/full/-/spreadsheet";
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

    get_document = function(doc,etag,callback) {
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
                var headers_block = {'GData-Version':'3.0'};
                if (etag) {
                    headers_block["If-None-Match"] = etag;
                }
                service.setHeaders(headers_block);
                service.getFeed(feedUrl,function(data) {
                    callback.call(null,null,parsedata(data));
                },callback,google.gdata.Feed);
            } else {
                callback.call(null,null,dat);
            }
        });
    };
}


var render_site = function(renderer) {
    var self = this;
    var sites = self.result._raw_data.sites || [], i = 0, match = null;
    MASCP.registerLayer(self.datasetname,{ 'fullname' : self.result._raw_data.title });
    for (i = sites.length - 1; i >= 0; i--) {
        if (match = sites[i].match(/(\d+)/g)) {
            renderer.getAminoAcidsByPosition([parseInt(match[0])])[0].addToLayer(self.datasetname);
        }
    }
};

var render_peptides = function(renderer) {
    var self = this;
    var peptides = self.result._raw_data.peptides || [], i = 0, match = null;
    MASCP.registerLayer(self.datasetname,{ 'fullname' : self.result._raw_data.title });
    for (i = peptides.length - 1; i >= 0; i--) {
        if (match = peptides [i].match(/(\d+)/g)) {
            renderer.getAminoAcidsByPosition(parseInt(match[0])).addToLayer(self.datasetname);
        }
    }
};

var setup = function(renderer) {
    this.bind('resultReceived',function(e) {
        render_peptides.call(this,renderer);
        render_site.call(this,renderer);
    });
};

MASCP.GoogledataReader.prototype.getDocumentList = get_document_list;

MASCP.GoogledataReader.prototype.getDocument = get_document;
/*
map = {
    "peptides" : "column_a",
    "sites"    : "column_b",
    "id"       : "uniprot_id"
}
*/
MASCP.GoogledataReader.prototype.createReader = function(doc, map) {
    var self = this;
    var reader = new MASCP.UserdataReader();
    reader.datasetname = doc;
    reader.setupSequenceRenderer = setup;

    MASCP.Service.CacheService(reader);

    (function() {
        var a_temp_reader = new MASCP.UserdataReader();
        a_temp_reader.datasetname = doc;
        MASCP.Service.CacheService(a_temp_reader);
        MASCP.Service.CachedAgis(a_temp_reader,function(accs) {
            if ( accs.length < 1 ) {
                get_data(null);
                return;
            }
            a_temp_reader.retrieve(accs[0],function() {
                get_data(this.result._raw_data.etag);
            });
        });
    })();

    var get_data = function(etag) {
        self.getDocument(doc,etag,function(e,data) {
            if (e) {
                if (e.cause.status == 304) {
                    // We don't do anything - the cached data is fine.
                    console.log("Matching e-tag");
                    bean.fire(reader,'ready');
                    return;
                }
                reader.retrieve = null;
                bean.fire(reader,"error",[e]);
                return;
            }

            // Clear out the cache since we have new data coming in
            console.log("Wiping out data");
            MASCP.Service.ClearCache(reader);

            var headers = data.data.shift();
            var dataset = {};
            var id_col = headers.indexOf(map.id);
            var databits = data.data;
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
                    dataset[id] = {};
                }
                var obj = dataset[id];
                var i;
                for (i = cols_to_add.length - 1; i >= 0; i--) {
                    if ( ! obj[cols_to_add[i].name] ) {
                        obj[cols_to_add[i].name] = [];
                    }
                    obj[cols_to_add[i].name] = obj[cols_to_add[i].name].concat((row[cols_to_add[i].index] || '').split(','));
                }
                obj.retrieved = data.retrieved;
                obj.title = data.title;
                obj.etag = data.etag;
            }
            reader.setData(doc,dataset);
        });
    }
    return reader;
};

})();
