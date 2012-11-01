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
    retdata.retrieved = new Date((new Date(data.feed.updated.$t)).getTime());

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

var get_document, get_document_list, get_permissions, get_permissions_id, authenticate, do_request, update_or_insert_row, insert_row;

update_or_insert_row = function(doc,query,new_data,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');
    do_request("spreadsheets.google.com","/feeds/list/"+doc_id+"/1/private/full?sq="+encodeURIComponent(query)+"&alt=json",null,function(err,json) {
        if (json.feed.entry) {
            var last_entry = json.feed.entry.reverse().shift();
            var edit_url;
            last_entry.link.forEach(function(link) {
                if (link.rel == 'edit') {
                    edit_url = link.href;
                }
            });
            var reg = /.+?\:\/\/.+?(\/.+?)(?:#|\?|$)/;
            var path = reg.exec(edit_url)[1];
            do_request("spreadsheets.google.com",path+"?alt=json",last_entry['gd$etag'],function(err,json) {
                if (! err) {
                    insert_row(doc,new_data,callback);
                }
            },"DELETE");
        } else {
            insert_row(doc,new_data,callback);
        }
    });
};

insert_row = function(doc,new_data,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');

    var data = ['<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">'];
    for (var key in new_data) {
        data.push("<gsx:"+key+">");
        if (new_data[key] === null) {
            data.push('');
        } else {
            data.push(new_data[key]);
        }
        data.push("</gsx:"+key+">");
    }
    data.push("</entry>");
    do_request("spreadsheets.google.com","/feeds/list/"+doc_id+"/1/private/full",null,function(err,json) {
        if ( ! err ) {
            callback.call(null);
        } else {
            callback.call(null,err);
        }
    },"POST",data.join(''));
};

get_document_list = function(callback) {
    do_request("docs.google.com", "/feeds/default/private/full/-/spreadsheet?alt=json",null,function(err,data) {
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
};

get_permissions_id = function(callback) {
    do_request("www.googleapis.com","/drive/v2/about",null,function(err,data) {
        if (err) {
            callback.call(null,err);
            return;
        }
        callback.call(null,null,data.permissionId);
    });
}

get_permissions = function(doc,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');
    get_permissions_id(function(error,permissionId) {
        if ( error ) {
            callback.call(null,error);
            return;
        }
        do_request("www.googleapis.com","/drive/v2/files/"+doc_id+"/permissions",null,function(err,data){
            if (err) {
                if (err.cause && err.cause.status == '400') {
                    callback.call(null,null,{"write" : false, "read" : false});
                    return;
                }
                callback.call(null,err);
                return;
            }
            var writable = false;
            if ( ! data ) {
                callback.call(null,null,{"write" : false, "read" : false});
                return;
            }
            data.items.forEach(function(item) {
                if (item.id == permissionId && (item.role == 'owner' || item.role == 'writer')) {
                    writable = true;
                }
            });
            callback.call(null,null,{"write": writable, "read" : true});
        });
    });
};

get_document = function(doc,etag,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');

    var headers_block = { 'GData-Version' : '3.0' };

    var feed_type = 'private';

    do_request("spreadsheets.google.com","/feeds/cells/"+doc_id+"/1/"+feed_type+"/basic?alt=json",etag,function(err,json) {
        if ( ! err ) {
            callback.call(null,null,parsedata(json));
        } else {
            callback.call(null,err);
        }
    });
};

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
                    console.log("Problems with auth details");
                    callback(null);
                    return;
                }
                if ( auth_details.error && auth_details.error == 'invalid_grant') {
                    nconf.clear('google:refresh_token');
                    nconf.save(function(err) {
                        if (err) {
                            console.log("Could not write config");
                        }
                    });

                    refresh_token = null;
                    with_google_authentication(callback);
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
        var old_eval;

        if ( ! google_client_id || ! google_client_secret ) {
            console.log("Missing important authorisation information. Check that google:client_id and google:client_secret are set.");
            if ( ! repl || ! repl.repl ) {
                console.log("Not running in an interactive session - returning");
                auth_done(null);
                return;
            }
            old_eval = repl.repl.eval;
            console.log("Set client ID now? : [yN] ");
            repl.repl.eval = function(cmd,context,filename,callback) {
                var re = /\n.*/m;
                cmd = (cmd || "").replace(/\(/,'');
                cmd = cmd.replace(re,'');
                if (cmd.match(/[yY]/)) {
                    console.log("Enter client ID: ");
                    repl.repl.eval = function(cmd) {
                        cmd = (cmd || "").replace(/\(/,'');
                        cmd = cmd.replace(re,'');
                        google_client_id = cmd;
                        console.log("Enter client secret: ");
                        repl.repl.eval = function(cmd) {
                            cmd = (cmd || "").replace(/\(/,'');
                            cmd = cmd.replace(re,'');
                            repl.repl.eval = old_eval;
                            google_client_secret = cmd;
                            nconf.set('google:client_id',google_client_id);
                            nconf.set('google:client_secret',google_client_secret);
                            nconf.save(function(err) {
                                if (! err) {
                                    new_authenticate(auth_done);
                                } else {
                                    console.log("Error saving configuration");
                                    auth_done(null);
                                }
                            });
                        }
                    };
                } else {
                    repl.repl.prompt = "Gator data server > ";
                    repl.repl.eval = old_eval;
                    auth_done(null);
                }
                return;
            }
            return;
        }
        console.log("Go to this URL:");
        console.log(base+"scope="+enc_scope+"&redirect_uri="+redirect_uri+"&response_type=code&client_id="+client_id);
        console.log("Authentication code : ");
        if ( ! repl || ! repl.repl ) {
            console.log("Not running in an interactive session - returning");
            auth_done(null);
            return;
        }
        old_eval = repl.repl.eval;
        repl.repl.eval = function(cmd,context,filename,callback) {
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
                        if (response.error) {
                            console.log("Error validating authentication code");
                            auth_done(null);
                        } else {
                            auth_done(response);
                        }
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
                    cback.call(null);
                }
            } else {
                console.log("Could not authorize");
            }
        });
    }

    do_request = function(host,path,etag,callback,method,data) {
        var headers_block = { 'GData-Version' : '3.0' };
        var req_method = method || 'GET';
        if (req_method != 'GET') {
            headers_block = {};
        }
        if (req_method == "POST") {
            headers_block["Content-Type"] = "application/atom+xml";
        }
        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
        } else {
            var self_func = arguments.callee;
            authenticate(function() {
                self_func.call(null,host,path,etag,callback);
            });
            return;
        }
        if (etag) {
            headers_block["If-None-Match"] = etag;
        }
        var https = require('https');
        var req = https.request(
            {
                host: host,
                path: path,
                headers: headers_block,
                method: req_method
            },function(res) {
                res.setEncoding('utf8');
                var response = "";
                res.on('data',function(chunk) {
                    response += chunk;
                });
                res.on('end',function() {
                    if (res.statusCode > 300) {
                        callback.call(null,{ 'cause' : { 'status' : res.statusCode } } );
                        return;
                    }
                    var data = response.length > 0 ? (res.headers['content-type'].match(/json/) ? JSON.parse(response) : response ) : null;
                    callback.call(null,null,data);
                });
            }
        );
        if (data) {
            req.write(data);
        }
        req.end();
        req.on('error',function(err) {
            callback.call(null,{cause: err});
        });
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
    var initing_auth = false;
    var waiting_callbacks = [];

    authenticate = function(cback) {
        if (MASCP.GOOGLE_AUTH_TOKEN) {
            cback.call(null);
            return;
        }
        if (initing_auth) {
            waiting_callbacks.push(cback);
        }
        if (! gapi || ! gapi.auth || ! gapi.auth.authorize) {
            cback.call(null,{ "cause" : "No google auth library"});
            return;
        }
        if ( ! MASCP.GOOGLE_CLIENT_ID ) {
            cback.call(null, { "cause" : "No client ID set (MASCP.GOOGLE_CLIENT_ID)"});
            return;
        }
        var auth_settings = { client_id : MASCP.GOOGLE_CLIENT_ID, scope : scope, immediate : true };
        gapi.auth.authorize({immediate: true},function(){
        });
        initing_auth = true;
        gapi.auth.authorize(auth_settings,function(result) {
            if (result && ! result.error) {
                MASCP.GOOGLE_AUTH_TOKEN = result.access_token;
                window.setTimeout(function(){
                    console.log("Google token has timed out, forcing refresh");
                    delete MASCP["GOOGLE_AUTH_TOKEN"];
                },parseInt(result.expires_in)*1000);
                initing_auth = false;
                cback.call(null);
                waiting_callbacks.forEach(function(cb){
                    cb.call(null);
                });
                waiting_callbacks = [];
                return;
            } else if (result && result.error) {
                initing_auth = false;
                var error = { "cause" : result.error };
                cback.call(null,error);
                waiting_callbacks.forEach(function(cb){
                    cb.call(null,error);
                });
            } else {
                if ( auth_settings.immediate ) {
                    auth_settings.immediate = false;
                    gapi.auth.authorize(auth_settings,arguments.callee);
                    return;
                }
            }
        });
        return;
    };

    do_request = function(host,path,etag,callback,method,data) {
        authenticate(function(err) {
            if (err) {
                callback.call(null,err);
                return;
            }

            var request = new XMLHttpRequest();
            var req_method = method || 'GET';
            request.open(req_method,"https://"+host+path);
            request.setRequestHeader('Authorization','Bearer '+MASCP.GOOGLE_AUTH_TOKEN);
            if (req_method == 'GET') {
                request.setRequestHeader('GData-Version','3.0');
            }
            if (req_method == 'POST') {
                request.setRequestHeader('Content-Type','application/atom+xml');
            }
            if (etag) {
                request.setRequestHeader('If-None-Match',etag);
            }
            request.onreadystatechange = function(evt) {
                if (request.readyState == 4) {
                    if (request.status < 300) {
                        var datablock = request.responseText.length > 0 ? (request.getResponseHeader('Content-Type').match(/json/) ? JSON.parse(request.responseText) : request.responseText) : null;
                        callback.call(null,null,datablock);
                    } else {
                        callback.call(null,{'cause' : { 'status' : request.status }});
                    }
                }
            };
            request.send(data);
        });
    };

    var basic_get_document = get_document;

    get_document = function(doc,etag,callback) {
        if ( ! doc.match(/^spreadsheet/ ) ) {
            console.log("No support for retrieving things that aren't spreadsheets yet");
            return;
        }
        var doc_id = doc.replace(/^spreadsheet:/,'');

        if (etag || MASCP.GOOGLE_AUTH_TOKEN) {
            basic_get_document(doc,etag,callback);
        } else {
            get_document_using_script(doc_id,function(err,dat){
                if (err) {
                    basic_get_document(doc,etag,callback);
                } else {
                    callback.call(null,null,dat);
                }
            });
        }
    };
}

var render_site = function(renderer) {
    var self = this;
    var sites = self.result._raw_data.data.sites || [], i = 0, match = null;
    MASCP.registerLayer(self.datasetname,{ 'fullname' : self.result._raw_data.title });
    for (i = sites.length - 1; i >= 0; i--) {
        if (match = sites[i].match(/(\d+)/g)) {
            renderer.getAminoAcidsByPosition([parseInt(match[0])])[0].addToLayer(self.datasetname);
        }
    }
};

var render_peptides = function(renderer) {
    var self = this;
    var peptides = self.result._raw_data.data.peptides || [], i = 0, match = null;
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

MASCP.GoogledataReader.prototype.getPermissions = get_permissions;

MASCP.GoogledataReader.prototype.updateOrInsertRow = update_or_insert_row;

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
        MASCP.Service.FirstAgi(a_temp_reader,function(entry) {
            if ( ! entry ) {
                get_data(null);
                return;
            }

            var update_timestamps = {};
            if (typeof module == 'undefined' || ! module.exports && typeof window != 'undefined'){
                if (window.sessionStorage) {
                    update_timestamps = JSON.parse(window.sessionStorage.getItem("update_timestamps") || "{}");
                }
            }

            if (update_timestamps[doc] && ((new Date().getTime()) - update_timestamps[doc]) < 1000*60*120) {
                bean.fire(reader,'ready');
                return;
            }
            a_temp_reader.retrieve(entry,function() {
                get_data(this.result._raw_data.etag);
            });
        });
    })();

    var trans;

    var get_data = function(etag) {

        var update_timestamps = {};

        if (typeof module == 'undefined' || ! module.exports && typeof window != 'undefined'){
            if (window.sessionStorage) {
                update_timestamps = JSON.parse(window.sessionStorage.getItem("update_timestamps") || "{}");
            }
        }

        update_timestamps[doc] = new Date().getTime();

        if (typeof module == 'undefined' || ! module.exports && typeof window != 'undefined'){
            if (window.sessionStorage) {
                update_timestamps = window.sessionStorage.setItem("update_timestamps",JSON.stringify(update_timestamps));
            }
        }

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
            console.log("Wiping out data on "+data.title+" ("+doc+")");
            MASCP.Service.ClearCache(reader,null,function(error) {
                if (error) {
                    bean.fire(reader,"error",[error]);
                    return;
                }
                reader.map = map;
                reader.setData(doc,data);
            });
        });
    }
    return reader;
};

})();
