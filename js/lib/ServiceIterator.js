import UserdataReader from './UserdataReader';
import GatorDataReader from './GatorDataReader';
import JSandbox from '../jsandbox';
import Service from './Service';
import CachingService from './ServiceCaching';

var already_seen_set = {};
var service_from_config = function(set,pref,callback) {
    if ( ! pref ) {
        return;
    }
    if ( pref.type == "gatorURL" ) {
        var reader = new UserdataReader(null, set);
        reader.datasetname = pref.title;
        reader.requestData = function() {
            var agi = this.agi.toLowerCase();
            var urlpart = set.split('#')[0];
            var gatorURL = urlpart.slice(-1) == '/' ? urlpart+agi : urlpart+'/'+agi;
            return {
                type: "GET",
                dataType: "json",
                url : gatorURL,
                data: { 'agi'       : agi,
                        'service'   : this.datasetname
                }
            };
        };
        callback.call(null,null,pref,reader);
        return;
    }

    if ( pref.type == "data" ) {
        var reader = new UserdataReader();
        reader.map = function(data) {
            var results = {};
            for (var key in data) {
                if (key == "retrieved" || key == "title") {
                    continue;
                }
                if ( ! data[key].data ) {
                    results[key] = {'data' : data[key]};
                } else {
                    results[key] = data;
                }
                results[key].retrieved = data.retrieved;
                results[key].title = data.title;

            }
            return results;
        };
        reader.bind('ready',function() {
            callback.call(null,null,pref,reader);
        });
        reader.setData(set,pref.data);
        return;
    }
    if ( pref.type == "reader" ) {
        callback.call(null,null,pref,pref.reader);
        return;
    }

    if (pref.type == 'dataset') {
        var a_reader = GatorDataReader.createReader(set);
        a_reader.bind('ready',function() {
            if (parser) {
                parser.terminate();
            }
            callback.call(null,null,pref,a_reader);
            callback = function() {};
        });
        a_reader.bind('error',function(err) {
            callback.call(null,{"error" : err },pref);
            callback = function() {};
        });
        return;
    }

    // If we wish to load complete datasets
    // and store them browser-side, we need
    // a parser function to grab the dataset.

    if ( ! pref.parser_function ) {
      return;
    }

    if (JSandbox && /^(https?:)?\/?\//.test(set)) {
      var sandbox = new JSandbox();
      var parser;
      sandbox.eval('var sandboxed_parser = '+pref.parser_function+';',function() {
        var box = this;
        parser = function(datablock,cback) {
            box.eval({ "data" : "sandboxed_parser(input.datablock)",
                        "input" : {"datablock" : datablock },
                        "callback" : function(r) {
                            cback.call(null,r);
                            box.terminate();
                        },
                        "onerror" : function(err) {
                            console.log("Parser error");
                            cback.call(null,null);
                        }
                    });
        };
        parser.callback = true;
        parser.terminate = function() {
            if (sandbox) {
                sandbox.terminate();
            }
        };


        // Right now we only download stuff from Google Drive
        // We should be able to download stuff from other datasources too
        if (/^(https?:)?\/?\//.test(set)) {
            Service.request(set,function(err,data) {
                if (err) {
                    callback.call(null,{"error" : err},pref);
                    return;
                }

                var reader = new UserdataReader(null,null);

                reader.datasetname = pref.title;

                if (already_seen_set[set]) {
                    CachingService.CacheService(reader);
                    callback.call(null,null,pref,reader);
                    return;
                }
                already_seen_set[set] = true;


                reader.bind('ready',function() {
                    if (parser) {
                        parser.terminate();
                    }
                    callback.call(null,null,pref,reader);
                });

                reader.bind('error',function(err) {
                    if (parser) {
                        parser.terminate();
                    }
                    callback.call(null,{"error" : err},pref);
                });

                CachingService.ClearCache(reader,null,function(error) {
                    if (error) {
                        bean.fire(reader,"error",[error]);
                        return;
                    }
                    reader.map = parser;
                    reader.setData(pref.title,data);
                });

            });
            return;
        }

      });

    } else {
        console.log("No sandbox support - not trying to get data for "+pref.title);
        callback.call(null,{"error" : "No sandbox support"});
        return;
    }

};

let IterateFromConfig = function(configuration,callback) {
    if (! configuration ) {
        return;
    }
    for (var set in configuration) {
        service_from_config(set,configuration[set],callback);
    }
};

export default IterateFromConfig;