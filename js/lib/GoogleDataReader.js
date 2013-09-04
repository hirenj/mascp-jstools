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

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
    var o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) uri[o.q.name][$1] = $2;
    });

    return uri;
};

parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
        name:   "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};


// We want to store the locally cached files
// for all instances
var cached_files = {};
var etags = {};

var get_file_by_filename = function(filename,mime,callback) {
    if (cached_files[filename] && callback && MASCP["GOOGLE_AUTH_TOKEN"]) {
        callback.call(null,null,cached_files[filename]);
        return;
    }
    var query = encodeURIComponent("title='"+filename+"' and 'appdata' in parents and mimeType = '"+mime+"' and trashed = false");
    do_request("www.googleapis.com","/drive/v2/files?q="+query,null,function(err,data) {

        if (cached_files[filename] && callback) {
            callback.call(null,null,cached_files[filename]);
            return;
        }

        if (err && err.status == 401) {
            delete MASCP["GOOGLE_AUTH_TOKEN"];
        }

        if (err) {
            callback.call(null,err);
            return;
        }

        if (data.items.length == 0) {
            cached_files[filename] = {};
            callback.call(null,null,cached_files[filename]);
            return;
        }

        var item_id = data.items[0].id;
        etags[filename] = data.items[0].etag;
        if ( ! callback ) {
            return;
        }
        get_file({ "id" : item_id },null,function(err,data) {
            if (cached_files[filename]) {
                callback.call(null,null,cached_files[filename]);
                return;
            }
            if ( err ) {
                callback.call(null,err);
            }
            cached_files[filename] = data;
            callback.call(null,null,cached_files[filename],item_id);
        });
    });
};

var get_file = function(file,mime,callback) {
    if ( typeof(file) === 'string' ) {
        get_file_by_filename(file,mime,callback);
        return;
    }
    if (! file.id) {
        callback.call(null,{"error" : "No file id"});
        return;
    }
    var item_id = file.id;
    do_request("www.googleapis.com","/drive/v2/files/"+item_id,file.etag,function(err,data) {

        if ( err ) {
            callback.call(null,err);
            return;
        }

        var uri = parseUri(data.downloadUrl);

        file.etag = data.etag;

        do_request(uri.host,uri.relative,null,function(err,data) {
            if ( err ) {
                callback.call(null,err);
                return;
            }
            if ( ! data ) {
                data = {};
            }
            var ret_data;
            if (typeof data !== 'string') {
                ret_data = data;
            } else {
                ret_data = JSON.parse(data);
            }
            callback.call(null,null,ret_data,item_id);
        });
    });
};

var write_file_by_filename = function(filename,mime,callback) {
    if (! cached_files[filename]) {
        callback.call(null,{"error" : "No file to save"});
        return;
    }
    var query = encodeURIComponent("title='"+filename+"' and 'appdata' in parents and mimeType = '"+mime+"' and trashed = false");
    do_request("www.googleapis.com","/drive/v2/files?q="+query,null,function(err,data) {
        if ( ! cached_files[filename]) {
            return;
        }
        if (err) {
            callback.call(null,err);
            return;
        }
        var item_id = null;
        if (data.items && data.items.length == 0) {
            do_request("www.googleapis.com","/drive/v2/files/",null,arguments.callee, "POST:application/json",JSON.stringify({
                'parents': [{'id': 'appdata'}],
                "title" : filename,
                "mimeType" : mime,
                "description" : filename
            }));
            return;
        }
        if (data.items) {
            item_id = data.items[0].id;
        } else {
            item_id = data.id;
        }
        if (etags[filename] && data.items && etags[filename] !== data.items[0].etag ) {
            cached_files[filename] = null;
            etags[filename] = null;
            get_file(filename,mime,function() { });
            callback.call(null,{"cause" : "File too old"});
            return;
        }

        if ( ! cached_files[filename]) {
            return;
        }
        write_file( { "id" : item_id, "content" : cached_files[filename] },mime,function(err,data) {
            if (err) {
                if (err.status && err.status == 412) {
                    cached_files[filename] = null;
                    etags[filename] = null;
                    get_file(filename,mime,callback);
                }
                callback.call(null,err);
                return;
            }

            // cached_files[filename] = null;
            etags[filename] = null;
            get_file(filename,mime,null);
            callback.call(null,null,cached_files[filename]);

        });
    });
}

