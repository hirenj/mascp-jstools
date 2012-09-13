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

var scope = "https://docs.google.com/feeds/ https://spreadsheets.google.com/feeds/";

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

var get_document, get_document_list, authenticate;

if (typeof module != 'undefined' && module.exports){

    var nconf = require('nconf');
    nconf.env().argv();
    nconf.file('config.json');

    var google_client_id = nconf.get('google:client_id');
    var google_client_secret = nconf.get('google:client_secret');

    var access_token = null;
    var refresh_token = nconf.get('google:refresh_token');

    var with_google_authentication = function(callback) {
        if (access_token) {
            if (access_token.expiration < (new Date()) ) {
                access_token = null;
            }
        }

        if (access_token) {
            callback(access_token);
            return;
        }
        if (refresh_token) {
            refresh_authenticate(refresh_token,function(auth_details) {
                if ( ! auth_details ) {
                    callback(null);
                    return;
                }
                var expiration = new Date();
                expiration.setSeconds(expiration.getSeconds() + auth_details.expires_in);
                access_token = {
                    "token": auth_details.access_token,
                    "expiration": expiration
                };
                callback(access_token);
            });
            return;
        }
        new_authenticate(function(auth_details) {
            if ( ! auth_details ) {
                callback(null);
                return;
            }
            var expiration = new Date();
            expiration.setSeconds(expiration.getSeconds() + auth_details.expires_in);
            access_token = {
                "token": auth_details.access_token,
                "expiration": expiration
            };
            refresh_token = auth_details.refresh_token;
            nconf.set('google:refresh_token',refresh_token);
            nconf.save(function(err) {
                if (err) {
                    console.log("Could not write config");
                }
            });
            callback(access_token);
        });
    };

    var new_authenticate = function(auth_done) {
        var base = "https://accounts.google.com/o/oauth2/auth?";
        var enc_scope = encodeURIComponent(scope);
        var redirect_uri = encodeURIComponent("urn:ietf:wg:oauth:2.0:oob");
        var client_id = encodeURIComponent(google_client_id);
        var state = "login";
        console.log("Go to this URL:");
        console.log(base+"scope="+enc_scope+"&redirect_uri="+redirect_uri+"&response_type=code&client_id="+client_id);
        if ( ! repl || ! repl.repl ) {
            console.log("Not running in an interactive session - returning");
            auth_done(null);
            return;
        }
        var old_eval = repl.repl.eval;
        repl.repl.prompt = "Authentication code : ";
        repl.repl.eval = function(cmd,context,filename,callback) {
            repl.repl.prompt = "Gator data server > ";
            repl.repl.eval = old_eval;

            var re = /\n.*/m;
            cmd = cmd.replace(/\(/,'');
            cmd = cmd.replace(re,'');
            var querystring = require('querystring');
            var post_data = querystring.stringify({
                'code' : cmd,
                'client_id' : google_client_id,
                'client_secret' : google_client_secret,
                'redirect_uri' : "urn:ietf:wg:oauth:2.0:oob",
                'grant_type' : 'authorization_code'
            });
            var req = require('https').request(
                {
                    host: "accounts.google.com",
                    path: "/o/oauth2/token",
                    method: "POST",

                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Content-Length': post_data.length
                    }
                },function(res) {
                    res.setEncoding('utf8');
                    var data = "";
                    res.on('data',function(chunk) {
                        data += chunk;
                    });
                    res.on('end',function() {
                        var response = JSON.parse(data);

                        callback(null,"Authentication code validated");

                        auth_done(response);
                    });
                }
            );
            req.write(post_data);
            req.end();
        }
    };

    var refresh_authenticate = function(refresh_token,auth_done) {
        var querystring = require('querystring');
        var post_data = querystring.stringify({
            'client_id' : google_client_id,
            'client_secret' : google_client_secret,
            'refresh_token' : refresh_token,
            'grant_type' : 'refresh_token'
        });
        var req = require('https').request(
            {
                host: "accounts.google.com",
                path: "/o/oauth2/token",
                method: "POST",

                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': post_data.length
                }
            },function(res) {
                res.setEncoding('utf8');
                var data = "";
                res.on('data',function(chunk) {
                    data += chunk;
                });
                res.on('end',function() {
                    var response = JSON.parse(data);
                    auth_done(response);
                });
            }
        );
        req.write(post_data);
        req.end();
    };


    authenticate = function(cback) {
        with_google_authentication(function(auth_details) {
            if (auth_details) {
                MASCP.GOOGLE_AUTH_TOKEN = auth_details.token;
                if (cback) {
                    cback();
                }
            } else {
                console.log("Could not authorize");
            }
        });
    }

    get_document_list = function(callback) {    

        var headers_block = { 'GData-Version' : '3.0' };

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
        } else {
            var self_func = arguments.callee;
            authenticate(function() {
                self_func.call(null,callback);
            });
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
        if ( ! doc.match(/^spreadsheet/ ) ) {
            console.log("No support for retrieving things that aren't spreadsheets yet");
            return;
        }
        var doc_id = doc.replace(/^spreadsheet:/,'');

        var headers_block = { 'GData-Version' : '3.0' };

        var feed_type = 'public';

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
            feed_type = 'private';
        } else {
            var self_func = arguments.callee;
            authenticate(function() {
                self_func.call(null,doc,etag,callback);
            });
            return;
        }

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
                path: "/feeds/cells/"+doc_id+"/1/"+feed_type+"/basic?alt=json",
                headers: headers_block,
            },function(res) {
                res.setEncoding('utf8');
                if (res.statusCode != 200) {
                    callback.call(null,{ 'cause' : { 'status' : res.statusCode } } );
                    return;
                }
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

    MASCP.GoogledataReader.authenticate = authenticate;

} else {

    var get_document_using_script = function(doc_id,callback) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        var type = "public";
        var auth = "";
        script.type = 'text/javascript';
        script.setAttribute('id','ssheet-'+doc_id);
        if (MASCP.GOOGLE_AUTH_TOKEN) {
            auth = "&access_token="+MASCP.GOOGLE_AUTH_TOKEN;
            type = "private";
        }
        script.src = "https://spreadsheets.google.com/feeds/cells/"+doc_id+"/1/"+type+"/basic?alt=json-in-script&callback=cback"+doc_id+""+auth;
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
    };

    authenticate = function(cback) {
        if (! gapi || ! gapi.auth.authorize) {
            cback.call(null,{ "cause" : "No google auth library"});
            return;
        }
        if ( ! MASCP.GOOGLE_CLIENT_ID ) {
            cback.call(null, { "cause" : "No client ID set (MASCP.GOOGLE_CLIENT_ID)"});
            return;
        }
        var auth_settings = { client_id : MASCP.GOOGLE_CLIENT_ID, scope : scope, immediate : true };
        gapi.auth.authorize(auth_settings,function(result) {
            if (result && ! result.error) {
                MASCP.GOOGLE_AUTH_TOKEN = result.access_token;
                cback();
            } else {
                if ( auth_settings.immediate ) {
                    auth_settings.immediate = false;
                    gapi.auth.authorize(auth_settings,arguments.callee);
                }
            }
        });
        return;
    };


    get_document_list = function(callback) {    

        authenticate(function(err) {
            if (err) {
                callback.call(null,err);
                return;
            }
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
        });

    };

    get_document = function(doc,etag,callback) {
        if ( ! doc.match(/^spreadsheet/ ) ) {
            console.log("No support for retrieving things that aren't spreadsheets yet");
            return;
        }
        var doc_id = doc.replace(/^spreadsheet:/,'');
        

        get_document_using_script(doc_id,function(err,dat){
            if (err) {
                console.log("Retrying with authentication");
                authenticate(function(err) {
                    if (err) {
                        callback.call(null,err);
                        return;
                    }
                    var request = new XMLHttpRequest();
                    request.open("GET","https://spreadsheets.google.com/feeds/cells/"+doc_id+"/1/"+"private"+"/basic?alt=json");
                    request.setRequestHeader('Authorization','Bearer '+MASCP.GOOGLE_AUTH_TOKEN);
                    request.setRequestHeader('GData-Version','3.0');
                    if (etag) {
                        request.setRequestHeader('If-None-Match',etag);
                    }
                    request.onreadystatechange = function(evt) {
                        if (request.readyState == 4) {
                            if (request.status == 200) {
                                callback.call(null,null,parsedata(JSON.parse(request.responseText)));
                            } else {
                                callback.call(null,{'cause' : { 'status' : request.status }});
                            }
                        }
                    };
                    request.send();
                    //get_document_using_script(doc_id,callback);
                });
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
            reader.map = map;
            reader.setData(doc,data);
        });
    }
    return reader;
};

})();
