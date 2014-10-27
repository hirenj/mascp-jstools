
/** @fileOverview   Classes for reading data from the AtChloro database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}


/*

  "accepted_domains" : {
    "type" : "gatorURL",
    "url"  : "http://localhost:3000/data/latest/spreadsheet:0Ai48KKDu9leCdHM5ZXRjdUdFWnQ4M2xYcjM3S0Izdmc" 
    },

*/

/*

  "accepted_domains" : {
    "type" : "googleFile",
    "file"  : "User specified domains"
    },


*/


(function() {

  var editing_enabled = false;

  MASCP.DomainRetriever = MASCP.buildService(function(data) {
    this._raw_data = data;
    return this;
  });

  MASCP.DomainRetriever.prototype.requestData = function() {
    var url = this._endpointURL;
    if (Array.isArray(url)) {
      return this.requestDataWithUniprot();
    }
    var agi = this.agi.toLowerCase();
    var gatorURL = url.slice(-1) == '/' ? url+agi : url+'/'+agi;
    return {
        type: "GET",
        dataType: "json",
        url : gatorURL,
        data: { 'agi'       : agi
        }
    };
  };

  MASCP.DomainRetriever.prototype.requestDataWithUniprot = function() {
      var self = this;
      var urls = this._endpointURL;
      var results = {};

      var merge_hash = function(h1,h2) {
          var key;
          for (key in h2.data) {
              h1.data[key] = h2.data[key];
          }
          return h1;
      };

      var check_result = function(err) {
          if (err && err !== "No data") {
              bean.fire(self,"error",[err]);
              bean.fire(MASCP.Service,'requestComplete');
              self.requestComplete();
              check_result = function() {};
              return;
          }
          if (results['uniprot'] && results['full']) {
              self._dataReceived(merge_hash(results['uniprot'],results['full']));
              self.gotResult();
              self.requestComplete();
          }
      };

      urls.forEach(function(url) {
        var self_runner;
        var type = 'uniprot';
        if (url.indexOf('uniprot') >= 0) {
          self_runner = new MASCP.UniprotDomainReader();
        } else {
          type = 'full';
          self_runner = new MASCP.DomainRetriever(null,url);
        }
        self_runner.retrieve(self.agi,function(err) {
          if ( ! err ) {
            results[type] = this.result._raw_data;
          } else {
            results[type] = {};
          }
          check_result(err);
        });
        return;
      });

      return false;
  };

  MASCP.DomainRetriever.getRawData = function(config,callback) {
    if (config.type === "gatorURL") {
      callback.call({"error" : "Can't get raw data from GATOR URL, missing accession"});
      // Unless this is an S3 url?
      return;
    }
    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,file.getData(),file.permissions,file.owner);
      });
      return;
    }
    if (config.type === "url") {
      if ( ! sessionStorage.wanted_domains ) {
        sessionStorage.wanted_domains = "{}";
      }
      var cached_files = JSON.parse(sessionStorage.wanted_domains);
      if (cached_files[config.url]) {
        callback.call(null, null, JSON.parse(cached_files[config.url]));
        return;
      }
      MASCP.Service.request(config.url,function(err,data) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,data);
      });
    }
  };

  var retrieve_accepted_domains = function(config,acc,callback) {
    if (config && Array.isArray(config)) {
      var configs_array = [].concat(config);
      var current = configs_array.shift();
      retrieve_accepted_domains(current,acc,function(err,accepted) {
        if (! err ) {
          callback.call(null,err,accepted);
        } else {
          current = configs_array.shift();
          if (current) {
            retrieve_accepted_domains(current,acc,arguments.callee);
            return;
          }
          callback.call(null,err,accepted);
        }
      });
      return;
    }
    if (config.type === "gatorURL") {
      var datareader = new MASCP.UserdataReader(null, config.url);
      datareader.requestData = MASCP.DomainRetriever.prototype.requestData;

     // datareader.datasetname = "domains";
    // datareader.datasetname = "spreadsheet:0Ai48KKDu9leCdHM5ZXRjdUdFWnQ4M2xYcjM3S0Izdmc";
      datareader.retrieve(acc,function(err) {
        if (err) {
          if (typeof err == "string") {
            err = { "error" : err };
          }
          callback.call(null,err);
          return;
        }
        var wanted_domains = null;
        if (this.result) {
          wanted_domains = this.result._raw_data.data.domains;
        }
        callback.call(null,null,wanted_domains);
      });
    }
    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        var user_wanted = file.getData();
        if (acc in user_wanted) {
          var wanted = [];
          var data_hash = JSON.parse(user_wanted[acc]);
          for (var key in data_hash) {
            if (data_hash.hasOwnProperty(key)) {
              wanted.push(key.replace("dom:",""));
            }
          }
          callback.call(null,null,data_hash ? wanted : null);
        } else {
          callback.call(null,{"error" : "No data" },null);
        }
      });
    }
    if (config.type === "url") {
      if ( ! sessionStorage.wanted_domains ) {
        sessionStorage.wanted_domains = "{}";
      }
      var cached_files = JSON.parse(sessionStorage.wanted_domains);
      if (cached_files[config.url]) {
        callback.call(null, null, JSON.parse(cached_files[config.url])[acc]);
        return;
      }
      MASCP.Service.request(config.url,function(err,data) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,data ? data[acc] : null );
      });
    }
  };

  var check_accepted_domains_writable = function(config,callback) {

    // Only select the first file for writing domains to
    if (config && Array.isArray(config)) {
      config = config[0];
    }

    // We can only write to a googleFile

    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,file.permissions.write);
      });
      return;
    }

    callback.call(null,null,false);
  };

  var cached_file_blocks = {};

  var get_syncable_file = function(config,callback) {
    var id_string = "";
    var mime = "application/json";
    var file_block = {};
    if (typeof config.file == "string") {
      id_string = config.file;
      file_block = config.file;
    } else {
      id_string = config.file.file_id;
      file_block = { "id" : config.file.file_id };
      mime = "application/json; data-type=domaintool-domains";
    }
    var file = cached_file_blocks[id_string];
    if (file) {
      if (! file.ready) {
        bean.add(file,'ready',function() {
          bean.remove(file,'ready',arguments.callee);
          callback.call(null,null,file);
        });
        return;
      }
      callback.call(null,null,file);
      return;
    }
    cached_file_blocks[id_string] = (new MASCP.GoogledataReader()).getSyncableFile(file_block,callback,mime);
  };

  var update_accepted_domains = function(config,callback) {
    // Only select the first file for writing domains to
    if (config && Array.isArray(config)) {
      config = config[0];
    }

    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,file.getData());
        file.sync();
      });
      return;
    }

    callback.call();
  };


  var get_accepted_domains = function(acc,next) {
    var self = this;
    var next_call = function(accepted_domains) {
      return function() {
        // We should just pretend we got data back
        var all_domains = self.result._raw_data.data;
        filter_domains(all_domains,accepted_domains,acc,function(domains) {
          next(acc,domains);
        });
      };
    };

    var use_default_accepted = next_call([]);

    self.preferences.getPreferences(function(err,prefs) {
      if (prefs && prefs.accepted_domains) {
        retrieve_accepted_domains(prefs.accepted_domains,acc,function(err,wanted_domains) {
          if (err) {
            if (err.status == 403) {
              next_call([])();
              return;
            }
            if (err.error !== "No data") {
              console.log("Some problem");
              return;
            }
            wanted_domains = null;
          }
          next_call(wanted_domains)();
        });
      }
    });
  };

  var filter_domains = function(all_domains,wanted_domains,acc,callback) {
    var results = {};
    if (! wanted_domains ) {
      callback.call(null,all_domains);
      return all_domains;
    }
    all_domains = all_domains || {};
    for (var dom in all_domains) {
      if (! all_domains.hasOwnProperty(dom)) {
        continue;
      }
      var dom_key = dom.replace(/\s/g,'_');
      if (wanted_domains.indexOf(dom_key) >= 0) {
        results[dom] = all_domains[dom];
      }
      if (dom_key.match(/GlcNAc/)) {
        results[dom] = all_domains[dom];
      }
    }
    if (all_domains["tmhmm-TMhelix"]) {
      results["tmhmm-TMhelix"] = all_domains["tmhmm-TMhelix"];
    }
    callback.call(null,results);
    return results;
  };

  var render_domains = function(renderer,domains,acc,track,offset,namespace) {
      var target_layer = track || acc.toString();
      renderer.text_els = [];
      MASCP.registerLayer(target_layer, { 'fullname' : "All domains", 'color' : '#aaaaaa' },[renderer]);
      var domain_keys = [];
      for (var domain in domains) {
        domain_keys.push(domain);
      }
      domain_keys.sort(function(a,b) {
        if (a == 'SIGNALP') {
          return 1;
        }
        if (b == 'SIGNALP') {
          return -1;
        }
        if (a == 'tmhmm-TMhelix') {
          return 1;
        }
        if (b == 'tmhmm-TMhelix') {
          return -1;
        }
        return a.localeCompare(b);
      });
      domain_keys.forEach(function(dom) {
        var lay_name = "dom:"+dom;
        lay_name = lay_name.replace(/\s/g,'_');
        if (dom == "KDEL") {
          domains[dom].peptides.push([ renderer.sequence.length - 3, renderer.sequence.length  ]);
        }
        var track_name = domains[dom].name;
        if ( dom == "tmhmm-TMhelix") {
          track_name = "TM Transmembrane";
        }
        if ( dom == "tmhmm-outside") {
          return;
        }
        if ( dom == "tmhmm-inside") {
          return;
        }

        MASCP.registerLayer(lay_name, { 'fullname' : track_name || dom, 'color' : '#aaaaaa' },[renderer]);
        renderer.trackOrder.push(lay_name);
        if (editing_enabled) {
          renderer.showLayer(lay_name);
        }
        var done_anno = false;
        var seen = {};
        domains[dom].peptides.forEach(function(pos) {
          var start = parseInt(pos[0]);
          var end = parseInt(pos[1]);
          if (isNaN(start)) {
            return;
          }
          if (seen[start]) {
            return;
          }

          if ((dom == "tmhmm-TMhelix") && domains["SIGNALP"]) {
            var signalp_end = parseInt(domains["SIGNALP"].peptides[0][1]);
            if ( (signalp_end >= end) || (start <= signalp_end) ) {
              return;
            }
          }
          seen[start] = true;
          if (start == end) {
            var shape_func   =  /N\-linked.*GlcNAc/.test(dom)    ? "glcnac(b1-4)glcnac" :
                                /GlcNAc/.test(dom)    ? "glcnac" :
                                /GalNAc/.test(dom)    ? "galnac"  :
                                /Fuc/.test(dom)       ? "fuc" :
                                /Man/.test(dom)       ? "man" :
                                /Glc\)/.test(dom)     ? "glc" :
                                /Gal[\.\)]/.test(dom) ? "gal" :
                                /Hex[\.\)]/.test(dom) ? "hex" :
                                /HexNAc/.test(dom)    ? "hexnac" :
                                /Xyl/.test(dom)       ? "xyl" : "?";
            var icon_height = 8;
            if (shape_func == "glcnac(b1-4)glcnac" || shape_func == renderer.small_galnac || shape_func == "xyl" || shape_func == renderer.fuc) {
              icon_height += 8;
            }
            if (/Potential/.test(dom) && (shape_func == "glcnac(b1-4)glcnac")) {
              shape_func += ".potential";
            }

            var els = renderer.getAA(start).addToLayer(target_layer, {"height" : icon_height, "content" : '#'+namespace+'_'+shape_func, "offset" : offset+12, "angle": 0, "bare_element" : true });
            renderer.getAA(start).addToLayer(lay_name, {"height" : 8, "content" : '#'+namespace+'_'+shape_func, "offset" : 12, "bare_element" : true });
          } else {
            var all_box;
            var box;
            if (! domains[dom].name) {
              domains[dom].name = dom;
            }
            var dom_key = (domains[dom].name).replace(/\s/g,'_');
            if (window.DOMAIN_DEFINITIONS && window.DOMAIN_DEFINITIONS[dom_key]) {
                var dats = window.DOMAIN_DEFINITIONS[dom_key];
                var fill = (renderer.gradients.length > 0) ? "url('#grad_"+dats[1]+"')" : dats[1];
                all_box = renderer.getAA(start).addShapeOverlay(target_layer,end-start+1,{ "offset" : offset, "shape" : dats[0], "height" : 12, "fill" : fill, "rotate" : dats[2] || 0 });
                all_box.setAttribute('stroke','#999999');
                all_box.style.strokeWidth = '10px';
                box = renderer.getAA(start).addShapeOverlay(lay_name,end-start+1,{ "shape" : dats[0], "fill" : 'url("#grad_'+dats[1]+'")' });
            } else {
                all_box = renderer.getAA(start).addBoxOverlay(target_layer,end-start+1,1,{"offset" : offset });
                box = renderer.getAA(start).addBoxOverlay(lay_name,end-start+1,1);
            }

            var a_text = renderer.getAA(parseInt(0.5*(start+end))).addTextOverlay(target_layer,0,{ "offset" : offset, 'txt' : domains[dom].name });
            a_text.setAttribute('fill','#111111');
            a_text.setAttribute('stroke','#999999');
            renderer.text_els.push([a_text,all_box]);
          }

          done_anno = true;
        });
      });
      renderer.showLayer(target_layer);
      renderer.trigger('resultsRendered');
      renderer.zoom -= 0.0001;

  };

  var write_sync_timeout = null;

  var edit_toggler = function(renderer,read_only) {
      var needs_edit = renderer.navigation.isEditing();

      if ( read_only ) {
        return;
      }
      renderer.trackOrder.forEach(function(track) {
        if (track.match(/^dom\:/)) {
          if (needs_edit) {
            renderer.showLayer(track);
          } else {
            renderer.hideLayer(track);
          }
        }
      });
      renderer.refresh();
  };

  var reset_protein = function(acc) {
    var self = this;
    self.preferences.getPreferences(function(err,prefs) {
      if ( ! prefs || ! prefs.accepted_domains ) {
        return;
      }
      update_accepted_domains(prefs.accepted_domains,function(err,datablock) {
        datablock[acc] = null;
      });
    });
  };



  MASCP.DomainRetriever.prototype.setupSequenceRenderer = function(renderer,options) {
    var self = this;
    setup_editing.call(self,renderer);
    self.bind('resultReceived',function() {
      self.acc = self.agi;
      get_accepted_domains.call(self,self.agi,function(acc,domains) {
          var temp_result = {
            'gotResult' : function() {
              render_domains(renderer,domains,acc,options.track,options.offset,options.icons ? options.icons.namespace : null);

              bean.add(renderer.navigation,'toggleEdit',function() {
                if (edit_toggler.enabled) {
                  edit_toggler(renderer);
                }
              });

              // Not sure why we need this call here
              edit_toggler(renderer,true);

              renderer.trigger('domainsRendered');
            },
            'acc'       : acc
          };
          renderer.trigger('readerRegistered',[temp_result]);
          temp_result.gotResult();
      });
    });
  };


  var setup_editing = function(renderer) {
    var self = this;

    self.preferences.getPreferences(function(err,prefs) {

      renderer.clearDataFor = function(acc) {
      };

      check_accepted_domains_writable(prefs.accepted_domains,function(err,writable) {
        if (writable) {
          renderer.clearDataFor = function(acc) {
            reset_protein.call(self,acc);
          };

          edit_toggler.enabled = true;
          var order_changed_func = function(order) {
            console.log("Order changed");
            if ((order.indexOf((self.acc || "").toUpperCase()) == (order.length - 1) && order.length > 0) || ( order.length == 1 && order[0] == (self.acc.toUpperCase()) ) ) {
              console.log(self.acc);
              renderer.clearDataFor(self.acc);
              return;
            }
            if (renderer.trackOrder.length > 0) {
              console.log("Removed layer");
              update_domains.call(self,renderer,self.acc);
            }
          };
          bean.add(renderer,'sequenceChange',function() {
            bean.remove(renderer,'orderChanged',order_changed_func);
          });
          bean.add(renderer,'orderChanged',order_changed_func);
        }
      });
    });
  };

  var update_domains = function(renderer,acc) {
    var self = this;
    var wanted = {};
    renderer.trackOrder.forEach(function(track) {
      if (track.match(/^dom\:/) && renderer.isLayerActive(track)) {
        wanted[track] = 1;
      }
    });
    var wanted_domains = JSON.stringify(wanted);
    self.preferences.getPreferences(function(err,prefs) {
      if ( ! prefs || ! prefs.accepted_domains ) {
        return;
      }
      update_accepted_domains(prefs.accepted_domains,function(err,datablock) {
        datablock[acc] = wanted_domains;
      });
    });
  };


})();