var create_file = function(file,mime,callback) {
    if ( typeof(file) === 'string' ) {
        write_file_by_filename(file,mime,callback);
        return;
    }
    if (file.id) {
        write_file(file,mime,callback);
        return;
    }
    var req_body = JSON.stringify({
        'parents': [{'id': file.parent }],
        "title" : file.name,
        "mimeType" : mime,
        "description" : file.name
    });

    do_request("www.googleapis.com","/drive/v2/files/",null,
        function(err,data) {
            if (err) {
                callback.call(null,err);
                return;
            }
            file.id = data.id;
            write_file(file,mime,callback);
        },
        "POST:application/json",req_body);
};

var write_file = function(file,mime,callback) {
    if ( typeof(file) === 'string' ) {
        write_file_by_filename(file,mime,callback);
        return;
    }
    if ( ! file.id ) {
        callback.call(null,{"error" : "No file id"});
        return;
    }
    var item_id = file.id;
    var string_rep;

    if ( ! file.content ) {
        callback.call();
        return;
    }

    try {
        string_rep = JSON.stringify(file.content);
    } catch (e) {
        callback.call(null,{"status" : "JSON error", "error" : e });
        return;
    }

    item_id = file.id;

    // CORS requests are not allowed on this domain for uploads for some reason, we need to use
    // the wacky Google uploader, but the commented out bit should work for when they finally
    // allow the CORS request to go through

    var headers_block = {
        'Content-Type' : mime
    };

    if (file.etag) {
        // headers_block['If-Match'] = file.etag;
    }

    var req = gapi.client.request({
        'path' : "/upload/drive/v2/files/"+item_id,
        'method' : "PUT",
        'params' : { "uploadType" : "media"},
        'headers' : headers_block,
        'body' : string_rep
    });

    req.execute(function(isjson,data) {
        if (isjson && isjson.error && isjson.error.code == 412) {
            callback.call(null,{"status" : 412, "message" : "E-tag mismatch" });
            return;
        }
        if ( ! isjson ) {
            callback.call(null,{"status" : "Google error", "response" : response});
            return;
        }
        callback.call(null,null,file.content);
    });

    // do_request("www.googleapis.com","/upload/drive/v2/files/"+item_id+"?uploadType=media",null,function(err,data) {

    //     if ( err ) {
    //         callback.call(null,err);
    //         return;
    //     }
    //     callback.call(null,null,cached_files[filename]);
    // }, "PUT:"+mime,JSON.stringify(cached_files[filename]));
};

get_permissions = function(doc,callback) {
    var doc_id = doc.replace(/^file:/,'');
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
    var is_spreadsheet = true;
    if ( ! doc.match(/^spreadsheet/ ) ) {
        is_spreadsheet = false;
        // console.log("No support for retrieving things that aren't spreadsheets yet");
        // return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');

    var headers_block = { 'GData-Version' : '3.0' };

    var feed_type = 'private';
    if (is_spreadsheet) {
        do_request("spreadsheets.google.com","/feeds/cells/"+doc_id+"/1/"+feed_type+"/basic?alt=json",etag,function(err,json) {
            if ( ! err ) {
                if (json) {
                    callback.call(null,null,parsedata(json));
                } else {
                    callback.call(null,{ "cause" : "No data" } );
                }
            } else {
                callback.call(null,err);
            }
        });
    } else {
        do_request("www.googleapis.com","/drive/v2/files/"+doc_id,etag,function(err,data) {
            if ( ! err ) {
                var uri = parseUri(data.downloadUrl);
                var title = data.title;
                var etag = data.etag;
                do_request(uri.host,uri.relative,null,function(err,json) {
                    if (err) {
                        callback.call(null,err);
                    } else {
                        json.etag = etag;
                        json.title = title || doc_id;
                        callback.call(null,null,json);
                    }
                });
            } else {
                if (err.cause && err.cause.status == 401) {
                    delete MASCP["GOOGLE_AUTH_TOKEN"];
                }
                callback.call(null,err);
            }
        });
    }
};

if (typeof module != 'undefined' && module.exports){

    var nconf = require('nconf');
    nconf.env('__').argv();
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
                console.log("We didn't get back auth details");
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
                } else {
                    console.log("Successful retrieval of auth details");
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
        if ( ! repl || ! repl.repl ) {
            console.log("Not running in an interactive session - returning");
            auth_done(null);
            return;
        }
        if (repl.repl.running) {
            console.log("Already asking for auth info");
            auth_done(null);
            return;
        }
        console.log("Go to this URL:");
        console.log(base+"scope="+enc_scope+"&redirect_uri="+redirect_uri+"&response_type=code&client_id="+client_id);
        console.log("Authentication code : ");
        repl.repl.running = true;
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

                        if (response.error) {
                            console.log("Error validating authentication code");
                            delete repl.repl.running;
                            auth_done(null);
                        } else {
                            callback(null,"Authentication code validated");
                            delete repl.repl.running;
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
                if (cback) {
                    cback.call(null,{"cause" : "Could not authorize"});
                }
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

        if (req_method.match(/:/)) {
            headers_block['Content-Type'] = req_method.split(':')[1];
            req_method = req_method.split(':')[0];
        }

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
        } else {
            var self_func = arguments.callee;
            authenticate(function(err) {
                if ( ! err ) {
                    self_func.call(null,host,path,etag,callback);
                } else {
                    callback.call(null,err);
                }
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
    scope = "https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive https://spreadsheets.google.com/feeds/";

    var get_document_using_script = function(doc_id,callback,tryauth) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        var type = "public";
        var auth = "";
        script.type = 'text/javascript';
        script.setAttribute('id','ssheet-'+doc_id);
        if (MASCP.GOOGLE_AUTH_TOKEN && tryauth ) {
            auth = "&access_token="+MASCP.GOOGLE_AUTH_TOKEN;
            type = "private";
        }
        script.src = "https://spreadsheets.google.com/feeds/cells/"+doc_id+"/1/"+type+"/basic?alt=json-in-script&callback=cback"+doc_id+""+auth;
        var error_function = function(e) {
            if (window.removeEventListener) {
                window.removeEventListener('error',error_function);
            }
            if (script.parentNode) {
                script.parentNode.removeChild(script);
                callback.call(null,{ "cause" : { "status" : "" }, "message" : "Could not load data via script tag" } ,doc_id);
            }
        };
        script.addEventListener('error', error_function ,false);
        window.addEventListener('error', error_function, false);

        window["cback"+doc_id] = function(dat) {
            delete window["cback"+doc_id];
            if (window.removeEventListener) {
                window.removeEventListener('error',error_function);
            }
            callback.call(null,null,parsedata(dat));
        }
        try {
            head.appendChild(script);
        } catch (e) {
            callback.call(null,{"cause" : { "status" : "" }, "object" : e});
        }
    };
    var initing_auth = false;
    var waiting_callbacks = [];
    var has_failed_once = false;

    authenticate = function(cback,noevent) {
        if ( ! ("withCredentials" in (new XMLHttpRequest()))) {
            cback.call(null,{"cause" : "Browser not supported"});
            return;
        }

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            cback.call(null);
            return;
        }
        if (initing_auth) {
            waiting_callbacks.push(cback);
            return;
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
        //gapi.auth.authorize({immediate: true},function(){});
        initing_auth = true;
        var user_action = true;
        if (noevent) {
            user_action = false;
        }
        if (window.event) {
            user_action = window.event ? window.event.which : null;
        }

        if (! window.event && "event" in window) {
            user_action = false;
        }
        if (! user_action && has_failed_once) {
            initing_auth = false;
            cback.call(null,{"cause" : "No user event" });
            return;
        }
        setTimeout(function() {

        var timeout = setTimeout(function() {
            initing_auth = false;
            var error = { "cause" : "Failed to return from auth" };
            cback.call(null,error);
            waiting_callbacks.forEach(function(cb){
                if (cb !== cback) {
                    cb.call(null,error);
                }
            });
            waiting_callbacks = [];
            return;
        },3000);

        gapi.auth.authorize(auth_settings,function(result) {
            clearTimeout(timeout);
            if (result && ! result.error) {
                MASCP.GOOGLE_AUTH_TOKEN = result.access_token;
                window.setTimeout(function(){
                    console.log("Google token has timed out, forcing refresh");
                    delete MASCP["GOOGLE_AUTH_TOKEN"];
                },parseInt(result.expires_in)*1000);
                initing_auth = false;
                cback.call(null);
                waiting_callbacks.forEach(function(cb){
                    if (cb !== cback) {
                        cb.call(null);
                    }
                });
                waiting_callbacks = [];
                return;
            } else if (result && result.error) {
                initing_auth = false;
                var error = { "cause" : result.error };
                cback.call(null,error);
                waiting_callbacks.forEach(function(cb){
                    if (cb !== cback) {
                        cb.call(null,error);
                    }
                });
                waiting_callbacks = [];
            } else {
                initing_auth = false;
                if ( auth_settings.immediate ) {
                    if (! user_action ) {
                        var auth_func = function(success) {
                            auth_settings.immediate = false;
                            gapi.auth.authorize(auth_settings,function(result) {
                                if (result && ! result.error) {
                                    MASCP.GOOGLE_AUTH_TOKEN = result.access_token;
                                    window.setTimeout(function(){
                                        console.log("Google token has timed out, forcing refresh");
                                        delete MASCP["GOOGLE_AUTH_TOKEN"];
                                    },parseInt(result.expires_in)*1000);
                                    success.call(null);
                                } else {
                                    success.call(null,{ "cause" : result ? result.error : "No auth result" });
                                }
                            });
                        };
                        has_failed_once = true;
                        cback.call(null,{"cause" : "No user event", "authorize" : auth_func });
                        if (waiting_callbacks) {
                            waiting_callbacks.forEach(function(cb) {
                                if (cb !== cback) {
                                    cb.call(null, {"cause" : "No user event", "authorize" : auth_func });
                                }
                            });
                            waiting_callbacks = [];
                        }
                        return;
                    }
                    auth_settings.immediate = false;
                    gapi.auth.authorize(auth_settings,arguments.callee);
                    return;
                }
            }
        });
        },1);
        return;
    };

    do_request = function(host,path,etag,callback,method,data) {
        authenticate(function(err) {
            if (err) {
                callback.call(null,err);
                return;
            }

            var request = new XMLHttpRequest();
            if (! ('withCredentials' in request) ) {
                callback.call(null, {'cause' : 'Browser not supported'});
                return;
            }
            var req_method = method || 'GET';
            try {
                request.open(req_method.replace(/:.*/,''),"https://"+host+path);
            } catch (e) {
                callback.call(null,{ 'cause' : "Access is denied.", 'error' : e, 'status' : 0 });
                return;
            }
            request.setRequestHeader('Authorization','Bearer '+MASCP.GOOGLE_AUTH_TOKEN);
            if (req_method == 'GET') {
                request.setRequestHeader('GData-Version','3.0');
            }
            if (req_method == 'POST') {
                request.setRequestHeader('Content-Type','application/atom+xml');
            }
            if (req_method.match(/:/)) {
                request.setRequestHeader('Content-Type',req_method.split(':')[1]);
                req_method = req_method.split(':')[0];
            }
            if (etag && req_method !== 'PUT') {
                request.setRequestHeader('If-None-Match',etag);
            }
            if (etag && req_method == 'PUT' ) {
                request.setRequestHeader('If-Match',etag);
            }
            request.onreadystatechange = function(evt) {
                if (request.readyState == 4) {
                    if (request.status < 300 && request.status >= 200) {
                        var datablock = request.responseText.length > 0 ? (request.getResponseHeader('Content-Type').match(/json/) ? JSON.parse(request.responseText) : request.responseText) : null;
                        if (callback !== null) {
                            callback.call(null,null,datablock);
                        }
                        callback = null;
                    } else {
                        if (callback !== null) {
                            callback.call(null,{'cause' : { 'status' : request.status }});
                        }
                        callback =  null;
                    }
                }
            };
            request.send(data);
        });
    };

    var basic_get_document = get_document;
    get_document = function(doc,etag,callback) {
        if ( ! doc && callback ) {
            authenticate(callback,true);
            return;
        }
        var is_spreadsheet = true;
        if ( ! doc.match(/^spreadsheet/ ) ) {
            is_spreadsheet = false;
        }
        var doc_id = doc.replace(/^spreadsheet:/g,'');
        if (! is_spreadsheet || etag || MASCP.GOOGLE_AUTH_TOKEN) {
            basic_get_document(doc,etag,function(err,dat) {
                if (err) {
                    if (err.cause && err.cause.status == 304) {
                        callback.call(null,err);
                        return;
                    }
                    get_document_using_script(doc_id,function(err,dat) {
                        if (err) {
                            get_document_using_script(doc_id,callback,true);
                        } else {
                            callback(null,err,dat);
                        }
                    },false);
                } else {
                    callback.call(null,null,dat);
                }
            });
        } else {
            get_document_using_script(doc_id,function(err,dat){
                if (err) {
                    basic_get_document(doc,etag,function(err,dat) {
                        if (err) {
                            if (err.cause == "No user event" || err.cause == "Access is denied.") {
                                callback.call(null,err);
                                return;
                            }
                            get_document_using_script(doc_id,callback,true);
                        } else {
                            callback.call(null,null,dat);
                        }
                    });
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

MASCP.GoogledataReader.prototype.getPreferences = function(prefs_domain,callback) {
    if ( ! prefs_domain ) {
        prefs_domain = "MASCP GATOR PREFS";
    }
    return get_file(prefs_domain,"application/json; data-type=domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.writePreferences = function(prefs_domain,callback) {
    return write_file(prefs_domain,"application/json; data-type=domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.createPreferences = function(folder,callback) {
    return create_file({ "parent" : folder, "content" : {}, "name" : "New annotation session" }, "application/json; data-type=domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.getSyncableFile = function(file,callback) {
    var file_block = { "getData" : function() { return "Not ready"; }};
    get_file(file,"application/json",function(err,filedata,file_id) {
        if (err) {
            callback.call(null,err);
        }
        file_block.getData = function() {
            return filedata;
        };
        var timeout = null;
        var original_sync;
        file_block.sync = function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            timeout = setTimeout(function() {
                var wanting_new_sync = false;
                file_block.sync = function() {
                    wanting_new_sync = true;
                };
                write_file(file,"application/json",function(err) {
                    timeout = null;
                    file_block.sync = original_sync;
                    if (wanting_new_sync) {
                        file_block.sync();
                    }
                });
            },500);
        };
        original_sync = file_block.sync;
        // We disable permissions checking here, since the method is not supported for app settings
        if (false && file_id) {
            get_permissions(file_id,function(err,permissions) {
                file.permissions = permissions;
                bean.fire(file_block,'ready');
                callback.call(null,null,file_block);
            });
        } else {
            file_block.permissions = { "read" : true, "write" : true };
            bean.fire(file_block,'ready');
            callback.call(null,null,file_block);
        }
    });
    return file_block;
};

MASCP.GoogledataReader.prototype.addWatchedDocument = function(prefs_domain,doc_id,parser_function,callback) {
    var self = this;
    var reader = (new MASCP.GoogledataReader()).createReader(doc_id,parser_function);

    reader.bind('error',function(err) {
        callback.call(null,err);
    });

    reader.bind('ready',function() {
        var title = this.title;
        self.getPreferences(prefs_domain,function(err,prefs) {
            if (err) {
                callback.call(null,{ "status" : "preferences", "original_error" : err });
                return;
            }

            if ( ! prefs.user_datasets ) {
                prefs.user_datasets = {};
            }

            prefs.user_datasets[reader.datasetname] = prefs.user_datasets[reader.datasetname] || {};
            prefs.user_datasets[reader.datasetname].parser_function = parser_function.toString();
            prefs.user_datasets[reader.datasetname].title = title;

            self.writePreferences(prefs_domain,function(err,prefs) {
                if (err) {
                    callback.call(null,{ "status" : "preferences", "original_error" : err });
                    return;
                }
                callback.call(null,null,title);
            });
        });
    });
};

MASCP.GoogledataReader.prototype.removeWatchedDocument = function(prefs_domain,doc_id,callback) {
    var self = this;
    self.getPreferences(prefs_domain,function(err,prefs) {
        if (err) {
            callback.call(null,{ "status" : "preferences", "original_error" : err });
            return;
        }

        if ( ! prefs.user_datasets ) {
            prefs.user_datasets = {};
        }
        if (doc_id in prefs.user_datasets) {
            delete prefs.user_datasets[doc_id];
        } else {
            callback.call();
        }

        self.writePreferences(prefs_domain,function(err,prefs) {
            if (err) {
                callback.call(null,{ "status" : "preferences", "original_error" : err });
                return;
            }
            callback.call();
        });
    });
};

MASCP.GoogledataReader.prototype.listWatchedDocuments = function(prefs_domain,callback) {
    this.getPreferences(prefs_domain,function(err,prefs) {
        if (err) {
          if (err.cause === "No user event") {
            console.log("Consuming no user event");
            return;
          }
          callback.call(null,{ "status" : "preferences", "original_error" : err });
          return;
        }
        var sets = prefs.user_datasets;
        callback.call(null,null,sets);
    });
};

MASCP.GoogledataReader.prototype.readWatchedDocuments = function(prefs_domain,callback) {
    var self = this;
    self.getPreferences(prefs_domain,function(err,prefs) {
        if (err) {
          if (err.cause === "No user event") {
            console.log("Consuming no user event");
            return;
          }
          if (err.cause == "Browser not supported") {
            console.log("Consuming no browser support");
            return;
          }
          callback.call(null,{ "status" : "preferences", "original_error" : err });
          return;
        }
        var sets = prefs.user_datasets;
        for (var set in sets) {
          (function() {
            var pref = sets[set];

            if ( ! sets[set].parser_function ) {
              return;
            }

            var parser = eval("("+sets[set].parser_function+")");
            var a_reader = self.createReader(set,parser);

            a_reader.bind('ready',function() {
                callback.call(null,null,pref,a_reader);
            });
            a_reader.bind('error',function(err) {
                callback.call(null,{"error" : err });
            });
          })();
        }
    });
};

/*
map = {
    "peptides" : "column_a",
    "sites"    : "column_b",
    "id"       : "uniprot_id"
}
*/
MASCP.GoogledataReader.prototype.createReader = function(doc, map) {
    var self = this;
    var reader = new MASCP.UserdataReader(null,null);
    reader.datasetname = doc;
    reader.setupSequenceRenderer = setup;

    MASCP.Service.CacheService(reader);

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
                    console.log("Matching e-tag for "+doc);
                    bean.fire(reader,'ready');
                    return;
                }
                reader.retrieve = null;
                bean.fire(reader,"error",[e]);
                return;
            }
            if ( ! map ) {
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
    };

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
                console.log("Update timestamp < 2 hours, not refreshing data for "+doc);
                bean.fire(reader,'ready');
                return;
            }
            a_temp_reader.retrieve(entry,function() {
                get_data( (this.result && this.result._raw_data) ? this.result._raw_data.etag : null);
            });
        });
    })();

    return reader;
};

})();
